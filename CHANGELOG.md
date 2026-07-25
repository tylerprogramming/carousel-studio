# Changelog

## 2.0.0

A rewrite of the export path, the editor layout and the generation pipeline.
The app is now standalone: nothing personal is baked in, and it runs from a
fresh clone with only `settings.example.json` copied and an API key added.

### Added
- **Terminal slide variant** — dark mono layout with a real terminal window,
  for command-line content.
- **Background photos and video on slides**, with a `bottomFade` ramp so an
  image dissolves into the slide instead of ending on a hard edge.
- **Video carousel slides** (`slide_video.py`) — Instagram accepts a video
  slide beside image slides, so slide 1 can move. Renders the slide furniture
  on alpha and composites it over a still with a slow push-in, or over your own
  clip. Optional audio bed.
- **TikTok re-framing** (`tiktok_safe.py`) — re-frames a finished 4:5 slide
  into 1080x1920 clear of TikTok's caption block, action rail and tab chrome.
- **Themes as files** — every `.json` in `themes/` becomes a swatch. Drop a
  file in, reload, done. See `themes/README.md`.
- **Background image generation** via kie.ai, with an optional likeness
  reference, run through a **job queue** so the editor stays usable while
  images render.
- **Exports gallery**, **undo/redo**, and **shift-click to apply any control to
  every slide**.

### Changed
- Editor and background panels merged into one **Inspector** with Content /
  Style / Image tabs; actions moved to a top bar. The canvas gained ~630px.
- Images are filed **by purpose** (`images/<carousel>/slide-NN-<prompt>.png`),
  not by date.
- Generation uses **Claude Opus 5** with structured outputs, with an OpenAI
  fallback.
- Exports default to `./exports`; override with `exportDir` or
  `CAROUSEL_EXPORT_DIR`.

### Fixed
- Exported PNGs now match the preview. The renderer reproduces the CSS line-box
  model, `object-fit: cover` cropping, and font weights, rather than stretching
  images and guessing leading.
- Media served with correct content types. An mp4 was being labelled as an
  image on three separate routes, so video would not play anywhere.
- An inset `.mp4` no longer crashes the whole slide export.
- `load_font(bold=False)` was accepted and ignored, so "muted" lines rendered
  at headline weight.
- Path traversal is blocked on every media route.
- Long emphasis lines wrap instead of running off the slide.

### Notes
- `generate_slide.py` and `client/src/components/SlidePreview.tsx` are
  deliberate twins. Changing one means changing the other.
- `flash_video.py` (1080x1920 Reels) and `slide_video.py` (1080x1350 carousel
  slides) are separate on purpose.
