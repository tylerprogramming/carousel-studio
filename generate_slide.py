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

FONT_PATH = Path(__file__).parent / 'fonts' / 'Inter-Variable.ttf'

# macOS fallbacks, used only when the vendored Inter is missing. Exports will
# not match the preview in that case.
FALLBACK_FONTS = [
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
]


def load_font(size: int, weight: int = 400) -> ImageFont.FreeTypeFont:
    """Inter at an explicit weight. Inter ships as a variable font, so weight is
    selected on the wght axis rather than by loading a separate file."""
    size = max(8, int(size))
    if FONT_PATH.exists():
        font = ImageFont.truetype(str(FONT_PATH), size)
        try:
            # Axis order is [Optical size, Weight]
            font.set_variation_by_axes([14.0, float(weight)])
        except Exception:
            pass
        return font
    for path in FALLBACK_FONTS:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
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

MONO_FONTS = ['/System/Library/Fonts/Menlo.ttc', '/System/Library/Fonts/Monaco.ttf']

# Anything outside this set renders as a tofu box in a mono face. The server
# already scrubs generated text; this is the last line of defence for hand-typed
# or older saved carousels.
_MONO_OK = re.compile(r'[^\x20-\x7E\u2713\u2192\u2014]')


def mono_safe(text: str) -> str:
    return _MONO_OK.sub('', (text or '').replace('\t', ' ')).rstrip()


def load_mono(size: int) -> ImageFont.FreeTypeFont:
    for p in MONO_FONTS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, max(8, int(size)))
            except Exception:
                continue
    return load_font(size, 400)


def generate_terminal_slide(data):
    """Terminal variant — the export-side twin of TerminalSlide in
    SlidePreview.tsx. Change both together."""
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

    PADX = 84
    img = Image.new('RGB', (WIDTH, HEIGHT), bg)

    # Optional photo behind the terminal chrome. Cover-cropped like the CSS
    # `object-fit: cover` the preview uses, so framing matches the export.
    bg_path = data.get('backgroundImagePath')
    has_photo = bool(bg_path and os.path.exists(bg_path))
    if has_photo:
        try:
            src = Image.open(bg_path).convert('RGB')
            img.paste(cover_crop(src, WIDTH, HEIGHT,
                                 50 + float(data.get('bgPanX', 0) or 0) / 2,
                                 50 + float(data.get('bgPanY', 0) or 0) / 2), (0, 0))
        except Exception:
            pass

    # Bottom fade: a vertical ramp to the slide's own background colour, so the
    # photo dissolves into the slide instead of stopping at a hard edge. Value
    # is the fraction of slide height the ramp covers.
    fade = float(data.get('bottomFade', 0) or 0)
    if fade > 0:
        fade_h = max(1, min(HEIGHT, round(HEIGHT * fade)))
        ramp = Image.new('L', (1, fade_h))
        # Squared falloff — a linear ramp reads as a visible band, this does not
        ramp.putdata([int(255 * (i / max(1, fade_h - 1)) ** 2) for i in range(fade_h)])
        img.paste(Image.new('RGB', (WIDTH, fade_h), bg), (0, HEIGHT - fade_h),
                  ramp.resize((WIDTH, fade_h)))

    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, WIDTH, 8], fill=ac)

    # Rail shows the bare username, footer shows it with the @ — both come from
    # settings.json via the server, so nothing personal is baked into the app.
    handle = str(data.get('handle') or '@yourhandle').strip()
    if not handle.startswith('@'):
        handle = '@' + handle

    rail = load_mono(26)
    d.text((PADX, 74), handle[1:], font=rail, fill=dim)
    right = 'v1.0' if stype == 'cover' else f'{slide_num:02d} / {total:02d}'
    d.text((WIDTH - PADX, 74), right, font=rail, fill=dim, anchor='rt')

    y = 200
    step = data.get('stepNumber')
    if step is not None and stype == 'content':
        f_step = load_font(fs(48), 900)
        tw = d.textbbox((0, 0), str(step), font=f_step)[2]
        d.rounded_rectangle([PADX, y, PADX + tw + 48, y + fs(48) + 28], radius=8, fill=ac)
        d.text((PADX + 24, y + 14), str(step), font=f_step, fill=bg)
        y += fs(48) + 28 + 28

    headline = (data.get('headline') or '').strip()
    if headline:
        size = fs(118 if stype == 'cover' else 108)
        f_h = load_font(size, 800)
        for ln in wrap_text(d, headline, f_h, WIDTH - PADX * 2):
            d.text((PADX, y), ln, font=f_h, fill=fg)
            y += round(size * 1.06)
        y += 20

    emphasis = (data.get('emphasisLine') or '').strip()
    if emphasis:
        if stype == 'cover':
            # One pill per wrapped line, mirroring box-decoration-break: clone
            f_e = load_font(fs(44), 700)
            avail = WIDTH - PADX * 2 - 40
            for line in wrap_text(d, emphasis, f_e, avail):
                tw = d.textbbox((0, 0), line, font=f_e)[2]
                d.rounded_rectangle([PADX, y, PADX + tw + 36, y + fs(44) + 20], radius=8, fill=ac)
                d.text((PADX + 18, y + 10), line, font=f_e, fill=bg)
                y += fs(44) + 30
        else:
            f_e = load_font(fs(44), 600)
            d.text((PADX, y), emphasis, font=f_e, fill=ac)

    lines = data.get('terminalLines') or []
    if lines:
        win_top = 700
        f_line = load_mono(fs(29))
        line_h = round(fs(29) * 1.9)
        win_h = 62 + 26 * 2 + line_h * len(lines)
        d.rounded_rectangle([PADX, win_top, WIDTH - PADX, win_top + win_h], radius=16, fill=(11, 13, 18))
        d.rounded_rectangle([PADX, win_top, WIDTH - PADX, win_top + 62], radius=16, fill=(35, 39, 47))
        d.rectangle([PADX, win_top + 40, WIDTH - PADX, win_top + 62], fill=(35, 39, 47))
        for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
            cx = PADX + 24 + i * 25
            d.ellipse([cx, win_top + 23, cx + 15, win_top + 38], fill=c)
        d.text((PADX + 24 + 3 * 25 + 20, win_top + 18), mono_safe(data.get('terminalTitle')) or 'claude',
               font=load_mono(24), fill=dim)
        ly = win_top + 62 + 26
        for ln in [mono_safe(l) for l in lines]:
            col = fg if ln.startswith('$') else ((110, 220, 140) if ln.lstrip().startswith('✓') else dim)
            d.text((PADX + 30, ly), ln, font=f_line, fill=col)
            ly += line_h
    elif (data.get('bodyText') or '').strip():
        f_b = load_mono(fs(32))
        # With a photo behind, 720 lands the copy on the brightest part of the
        # frame. Drop it into the faded zone above the footer instead.
        n_lines = len(wrap_text(d, data['bodyText'].strip(), f_b, WIDTH - PADX * 2))
        by = (HEIGHT - 150 - n_lines * round(fs(32) * 1.65)) if has_photo else 720
        for ln in wrap_text(d, data['bodyText'].strip(), f_b, WIDTH - PADX * 2):
            d.text((PADX, by), ln, font=f_b, fill=dim)
            by += round(fs(32) * 1.65)

    foot = load_mono(26)
    d.text((PADX, HEIGHT - 64), handle, font=foot, fill=dim)
    if slide_num < total:
        d.text((WIDTH - PADX, HEIGHT - 64), 'swipe →', font=foot, fill=ac, anchor='rt')

    Path(out).parent.mkdir(parents=True, exist_ok=True)
    img.save(out, 'PNG')
    return out


def generate_slide(data):
    if data.get('variant') == 'terminal':
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
    inset_media = load_media(data.get('insetImagePath'), None)
    if not inset_media and data.get('insetImagePath', '').endswith(('.mp4', '.webm')):
        inset_media = video_first_frame(data['insetImagePath'])

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
