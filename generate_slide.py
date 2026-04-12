#!/usr/bin/env python3
"""PIL-based carousel slide generator."""
import sys
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1080
HEIGHT = 1350
PADDING = 90

def load_font(size, bold=False):
    candidates = []
    if bold:
        candidates = [
            '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
            '/Library/Fonts/Arial Bold.ttf',
            '/System/Library/Fonts/Helvetica.ttc',
        ]
    else:
        candidates = [
            '/System/Library/Fonts/Supplemental/Arial.ttf',
            '/Library/Fonts/Arial.ttf',
            '/System/Library/Fonts/Helvetica.ttc',
        ]
    for path in candidates:
        if os.path.exists(path):
            try:
                idx = 1 if (bold and path.endswith('.ttc')) else 0
                return ImageFont.truetype(path, size, index=idx)
            except Exception:
                continue
    return ImageFont.load_default()

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def luminance(rgb):
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]

def muted(rgb, bg_rgb, factor=0.72):
    return tuple(int(c * factor + bg_rgb[i] * (1 - factor)) for i, c in enumerate(rgb))

def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines, cur = [], []
    for word in words:
        test = ' '.join(cur + [word])
        w = draw.textbbox((0, 0), test, font=font)[2]
        if w <= max_width:
            cur.append(word)
        else:
            if cur:
                lines.append(' '.join(cur))
            cur = [word]
    if cur:
        lines.append(' '.join(cur))
    return lines or ['']

def line_height(draw, text, font):
    bb = draw.textbbox((0, 0), text or 'Ag', font=font)
    return bb[3] - bb[1]

def generate_slide(data):
    bg_rgb = hex_to_rgb(data.get('bgColor', '#F5F0EB'))
    text_rgb = hex_to_rgb(data.get('textColor', '#1B1B1B'))
    accent_rgb = hex_to_rgb(data.get('accentColor', '#E07355'))
    headline = data.get('headline', '').strip()
    emphasis = data.get('emphasisLine', '').strip()
    body = data.get('bodyText', '').strip()
    slide_num = data.get('slideNumber', 1)
    total = data.get('totalSlides', 7)
    slide_type = data.get('type', 'content')
    text_scale = float(data.get('textScale', 1.0))
    output_path = data.get('output', '/tmp/slide.png')

    # Background: image or solid color
    bg_image_path = data.get('backgroundImagePath', '')
    if bg_image_path and os.path.exists(bg_image_path):
        bg_src = Image.open(bg_image_path).convert('RGB')
        bg_src = bg_src.resize((WIDTH, HEIGHT), Image.LANCZOS)
        img  = bg_src.copy()
        # Semi-transparent overlay for text readability
        overlay_opacity = data.get('overlayOpacity', 0.45)
        overlay_color   = data.get('overlayColor', '#000000')
        ov_rgb = hex_to_rgb(overlay_color)
        overlay = Image.new('RGBA', (WIDTH, HEIGHT), (*ov_rgb, int(255 * overlay_opacity)))
        img.paste(Image.new('RGB', (WIDTH, HEIGHT), ov_rgb),
                  mask=Image.new('L', (WIDTH, HEIGHT), int(255 * overlay_opacity)))
    else:
        img = Image.new('RGB', (WIDTH, HEIGHT), bg_rgb)
    draw = ImageDraw.Draw(img)

    # Fonts (scaled by textScale)
    def fs(size): return max(8, round(size * text_scale))
    f_title     = load_font(fs(82),  bold=True)
    f_emph      = load_font(fs(60),  bold=True)
    f_body      = load_font(fs(44),  bold=False)
    f_num       = load_font(34,      bold=False)   # counter — not scaled
    f_large_num = load_font(fs(140), bold=True)

    # Counter top-right
    counter_txt = f"{slide_num} / {total}"
    muted_rgb = muted(text_rgb, bg_rgb, 0.4)
    draw.text((WIDTH - PADDING, 52), counter_txt, font=f_num, fill=muted_rgb, anchor='rt')

    # Corner L accent
    draw.rectangle([(0, 0), (14, 88)], fill=accent_rgb)
    draw.rectangle([(0, 0), (88, 14)], fill=accent_rgb)

    # Bottom accent bar
    draw.rectangle([(0, HEIGHT - 18), (WIDTH, HEIGHT)], fill=accent_rgb)

    # Save for later / Swipe row (just above the accent bar)
    # Semi-transparent strip via RGBA composite
    if slide_num >= total:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        img.save(output_path, 'PNG')
        return output_path

    footer_hex   = data.get('footerColor', '#FFFFFF')
    footer_rgb   = hex_to_rgb(footer_hex)
    footer_color = tuple(int(c * 0.88) for c in footer_rgb)
    f_badge      = load_font(30, bold=True)
    row_h        = 52
    badge_y      = HEIGHT - 18 - 52 - row_h  # extra 52px margin above accent
    badge_pad    = 90
    # Ribbon bookmark icon
    bw, bh = 18, 26
    bx, by = badge_pad, badge_y + 10
    draw.polygon([(bx, by), (bx+bw, by), (bx+bw, by+bh), (bx+bw//2, by+bh-8), (bx, by+bh)], fill=footer_color)
    draw.text((badge_pad + bw + 14, badge_y + 12), 'SAVE FOR LATER', font=f_badge, fill=footer_color)
    swipe_txt = 'SWIPE >'
    sw = draw.textbbox((0, 0), swipe_txt, font=f_badge)[2]
    draw.text((WIDTH - badge_pad - sw, badge_y + 12), swipe_txt, font=f_badge, fill=footer_color)

    max_w = WIDTH - PADDING * 2

    # --- Layout by slide type ---
    if slide_type == 'cover':
        # Centered vertically
        title_lines = wrap_text(draw, headline.upper() if headline else '', f_title, max_w)
        emph_lines  = wrap_text(draw, emphasis, f_emph, max_w)
        body_lines  = wrap_text(draw, body, f_body, max_w)

        lh_t = line_height(draw, 'A', f_title) + 14
        lh_e = line_height(draw, 'A', f_emph) + 10
        lh_b = line_height(draw, 'A', f_body) + 8

        total_h = (lh_t * len(title_lines) if title_lines[0] else 0) + \
                  (24 if emphasis else 0) + (lh_e * len(emph_lines) if emphasis else 0) + \
                  (20 if body else 0) + (lh_b * len(body_lines) if body else 0)

        y = (HEIGHT - total_h) // 2

        for line in title_lines:
            draw.text((PADDING, y), line, font=f_title, fill=text_rgb)
            y += lh_t
        if emphasis:
            y += 24
            for line in emph_lines:
                draw.text((PADDING, y), line, font=f_emph, fill=accent_rgb)
                y += lh_e
        if body:
            y += 20
            for line in body_lines:
                draw.text((PADDING, y), line, font=f_body, fill=muted(text_rgb, bg_rgb, 0.68))
                y += lh_b

    elif slide_type == 'cta':
        # CTA centered
        cta_lines  = wrap_text(draw, headline.upper() if headline else 'FOLLOW FOR MORE', f_title, max_w)
        emph_lines = wrap_text(draw, emphasis, f_emph, max_w)
        body_lines = wrap_text(draw, body, f_body, max_w)

        lh_t = line_height(draw, 'A', f_title) + 14
        lh_e = line_height(draw, 'A', f_emph) + 10
        lh_b = line_height(draw, 'A', f_body) + 8

        total_h = lh_t * len(cta_lines) + \
                  (30 + lh_e * len(emph_lines) if emphasis else 0) + \
                  (20 + lh_b * len(body_lines) if body else 0)

        y = (HEIGHT - total_h) // 2
        for line in cta_lines:
            draw.text((PADDING, y), line, font=f_title, fill=accent_rgb)
            y += lh_t
        if emphasis:
            y += 30
            for line in emph_lines:
                draw.text((PADDING, y), line, font=f_emph, fill=text_rgb)
                y += lh_e
        if body:
            y += 20
            for line in body_lines:
                draw.text((PADDING, y), line, font=f_body, fill=muted(text_rgb, bg_rgb, 0.68))
                y += lh_b

    else:
        # Content slide: step number top, headline, emphasis, body
        # Big step number
        step_num = str(data.get('stepNumber', slide_num - 1))
        num_y = 160
        draw.text((PADDING, num_y), step_num + '.', font=f_large_num, fill=accent_rgb)
        num_bb = draw.textbbox((0, 0), step_num + '.', font=f_large_num)
        num_h = num_bb[3] - num_bb[1]

        y = num_y + num_h + 32

        title_lines = wrap_text(draw, headline.upper() if headline else '', f_title, max_w)
        emph_lines  = wrap_text(draw, emphasis, f_emph, max_w)
        body_lines  = wrap_text(draw, body, f_body, max_w)

        lh_t = line_height(draw, 'A', f_title) + 12
        lh_e = line_height(draw, 'A', f_emph) + 10
        lh_b = line_height(draw, 'A', f_body) + 8

        for line in title_lines:
            draw.text((PADDING, y), line, font=f_title, fill=text_rgb)
            y += lh_t
        if emphasis:
            y += 20
            for line in emph_lines:
                draw.text((PADDING, y), line, font=f_emph, fill=accent_rgb)
                y += lh_e
        if body:
            y += 18
            for line in body_lines:
                draw.text((PADDING, y), line, font=f_body, fill=muted(text_rgb, bg_rgb, 0.68))
                y += lh_b

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, 'PNG')
    return output_path

def combine_pdf(image_paths: list, output_path: str) -> str:
    """Combine multiple PNG files into a single multi-page PDF."""
    images = []
    for p in image_paths:
        img = Image.open(p).convert('RGB')
        images.append(img)
    if not images:
        raise ValueError('No images to combine')
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    images[0].save(
        output_path,
        save_all=True,
        append_images=images[1:],
        format='PDF',
        resolution=150,
    )
    return output_path

if __name__ == '__main__':
    # Mode 1: generate_slide.py '{"...slide data..."}' → generate one PNG
    # Mode 2: generate_slide.py --pdf '["path1.png","path2.png"]' output.pdf → combine to PDF
    if len(sys.argv) >= 2 and sys.argv[1] == '--pdf':
        paths = json.loads(sys.argv[2])
        out   = sys.argv[3]
        result = combine_pdf(paths, out)
        print(result)
    else:
        data = json.loads(sys.argv[1])
        result = generate_slide(data)
        print(result)
