# Changelog

## 2.2.0

**Bring your own typeface.** A branded content tool that cannot use your brand's
font is a strange thing, and this one had Inter compiled into both halves.
`fontPath` and `monoFontPath` in settings.json now choose the faces — a filename
in `fonts/`, or an absolute path. The renderer is handed the resolved paths and
the browser is served the same files, because a CSS stack the exporter cannot
read would break the promise that the preview is a preview. `check_slides.py`
gets them too: a deck set in a wider face measured in Inter would report as
fitting when it does not. Variable fonts get their weight axis driven properly;
static fonts work but come out at one weight. See [`fonts/README.md`](fonts/README.md).

That surfaced a bug worth naming. Variable-font axes were set positionally, as
`[14.0, weight]` — correct for Inter and wrong for anything else, since a font
declaring its axes in a different order would have had its weight written into
whichever axis came second. Axes are found by name now. Inter resolves to the
same values it always did, and the reference renders are unchanged.

**Alt text for every slide, with no API key.** Carousels are among the least
accessible formats going: the words are baked into a picture, so a screen reader
gets nothing unless someone types them out again. These slides are almost
entirely text, which makes the description mostly mechanical, so it is composed
locally and deterministically — accessibility is not the one feature that needs
a credit card. `/api/captions` then asks a model to do better with the whole
carousel in view, and falls back per slide, so one skipped entry cannot leave a
slide undescribed. Terminal commands are read out verbatim rather than
summarised as "a terminal window", which would discard the only thing on the
slide worth having. Written into `captions.md` and editable per slide.

**A place to start, if you want to contribute.** There was no CONTRIBUTING and
no issue templates, which was fine while this was one person's repo and stopped
being fine when it gained a test suite, a parity contract and CI that runs on
strangers' pull requests. The render-bug template asks for `/api/health` first,
because that output answers most render reports outright.

**`server.ts` is 667 lines, down from 1,580.** The machinery moved to `lib/` and
the three largest route groups to `routes/`. Nothing about behaviour changed, and
that was checked rather than assumed: the route surface was diffed against a list
taken before any of it started and stayed identical at all 35 routes through
every move.

Route tests came first, because `server.ts` had no coverage of any kind — the
other suites all exercise the Python side. They are shaped around the failures
this file has actually had, including a path that once fell through to the SPA
catch-all and answered a request for an image with HTML.

## 2.1.8

**No CDN.** The README's first claim was that nothing leaves your machine
except calls to the model provider you configure, and every page load hit
fonts.googleapis.com. Inter and JetBrains Mono are now declared as `@font-face`
against the same files in `fonts/` that the renderer draws with, so the editor
makes no third-party request and works with the network off. Verified in a
browser against the production build: nine requests on load, all to localhost.

It was also a parity hole. The exporter used the vendored Inter while the
browser used Google's — the same face, not guaranteed the same cut, and nothing
in the test suite could have caught them diverging because the goldens only
exercise the Python side. With the CDN unreachable the UI fell back to
system-ui while exports stayed Inter, so the preview stopped being a preview at
the moment you were least able to tell.

Inter's optical-size axis is pinned to match. It runs 14 to 32 and browsers
default to `font-optical-sizing: auto`, so a 118px headline was drawn with a
display cut — but the renderer pins the axis at 14 for every size. The preview
was letting the browser reshape type the exporter never reshapes.

**The app finds a Python that can render** instead of spawning the literal
`python3` at fourteen call sites. That name means "whatever is first on PATH
right now", and it moves: a Homebrew Python arrived here as somebody else's
dependency, took the name, and rendering broke silently — the server started,
the editor loaded, and the next export would have failed with an ImportError in
a toast. Set `pythonPath` in settings.json to pin one, or `CAROUSEL_PYTHON` to
override for a single run. A configured interpreter that cannot import Pillow
is skipped with a warning rather than obeyed in silence.

**The editor says so before you start.** A banner reports when no Python with
Pillow was found, listing what was tried, and separately when ffmpeg is missing
— video only, PNG and PDF are unaffected. It renders nothing when everything is
present. `GET /api/health` answers the same question over HTTP.

**Example slides and the editor are in the README**, composed from the golden
fixtures so the picture is the renderer's verified output rather than an old
screenshot.

The golden manifest records FreeType and Raqm alongside Pillow, because Pillow's
version does not determine rendering — it wraps them, they are linked at build
time, and they move independently. Measured here, FreeType 2.13.3 without Raqm
against 2.14.3 with it moved 1.15% of pixels, fifty times the failure
threshold. That provenance now explains a pixel failure rather than gating on
one, so a patch release that shifts nothing no longer turns the suite red.

## 2.1.7

**The terminal variant exported in a sans face on Linux and Windows.**
`MONO_FONTS` held two paths, both under `/System/Library/Fonts`. On any other
OS neither exists, `load_mono()` fell through to `load_font()`, and that is
Inter — proportional. So the terminal window, whose whole point is looking like
a terminal, drew commands in a sans face. The preview did not, because its CSS
ended in the generic `monospace` keyword, which a browser resolves to a real
mono. Preview and export disagreed on every non-Mac machine.

It had a second symptom: `check_slides.py` measures with `load_mono()` too, so
the checker's answers depended on which machine ran it. The same slide reported
clean on Linux and overflowing on macOS.

JetBrains Mono is vendored (SIL OFL 1.1) as the last entry rather than the
first. Menlo still wins on macOS, so existing decks render byte-identically —
verified by regenerating the reference images and finding that not one PNG was
rewritten. `SlidePreview` mirrors the same order and loads the same face, so
the preview shows the font the exporter will use.

**Tests and CI**, which is how the above was found. Three suites: the geometry
tables in `generate_slide.py` and `client/src/lib/geometry.ts` are diffed field
for field, so the parity contract fails instead of drifting; `check_slides.py`
runs against fixtures with known findings, including a deck that must come back
completely clean; and the exporter is compared to committed renders. Thresholds
for that last one were measured rather than guessed — rendering is exactly
deterministic, and the quietest regression worth catching still moves about
0.1% of the frame.

`typecheck` never ran. The repo root had no `tsconfig.json`, so `tsc --noEmit`
printed its help and exited 1, and the `&&` meant the client half was never
reached either.

**Upgrading:** `requirements.txt` now pins Pillow exactly at 11.3.0 rather than
flooring it at 10. The reference renders are compared pixel by pixel and Pillow
ships its own FreeType, so a different version rasterizes text differently. If
you share a Python environment with something else that wants Pillow 10, this
is the one change here that will notice.

## 2.1.6

**A native 9:16 slide, instead of a 4:5 one padded to fit.** Slides are drawn
1080x1350; TikTok is 1080x1920. `tiktok_safe.py` adapted a finished slide by
insetting it, which left about 44% of the frame as flat background — 147px
above and 241px below on a 495x880 preview. That is arithmetic, not something
margin tuning fixes.

The `tall` variant is the same terminal design drawn at 1080x1920, chosen
through `themes/terminal-tall.json` like any other theme. A `tall` carousel
skips the TikTok reframe, because it is already the right shape.

Every number that differs between the two canvases lives in one table:
`terminal_geometry()` in `generate_slide.py`, mirrored as `terminalGeometry()`
in `SlidePreview.tsx` and imported by `check_slides.py`. Those constants used
to be duplicated literals in all three, which is fine with one canvas and
silently wrong with two.

Existing 4:5 carousels are untouched — verified byte-identical against a
shipped slide, with the checker still reporting the same findings across all
nine.

## 2.1.5

**One editor, one preview.** Choosing TikTok used to swap the whole desktop
layout for a different panel, which meant the Inspector vanished — you could
not edit a caption, a style or an image on a TikTok carousel — and the
readiness rail was skipped. There were also two separate phone previews in the
codebase, so a safe-area fix once landed in the copy that only rendered below
1200px and looked like it had done nothing.

The platform switcher now changes what the canvas shows and nothing else.
`InstagramPreview.tsx` became `PlatformPreview.tsx` and is the only phone
preview; `TikTokPanel.tsx` is deleted. Its "Exported for TikTok" block is not
reproduced, because the Exports panel already rendered every part of it for
every platform — the panel was a second copy. Exports now auto-opens on the
carousel you are editing, and video plays in the phone frame rather than a
cramped inline player.

Two things fixed on the way: the stale-variant banner said "rebuild before
posting" while the rebuild button was hidden whenever a set already existed,
and the safe-area guide was drawn in white on slides that are mostly light.

## 2.1.4

**Exports is a docked panel, not a modal.** Exports is where you confirm the
work is right, which is exactly when you want the editor still in front of
you. A modal made checking a slide and then fixing it three separate trips.

It now takes the right-hand column, swapping with the Inspector rather than
adding a fourth column — at the 1200px desktop breakpoint a fourth column
would pin the canvas to its 320px floor. Sharing the slot also gives that
column one meaning at a time: change this slide, or check what shipped. Below
1200px the desktop row is not rendered at all, so the overlay remains the
fallback there.

Every capability is intact: variant tabs, video playback, the build buttons,
captions, downloads, and the stale-variant warning.

## 2.1.3

**Check findings appear on the slides.** The pre-export check finds real
defects — it caught a headline clipped to "/embedded-captio" that had already
been exported and scheduled. But findings only arrived as JSON attached to an
export result, and a line saying "slide 3" is not read the way a mark on slide
3 is.

The check now runs 800ms after edits settle. Affected thumbnails carry a dot,
red for error and amber for warning. The selected slide's findings sit above
the Inspector tabs, errors first, because the fix lands in a different tab
depending on the finding. A header badge gives the count and jumps to the
first affected slide, and stays quiet when clean. Export is never blocked.

Fixes a real bug found on the way: slides written server-side by Generate and
Batch were stored with no id, so 9 of 11 saved carousels had `id: null` on
every slide. React was keying every thumbnail as `undefined`, which made
drag-reorder unreliable and would have put every finding on every slide. Ids
are now backfilled on load.

## 2.1.2

**Readiness rail in the editor.** Whether a carousel could be posted took three
places to answer: the Library drawer, the Exports gallery, and the filesystem.
You are never in the Library while you are editing.

A fixed-height strip along the bottom now shows four pips: caption, gate,
exported, TikTok set. Caption and gate read from memory so they update as you
type; the disk-backed two come from a new
`GET /api/carousels/:id/readiness`. Hovering a pip says what is missing and
where to fix it. When everything is satisfied it says so rather than
disappearing — a vanishing indicator is worse than a calm one.

The readiness logic moved into one `carouselStatus()` used by both the list
endpoint and the new one, so there is still a single definition of "ready"
rather than two that can drift.

## 2.1.1

**Caption tab in the Inspector.** Captions were a field on the carousel with
nowhere to edit them, reachable only through a modal that generated and
disposed. Nine carousels reached the day before posting with no caption
because nothing in the editor showed the field was empty. Now a fourth tab
alongside Content / Style / Image, with Instagram, TikTok and LinkedIn copy,
the gate keyword, hashtags, and live character counts against each platform's
limit. Edits go through the same history as everything else, so undo works.

Fixes a bug that would have destroyed the backfilled captions: `config.captions`
was dropped when loading a carousel, and since autosave POSTs the whole config
back, opening one and touching anything would have written its caption away
after the debounce.

The captions modal is gone. Two entry points would have disagreed about where
a caption lives.

## 2.1.0

TikTok, and video that plays.

### Added
- **TikTok slideshow sets** — `tiktok_safe.py` re-frames a finished 4:5 slide
  into 1080x1920 clear of TikTok's caption block, action rail and tab chrome.
  Exports as JPG, which is what TikTok photo slideshows actually accept; PNG is
  rejected. Build one from the Exports gallery or `POST /api/export-tiktok`.
- **Carousel videos** — `slides_to_video.py` plays a whole set as one vertical
  clip, paced per slide rather than squeezed into a fixed runtime. Optional
  crossfade and audio bed.
- **Summary cards** — `POST /api/summary-slide` lifts the takeaway from every
  slide onto one card, and optionally carries it through to a clip.
- **Audio** — an `audio/` folder and `audioPath` setting for video beds.
  Nothing is bundled; see `audio/README.md`.
- **Platform variants in the gallery** — any subfolder of slides shows as a
  variant with its own tab, and a variant older than the main set is flagged
  stale rather than silently posted.

### Changed
- The TikTok preview shows the exported framing instead of a full-bleed slide
  TikTok would crop, and scales to the window like the Instagram one.
- Carousel videos are paced at seconds per slide (default 2.5), so runtime
  follows the slide count.
- Video cards render at a larger text scale, since a card read in five seconds
  needs bigger type than one you can pinch-zoom.

### Fixed
- **Terminal lines now wrap.** They were drawn without wrapping, so anything
  past the window edge was silently cut. The preview wrapped; the exporter did
  not.
- Media is served with correct content types on every route. An mp4 came back
  labelled as an image from three separate handlers, so video would not play.
- Platform-variant paths 404'd into the SPA, so variant thumbnails rendered as
  broken images.
- The client and server derived export slugs differently, so exporting from the
  UI wrote to a second folder and left the first silently stale.
- Exported videos are viewable in the app rather than only on disk.

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
