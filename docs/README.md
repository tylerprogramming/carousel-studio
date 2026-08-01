# README images

`slides.png` is built from `tests/fixtures/golden/`, the reference renders the
golden tests compare every build against. That is deliberate: the picture in
the README is the renderer's actual output, verified on every push, rather than
a screenshot someone took once and never revisited.

Rebuild it after regenerating the goldens:

```bash
python3 docs/build_slides.py
```

`editor.jpg` is a screenshot of the app running the same fixture deck. It uses
fixture content on purpose — a screenshot of real work would put unpublished
carousels into a public repo.

# Decisions

`decisions/` holds the reasoning behind choices that were argued about, so the
argument does not have to happen twice. They record what was measured, not just
what was chosen.

- [`001-making-it-easy-to-run.md`](decisions/001-making-it-easy-to-run.md) —
  what the least a person has to install could be. Docker, bunx, Codespaces, a
  bundled Python, and a measured spike of the TypeScript renderer port.
