# Changelog

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
