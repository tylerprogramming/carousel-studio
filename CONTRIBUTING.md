# Contributing

Thanks for looking. This is a small app rather than a library — there is no
plugin API and no published package, so most changes are direct edits to code
someone will read six months from now.

Two things are worth knowing before you start, because they are the ones a first
pull request usually trips over: the renderer parity contract, and how the
golden tests treat your machine.

## Setup

```bash
git clone https://github.com/tylerprogramming/social-studio.git
cd social-studio
bun install && (cd client && bun install)
pip install -r requirements.txt

cp .env.example .env          # ANTHROPIC_API_KEY, only needed for generation
bun run dev                   # http://localhost:5175
```

You need [Bun](https://bun.sh) 1.1+, Python 3.9+ and Pillow. `ffmpeg` only if
you are touching video. You do not need an API key to work on the renderer, the
editor, or the tests — only to generate copy.

```bash
bun run test          # the whole suite
bun run typecheck     # server + client
```

Both run in CI on every pull request.

### If rendering does not work

Open `http://localhost:3010/api/health`. It reports which Python was chosen,
its Pillow, FreeType and Raqm versions, and whether ffmpeg is present. The app
does not trust `python3` to mean anything in particular — it looks for an
interpreter that can import Pillow. Pin one with `pythonPath` in
`settings.json`, or `CAROUSEL_PYTHON=/path/to/python` for a single run.

## The renderer parity contract

**`generate_slide.py` and `client/src/components/SlidePreview.tsx` are two
implementations of one design. Changing one means changing the other.**

If they drift, the app stops being a preview of what you post, which is the
only thing it is really for. Every geometry constant, font size, weight and
colour rule exists in both.

Every number that differs between the 4:5 canvas and the 9:16 one lives in a
single table — `terminal_geometry()` in Python, `terminalGeometry()` in
`client/src/lib/geometry.ts`. Adding a canvas means editing that table, not
hunting literals. `bun run test` diffs the two tables field for field, so drift
fails rather than ships.

The same applies to fonts: the renderer and the browser load the same files
from `fonts/`. Do not add a CDN link — the app makes no third-party requests and
works offline, and that is a promise in the README.

## Tests

Three suites, described properly in [`tests/README.md`](tests/README.md). The
short version:

| | fails when |
|---|---|
| `geometry-parity` | the Python and TypeScript geometry tables disagree |
| `check-slides` | the checker gained a false positive, or lost a check |
| `golden` | the exported PNGs changed |

**Adding a check to `check_slides.py` means adding a fixture.** A coverage test
reads the codes out of the source and fails if one has none.

### Goldens

The reference renders in `tests/fixtures/golden/` are tied to the machine that
made them — macOS with Menlo, in the committed manifest. On another platform the
suite skips itself and says why, because a different OS resolves a different
mono font and failing you for that would be pointless.

If your change is *meant* to alter the output:

```bash
bun run test:golden:update
```

Then **open the new PNGs before committing them.** A golden is only worth having
if what it records is correct; accepting a render without looking is how a bug
becomes the reference. A failing run leaves `expected`, `actual` and a diff map
in `tests/fixtures/golden/_failed/`.

If the goldens fail and you did not touch the renderer, check the reported
FreeType and Raqm versions. Pillow wraps them, they are linked at build time,
and they move independently of the version on the tin — a Homebrew Pillow and a
pip Pillow at the same version can render differently.

## Things that need no code

- **A theme** is one JSON file in `themes/`. Drop it in, reload. See
  [`themes/README.md`](themes/README.md).
- **A framework** is one JSON file in `frameworks/`, read at startup.

Both are the preferred way to add a look or a structure. If you find yourself
editing the renderer to get a different style, a theme may be the better answer.

## Pull requests

- One concern per PR. A refactor and a behaviour change in the same diff are
  hard to review and harder to revert.
- Say **why**, not just what. The commit log here is written to be read later;
  a message that explains the problem is worth more than one that lists files.
- If you fixed a bug, say how it showed up. "Exports were silently clipped" is
  a better record than "fix wrap".
- Screenshots for anything visual. Before and after if you changed a render.

CI runs typecheck, the three suites on Linux, the goldens on macOS, and imports
every Python script on 3.9 and 3.13. Green is expected before review.

## Reporting a bug

Use the templates — they ask for `/api/health` output on render bugs, which
answers most of them immediately.
