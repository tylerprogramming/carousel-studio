# Tests

```bash
bun test tests/              # everything
bun run test:golden:update   # accept the current renders as correct
```

Needs Python and Pillow as well as Bun — most of what is under test is the
Python renderer, reached through `python3`.

Three suites, and they fail for different reasons.

## `geometry-parity.test.ts` — the twin contract

`generate_slide.py` and `SlidePreview.tsx` are two implementations of one
design. Every number that differs between the 4:5 canvas and the 9:16 one lives
in a table on each side: `terminal_geometry()` in Python, `terminalGeometry()`
in `client/src/lib/geometry.ts`.

Until this test existed, "these two tables agree" was a paragraph in the README,
and a paragraph does not fail CI. The test reads the Python table by importing
the renderer itself — not by restating its numbers — and diffs the whole object,
so a field added on one side and forgotten on the other fails as loudly as a
changed one.

Python is the specification. When this fails, the TypeScript table is the side
that moves.

The geometry lives in `lib/geometry.ts` rather than inside `SlidePreview.tsx`
purely so it can be imported without pulling in React. `SlidePreview` re-exports
it, so every existing import still resolves.

## `check-slides.test.ts` — the checker

Two halves, and the second matters more.

**Broken slides produce exactly the codes they should.** One fixture per check
in `fixtures/findings.json`, each asserting an exact set, not a subset — "it
still reports the one I asked about" would pass while the checker quietly grew
a false positive on the same slide.

**A correct deck produces nothing at all.** `fixtures/clean-deck.json` must come
back with zero findings, warnings included. The first version of
`check_slides.py` reported five errors on slides that render fine, and a checker
that cries wolf gets ignored, and then it is right once and you miss it.

There is also a coverage test: it greps the codes out of `check_slides.py` and
fails if one has no fixture. Adding a check means adding a fixture.

## `golden.test.ts` + `golden.py` — the exporter

Renders `clean-deck.json` and compares it to the PNGs in `fixtures/golden/`.

`check_slides.py` catches the bugs that can be stated as a rule. This catches
the rest. The headline that clipped to `/embedded-captio` and got posted broke
no rule; it just came out wrong, and only looking at it would have caught it.

Every pixel is graded by how far it moved: `soft` counts pixels off by more
than 8 on any channel, where antialiased glyph edges land; `hard` counts pixels
off by more than 64, which is a pixel that has gone from background to
foreground — text that moved, rewrapped, or got clipped.

Thresholds were measured on this deck, not guessed:

| | soft | hard |
|---|---|---|
| re-render, identical input | 0.00000 | 0.00000 |
| one extra terminal line | 0.00100 | 0.00087 |
| one word longer headline | 0.00512 | 0.00505 |
| `textScale` 1.00 → 1.01 | 0.02350 | 0.02015 |

Rendering is exactly deterministic, and the quietest change worth catching still
moves about 0.1% of the frame. The limits sit in that gap — `soft ≤ 0.0005`,
`hard ≤ 0.0002` — high enough to absorb a stray glyph edge, an order of
magnitude below the smallest real regression.

### When a golden fails

Look at `fixtures/golden/_failed/`, which a failing run fills with
`*.expected.png`, `*.actual.png` and an autolevelled `*.diff.png` showing
exactly which pixels moved. CI uploads it as the `golden-diff` artifact.

If the change is intended:

```bash
bun run test:golden:update
```

Then **look at the new PNGs before committing them**. A golden is only worth
having if what it records is correct — accepting a render without opening it is
how a bug becomes the reference.

### The Pillow caveat

These thresholds cannot tell a real regression from a FreeType rasterizer
change, because a rasterizer change moves far more pixels than an extra terminal
line does. Nothing measurable separates them, so the test does not pretend to.

Pillow is pinned exactly in `requirements.txt` for this reason. Bumping it is
expected to turn the goldens red — that is the test working, because a Pillow
bump really does change the PNGs you post. Check the slides still read
correctly, then `update`.

## Fixtures

| | |
|---|---|
| `clean-deck.json` | A correct carousel. Zero findings, and the golden deck. Exercises the cover pill, step numbers, the terminal window, body copy, CTA and the 9:16 canvas. |
| `findings.json` | One slide per check, with the exact codes it must produce. |
| `golden/` | Committed reference renders. Regenerate deliberately, never casually. |
| `golden/_failed/` | Written by a failing run. Gitignored. |
