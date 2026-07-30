#!/usr/bin/env python3
"""PIL-based carousel slide renderer.

This is the export-side twin of client/src/components/SlidePreview.tsx. The two
must stay in lockstep: whatever the user sees in the app is what gets posted, so
every geometry constant, font size, weight, and colour rule here mirrors that
component. If you change one, change the other.
"""
import json
import os
import re
from functools import lru_cache
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ── Canvas ────────────────────────────────────────────────────────────────────
WIDTH = 1080
HEIGHT = 1350
PAD = 80          # SlidePreview: PAD = s(80)
FOOTER_PAD = 90   # SlidePreview: footer row paddingLeft/Right

# ── Tall canvas ───────────────────────────────────────────────────────────────
# TikTok is 1080x1920. tiktok_safe.py fits a finished 4:5 slide inside that
# frame, which leaves roughly 44% of it as flat padding — that is arithmetic,
# not a margin anyone can tune away. The `tall` variant draws the terminal
# design at 1080x1920 instead, so the post is native rather than adapted.
TALL_WIDTH = 1080
TALL_HEIGHT = 1920

# TikTok's own UI, in the frame's coordinates — the same measurements
# tiktok_safe.py documents. They are keep-out zones, not padding: the
# background still fills the whole frame, nothing readable sits under them.
TALL_SAFE_TOP = 130       # status bar, and the Following / For You tabs
TALL_SAFE_RIGHT = 150     # like / comment / share / sound rail
TALL_SAFE_BOTTOM = 340    # caption block, username, bottom nav

FONTS_DIR = Path(__file__).parent / 'fonts'
FONT_PATH = FONTS_DIR / 'Inter-Variable.ttf'

# macOS fallbacks, used only when the vendored Inter is missing. Exports will
# not match the preview in that case.
FALLBACK_FONTS = [
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
]


def resolve_font(configured: str, default: Path) -> Path:
    """A configured typeface, or the vendored one.

    A bare name means a file in fonts/, which is the normal case — drop a .ttf
    in there and name it. An absolute path or a ~ path is taken as given. A
    configured font that does not exist falls back rather than failing: a typo
    in settings.json should not stop you rendering.
    """
    if configured:
        p = Path(configured).expanduser()
        if not p.is_absolute():
            p = FONTS_DIR / configured
        if p.exists():
            return p
    return default


@lru_cache(maxsize=None)
def variation_plan(font_file: str):
    """Where the weight axis is in this font, and what the other axes default to.

    Returns (weight_axis_index, defaults) — or (None, ()) for a static font,
    which is most of them.

    The axes are found by name rather than by position. The old code set
    `[14.0, float(weight)]`, which is correct for Inter and wrong for anything
    else: a font whose axes come in a different order would have had its weight
    written into whichever axis happened to be second. That was invisible while
    one font was vendored and is the first thing a custom font would hit.

    Every other axis keeps its default, which is what holds Inter's optical size
    at 14 for every size — matching `font-optical-sizing: none` in the preview.
    """
    try:
        axes = ImageFont.truetype(font_file, 16).get_variation_axes()
    except Exception:
        return (None, ())          # static font, or unreadable
    defaults, weight_at = [], None
    for i, axis in enumerate(axes):
        defaults.append(axis.get('default', 0))
        name = axis.get('name', b'')
        if isinstance(name, bytes):
            name = name.decode('utf-8', 'ignore')
        if str(name).strip().lower() == 'weight':
            weight_at = i
    return (weight_at, tuple(defaults))


# The typefaces this render is using. Set once per slide from the payload
# rather than threaded through the twenty-odd load_font calls in the layout
# code, which would bury the design under plumbing. Every render is its own
# process, so this is set once and never contended; the caches are cleared when
# it changes so a stale face can never be served under a new setting.
_ACTIVE_FONT = ''
_ACTIVE_MONO = ''


def set_fonts(font_path: str = '', mono_path: str = '') -> None:
    global _ACTIVE_FONT, _ACTIVE_MONO
    if (font_path or '') == _ACTIVE_FONT and (mono_path or '') == _ACTIVE_MONO:
        return
    _ACTIVE_FONT, _ACTIVE_MONO = font_path or '', mono_path or ''
    load_font.cache_clear()
    load_mono.cache_clear()


@lru_cache(maxsize=None)
def load_font(size: int, weight: int = 400, font_path: str = '') -> ImageFont.FreeTypeFont:
    """The body typeface at an explicit weight.

    A variable font carries weight on an axis, so one file covers the range. A
    static font has no axis and is drawn as it is — the design still asks for
    800 in places, and with a single-weight face those simply come out at that
    face's weight rather than failing.
    """
    size = max(8, int(size))
    path = resolve_font(font_path or _ACTIVE_FONT, FONT_PATH)
    if path.exists():
        font = ImageFont.truetype(str(path), size)
        weight_at, defaults = variation_plan(str(path))
        if weight_at is not None:
            axes = list(defaults)
            axes[weight_at] = float(weight)
            try:
                font.set_variation_by_axes(axes)
            except Exception:
                pass
        return font
    for p in FALLBACK_FONTS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


# ── Colour helpers ────────────────────────────────────────────────────────────

def hex_to_rgb(h: str):
    h = (h or '#000000').lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    try:
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return (0, 0, 0)


def luminance(rgb):
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def blend(fg, bg, factor):
    """SlidePreview's blend(): mix fg over bg by factor."""
    return tuple(int(fg[i] * factor + bg[i] * (1 - factor)) for i in range(3))


# ── Text layout ───────────────────────────────────────────────────────────────
# CSS places glyphs in a line box of height `lineHeight * fontSize`, centring the
# em box within it (half-leading). PIL draws from a baseline, so we reproduce the
# CSS model explicitly rather than stacking bounding boxes.

def text_width(draw, text, font, tracking=0.0):
    if not text:
        return 0
    w = draw.textbbox((0, 0), text, font=font)[2]
    return w + tracking * len(text)


def draw_tracked(draw, xy, text, font, fill, tracking=0.0, anchor='ls'):
    """Draw text with CSS-style letter-spacing. PIL has no tracking, so wide
    tracking is drawn glyph by glyph."""
    x, y = xy
    if not tracking:
        draw.text((x, y), text, font=font, fill=fill, anchor=anchor)
        return
    if anchor.startswith('r'):
        x -= text_width(draw, text, font, tracking)
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill, anchor='ls' if anchor.endswith('s') else 'lt')
        x += draw.textbbox((0, 0), ch, font=font)[2] + tracking


def wrap_text(draw, text, font, max_width, tracking=0.0):
    if not text:
        return []
    lines, cur = [], []
    for word in text.split():
        test = ' '.join(cur + [word])
        if text_width(draw, test, font, tracking) <= max_width or not cur:
            cur.append(word)
        else:
            lines.append(' '.join(cur))
            cur = [word]
    if cur:
        lines.append(' '.join(cur))
    return lines


class TextBlock:
    """One run of wrapped text laid out on the CSS line-box model."""

    def __init__(self, draw, text, size, weight, line_height, color,
                 max_width, upper=False, tracking=0.0):
        self.font = load_font(size, weight)
        self.size = size
        self.color = color
        self.tracking = tracking
        content = (text or '').strip()
        if upper:
            content = content.upper()
        self.lines = wrap_text(draw, content, self.font, max_width, tracking)
        self.line_step = round(size * line_height)
        ascent, descent = self.font.getmetrics()
        # Half-leading: the gap CSS distributes above and below the em box
        self.baseline_offset = (self.line_step - (ascent + descent)) / 2 + ascent

    @property
    def height(self):
        return self.line_step * len(self.lines)

    def render(self, draw, x, y_top):
        for i, line in enumerate(self.lines):
            baseline = y_top + i * self.line_step + self.baseline_offset
            draw_tracked(draw, (x, baseline), line, self.font, self.color,
                         self.tracking, anchor='ls')
        return y_top + self.height


# ── Media helpers ─────────────────────────────────────────────────────────────

def video_first_frame(path):
    """Preview auto-plays background/inset video; the export uses frame one."""
    try:
        tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        tmp.close()
        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-frames:v', '1', tmp.name],
            check=True, capture_output=True, timeout=30,
        )
        img = Image.open(tmp.name).convert('RGB')
        os.unlink(tmp.name)
        return img
    except Exception:
        return None


def load_media(image_path, video_path):
    if image_path and os.path.exists(image_path):
        return Image.open(image_path).convert('RGB')
    if video_path and os.path.exists(video_path):
        return video_first_frame(video_path)
    return None


def cover_crop(img, box_w, box_h, pos_x_pct=50.0, pos_y_pct=50.0):
    """CSS object-fit: cover + object-position.

    The old renderer used resize(), which squashed any image whose aspect ratio
    differed from 4:5. This scales to cover and crops instead, so exports keep
    the same framing the preview shows.
    """
    src_w, src_h = img.size
    if src_w == 0 or src_h == 0:
        return Image.new('RGB', (box_w, box_h), (0, 0, 0))
    scale = max(box_w / src_w, box_h / src_h)
    new_w, new_h = max(1, round(src_w * scale)), max(1, round(src_h * scale))
    scaled = img.resize((new_w, new_h), Image.LANCZOS)
    off_x = round((new_w - box_w) * (pos_x_pct / 100.0))
    off_y = round((new_h - box_h) * (pos_y_pct / 100.0))
    off_x = max(0, min(off_x, new_w - box_w))
    off_y = max(0, min(off_y, new_h - box_h))
    return scaled.crop((off_x, off_y, off_x + box_w, off_y + box_h))


def zoom_crop(img, box_w, box_h, zoom, pan_x, pan_y):
    """Inset media at zoom > 1: SlidePreview applies scale() + translate()."""
    base = cover_crop(img, box_w, box_h, 50.0, 50.0)
    if zoom <= 1.0:
        return base
    zw, zh = round(box_w * zoom), round(box_h * zoom)
    zoomed = base.resize((zw, zh), Image.LANCZOS)
    cx, cy = zw / 2, zh / 2
    # translate(panX/2 %, panY/2 %) of the element's own size
    cx -= (pan_x / 2 / 100.0) * zw
    cy -= (pan_y / 2 / 100.0) * zh
    left = max(0, min(round(cx - box_w / 2), zw - box_w))
    top = max(0, min(round(cy - box_h / 2), zh - box_h))
    return zoomed.crop((left, top, left + box_w, top + box_h))


# ── Renderer ──────────────────────────────────────────────────────────────────

# The terminal variant's whole identity is that it looks like a terminal, so
# the mono face is not optional. These two are macOS system paths and this list
# used to end there — on any other OS load_mono() fell through to load_font(),
# which is Inter, which is proportional. The terminal window rendered in a sans
# face while the preview's CSS `monospace` keyword still resolved to a real
# mono, so the preview and the export disagreed on every non-Mac machine.
#
# CI on Linux found that on its first run. JetBrains Mono is vendored as the
# floor so the list can never run out.
#
# Menlo stays first deliberately: existing decks keep rendering exactly as they
# always have on macOS. The order here is mirrored by MONO in SlidePreview.tsx.
MONO_FONTS = [
    '/System/Library/Fonts/Menlo.ttc',
    '/System/Library/Fonts/Monaco.ttf',
    str(Path(__file__).parent / 'fonts' / 'JetBrainsMono-Regular.ttf'),
]

# Anything outside this set renders as a tofu box in a mono face. The server
# already scrubs generated text; this is the last line of defence for hand-typed
# or older saved carousels.
_MONO_OK = re.compile(r'[^\x20-\x7E\u2713\u2192\u2014]')


def mono_safe(text: str) -> str:
    return _MONO_OK.sub('', (text or '').replace('\t', ' ')).rstrip()


@lru_cache(maxsize=None)
def load_mono(size: int) -> ImageFont.FreeTypeFont:
    # A configured mono face wins over the system ones. Without it the search
    # runs Menlo, Monaco, then the vendored JetBrains Mono — see MONO_FONTS.
    if _ACTIVE_MONO:
        p = resolve_font(_ACTIVE_MONO, Path(MONO_FONTS[-1]))
        if p.exists():
            try:
                return ImageFont.truetype(str(p), max(8, int(size)))
            except Exception:
                pass
    for p in MONO_FONTS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, max(8, int(size)))
            except Exception:
                continue
    return load_font(size, 400)


def terminal_geometry(tall: bool) -> dict:
    """Every number that differs between the 4:5 terminal slide and its 9:16
    twin, in one table.

    generate_terminal_slide walks it, check_slides.py imports it, and
    SlidePreview.tsx keeps a copy as GEOMETRY. One table rather than three sets
    of literals, because the twin contract is only as good as the number of
    places a constant has to be edited by hand.

    `floor` is the bottom of the usable frame. On a 4:5 slide that is the
    canvas bottom; on a tall slide it is the top of TikTok's caption block.
    Everything anchored to the bottom hangs off it, so the same offsets that
    place the footer and the terminal window at 4:5 place them at 9:16.
    """
    if tall:
        return {
            'width': TALL_WIDTH,
            'height': TALL_HEIGHT,
            'padx': 84,
            # Stop short of the action rail instead of running under it
            'right': TALL_WIDTH - TALL_SAFE_RIGHT,
            'rail_y': 160,     # below the status bar and the tab chrome
            'top': 300,        # the headline gets the top third to itself
            'win_top': 900,
            'win_gap': 56,     # minimum air between the text above and the window
            'body_top': 980,
            'floor': TALL_HEIGHT - TALL_SAFE_BOTTOM,
        }
    return {
        'width': WIDTH,
        'height': HEIGHT,
        'padx': 84,
        'right': WIDTH - 84,
        'rail_y': 74,
        'top': 200,
        'win_top': 700,
        'win_gap': 40,
        'body_top': 720,
        'floor': HEIGHT,
    }


def generate_terminal_slide(data):
    """Terminal variant — the export-side twin of TerminalSlide in
    SlidePreview.tsx. Change both together.

    Draws `terminal` at 1080x1350 and `tall` at 1080x1920. Same design, two
    canvases: the difference is entirely in terminal_geometry() above."""
    bg = hex_to_rgb(data.get('bgColor') or '#12141A')
    fg = hex_to_rgb(data.get('textColor') or '#EEECE8')
    ac = hex_to_rgb(data.get('accentColor') or '#E07355')
    dim = blend(fg, bg, 0.45)
    slide_num = int(data.get('slideNumber', 1))
    total = int(data.get('totalSlides', 7))
    stype = data.get('type', 'content')
    scale = float(data.get('textScale', 1.0) or 1.0)
    out = data.get('output', '/tmp/slide.png')

    def fs(px):
        return max(8, round(px * scale))

    g = terminal_geometry(data.get('variant') == 'tall')
    W, H = g['width'], g['height']
    PADX = g['padx']
    RIGHT = g['right']          # right edge of the content column
    AVAIL = RIGHT - PADX        # width text and the terminal window get
    FLOOR = g['floor']          # bottom of the usable frame
    # `transparent` renders the slide furniture only, on alpha, so ffmpeg can
    # composite it over moving footage. The photo is skipped: the video is the
    # background in that mode.
    transparent = bool(data.get('transparent'))
    img = (Image.new('RGBA', (W, H), (0, 0, 0, 0)) if transparent
           else Image.new('RGB', (W, H), bg))

    # Optional photo behind the terminal chrome. Cover-cropped like the CSS
    # `object-fit: cover` the preview uses, so framing matches the export.
    # video_first_frame returns an Image, not a path, so resolve to an Image
    # here rather than mixing the two.
    src = None
    if not transparent:
        try:
            vid_path = data.get('backgroundVideoPath')
            bg_path = data.get('backgroundImagePath')
            if vid_path and os.path.exists(vid_path):
                # The still export of a moving slide is its first frame
                src = video_first_frame(vid_path)
            if src is None and bg_path and os.path.exists(bg_path):
                src = Image.open(bg_path)
            if src is not None:
                src = src.convert('RGB')
        except Exception:
            src = None
    has_photo = src is not None
    if has_photo:
        img.paste(cover_crop(src, W, H,
                             50 + float(data.get('bgPanX', 0) or 0) / 2,
                             50 + float(data.get('bgPanY', 0) or 0) / 2), (0, 0))

    # Bottom fade: a vertical ramp to the slide's own background colour, so the
    # photo dissolves into the slide instead of stopping at a hard edge. Value
    # is the fraction of slide height the ramp covers.
    fade = float(data.get('bottomFade', 0) or 0)
    if fade > 0:
        fade_h = max(1, min(H, round(H * fade)))
        ramp = Image.new('L', (1, fade_h))
        # Squared falloff — a linear ramp reads as a visible band, this does not
        ramp.putdata([int(255 * (i / max(1, fade_h - 1)) ** 2) for i in range(fade_h)])
        mask = ramp.resize((W, fade_h))
        if transparent:
            band = Image.new('RGBA', (W, fade_h), (*bg, 255))
            band.putalpha(mask)
            img.alpha_composite(band, (0, H - fade_h))
        else:
            img.paste(Image.new('RGB', (W, fade_h), bg), (0, H - fade_h), mask)

    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, W, 8], fill=ac)

    # Rail shows the bare username, footer shows it with the @ — both come from
    # settings.json via the server, so nothing personal is baked into the app.
    handle = str(data.get('handle') or '@yourhandle').strip()
    if not handle.startswith('@'):
        handle = '@' + handle

    rail = load_mono(26)
    d.text((PADX, g['rail_y']), handle[1:], font=rail, fill=dim)
    right = 'v1.0' if stype == 'cover' else f'{slide_num:02d} / {total:02d}'
    d.text((RIGHT, g['rail_y']), right, font=rail, fill=dim, anchor='rt')

    y = g['top']
    step = data.get('stepNumber')
    if step is not None and stype == 'content':
        f_step = load_font(fs(48), 900)
        tw = d.textbbox((0, 0), str(step), font=f_step)[2]
        d.rectangle([PADX, y, PADX + tw + 48, y + fs(48) + 28], fill=ac)
        d.text((PADX + 24, y + 14), str(step), font=f_step, fill=bg)
        y += fs(48) + 28 + 28

    headline = (data.get('headline') or '').strip()
    if headline:
        size = fs(118 if stype == 'cover' else 108)
        f_h = load_font(size, 800)
        for ln in wrap_text(d, headline, f_h, AVAIL):
            d.text((PADX, y), ln, font=f_h, fill=fg)
            y += round(size * 1.06)
        y += 20

    emphasis = (data.get('emphasisLine') or '').strip()
    if emphasis:
        if stype == 'cover':
            # One pill per wrapped line, mirroring box-decoration-break: clone
            f_e = load_font(fs(50), 700)
            avail = AVAIL - 40
            pill_h = fs(50) + 20
            for line in wrap_text(d, emphasis, f_e, avail):
                tw = d.textbbox((0, 0), line, font=f_e)[2]
                # Square corners, and advance by exactly the pill height so
                # stacked lines read as one continuous highlight
                d.rectangle([PADX, y, PADX + tw + 36, y + pill_h], fill=ac)
                d.text((PADX + 18, y + 10), line, font=f_e, fill=bg)
                y += pill_h
        else:
            f_e = load_font(fs(44), 600)
            d.text((PADX, y), emphasis, font=f_e, fill=ac)

    lines = data.get('terminalLines') or []
    if lines:
        f_line = load_mono(fs(29))
        line_h = round(fs(29) * 1.9)
        # Terminal lines wrap, matching whiteSpace: pre-wrap in SlidePreview.
        # Without this a long line was simply cut off at the window edge, which
        # only showed up once the type got bigger.
        avail_w = AVAIL - 60
        wrapped = []
        for raw in [mono_safe(l) for l in lines]:
            pieces = wrap_text(d, raw, f_line, avail_w) or ['']
            # Continuation lines are indented so a wrapped command still reads
            # as one command rather than a new line of output.
            wrapped.append((pieces[0], raw))
            for extra in pieces[1:]:
                wrapped.append(('  ' + extra, raw))
        win_h = 62 + 26 * 2 + line_h * len(wrapped)
        # Wrapping makes the window taller, and at its preferred top it grew
        # straight through the footer. Lift it so it always clears, with a
        # floor so it cannot ride up into the headline.
        # Floor is where the text above actually ended, not a fixed number:
        # at a larger textScale the headline and emphasis take more room, and a
        # magic floor let the window ride up over them.
        FOOTER_TOP = FLOOR - 130
        win_top = max(y + g['win_gap'], min(g['win_top'], FOOTER_TOP - win_h))
        d.rounded_rectangle([PADX, win_top, RIGHT, win_top + win_h], radius=16, fill=(11, 13, 18))
        d.rounded_rectangle([PADX, win_top, RIGHT, win_top + 62], radius=16, fill=(35, 39, 47))
        d.rectangle([PADX, win_top + 40, RIGHT, win_top + 62], fill=(35, 39, 47))
        for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
            cx = PADX + 24 + i * 25
            d.ellipse([cx, win_top + 23, cx + 15, win_top + 38], fill=c)
        d.text((PADX + 24 + 3 * 25 + 20, win_top + 18), mono_safe(data.get('terminalTitle')) or 'claude',
               font=load_mono(24), fill=dim)
        ly = win_top + 62 + 26
        for text, source in wrapped:
            # Colour follows the original line, so a wrapped command stays white
            col = fg if source[:1] in ('$', '>') else ((110, 220, 140) if source.lstrip().startswith('✓') else dim)
            d.text((PADX + 30, ly), text, font=f_line, fill=col)
            ly += line_h
    if (data.get('bodyText') or '').strip():
        body_font = load_mono(fs(32))
        body_lines = wrap_text(d, data['bodyText'].strip(), body_font, AVAIL)
        n_lines = len(body_lines)
        line_adv = round(fs(32) * 1.65)
        if lines:
            # Body sits under the terminal window rather than being dropped.
            # A short block leaves most of the slide empty otherwise.
            by = win_top + win_h + 46
        elif has_photo:
            # At its usual top the copy lands on the brightest part of the
            # photo. Drop it into the faded zone above the footer instead.
            by = FLOOR - 150 - n_lines * line_adv
        else:
            by = g['body_top']
        body_fill = hex_to_rgb(data['bodyTextColor']) if data.get('bodyTextColor') else fg
        for ln in body_lines:
            d.text((PADX, by), ln, font=body_font, fill=body_fill)
            by += line_adv

    foot = load_mono(26)
    d.text((PADX, FLOOR - 64), handle, font=foot, fill=dim)
    if slide_num < total:
        d.text((RIGHT, FLOOR - 64), 'swipe →', font=foot, fill=ac, anchor='rt')

    Path(out).parent.mkdir(parents=True, exist_ok=True)
    img.save(out, 'PNG')
    return out


def generate_slide(data):
    # Before anything measures or draws. Both variants come through here, so
    # this is the single place the typeface is decided for a render.
    set_fonts(data.get('fontPath'), data.get('monoFontPath'))
    # Both terminal variants are the same drawing at two canvas sizes
    if data.get('variant') in ('terminal', 'tall'):
        return generate_terminal_slide(data)
    bg_rgb = hex_to_rgb(data.get('bgColor', '#F5F0EB'))
    text_rgb = hex_to_rgb(data.get('textColor', '#1B1B1B'))
    accent_rgb = hex_to_rgb(data.get('accentColor', '#E07355'))

    headline = data.get('headline', '') or ''
    emphasis = data.get('emphasisLine', '') or ''
    body = data.get('bodyText', '') or ''
    slide_num = int(data.get('slideNumber', 1))
    total = int(data.get('totalSlides', 7))
    slide_type = data.get('type', 'content')
    text_scale = float(data.get('textScale', 1.0) or 1.0)
    output_path = data.get('output', '/tmp/slide.png')

    def fs(px):
        """Font sizes scale with textScale; layout constants do not — same split
        as SlidePreview's s() vs sf()."""
        return max(8, round(px * text_scale))

    bg_media = load_media(data.get('backgroundImagePath'), data.get('backgroundVideoPath'))
    has_bg_media = bg_media is not None

    # ── Background ────────────────────────────────────────────────────────────
    if has_bg_media:
        img = cover_crop(
            bg_media, WIDTH, HEIGHT,
            50 + float(data.get('bgPanX', 0) or 0) / 2,
            50 + float(data.get('bgPanY', 0) or 0) / 2,
        )
        overlay_color = data.get('overlayColor') or '#000000'
        overlay_opacity = float(data.get('overlayOpacity', 0.45) or 0)
        ov_rgb = (255, 255, 255) if overlay_color.lower() == '#ffffff' else (0, 0, 0)
        img = Image.alpha_composite(
            img.convert('RGBA'),
            Image.new('RGBA', (WIDTH, HEIGHT), (*ov_rgb, int(255 * overlay_opacity))),
        ).convert('RGB')
    else:
        img = Image.new('RGB', (WIDTH, HEIGHT), bg_rgb)

    # Text and chrome go on an RGBA layer so semi-transparent fills composite
    # correctly over whatever background is underneath.
    layer = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    measure = ImageDraw.Draw(img)

    # ── Inset media panel ─────────────────────────────────────────────────────
    inset_path = data.get('insetImagePath') or ''
    inset_is_video = inset_path.lower().endswith(('.mp4', '.webm', '.mov'))
    inset_media = (load_media(None, inset_path) if inset_is_video
                   else load_media(inset_path, None))

    inset_pos = data.get('insetPosition') or 'bottom'
    inset_h = 0
    inset_top = 0
    if inset_media is not None:
        inset_h = round(HEIGHT * float(data.get('insetHeightPct', 38) or 38) / 100)
        vo = int(data.get('insetVerticalOffset', 0) or 0)
        if inset_pos == 'bottom':
            inset_top = HEIGHT - (78 + vo) - inset_h
        else:
            inset_top = 60 + vo

        inset_pad = int(data.get('insetPadding', 0) or 0)
        inset_w = WIDTH - inset_pad * 2
        border_w = int(data.get('insetBorderWidth', 4) or 0)
        border_rgb = hex_to_rgb(data.get('insetBorderColor') or '#FFFFFF')

        media = zoom_crop(
            inset_media,
            max(1, inset_w - border_w * 2), max(1, inset_h - border_w * 2),
            max(0.5, float(data.get('insetZoom', 1) or 1)),
            float(data.get('insetPanX', 0) or 0),
            float(data.get('insetPanY', 0) or 0),
        )
        if border_w > 0:
            frame = Image.new('RGB', (inset_w, inset_h), border_rgb)
            frame.paste(media, (border_w, border_w))
        else:
            frame = media
        img.paste(frame, (inset_pad, inset_top))

    # Content box shrinks to make room for the inset, exactly as in the preview
    if inset_h and inset_pos == 'bottom':
        content_bottom = (HEIGHT - inset_top) + 16
    else:
        content_bottom = 18
    if inset_h and inset_pos == 'top':
        content_top = inset_top + inset_h + 16
    else:
        content_top = 130

    # ── Chrome: corner accent, counter, footer, bottom bar ────────────────────
    draw.rectangle([(0, 0), (14, 88)], fill=(*accent_rgb, 255))
    draw.rectangle([(0, 0), (88, 14)], fill=(*accent_rgb, 255))
    draw.rectangle([(0, HEIGHT - 18), (WIDTH, HEIGHT)], fill=(*accent_rgb, 255))

    # Counter, top-right
    if has_bg_media:
        counter_fill = (255, 255, 255, int(255 * 0.5))
    elif luminance(bg_rgb) < 128:
        counter_fill = (255, 255, 255, int(255 * 0.35))
    else:
        counter_fill = (0, 0, 0, int(255 * 0.28))
    f_counter = load_font(fs(28), 500)
    c_ascent, c_descent = f_counter.getmetrics()
    counter_step = round(fs(28) * 1.2)
    counter_baseline = 48 + (counter_step - (c_ascent + c_descent)) / 2 + c_ascent
    draw_tracked(draw, (WIDTH - PAD, counter_baseline), f'{slide_num} / {total}',
                 f_counter, counter_fill, tracking=fs(28) * 0.04, anchor='rs')

    # Footer row — hidden on the final slide, same as the preview
    if slide_num < total:
        footer_rgb = hex_to_rgb(data.get('footerColor') or '#FFFFFF')
        footer_fill = (*footer_rgb, int(255 * 0.88))
        icon_fill = (*footer_rgb, int(255 * 0.75))
        f_footer = load_font(fs(26), 600)
        f_swipe = load_font(fs(26), 700)
        row_top = HEIGHT - 26 - 44
        row_mid = row_top + 22

        icon_w, icon_h = round(fs(18)), round(fs(24))
        ix, iy = FOOTER_PAD, row_mid - icon_h // 2
        draw.polygon(
            [(ix, iy), (ix + icon_w, iy), (ix + icon_w, iy + icon_h),
             (ix + icon_w // 2, iy + icon_h - round(icon_h / 3)), (ix, iy + icon_h)],
            fill=icon_fill,
        )
        a, d = f_footer.getmetrics()
        label_baseline = row_mid + (a - d) / 2
        draw_tracked(draw, (ix + icon_w + fs(8), label_baseline), 'SAVE FOR LATER',
                     f_footer, footer_fill, tracking=fs(26) * 0.06, anchor='ls')
        draw_tracked(draw, (WIDTH - FOOTER_PAD, label_baseline), 'SWIPE >',
                     f_swipe, footer_fill, tracking=fs(26) * 0.1, anchor='rs')

    # ── Body text colour ──────────────────────────────────────────────────────
    if data.get('bodyTextColor'):
        body_rgb = hex_to_rgb(data['bodyTextColor'])
    elif has_bg_media:
        white_overlay = (data.get('overlayColor') or '').lower() == '#ffffff'
        body_rgb = (0, 0, 0) if white_overlay else (255, 255, 255)
    else:
        body_rgb = blend(text_rgb, bg_rgb, 0.68)
    body_alpha = 255
    if not data.get('bodyTextColor') and has_bg_media:
        body_alpha = int(255 * (0.7 if (data.get('overlayColor') or '').lower() == '#ffffff' else 0.75))

    max_w = WIDTH - PAD * 2

    # ── Content by slide type ─────────────────────────────────────────────────
    if slide_type in ('cover', 'cta'):
        # Preview: absolutely positioned box, flex column, centred, gap 20
        is_cta = slide_type == 'cta'
        blocks = []
        if headline.strip():
            blocks.append(TextBlock(
                measure, headline, fs(72), 900, 1.1,
                (*(accent_rgb if is_cta else text_rgb), 255), max_w,
                upper=True, tracking=-fs(72) * 0.01,
            ))
        if emphasis.strip():
            blocks.append(TextBlock(
                measure, emphasis, fs(52), 700, 1.2,
                (*(text_rgb if is_cta else accent_rgb), 255), max_w,
            ))
        if body.strip():
            blocks.append(TextBlock(measure, body, fs(38), 400, 1.5,
                                    (*body_rgb, body_alpha), max_w))

        gap = 20
        total_h = sum(b.height for b in blocks) + gap * max(0, len(blocks) - 1)
        container_h = HEIGHT - content_bottom
        y = (container_h - total_h) // 2
        for b in blocks:
            y = b.render(draw, PAD, y) + gap

    else:
        y = content_top
        step = data.get('stepNumber')
        if step is not None:
            step_block = TextBlock(measure, f'{step}.', fs(130), 900, 1.0,
                                   (*accent_rgb, 255), max_w)
            y = step_block.render(draw, PAD, y) + 28
        if headline.strip():
            hb = TextBlock(measure, headline, fs(70), 900, 1.1, (*text_rgb, 255),
                           max_w, upper=True)
            y = hb.render(draw, PAD, y) + 16
        if emphasis.strip():
            eb = TextBlock(measure, emphasis, fs(50), 700, 1.25, (*accent_rgb, 255), max_w)
            y = eb.render(draw, PAD, y) + 16
        if body.strip():
            bb = TextBlock(measure, body, fs(38), 400, 1.55, (*body_rgb, body_alpha), max_w)
            bb.render(draw, PAD, y)

    out = Image.alpha_composite(img.convert('RGBA'), layer).convert('RGB')
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    out.save(output_path, 'PNG')
    return output_path


def combine_pdf(image_paths: list, output_path: str) -> str:
    """Combine PNGs into one multi-page PDF."""
    images = [Image.open(p).convert('RGB') for p in image_paths]
    if not images:
        raise ValueError('No images to combine')
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    images[0].save(output_path, save_all=True, append_images=images[1:],
                   format='PDF', resolution=150)
    return output_path


if __name__ == '__main__':
    # Mode 1: generate_slide.py '{...slide data...}'            → one PNG
    # Mode 2: generate_slide.py --pdf '["a.png","b.png"]' out.pdf → combined PDF
    if len(sys.argv) >= 2 and sys.argv[1] == '--pdf':
        print(combine_pdf(json.loads(sys.argv[2]), sys.argv[3]))
    else:
        print(generate_slide(json.loads(sys.argv[1])))
