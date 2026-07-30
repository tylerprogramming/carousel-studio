#!/usr/bin/env python3
"""
golden.py — render the fixture deck and diff it against committed reference PNGs.

Every layout bug this project shipped was found by eye, after export: a
headline clipped to "/embedded-captio", terminal lines cut mid-word, a window
growing down through the footer. check_slides.py catches the ones that can be
stated as a rule. This catches the rest, by rendering the same deck every time
and noticing when the pixels move.

    python3 tests/golden.py compare    # diff against tests/fixtures/golden
    python3 tests/golden.py update     # accept the current output as correct

Both print JSON.

## Thresholds

Measured on this deck rather than guessed:

    re-render, identical input      soft 0.00000   hard 0.00000
    one extra terminal line         soft 0.00100   hard 0.00087
    one word longer headline        soft 0.00512   hard 0.00505
    textScale 1.00 -> 1.01          soft 0.02350   hard 0.02015

Rendering is exactly deterministic, and the smallest change worth catching
still moves ~0.1% of the frame. The thresholds sit in that gap: high enough
that a stray glyph edge is not a failure, an order of magnitude below the
quietest real regression.

The diff is graded by how far each pixel moved. `soft` counts pixels off by
more than SOFT on any channel, which is where antialiased glyph edges land.
`hard` counts pixels off by more than HARD, which is a pixel that has gone
from background to foreground: text that moved, rewrapped, or got clipped.

## The Pillow caveat, stated plainly

These thresholds cannot tell a real regression from a FreeType rasterizer
change, because a rasterizer change moves far more pixels than an extra
terminal line does. Nothing measurable separates them, so this test does not
pretend to. Pillow is pinned exactly in requirements.txt, and bumping it is
expected to turn this red — that is the test doing its job, because a Pillow
bump really does change the PNGs you post. Look at tests/fixtures/golden/_failed,
confirm the slides still read correctly, then run `update`.
"""

import json
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import PIL
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / 'tests' / 'fixtures'
GOLDEN = FIXTURES / 'golden'
DECK = FIXTURES / 'clean-deck.json'
MANIFEST = GOLDEN / 'manifest.json'

SOFT, HARD = 8, 64          # per-channel difference, 0-255
MAX_SOFT_RATIO = 0.0005     # a handful of glyph edges, ~5x under the quietest regression
MAX_HARD_RATIO = 0.0002     # ~290px on a 4:5 slide, against 1270 for one extra terminal line

# Failures drop the render and a diff map here so there is something to look at.
# A golden test that only says "the pixels moved" makes you go and reproduce it
# by hand, which is the point at which people stop running it. Gitignored.
FAILED = GOLDEN / '_failed'


def provenance() -> dict:
    """What these renders depend on, beyond the code.

    A golden is only meaningful against the same font and the same rasterizer.
    Recording that turns two different failures into two different messages:
    "you are on a platform these were not made on" is a skip, and "you are on
    the right platform but something underneath moved" is a real failure worth
    looking at. Without it both arrive as an unexplained pixel diff.

    The first version of this recorded the Pillow version and stopped, on the
    assumption that it determined rendering. It does not. Pillow is a wrapper:
    FreeType rasterises the glyphs and Raqm shapes the runs, both are linked in
    at build time, and both move independently of the version on the tin. A
    Homebrew Pillow 12.3.0 and a pip Pillow 12.3.0 can disagree.

    Measured on this deck, going from FreeType 2.13.3 with no Raqm to 2.14.3
    with Raqm 0.11.0 moved 1.15% of pixels — 50x the failure threshold. Roughly
    a third of that was Raqm's shaping and the rest was FreeType alone. Neither
    is visible in `PIL.__version__`.
    """
    sys.path.insert(0, str(ROOT))
    import generate_slide as g
    from PIL import features
    return {
        'platform': platform.system().lower(),
        'pillow': PIL.__version__,
        # The two that actually draw the glyphs.
        'freetype': features.version('freetype2'),
        'raqm': features.version('raqm'),
        'mono': g.load_mono(29).getname()[0],
    }


def render(slides, into: Path) -> dict:
    """Render each slide to `into`, returning {name: path}.

    `handle` and `totalSlides` are pinned rather than left to their defaults so
    a golden is a test of the layout, not of whatever settings.json happens to
    hold on the machine running it.
    """
    into.mkdir(parents=True, exist_ok=True)
    out = {}
    for i, slide in enumerate(slides):
        name = f"{i + 1:02d}-{slide.get('variant', 'standard')}-{slide.get('type', 'content')}.png"
        payload = {**slide,
                   'handle': '@fixture',
                   'totalSlides': len(slides),
                   'output': str(into / name)}
        # sys.executable, not 'python3'. This script reports the Pillow and
        # FreeType of the interpreter running it, and then had the renderer
        # spawned by whatever 'python3' happened to mean — so on a machine with
        # two Pythons it would record one environment's provenance against
        # another's pixels, and `python3.9 golden.py update` would silently not
        # do what it said. Same bug the server had at fourteen call sites.
        proc = subprocess.run([sys.executable, str(ROOT / 'generate_slide.py'), json.dumps(payload)],
                              capture_output=True, text=True, cwd=ROOT)
        if proc.returncode != 0:
            raise SystemExit(f'render failed for {name}:\n{proc.stderr}')
        out[name] = into / name
    return out


def diff(a: Path, b: Path, keep_as: str = None) -> dict:
    """Grade the difference between two renders of the same slide.

    `a` is the golden, `b` the fresh render. On failure, both and a diff map
    are copied to FAILED under `keep_as`.
    """
    ia, ib = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    if ia.size != ib.size:
        return {'status': 'size', 'expected': list(ia.size), 'actual': list(ib.size),
                'soft': 1.0, 'hard': 1.0}

    delta = ImageChops.difference(ia, ib)
    # Collapse RGB to the worst channel per pixel, so a pure-red shift is not
    # diluted to a third of its size by two unchanged channels.
    worst = delta.convert('L')
    for band in delta.split():
        worst = ImageChops.lighter(worst, band)

    total = ia.size[0] * ia.size[1]
    hist = worst.histogram()
    soft = sum(hist[SOFT + 1:]) / total
    hard = sum(hist[HARD + 1:]) / total
    ok = soft <= MAX_SOFT_RATIO and hard <= MAX_HARD_RATIO

    if not ok and keep_as:
        FAILED.mkdir(parents=True, exist_ok=True)
        stem = keep_as.removesuffix('.png')
        shutil.copy(a, FAILED / f'{stem}.expected.png')
        shutil.copy(b, FAILED / f'{stem}.actual.png')
        # Autolevelled, so a difference of 12 is visible instead of near-black.
        worst.point(lambda v: min(255, v * 4)).save(FAILED / f'{stem}.diff.png')

    return {'status': 'ok' if ok else 'changed',
            'soft': round(soft, 6), 'hard': round(hard, 6),
            'peak': max((i for i, n in enumerate(hist) if n), default=0)}


def compare() -> dict:
    slides = json.loads(DECK.read_text())['slides']
    if not GOLDEN.exists():
        return {'ok': False, 'error': f'no goldens at {GOLDEN}. Run: python3 tests/golden.py update'}

    now = provenance()
    was = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else None

    # A different OS resolves a different mono font, so these renders cannot be
    # reproduced here at all. That is not a regression and must not read as one:
    # a test that fails for a reason the reader cannot act on is a test that
    # gets muted.
    if was and was.get('platform') != now['platform']:
        return {'ok': True, 'skipped': True, 'expected': was, 'actual': now,
                'reason': f"goldens were rendered on {was.get('platform')}, "
                          f"this is {now['platform']}"}

    # Everything else about the environment is diagnosis, not a gate.
    #
    # This used to fail outright on any difference, which had it backwards. The
    # pixels are the thing under test; the library versions are just the best
    # available explanation for why they moved. Gating on them means a FreeType
    # patch release that does not shift a single pixel turns the suite red, and
    # that is how a suite stops being trusted. So: always compare the renders,
    # and if they differ, say what underneath is likely responsible.
    drifted = [k for k in ('pillow', 'freetype', 'raqm', 'mono')
               if was and was.get(k) != now[k]]

    shutil.rmtree(FAILED, ignore_errors=True)   # last run's artifacts are not this run's
    tmp = Path(tempfile.mkdtemp(prefix='golden-'))
    try:
        rendered = render(slides, tmp)
        results = []
        for name, path in rendered.items():
            ref = GOLDEN / name
            if not ref.exists():
                results.append({'name': name, 'status': 'missing_golden',
                                'soft': 1.0, 'hard': 1.0})
                continue
            results.append({'name': name, **diff(ref, path, keep_as=name)})

        # A golden with no slide rendering into it means the deck lost a slide.
        for orphan in sorted(p.name for p in GOLDEN.glob('*.png') if p.name not in rendered):
            results.append({'name': orphan, 'status': 'orphan_golden', 'soft': 0, 'hard': 0})

        ok = all(r['status'] == 'ok' for r in results)
        out = {'ok': ok,
               'rendered_with': now,
               'thresholds': {'soft': MAX_SOFT_RATIO, 'hard': MAX_HARD_RATIO},
               'slides': results}

        if drifted and not ok:
            # The renders moved and the environment moved. Say which, so the
            # first question — "is this my change or my machine?" — is already
            # answered.
            out['likely_cause'] = (
                'the environment changed: ' +
                ', '.join(f'{k} {was.get(k)} -> {now[k]}' for k in drifted) +
                '. If the slides still read correctly this is not a regression '
                '— check them, then: bun run test:golden:update')
            out['expected_env'] = was
        elif drifted:
            # Different libraries, identical pixels. Worth saying out loud,
            # because it is evidence the thresholds are not too tight.
            out['note'] = ('environment differs but renders match: ' +
                           ', '.join(f'{k} {was.get(k)} -> {now[k]}' for k in drifted))
        return out
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def update() -> dict:
    slides = json.loads(DECK.read_text())['slides']
    now = provenance()
    if GOLDEN.exists():
        shutil.rmtree(GOLDEN)
    written = render(slides, GOLDEN)
    MANIFEST.write_text(json.dumps(now, indent=2) + '\n')
    return {'ok': True, 'rendered_with': now, 'wrote': sorted(written)}


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'compare'
    if cmd not in ('compare', 'update'):
        raise SystemExit('usage: golden.py [compare|update]')
    result = compare() if cmd == 'compare' else update()
    print(json.dumps(result, indent=2))
    sys.exit(0 if result.get('ok') else 1)
