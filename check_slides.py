#!/usr/bin/env python3
"""
check_slides.py — find what is wrong with a carousel before you export it.

Every layout bug caught during this project was caught by eye, after export:
an emphasis line running off the right edge, terminal lines cut mid-word, a
terminal window growing down through the footer. The renderer already measures
text to lay it out; it just never complained. This complains.

It measures with the same fonts and geometry as generate_slide.py, so a
finding here is a finding in the export, not an approximation.

Usage: python3 check_slides.py '<json payload>'

Payload:
  slides   : the carousel's slides array   (required)
  strict   : treat warnings as failures    (default false)

Returns JSON: { ok, counts, findings[] }
Each finding: { slide, level, code, message }
"""

import json
import sys

from generate_slide import (
    HEIGHT,
    WIDTH,
    hex_to_rgb,
    load_font,
    load_mono,
    luminance,
    mono_safe,
    text_width,
    wrap_text,
)
from PIL import Image, ImageDraw

# Layout constants mirrored from generate_terminal_slide. If that function's
# geometry changes, these move with it or the check goes quietly wrong.
PADX = 84
# Two different limits, and conflating them caused false positives. The
# terminal window is lifted to clear HEIGHT-130; the footer *text* is drawn at
# HEIGHT-64, so body copy has more room than the window does.
FOOTER_TOP = HEIGHT - 130
BODY_LIMIT = HEIGHT - 80
TERMINAL_TOP = 700

ERROR, WARN = 'error', 'warning'


def _contrast(a, b):
    """WCAG-ish contrast ratio between two hex colours."""
    la, lb = luminance(hex_to_rgb(a)) / 255, luminance(hex_to_rgb(b)) / 255
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def check_slide(draw, slide, index):
    out = []

    def add(level, code, message):
        out.append({'slide': slide.get('slideNumber', index + 1),
                    'level': level, 'code': code, 'message': message})

    scale = float(slide.get('textScale', 1.0) or 1.0)
    fs = lambda px: max(8, round(px * scale))
    bg = slide.get('bgColor') or '#12141A'
    fg = slide.get('textColor') or '#EEECE8'
    accent = slide.get('accentColor') or '#E07355'
    is_terminal = slide.get('variant') == 'terminal'
    stype = slide.get('type', 'content')
    avail = WIDTH - PADX * 2

    # ── empty ────────────────────────────────────────────────────────────────
    if not (slide.get('headline') or '').strip():
        add(ERROR, 'empty_headline', 'No headline. The slide renders blank at the top.')

    # ── contrast ─────────────────────────────────────────────────────────────
    if _contrast(fg, bg) < 4.5:
        add(WARN, 'low_contrast_text',
            f'Text on background is {_contrast(fg, bg):.1f}:1. Under 4.5 is hard to read at thumbnail size.')
    # The accent is a *background* for the emphasis block, with bgColor on top
    if (slide.get('emphasisLine') or '').strip() and stype == 'cover':
        if _contrast(accent, bg) < 3.0:
            add(WARN, 'low_contrast_emphasis',
                f'Emphasis block is {_contrast(accent, bg):.1f}:1 against its own text. '
                'Accent is a background here, not a text colour.')

    if not is_terminal:
        return out

    # Layout position, walked the same way generate_terminal_slide walks it.
    y = 200
    if slide.get('stepNumber') is not None and stype == 'content':
        y += fs(48) + 28 + 28

    # ── headline overflow ────────────────────────────────────────────────────
    head = (slide.get('headline') or '').strip()
    if head:
        size = fs(118 if stype == 'cover' else 108)
        f_h = load_font(size, 800)
        lines = wrap_text(draw, head, f_h, avail)
        y += len(lines) * round(size * 1.06) + 20
        widest = max((text_width(draw, ln, f_h) for ln in lines), default=0)
        if widest > avail:
            add(ERROR, 'headline_overflow',
                f'Headline is {widest - avail}px wider than the slide even after wrapping. '
                'Shorten it or lower textScale.')
        if len(lines) > 3:
            add(WARN, 'headline_tall',
                f'Headline wraps to {len(lines)} lines and will crowd what is below it.')

    # ── emphasis block ───────────────────────────────────────────────────────
    emph = (slide.get('emphasisLine') or '').strip()
    if emph:
        if stype == 'cover':
            f_e = load_font(fs(50), 700)
            # The pill is inset either side, so it has less room than the slide
            room = avail - 40
            lines = wrap_text(draw, emph, f_e, room)
            widest = max((text_width(draw, ln, f_e) for ln in lines), default=0)
            if widest > room:
                add(ERROR, 'emphasis_overflow',
                    f'Emphasis line is {widest - room}px too wide even wrapped, so the block '
                    'runs off the slide. Usually one unbreakable word.')
            y += len(lines) * (fs(50) + 20)
            if len(lines) > 2:
                add(WARN, 'emphasis_tall',
                    f'Emphasis wraps to {len(lines)} stacked blocks, which reads as a paragraph '
                    'rather than a line.')
        else:
            f_e = load_font(fs(44), 600)
            if text_width(draw, emph, f_e) > avail:
                add(WARN, 'emphasis_wraps',
                    'Emphasis line is wider than the slide. On a content slide it does not wrap.')

    # ── terminal block ───────────────────────────────────────────────────────
    raw_lines = slide.get('terminalLines') or []
    win_bottom = None
    if raw_lines:
        f_line = load_mono(fs(29))
        line_h = round(fs(29) * 1.9)
        inner = avail - 60
        wrapped = 0
        for raw in [mono_safe(l) for l in raw_lines]:
            pieces = wrap_text(draw, raw, f_line, inner) or ['']
            wrapped += len(pieces)
            if len(pieces) > 2:
                add(WARN, 'terminal_line_wraps',
                    f'"{raw[:40]}…" wraps to {len(pieces)} lines. A command split three ways stops reading as one.')
        win_h = 62 + 52 + line_h * wrapped
        # The renderer lifts the window to clear the footer, floored at the
        # text above it. Only a window too tall for that gap really overflows.
        win_top = max(y + 40, min(TERMINAL_TOP, FOOTER_TOP - win_h))
        win_bottom = win_top + win_h
        if win_bottom > FOOTER_TOP:
            add(ERROR, 'terminal_overflows_footer',
                f'Terminal window is {win_bottom - FOOTER_TOP}px too tall to fit between the '
                'headline and the footer. Cut a line or lower textScale.')

    # ── body copy ────────────────────────────────────────────────────────────
    body = (slide.get('bodyText') or '').strip()
    if body:
        f_b = load_mono(fs(32))
        lines = wrap_text(draw, body, f_b, avail)
        adv = round(fs(32) * 1.65)
        top = (win_bottom + 46) if win_bottom else (
            HEIGHT - 150 - len(lines) * adv if slide.get('backgroundImage') else 720)
        bottom = top + len(lines) * adv
        if bottom > BODY_LIMIT:
            add(ERROR, 'body_overflows_footer',
                f'Body copy runs {bottom - BODY_LIMIT}px into the footer at {len(lines)} lines. '
                'Shorten it or cut a terminal line to give it room.')

    # ── things that will look wrong rather than break ────────────────────────
    if slide.get('backgroundImage') and not slide.get('bottomFade'):
        add(WARN, 'photo_without_fade',
            'A photo with no bottomFade ends on a hard edge and usually swallows the footer.')
    if stype == 'cta' and not (slide.get('emphasisLine') or '').strip():
        add(WARN, 'cta_without_ask',
            'CTA slide has no emphasis line, so there is no visible ask.')

    return out


def run(cfg):
    slides = cfg.get('slides') or []
    if not slides:
        return {'ok': False, 'counts': {'error': 1, 'warning': 0},
                'findings': [{'slide': 0, 'level': ERROR, 'code': 'no_slides',
                              'message': 'Carousel has no slides.'}]}

    # One throwaway canvas for measurement, same size as the real one
    draw = ImageDraw.Draw(Image.new('RGB', (WIDTH, HEIGHT)))
    findings = []
    for i, slide in enumerate(slides):
        findings.extend(check_slide(draw, slide, i))

    errors = sum(1 for f in findings if f['level'] == ERROR)
    warnings = len(findings) - errors
    ok = errors == 0 and (warnings == 0 or not cfg.get('strict'))
    return {'ok': ok, 'counts': {'error': errors, 'warning': warnings}, 'findings': findings}


def main():
    if len(sys.argv) < 2:
        print('usage: check_slides.py <json>', file=sys.stderr)
        sys.exit(1)
    try:
        print(json.dumps(run(json.loads(sys.argv[1]))))
    except Exception as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
