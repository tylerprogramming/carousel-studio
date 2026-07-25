#!/usr/bin/env python3
"""
tiktok_safe.py — re-frame an exported 1080x1350 slide for TikTok.

TikTok draws its own UI over the post: a caption block and username along the
bottom, the like/comment/share rail down the right, and tab chrome at the top.
A 4:5 slide posted as-is loses content under all three.

This does not re-render anything. It takes the finished PNG, scales it down and
places it inside a 1080x1920 canvas filled with the slide's own background
colour, positioned to clear the overlays. Because it is a post-process, the
generate_slide.py / SlidePreview.tsx twin contract is untouched.

Safe area (measured against TikTok's phone layout, tweak with the flags):
  right rail   ~150px      bottom UI  ~340px      top chrome  ~130px

Usage: python3 tiktok_safe.py '<json payload>'

Payload:
  input    : path to the 1080x1350 slide PNG        (required)
  output   : where to write the 1080x1920 PNG       (required)
  bgColor  : "#RRGGBB" pad colour, default #12141A
  margin   : side margin in px, default 110
  topBias  : how far up the content sits, 0-1, default 0.38
"""

import json
import os
import sys

from PIL import Image

OUT_W, OUT_H = 1080, 1920


def hex_to_rgb(value, fallback=(18, 20, 26)):
    try:
        h = (value or '').lstrip('#')
        if len(h) == 3:
            h = ''.join(c * 2 for c in h)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return fallback


def reframe(cfg):
    src = Image.open(cfg['input']).convert('RGB')
    bg = hex_to_rgb(cfg.get('bgColor'))
    margin = int(cfg.get('margin', 110))
    top_bias = float(cfg.get('topBias', 0.38))

    content_w = OUT_W - margin * 2
    scaled = src.resize((content_w, round(src.height * content_w / src.width)),
                        Image.LANCZOS)

    canvas = Image.new('RGB', (OUT_W, OUT_H), bg)
    # top_bias < 0.5 pushes the slide up, leaving the larger gap at the bottom
    # where TikTok's caption and username sit.
    free = OUT_H - scaled.height
    y = max(0, min(free, round(free * top_bias)))
    canvas.paste(scaled, (margin, y))

    os.makedirs(os.path.dirname(cfg['output']) or '.', exist_ok=True)
    canvas.save(cfg['output'], 'PNG')
    return cfg['output']


def main():
    if len(sys.argv) < 2:
        print('usage: tiktok_safe.py <json>', file=sys.stderr)
        sys.exit(1)
    cfg = json.loads(sys.argv[1])
    for key in ('input', 'output'):
        if not cfg.get(key):
            print(f'missing required key: {key}', file=sys.stderr)
            sys.exit(1)
    try:
        print(reframe(cfg))
    except Exception as exc:
        print(f'tiktok_safe failed: {exc}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
