#!/usr/bin/env python3
"""
flash_video.py — Generate 4-7 second TikTok-format (1080x1920) MP4 videos from carousel slides.

Usage: python3 flash_video.py '<json_payload>'

Payload keys:
  style          : "statement" | "video" | "terminal"
  duration       : int (seconds)
  headline       : str
  emphasisLine   : str
  bgColor        : "#RRGGBB"
  textColor      : "#RRGGBB"
  accentColor    : "#RRGGBB"
  backgroundVideo: "/files/clip.mp4"  (optional, for video style)
  backgroundImage: "/files/bg.png"    (optional)
  overlayOpacity : float 0-1
  output         : "/abs/path/to/output.mp4"
  outputDir      : "/abs/path/to/output/dir"
"""

import sys
import json
import os
import subprocess
import tempfile

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print(json.dumps({"error": "Pillow not installed. Run: pip3 install Pillow"}))
    sys.exit(1)

W, H = 1080, 1920

# ── Font loading ──────────────────────────────────────────────────────────────

def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    # Futura first — clean, modern, very readable on social
    candidates = [
        "/System/Library/Fonts/Supplemental/Futura.ttc",
        "/System/Library/Fonts/Supplemental/GillSans.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/SFNSDisplay.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def sanitize(text: str) -> str:
    """Replace unsupported unicode chars with ASCII equivalents."""
    return (text
        .replace("\u2192", "->")   # →
        .replace("\u2190", "<-")   # ←
        .replace("\u2014", " - ")  # —
        .replace("\u2013", "-")    # –
        .replace("\u2022", "*")    # •
        .replace("\u00b7", "*")    # ·
    )


def load_mono_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Menlo.ttc",
        "/Library/Fonts/Courier New.ttf",
        "/System/Library/Fonts/Courier.dfont",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return load_font(size)


# ── Text wrapping ─────────────────────────────────────────────────────────────

def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines = []
    current = ""
    draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    for word in words:
        test = (current + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        w = bbox[2] - bbox[0]
        if w <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines if lines else [text]


def hex_to_rgb(hex_color: str) -> tuple:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


# ── Accent decorations ────────────────────────────────────────────────────────

def draw_corner_accent(draw: ImageDraw.ImageDraw, color: tuple, alpha: int = 255):
    """Top-left L-shaped accent: one vertical rect + one horizontal rect."""
    c = color + (alpha,) if len(color) == 3 else color
    draw.rectangle([40, 40, 54, 128], fill=c)   # vertical: 14×88
    draw.rectangle([40, 40, 128, 54], fill=c)   # horizontal: 88×14


def draw_bottom_bar(draw: ImageDraw.ImageDraw, color: tuple, alpha: int = 255):
    """Full-width bottom accent bar, 18px tall."""
    c = color + (alpha,) if len(color) == 3 else color
    draw.rectangle([0, H - 18, W, H], fill=c)


# ── Statement style ───────────────────────────────────────────────────────────

def render_statement(cfg: dict) -> str:
    """Solid color bg + headline + emphasisLine. Returns path to temp PNG."""
    bg_color   = hex_to_rgb(cfg.get("bgColor", "#F5F0EB"))
    text_color = hex_to_rgb(cfg.get("textColor", "#1B1B1B"))
    accent_rgb = hex_to_rgb(cfg.get("accentColor", "#E07355"))
    headline   = cfg.get("headline", "").upper()
    emphasis   = cfg.get("emphasisLine", "")

    img  = Image.new("RGB", (W, H), bg_color)
    draw = ImageDraw.Draw(img)

    pad    = 80
    max_w  = W - pad * 2
    h_font = load_font(100)
    e_font = load_font(72)

    sub_text = cfg.get("subText", "")
    s_font = load_font(52, bold=False) if sub_text else None

    h_lines = wrap_text(headline, h_font, max_w)
    e_lines = wrap_text(emphasis, e_font, max_w)
    s_lines = wrap_text(sub_text, s_font, max_w) if sub_text and s_font else []

    # Measure total block height
    dummy = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    line_h = lambda f, t: (dummy.textbbox((0, 0), t, font=f)[3] - dummy.textbbox((0, 0), t, font=f)[1])
    h_line_heights = [line_h(h_font, l) for l in h_lines]
    e_line_heights = [line_h(e_font, l) for l in e_lines]
    s_line_heights = [line_h(s_font, l) for l in s_lines] if s_font else []
    sub_block = (32 + sum(s_line_heights) + len(s_lines) * 6) if s_lines else 0
    total_h = sum(h_line_heights) + len(h_lines) * 8 + 40 + sum(e_line_heights) + len(e_lines) * 8 + sub_block

    start_y = (H - total_h) // 2

    y = start_y
    for i, line in enumerate(h_lines):
        draw.text((pad, y), line, font=h_font, fill=text_color)
        y += h_line_heights[i] + 8
    y += 40
    for i, line in enumerate(e_lines):
        draw.text((pad, y), line, font=e_font, fill=accent_rgb)
        y += e_line_heights[i] + 8
    if s_lines and s_font:
        y += 32
        muted = tuple(max(0, c - 60) for c in text_color) if isinstance(text_color, tuple) else (100, 100, 100)
        for i, line in enumerate(s_lines):
            draw.text((pad, y), line, font=s_font, fill=muted)
            y += s_line_heights[i] + 6

    # CTA pill at bottom
    cta_text = cfg.get("ctaText", "")
    if cta_text:
        cta_font = load_font(54)
        cta_lines = wrap_text(cta_text, cta_font, max_w - 40)
        cta_dummy = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        cta_lh = [line_h(cta_font, l) for l in cta_lines]
        cta_block_h = sum(cta_lh) + len(cta_lines) * 8
        pill_pad_x, pill_pad_y = 32, 22
        pill_w = max(
            cta_dummy.textbbox((0,0), l, font=cta_font)[2] for l in cta_lines
        ) + pill_pad_x * 2
        pill_h = cta_block_h + pill_pad_y * 2
        pill_x = pad
        pill_y = H - 160 - pill_h
        draw.rounded_rectangle(
            [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
            radius=16, fill=accent_rgb
        )
        ty = pill_y + pill_pad_y
        for i, line in enumerate(cta_lines):
            draw.text((pill_x + pill_pad_x, ty), line, font=cta_font, fill=(255, 255, 255))
            ty += cta_lh[i] + 8

    draw_corner_accent(draw, accent_rgb)
    draw_bottom_bar(draw, accent_rgb)

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    img.save(tmp.name)
    return tmp.name


# ── Terminal style ────────────────────────────────────────────────────────────

def render_terminal(cfg: dict) -> str:
    """Dark navy terminal with macOS chrome."""
    accent_rgb = hex_to_rgb(cfg.get("accentColor", "#E07355"))
    headline   = cfg.get("headline", "")
    emphasis   = cfg.get("emphasisLine", "")

    bg_dark = (26, 26, 46)
    img  = Image.new("RGB", (W, H), bg_dark)
    draw = ImageDraw.Draw(img)

    # Terminal window chrome
    chrome_x, chrome_y = 60, 120
    chrome_w, chrome_h = W - 120, 780
    draw.rounded_rectangle(
        [chrome_x, chrome_y, chrome_x + chrome_w, chrome_y + chrome_h],
        radius=20, fill=(30, 30, 50)
    )

    # Title bar
    draw.rounded_rectangle(
        [chrome_x, chrome_y, chrome_x + chrome_w, chrome_y + 50],
        radius=20, fill=(40, 40, 65)
    )

    # Traffic lights
    dot_y = chrome_y + 25
    for i, dot_color in enumerate([(255, 95, 87), (255, 189, 46), (39, 201, 63)]):
        draw.ellipse([chrome_x + 30 + i * 30, dot_y - 8, chrome_x + 30 + i * 30 + 16, dot_y + 8], fill=dot_color)

    # Command text
    mono  = load_mono_font(52)
    mono2 = load_mono_font(46)
    pad   = chrome_x + 40

    prompt_color = accent_rgb
    green_rgb    = (74, 222, 128)

    cmd_y = chrome_y + 80
    cmd_text = f"$ {headline}"
    draw.text((pad, cmd_y), cmd_text, font=mono, fill=prompt_color)

    # emphasisLine with arrow prefix
    arrow_y = cmd_y + 100
    e_lines = wrap_text(f"→ {emphasis}", mono2, W - pad - 60 - 40)
    for line in e_lines:
        draw.text((pad, arrow_y), line, font=mono2, fill=green_rgb)
        bbox = draw.textbbox((pad, arrow_y), line, font=mono2)
        arrow_y += (bbox[3] - bbox[1]) + 10

    draw_corner_accent(draw, accent_rgb)
    draw_bottom_bar(draw, accent_rgb)

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    img.save(tmp.name)
    return tmp.name


# ── Video overlay style ───────────────────────────────────────────────────────

def render_video_overlay(cfg: dict) -> str:
    """RGBA transparent overlay PNG for compositing over video."""
    accent_rgb = hex_to_rgb(cfg.get("accentColor", "#E07355"))
    headline   = cfg.get("headline", "")
    emphasis   = cfg.get("emphasisLine", "")

    img  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dark gradient scrim at bottom 500px
    scrim_top = H - 500
    for y in range(scrim_top, H):
        alpha = int(180 * (y - scrim_top) / 500)
        draw.line([(0, y), (W, y)], fill=(0, 0, 0, alpha))

    pad    = 80
    max_w  = W - pad * 2
    h_font = load_font(80)
    e_font = load_font(60)

    sub_text = cfg.get("subText", "")
    s_font = load_font(46, bold=False) if sub_text else None

    h_lines = wrap_text(headline, h_font, max_w)
    e_lines = wrap_text(emphasis, e_font, max_w)
    s_lines = wrap_text(sub_text, s_font, max_w) if sub_text and s_font else []

    dummy = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    line_h = lambda f, t: (dummy.textbbox((0, 0), t, font=f)[3] - dummy.textbbox((0, 0), t, font=f)[1])
    h_line_heights = [line_h(h_font, l) for l in h_lines]
    e_line_heights = [line_h(e_font, l) for l in e_lines]
    s_line_heights = [line_h(s_font, l) for l in s_lines] if s_font else []
    sub_block = (28 + sum(s_line_heights) + len(s_lines) * 6) if s_lines else 0

    total_text_h = sum(h_line_heights) + len(h_lines) * 8 + 20 + sum(e_line_heights) + len(e_lines) * 8 + sub_block
    start_y = H - 320 - total_text_h

    y = start_y
    for i, line in enumerate(h_lines):
        draw.text((pad, y), line, font=h_font, fill=(255, 255, 255, 240))
        y += h_line_heights[i] + 8
    y += 20
    for i, line in enumerate(e_lines):
        draw.text((pad, y), line, font=e_font, fill=accent_rgb + (255,))
        y += e_line_heights[i] + 8
    if s_lines and s_font:
        y += 28
        for i, line in enumerate(s_lines):
            draw.text((pad, y), line, font=s_font, fill=(255, 255, 255, 180))
            y += s_line_heights[i] + 6

    # CTA pill at bottom (above bar)
    cta_text = cfg.get("ctaText", "")
    if cta_text:
        cta_font = load_font(54)
        cta_lines = wrap_text(cta_text, cta_font, max_w - 40)
        cta_dummy = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        cta_lh = [line_h(cta_font, l) for l in cta_lines]
        cta_block_h = sum(cta_lh) + len(cta_lines) * 8
        pill_pad_x, pill_pad_y = 32, 22
        pill_w = max(
            cta_dummy.textbbox((0,0), l, font=cta_font)[2] for l in cta_lines
        ) + pill_pad_x * 2
        pill_h = cta_block_h + pill_pad_y * 2
        pill_x = pad
        pill_y = H - 160 - pill_h
        draw.rounded_rectangle(
            [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
            radius=16, fill=accent_rgb + (230,)
        )
        ty = pill_y + pill_pad_y
        for i, line in enumerate(cta_lines):
            draw.text((pill_x + pill_pad_x, ty), line, font=cta_font, fill=(255, 255, 255, 255))
            ty += cta_lh[i] + 8

    # Corner accent + bottom bar (fully opaque)
    draw_corner_accent(draw, accent_rgb, alpha=255)
    draw_bottom_bar(draw, accent_rgb, alpha=255)

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    img.save(tmp.name)
    return tmp.name


# ── ffmpeg helpers ────────────────────────────────────────────────────────────

def _draw_list_content(draw, cfg: dict, mode: str = "cream"):
    """
    Draw list content onto an existing draw context.
    mode = "cream"  → cream bg, orange header strip, dark text
    mode = "photo"  → no header strip, all white text on dark image
    mode = "rgba"   → same as photo but for RGBA overlay canvas
    Returns nothing — mutates draw in place.
    """
    accent_rgb = hex_to_rgb(cfg.get("accentColor", "#E07355"))
    text_color = hex_to_rgb(cfg.get("textColor", "#1B1B1B"))

    headline   = sanitize(cfg.get("headline", ""))
    emphasis   = sanitize(cfg.get("emphasisLine", ""))
    list_items = [sanitize(x) for x in cfg.get("listItems", [])]
    summary    = sanitize(cfg.get("summaryLine", ""))
    cta_text   = sanitize(cfg.get("ctaText", ""))
    handle     = cfg.get("handle", "@codewithtyler")

    on_photo   = mode in ("photo", "rgba")
    alpha      = 255  # PIL ignores alpha for RGB; used for RGBA fills
    WHITE      = (255, 255, 255, alpha) if on_photo else (255, 255, 255)
    TITLE_C    = WHITE
    EMPH_C     = accent_rgb + (alpha,) if on_photo else accent_rgb
    ITEM_C     = (240, 235, 230, alpha) if on_photo else text_color
    NUM_C      = accent_rgb + (alpha,) if on_photo else accent_rgb
    DIV_C      = (200, 190, 185, 140) if on_photo else (180, 165, 155)
    MUTED_C    = (200, 190, 185, alpha) if on_photo else (130, 120, 115)
    LINK_C     = accent_rgb + (alpha,) if on_photo else accent_rgb

    dummy  = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    line_h = lambda f, t: (dummy.textbbox((0,0), t, font=f)[3] - dummy.textbbox((0,0), t, font=f)[1])

    PAD   = 72   # horizontal padding — uniform on both sides
    RIGHT = W - PAD

    h_font  = load_font(86)
    e_font  = load_font(54, bold=False)

    h_lines = wrap_text(headline, h_font, RIGHT - PAD)
    e_lines = wrap_text(emphasis, e_font, RIGHT - PAD) if emphasis else []

    if mode == "cream":
        # ── Orange strip: headline only (not full-width, padded, rounded) ─────
        STRIP_TOP  = 56
        STRIP_PAD  = PAD
        INNER_PAD  = 28   # vertical padding inside the strip
        SIDE_INNER = 24   # extra horizontal padding inside text
        strip_text_h = sum(line_h(h_font, l) for l in h_lines) + len(h_lines) * 10
        STRIP_H    = strip_text_h + INNER_PAD * 2
        draw.rounded_rectangle(
            [STRIP_PAD, STRIP_TOP, W - STRIP_PAD, STRIP_TOP + STRIP_H],
            radius=14, fill=accent_rgb
        )
        y = STRIP_TOP + INNER_PAD
        for l in h_lines:
            draw.text((PAD + SIDE_INNER, y), l, font=h_font, fill=(255, 255, 255))
            y += line_h(h_font, l) + 10

        # emphasisLine sits below the strip as a larger subtitle in dark text
        y = STRIP_TOP + STRIP_H + 22
        if e_lines:
            sub_font = load_font(58, bold=False)
            for l in e_lines:
                draw.text((PAD, y), l, font=sub_font, fill=text_color)
                y += line_h(sub_font, l) + 8
            content_y = y + 30
        else:
            content_y = STRIP_TOP + STRIP_H + 52
    else:
        # ── Photo/video: title text only, no strip ────────────────────────────
        y = 100
        for l in h_lines:
            draw.text((PAD, y), l, font=h_font, fill=TITLE_C)
            y += line_h(h_font, l) + 10
        if e_lines:
            y += 14
            for l in e_lines:
                draw.text((PAD, y), l, font=e_font, fill=EMPH_C)
                y += line_h(e_font, l) + 8
        content_y = y + 52

    # ── Numbered list ─────────────────────────────────────────────────────────
    y        = content_y
    num_font = load_font(64)
    item_font= load_font(56, bold=False)
    num_w    = 72

    for i, item in enumerate(list_items):
        num_str = f"{i+1}."
        draw.text((PAD, y), num_str, font=num_font, fill=NUM_C)
        item_lines = wrap_text(item, item_font, RIGHT - PAD - num_w)
        for j, line in enumerate(item_lines):
            draw.text((PAD + num_w, y + j * (line_h(item_font, line) + 6)), line, font=item_font, fill=ITEM_C)
        item_block_h = len(item_lines) * (line_h(item_font, item_lines[0] if item_lines else " ") + 6)
        y += max(item_block_h, line_h(num_font, num_str)) + 22

    # ── Summary ───────────────────────────────────────────────────────────────
    if summary:
        y += 10
        draw.line([(PAD, y), (RIGHT, y)], fill=DIV_C, width=2)
        y += 26
        sum_font  = load_font(62)
        sum_lines = wrap_text(summary, sum_font, RIGHT - PAD)
        for l in sum_lines:
            draw.text((PAD, y), l, font=sum_font, fill=TITLE_C if on_photo else text_color)
            y += line_h(sum_font, l) + 10

    # ── Footer ────────────────────────────────────────────────────────────────
    footer_top = H - 400
    draw.line([(PAD, footer_top), (RIGHT, footer_top)], fill=DIV_C, width=2)

    fy    = footer_top + 30
    small = load_font(44, bold=False)
    link  = load_font(50)

    footer_text_c = TITLE_C if on_photo else text_color

    if cta_text:
        for l in wrap_text(cta_text, small, RIGHT - PAD):
            draw.text((PAD, fy), l, font=small, fill=footer_text_c)
            fy += line_h(small, l) + 10
        fy += 10

    # skool URL + "· Link in bio" on one line
    skool_str = "skool.com/the-ai-agency"
    sep_str   = "  ·  Link in bio"
    draw.text((PAD, fy), skool_str, font=link, fill=LINK_C)
    skool_w = dummy.textbbox((0,0), skool_str, font=link)[2]
    draw.text((PAD + skool_w, fy), sep_str, font=small, fill=footer_text_c)
    fy += line_h(link, skool_str) + 24

    # Handle on its own line, left-aligned so it never overlaps
    hfont    = load_font(44, bold=False)
    handle_c = (200, 185, 178, alpha) if on_photo else (160, 145, 138)
    draw.text((PAD, fy), handle, font=hfont, fill=handle_c)

    # Bottom bar
    bar_c = accent_rgb + (alpha,) if on_photo else accent_rgb
    if on_photo:
        draw.rectangle([0, H - 18, W, H], fill=bar_c)
    else:
        draw_bottom_bar(draw, accent_rgb)


def render_list(cfg: dict) -> str:
    """Dense list-style: cream bg + orange header. No background asset."""
    bg_color = hex_to_rgb(cfg.get("bgColor", "#F5F0EB"))
    img  = Image.new("RGB", (W, H), bg_color)
    draw = ImageDraw.Draw(img)
    _draw_list_content(draw, cfg, mode="cream")
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    img.save(tmp.name)
    return tmp.name


def render_list_photo(cfg: dict) -> str:
    """Dense list-style on a background image: no orange strip, white text."""
    accent_rgb  = hex_to_rgb(cfg.get("accentColor", "#E07355"))
    output_dir  = cfg.get("outputDir", "/tmp")
    bg_image    = cfg.get("backgroundImage", "")

    if bg_image.startswith("/files/"):
        bg_path = os.path.join(output_dir, bg_image[len("/files/"):])
    else:
        bg_path = bg_image

    bg = Image.open(bg_path).convert("RGB")
    bw, bh = bg.size
    scale  = max(W / bw, H / bh)
    bg     = bg.resize((int(bw * scale), int(bh * scale)), Image.LANCZOS)
    left   = (bg.width  - W) // 2
    top    = (bg.height - H) // 2
    bg     = bg.crop((left, top, left + W, top + H))

    # Dark scrim for readability
    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd    = ImageDraw.Draw(scrim)
    sd.rectangle([0, 0, W, H], fill=(0, 0, 0, 155))
    img   = Image.alpha_composite(bg.convert("RGBA"), scrim).convert("RGB")

    draw = ImageDraw.Draw(img)
    _draw_list_content(draw, cfg, mode="photo")

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    img.save(tmp.name)
    return tmp.name


def render_list_video_overlay(cfg: dict) -> str:
    """Dense list-style RGBA overlay for compositing over a video."""
    img  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Add a gradient scrim so text is readable
    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd    = ImageDraw.Draw(scrim)
    for py in range(H):
        a = int(170 * py / H)
        sd.line([(0, py), (W, py)], fill=(0, 0, 0, min(a, 160)))
    img = Image.alpha_composite(img, scrim)
    draw = ImageDraw.Draw(img)
    _draw_list_content(draw, cfg, mode="rgba")
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    img.save(tmp.name)
    return tmp.name


def image_to_mp4(frame_path: str, output_path: str, duration: int):
    """Convert a static image to MP4."""
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1",
        "-i", frame_path,
        "-c:v", "libx264",
        "-t", str(duration),
        "-pix_fmt", "yuv420p",
        "-vf", "scale=1080:1920",
        "-r", "25",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr}")


def video_overlay_to_mp4(source_path: str, overlay_path: str, output_path: str, duration: int):
    """Composite overlay PNG over source video, trim to duration."""
    cmd = [
        "ffmpeg", "-y",
        "-i", source_path,
        "-i", overlay_path,
        "-filter_complex",
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg];[bg][1:v]overlay=0:0[out]",
        "-map", "[out]",
        "-c:v", "libx264",
        "-t", str(duration),
        "-pix_fmt", "yuv420p",
        "-an",
        "-r", "25",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 flash_video.py '<json_payload>'"}))
        sys.exit(1)

    try:
        cfg = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    style      = cfg.get("style", "statement")
    duration   = int(cfg.get("duration", 5))
    output     = cfg.get("output", "/tmp/flash_output.mp4")
    output_dir = cfg.get("outputDir", os.path.dirname(output))
    bg_video   = cfg.get("backgroundVideo", "")

    # Resolve background video path once (used by both "video" and "list" styles)
    source_path = ""
    if bg_video:
        if bg_video.startswith("/files/"):
            source_path = os.path.join(output_dir, bg_video[len("/files/"):])
        else:
            source_path = bg_video

    temp_files = []
    try:
        if style == "video" and bg_video:
            if not os.path.exists(source_path):
                print(json.dumps({"error": f"Background video not found: {source_path}"}))
                sys.exit(1)

            overlay_path = render_video_overlay(cfg)
            temp_files.append(overlay_path)
            video_overlay_to_mp4(source_path, overlay_path, output, duration)

        elif style == "terminal":
            frame_path = render_terminal(cfg)
            temp_files.append(frame_path)
            image_to_mp4(frame_path, output, duration)

        elif style == "list":
            bg_image = cfg.get("backgroundImage", "")
            if bg_video:
                overlay_path = render_list_video_overlay(cfg)
                temp_files.append(overlay_path)
                video_overlay_to_mp4(source_path, overlay_path, output, duration)
            elif bg_image:
                frame_path = render_list_photo(cfg)
                temp_files.append(frame_path)
                image_to_mp4(frame_path, output, duration)
            else:
                frame_path = render_list(cfg)
                temp_files.append(frame_path)
                image_to_mp4(frame_path, output, duration)

        else:
            # statement (default)
            frame_path = render_statement(cfg)
            temp_files.append(frame_path)
            image_to_mp4(frame_path, output, duration)

        print(json.dumps({"output": output}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

    finally:
        for f in temp_files:
            try:
                os.unlink(f)
            except Exception:
                pass


if __name__ == "__main__":
    main()
