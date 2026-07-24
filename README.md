# Carousel Studio

A local web app for building branded Instagram and LinkedIn carousels with AI-written copy and AI-generated backgrounds. Bun + Hono on the server, React + Vite in the browser, Pillow for export.

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![Bun](https://img.shields.io/badge/runtime-Bun-black)

## Features

- **5 content frameworks** — Educational, Hormozi, Quick Wins, Storytelling, Instagram Writer
- **AI slide copy** — Claude Opus 5 writes every slide from a topic + framework, constrained to a JSON schema
- **AI captions** — Instagram caption with 5 hashtags and a LinkedIn caption with none, written from the finished slides and saved as `captions.md`
- **AI backgrounds** — per-slide or whole-carousel images via Kie.ai, generated concurrently
- **Likeness support** — reference your own photo so generated people look like you
- **What you see is what you export** — the PNG renderer is a deliberate mirror of the live preview (same font, geometry, and colour rules)
- **Undo / redo** with keystroke coalescing, so typing is one undo step rather than one per character
- **Drag to reorder**, duplicate slide, saved colour themes
- **Multi-platform previews** — Instagram, LinkedIn, and TikTok phone mockups
- **Export** — individual PNGs, a combined multi-page PDF, or both
- **iPad / tablet layout** — tabbed Slides / Edit / BG / Preview under 1200px

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘Z` / `⇧⌘Z` | Undo / redo |
| `⌘S` | Save now |
| `⌘D` | Duplicate current slide |
| `⌘E` | Export |

## Tech stack

| Layer | Tech |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| API server | [Hono](https://hono.dev), port 3010 |
| Frontend | React 19 + Vite 8, port 5175 |
| Slide copy & captions | [Claude Opus 5](https://platform.claude.com) via `@anthropic-ai/sdk` |
| Background images | [Kie.ai](https://kie.ai) (Nano Banana Pro / Nano Banana 2) |
| Slide rendering | Pillow, with Inter vendored in `fonts/` |

## Setup

### 1. Install

```bash
git clone https://github.com/tylerprogramming/carousel-studio.git
cd carousel-studio
bun install
cd client && bun install && cd ..
```

Python side: `pip install Pillow`. `ffmpeg` is optional — it's only used to pull the first frame of a background or inset video during export.

### 2. Configure keys

```bash
cp .env.example .env
```

Then fill in:

| Key | Needed for |
|---|---|
| `ANTHROPIC_API_KEY` | Slide copy and captions (Claude Opus 5) |
| `KIE_API_KEY` | AI background images |
| `OPENAI_API_KEY` | Optional fallback, only used when `ANTHROPIC_API_KEY` is unset (`gpt-5-mini`) |

Both AI paths are constrained to the same JSON schema, so the response shape is identical either way. Real environment variables override `.env`. If you use Claude Code, keys already in `~/.claude/.env` are picked up automatically and you can skip this step.

### 3. (Optional) Make it yours

```bash
cp settings.example.json settings.json
```

| Field | What it does |
|---|---|
| `handle` | Your handle. Appears on CTA slides and in the preview mockups. |
| `brandVoice` | A sentence describing how captions should sound. Appended to the caption prompt. |
| `exportDir` | Where exports are written. Defaults to `./exports`. |
| `likenessPath` | A photo of you, used as a reference image when "Use my likeness" is checked. |
| `likenessDescription` | Appended to the image prompt so the model gets your appearance right. |

### 4. Run

```bash
bun run dev
```

Open http://localhost:5175.

For a production build: `bun run build && bun run start`, then open http://localhost:3010.

### 5. (Optional) Reach it from an iPad

```bash
ngrok http --url=your-domain.ngrok-free.app --basic-auth="user:password" 5175
```

Allow the tunnel host via env var rather than editing the config:

```bash
VITE_ALLOWED_HOSTS=your-domain.ngrok-free.app bun run dev
```

## Project structure

```
carousel-studio/
├── server.ts                  # Hono API (port 3010)
├── generate_slide.py          # Slide renderer + PDF combiner
├── generate_bg_image.py       # Kie.ai image generation
├── flash_video.py             # Short-form video generation
├── fonts/Inter-Variable.ttf   # Vendored so exports match the preview
├── .env.example               # Copy to .env and add your keys
├── settings.example.json      # Copy to settings.json to set handle, voice, export dir
├── frameworks/                # Framework definitions, auto-discovered
└── client/src/
    ├── App.tsx
    ├── lib/tokens.ts          # Single source of truth for chrome colours
    ├── hooks/useHistory.ts    # Undo/redo
    └── components/
        ├── SlidePreview.tsx   # Live renderer — twin of generate_slide.py
        ├── SlideEditor.tsx    # Content + style editing
        ├── SlideList.tsx      # Slide strip, drag to reorder
        ├── ThemePicker.tsx    # Saved colour themes
        ├── CaptionModal.tsx   # Caption generation
        └── icons.tsx          # Shared inline SVGs
```

## Renderer parity

`generate_slide.py` and `client/src/components/SlidePreview.tsx` are two implementations of the same design. Every geometry constant, font size, weight, and colour rule appears in both, and **changing one means changing the other** — otherwise the app stops being a preview of what you actually post.

The renderer reproduces the CSS layout model directly: line boxes with half-leading rather than stacked bounding boxes, `object-fit: cover` cropping rather than a stretch-to-fill resize, and Inter selected on its variable weight axis rather than a lookalike system font.

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/frameworks` | List frameworks |
| `POST` | `/api/ai-generate` | Generate slides from a topic + framework |
| `POST` | `/api/bulk-generate` | Generate several carousels at once |
| `POST` | `/api/captions` | Write Instagram + LinkedIn captions |
| `GET` `POST` | `/api/carousels` | List / save carousels |
| `GET` `DELETE` | `/api/carousels/:id` | Load / delete a carousel |
| `POST` | `/api/generate-bg-image` | Generate backgrounds (SSE stream) |
| `GET` `DELETE` | `/api/images` | Browse / delete generated backgrounds |
| `POST` | `/api/export-slide` | Render one slide to PNG |
| `POST` | `/api/export-all` | Render every slide, plus PDF |
| `POST` | `/api/flash-video` | Generate a short-form video |
| `GET` | `/api/flash-videos` | List generated videos |
| `GET` `POST` | `/api/settings` | Read / update settings |
| `GET` | `/files/:filename` | Serve generated output |
| `GET` | `/carousel-output/:slug/:filename` | Serve exported carousels |

## Frameworks

Each framework is a JSON file in `frameworks/`, discovered automatically at startup:

```json
{
  "id": "hormozi",
  "name": "Hormozi",
  "description": "Contrarian, proof-driven, authority-based",
  "slideCount": 7,
  "systemPrompt": "…",
  "slides": [{ "slideNumber": 1, "type": "cover", "purpose": "…" }]
}
```

`systemPrompt` sets the voice; each slide's `purpose` tells the model what job that slide does in the arc. Neither is sent to the browser.

## Export

Exports go to `./exports/<slug>/` by default. Point `exportDir` in `settings.json` (or `CAROUSEL_EXPORT_DIR`) somewhere else to write straight into a content repo.

```
exports/my-carousel/
  slide_1.png
  …
  captions.md
  my-carousel.pdf
```

## License

MIT
