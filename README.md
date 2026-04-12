# Carousel Studio

A local web app for creating branded Instagram carousels with AI-generated background images. Built with Bun, Hono, React, and Vite.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Bun](https://img.shields.io/badge/runtime-Bun-black)

## Features

- **5 Content Frameworks** - Educational, Hormozi, Quick Wins, Storytelling, Instagram Writer
- **AI Background Images** - Generate per-slide or batch backgrounds via Kie.ai (Nano Banana 2)
- **Likeness Support** - Reference your own photo when generating AI images
- **Image Library** - Previously generated backgrounds are saved and reusable
- **Live Preview** - See exactly how slides look as you edit
- **Text Scale** - Per-slide font size control (XS → XL + fine-tuned slider)
- **Footer Branding** - "Save for Later" + "Swipe" footer on every slide (except the last)
- **Save & Load** - Carousels auto-save to local JSON files, reload from the drawer
- **Bulk Generate** - Generate multiple carousels at once from a list of topics
- **Export** - Download individual slide PNGs or a combined multi-page PDF

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | [Bun](https://bun.sh) |
| API Server | [Hono](https://hono.dev) (port 3010) |
| Frontend | React 18 + Vite (port 5175) |
| Styling | Tailwind CSS + Radix UI |
| Image Generation | [Kie.ai](https://kie.ai) via Python script |
| Slide Rendering | PIL (Pillow) for PNG export |
| PDF Export | PIL multi-page PDF |

## Prerequisites

- [Bun](https://bun.sh) installed
- Python 3 with Pillow: `pip install Pillow`
- A [Kie.ai](https://kie.ai) API key for background image generation

## Setup

### 1. Clone and install

```bash
git clone https://github.com/tylerprogramming/carousel-studio.git
cd carousel-studio
bun install
cd client && bun install && cd ..
```

### 2. Configure your API key

Create a file at `~/.claude/.env` (or set the environment variable directly):

```
KIE_API_KEY=your_kie_ai_key_here
```

The server reads this file automatically at startup.

### 3. (Optional) Set your likeness image

If you want AI-generated backgrounds to include your photo, create a `settings.json` in the project root:

```json
{
  "likenessPath": "/absolute/path/to/your-photo.png"
}
```

Then check "Use my likeness" in the Background Image panel before generating.

### 4. Run the dev server

```bash
bun run dev
```

Open [http://localhost:5175](http://localhost:5175) in your browser.

## Project Structure

```
carousel-studio/
├── server.ts              # Hono API server (port 3010)
├── generate_slide.py      # PIL slide renderer + PDF combiner
├── generate_bg_image.py   # Kie.ai image generation script
├── frameworks/            # JSON framework definitions
│   ├── educational.json
│   ├── hormozi.json
│   ├── quick-wins.json
│   ├── storytelling.json
│   └── instagram-writer.json
├── client/                # React + Vite frontend
│   └── src/
│       ├── App.tsx
│       ├── types.ts
│       ├── components/
│       │   ├── SlidePreview.tsx       # Live slide renderer
│       │   ├── SlideEditor.tsx        # Slide content + style editor
│       │   ├── SlideList.tsx          # Slide strip navigation
│       │   ├── BatchModal.tsx         # Bulk carousel generator
│       │   ├── SavedCarouselsDrawer.tsx
│       │   ├── ImageLibrary.tsx
│       │   └── GenerateModal.tsx
│       └── hooks/
│           └── useMediaQuery.ts
├── output/                # Generated PNGs (gitignored)
├── carousels/             # Saved carousel JSON files (gitignored)
└── settings.json          # Local config: likenessPath (gitignored)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/frameworks` | List available frameworks |
| `POST` | `/api/ai-generate` | Generate slides from a topic + framework |
| `GET` | `/api/carousels` | List saved carousels |
| `POST` | `/api/carousels` | Save a carousel |
| `GET` | `/api/carousels/:id` | Load a carousel |
| `DELETE` | `/api/carousels/:id` | Delete a carousel |
| `POST` | `/api/bulk-generate` | Bulk generate multiple carousels |
| `POST` | `/api/generate-bg-image` | Generate AI background (SSE stream) |
| `POST` | `/api/export-slide` | Render one slide to PNG |
| `POST` | `/api/export-all` | Export all slides to PNG + PDF |
| `GET` | `/api/settings` | Get app settings |
| `POST` | `/api/settings` | Update app settings |

## Frameworks

Frameworks define the slide structure, tone, and content style. Each framework is a JSON file in `frameworks/`:

```json
{
  "id": "hormozi",
  "name": "Hormozi",
  "description": "Contrarian, proof-driven, authority-based",
  "slideCount": 7,
  "slides": [...]
}
```

You can add your own by dropping a new `.json` file in `frameworks/` — the server auto-discovers them.

## Export

Exported carousels are saved to `~/content/carousel/<slug>/`:

```
~/content/carousel/my-carousel/
  slide_1.png
  slide_2.png
  ...
  my-carousel.pdf
```

## License

MIT
