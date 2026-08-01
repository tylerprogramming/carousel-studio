# Making it easy to run

**Status:** open. `bun run setup` shipped in v2.3.0; everything below is still a
decision, not a plan.

**Date:** 2026-08-01

## The question

Social Studio needs Bun *and* Python, and the renderer is Pillow. For someone
who already has both, `bun run setup` is now one command and this is a solved
problem. For everyone else, the runtimes are the barrier — and on Windows,
Python usually is not there at all.

So: what is the least a person has to install before this works?

## Options, and what each actually asks of the user

| | they install | then |
|---|---|---|
| today | Bun, Python | clone, cd, `bun run setup`, `bun run dev` |
| **bunx** | Bun, Python | `bunx social-studio` |
| **Codespaces** | *nothing* | click a button in the README |
| **bundled Python** | Bun | `bunx social-studio` |
| **Docker** | Docker Desktop | `docker compose up` + volume config |
| **port to TypeScript** | Bun | `bunx social-studio` |

### Docker is not the universal answer it looks like

It swaps one install for a bigger one. Docker Desktop is ~600MB, wants admin
rights, runs a Linux VM on macOS and Windows, and is licensed for larger
companies. That is a heavier ask than Python, not a lighter one — it is only
easy for people who already have it.

It also fits this app badly. Social Studio's job is writing files to your disk,
and a container cannot see the filesystem without bind mounts. `exportDir:
~/Desktop/carousels` would resolve inside the container. Workable, but it means
volume config and a caveat in the README.

Worth having eventually. Not the headline.

### bunx removes the clone, not the runtimes

Publishing to npm turns four commands into `bunx social-studio` — no git, no
clone, no directory, and updates become `@latest` rather than `git pull` into a
tree the user has edited.

**Blocker first:** the app writes `carousels/`, `exports/`, `output/` and
`settings.json` under `APP_ROOT`. Installed globally that is inside
`node_modules` — wrong, and wiped on reinstall. Needs a code root / data root
split, with data defaulting to `~/.social-studio/`. `lib/paths.ts` already
centralises every path, so this is contained rather than a hunt.

### Bundling Python is the cheapest real fix

There are redistributable, relocatable Python builds (`python-build-standalone`,
which is what `uv` uses). On first run, if no interpreter with Pillow is found,
the app can fetch `uv`, then:

```
uv python install 3.12
uv venv ~/.social-studio/venv
uv pip install -r requirements.txt
```

`~/.social-studio/venv/bin/python` then becomes one more candidate in
`lib/python.ts`, tried **after** the user's own — so anyone with a working Python
never downloads anything.

Nothing touches the system Python. No admin rights. No `--break-system-packages`.
Costs a slower first run (~50–80MB), a cache directory, and a download-and-verify
path to maintain.

The user does **not** install uv. The app fetches it. Telling users to install uv
would only trade "install Python" for "install uv", which is not a win.

### The TypeScript port — measured, not guessed

Porting the renderer would leave one runtime, and could collapse
`generate_slide.py` and `SlidePreview.tsx` into a single implementation — which
would eliminate structurally every parity bug this project has had, rather than
catching them.

It was spiked against `@napi-rs/canvas` (Skia) before being deferred. Findings:

**Canvas ignores variable font axes.** The same string at weight 400 and 800:

| | 400 | 800 |
|---|---|---|
| Pillow (variable axis) | 1467.0px | 1530.0px |
| Canvas, variable font | 1461.6px | **1461.6px** |

Identical. The weight axis is not applied, so the entire type hierarchy — 800
headlines against 400 body — would silently flatten to one weight.

**The workaround holds.** Static instances cut with `fonttools`, registered under
separate family names:

| | 400 | 800 |
|---|---|---|
| Pillow | 1467.0px | 1530.0px |
| Canvas + static instances | 1461.6px | **1521.2px** |

**Metrics still differ by ~0.5%.** Small, but enough to move where a headline
wraps, so a port would not be pixel-free. It would be a tuning exercise against
the golden tests, which is exactly what makes it *possible* — they give a
measurable definition of "the port is correct" rather than squinting at slides.

**Text wrapping ports cleanly.** Neither Pillow nor Canvas wraps automatically;
`generate_slide.py` already implements `wrap_text` against measured widths, and
that logic moves across almost line for line.

Verdict: viable, not free. No blocker, but two things that make it a project
rather than a translation — static font files, and chasing the last half-percent
of metrics. Deferred because it risks the one thing the app is actually good at,
in exchange for elegance rather than a fix for something broken.

## Where this lands

In order of value per unit of work:

1. **Codespaces button** — a single `.devcontainer/devcontainer.json`. The only
   option that asks the user to install literally nothing.
2. **bunx**, after the code/data root split.
3. **Bundled Python via uv** — makes Windows work without asking anything.
4. **Docker** — for people who already have it.
5. **TypeScript port** — when there is appetite, as a spike behind a flag with
   the goldens as the acceptance test. Not a big-bang rewrite.

## What is already decided

- `bun run setup` installs what is the app's business and *directs* for what is
  not. A language runtime does not get silently installed on someone's machine.
  A bundled Python in `~/.social-studio/` is not the same thing as installing one
  system-wide, which is why option 3 is consistent with this.
- The app must keep working with no API key. Editing, rendering, exporting,
  themes, fonts and alt text do not need one.
