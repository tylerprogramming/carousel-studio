#!/usr/bin/env python3
"""
Build docs/slides.png — the strip of example slides in the README.

Composed from tests/fixtures/golden/, which the golden tests compare every
build against. So the README's picture of the output is the output, checked on
every push, rather than a screenshot taken once and quietly left behind when
the renderer moved.

Run it after regenerating the goldens:

    python3 docs/build_slides.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GOLDEN = ROOT / 'tests' / 'fixtures' / 'golden'
OUT = ROOT / 'docs' / 'slides.png'

# A cover, a step with a terminal window, and the call to action — the three
# jobs a slide does. The tall 9:16 one is left out: at a shared height it would
# be half the width of the others and read as a mistake.
SLIDES = ['01-terminal-cover.png', '02-terminal-content.png', '04-terminal-cta.png']

HEIGHT = 900
GAP = PAD = 28
BACKDROP = '#0B0C10'


def main() -> None:
    missing = [n for n in SLIDES if not (GOLDEN / n).exists()]
    if missing:
        raise SystemExit(f'missing goldens: {", ".join(missing)}\n'
                         f'Run: bun run test:golden:update')

    imgs = [Image.open(GOLDEN / n).convert('RGB') for n in SLIDES]
    imgs = [i.resize((round(i.width * HEIGHT / i.height), HEIGHT), Image.LANCZOS) for i in imgs]

    width = sum(i.width for i in imgs) + GAP * (len(imgs) - 1) + PAD * 2
    strip = Image.new('RGB', (width, HEIGHT + PAD * 2), BACKDROP)
    x = PAD
    for i in imgs:
        strip.paste(i, (x, PAD))
        x += i.width + GAP
    strip.save(OUT)
    print(f'{OUT.relative_to(ROOT)}  {strip.width}x{strip.height}')


if __name__ == '__main__':
    main()
