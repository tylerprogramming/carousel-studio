import { Hono } from 'hono'
import { cors } from 'hono/cors'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, resolve, sep } from 'path'

import {
  APP_ROOT, CAROUSELS_DIR, DIST_DIR, FRAMEWORKS_DIR, OUTPUT_DIR, THEMES_DIR,
  audioDir, ensureDirs, expandPath, exportDir, imagesDir, resolveAudio, resolveMediaPath,
} from './lib/paths'
import { creatorHandle, loadEnv, readSettings, writeSettings } from './lib/settings'
import { MIME, mediaType, pngSize, slugFromTitle } from './lib/media'
import { FONTS_DIR, fontPayload, listFonts } from './lib/fonts'
import { seedExamples } from './lib/examples'
import {
  hasFfmpeg, python, pythonBin, pythonCandidates, reportPython,
} from './lib/python'
import { aiRoutes } from './routes/ai'
import { jobRoutes } from './routes/jobs'
import { renditionRoutes } from './routes/renditions'

// Exported so tests can drive the routes with app.fetch(new Request(...))
// without binding a port. Nothing else imports it.
export const app = new Hono()
app.use('*', cors())

ensureDirs()
loadEnv()

// A fresh clone has no carousels, so the editor opened on nothing at all. Only
// ever fills an empty directory — see lib/examples.ts.
const seeded = seedExamples()

// ── App Settings (likeness path, etc.) ───────────────────────────────────────

app.get('/api/settings', (c) => c.json(readSettings()))

app.post('/api/settings', async (c) => {
  const body = await c.req.json()
  writeSettings(body)
  return c.json({ ok: true, settings: readSettings() })
})

/** Can this machine actually do the work? Answering before you have built a
 *  carousel is the whole point: a missing Pillow used to surface as an
 *  ImportError in a toast at the moment you pressed Export. */
app.get('/api/health', (c) => {
  const py = python()
  return c.json({
    ok: !!py,
    python: py,
    // Which candidates were considered, so "it picked the wrong one" is a
    // debuggable statement rather than a guess.
    searched: pythonCandidates(),
    configured: (readSettings().pythonPath || '').trim() || null,
    ffmpeg: hasFfmpeg(),
    // Only video needs ffmpeg; PNG and PDF do not.
    capabilities: { render: !!py, video: !!py && hasFfmpeg() },
  })
})

/** The typefaces available to draw with, and which are selected. */
app.get('/api/fonts', (c) => c.json(listFonts()))

/** Serve a font file to the browser.
 *
 *  The same file the renderer draws with, which is the entire point — a custom
 *  face that only the exporter can see would make the preview a preview of the
 *  wrong thing. Confined to fonts/ by basename, so a configured absolute path
 *  cannot be used to read elsewhere on disk. */
app.get('/fonts/:name', async (c) => {
  const name = c.req.param('name')
  if (name.includes('/') || name.includes('..')) return c.text('Not found', 404)
  const path = join(FONTS_DIR, name)
  if (!existsSync(path)) return c.text('Not found', 404)
  return new Response(Bun.file(path), {
    headers: {
      'Content-Type': mediaType(name) === 'application/octet-stream'
        ? (MIME[name.slice(name.lastIndexOf('.')).toLowerCase()] ?? 'font/ttf')
        : mediaType(name),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

// ── Themes ────────────────────────────────────────────────────────────────────

// A theme is one JSON file in themes/. Drop a file in, reload the app, and it
// shows up — no rebuild, no code change. See themes/README.md for the fields.
app.get('/api/themes', (c) => {
  try {
    const themes = readdirSync(THEMES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const t = JSON.parse(readFileSync(join(THEMES_DIR, f), 'utf8'))
          if (!t.bgColor || !t.textColor || !t.accentColor) return null
          return { ...t, id: t.id || f.replace(/\.json$/, ''), builtin: true }
        } catch { return null }   // one malformed file must not hide the rest
      })
      .filter(Boolean)
      // Explicit `order` keeps the swatch row stable; readdir order is not.
      .sort((a: any, b: any) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name))
    return c.json(themes)
  } catch {
    return c.json([])
  }
})

// ── Carousel Save / Load ──────────────────────────────────────────────────────

/**
 * Everything needed to answer "can this be posted yet", in one place. It used
 * to take the Library, the Exports gallery and the filesystem.
 *
 * The Library list and the editor's readiness rail both go through here, so
 * there is one definition of ready rather than two that quietly disagree.
 *
 * `slugOverride` is for the editor: the title picks the export folder, and the
 * title in the editor can be ahead of the title on disk.
 */
function carouselStatus(d: any, slugOverride?: string) {
  // What has actually been exported for this carousel, so callers can say
  // whether an Instagram, TikTok or video version exists rather than making
  // you open the Exports gallery to find out.
  const slug = slugOverride || slugFromTitle(d.title)
  const slugDir = join(exportDir(), slug)
  let exported: string[] = []
  let hasVideo = false
  if (existsSync(slugDir)) {
    try {
      const files = readdirSync(slugDir, { withFileTypes: true })
      if (files.some((x) => x.isFile() && /^slide_\d+\.(png|mp4)$/i.test(x.name))) exported.push('default')
      for (const sub of files.filter((x) => x.isDirectory())) {
        try {
          if (readdirSync(join(slugDir, sub.name)).some((n) => /^slide_\d+\./i.test(n))) exported.push(sub.name)
        } catch { /* ignore */ }
      }
      hasVideo = files.some((x) => x.isFile() && /\.(mp4|mov|webm)$/i.test(x.name) && !/^slide_\d+\./i.test(x.name))
    } catch { /* ignore */ }
  }
  const caps = d.captions || {}
  const readiness = {
    hasCaption: !!(caps.instagram || caps.linkedin || caps.tiktok),
    hasGate: !!caps.gate,
    hasExport: exported.includes('default'),
    hasTikTok: exported.some((k: string) => k !== 'default'),
    hasVideo,
  }
  const blockers: string[] = []
  if (!readiness.hasCaption) blockers.push('no caption')
  if (!readiness.hasExport) blockers.push('not exported')
  return { slug, exported, hasVideo, readiness, blockers, ready: blockers.length === 0 }
}

// List all saved carousels (newest first)
app.get('/api/carousels', (c) => {
  const files = readdirSync(CAROUSELS_DIR).filter((f) => f.endsWith('.json'))
  const list = files
    .map((f) => {
      try {
        const d = JSON.parse(readFileSync(join(CAROUSELS_DIR, f), 'utf8'))
        return {
          id: d.id, title: d.title, platform: d.platform,
          slideCount: d.slides?.length ?? 0, savedAt: d.savedAt,
          ...carouselStatus(d),
        }
      } catch { return null }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
  return c.json(list)
})

// Save / upsert a carousel
app.post('/api/carousels', async (c) => {
  const body = await c.req.json()
  const id   = body.id || `carousel_${Date.now()}`
  const data = { ...body, id, savedAt: new Date().toISOString() }
  writeFileSync(join(CAROUSELS_DIR, `${id}.json`), JSON.stringify(data, null, 2))
  return c.json({ id, savedAt: data.savedAt })
})

// Load a carousel
app.get('/api/carousels/:id', (c) => {
  const path = join(CAROUSELS_DIR, `${c.req.param('id')}.json`)
  if (!existsSync(path)) return c.json({ error: 'Not found' }, 404)
  return c.json(JSON.parse(readFileSync(path, 'utf8')))
})

// Readiness for the one carousel that is open, so the editor's rail can answer
// "is anything missing" without pulling the whole Library list.
//
// A carousel that has never been saved has no file yet; that is not an error,
// it just means nothing is exported. The caller sends its live slug so the
// answer is about the folder this carousel would export to right now.
app.get('/api/carousels/:id/readiness', (c) => {
  const path = join(CAROUSELS_DIR, `${c.req.param('id')}.json`)
  let d: any = {}
  try { if (existsSync(path)) d = JSON.parse(readFileSync(path, 'utf8')) } catch { /* treat as unsaved */ }
  return c.json(carouselStatus(d, c.req.query('slug')))
})

// Delete a carousel
app.delete('/api/carousels/:id', (c) => {
  const path = join(CAROUSELS_DIR, `${c.req.param('id')}.json`)
  if (existsSync(path)) unlinkSync(path)
  return c.json({ ok: true })
})

// ── Frameworks ────────────────────────────────────────────────────────────────

app.get('/api/frameworks', (c) => {
  try {
    const files = readdirSync(FRAMEWORKS_DIR).filter((f) => f.endsWith('.json'))
    const frameworks = files.map((f) => {
      const raw = readFileSync(join(FRAMEWORKS_DIR, f), 'utf8')
      const fw = JSON.parse(raw)
      // Don't send the full systemPrompt to the client - keep it server-side
      const { systemPrompt, ...publicFramework } = fw
      return publicFramework
    })
    return c.json(frameworks)
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// ── AI generation and captions ─── moved to routes/ai.ts ─────────────────────
app.route('/', aiRoutes)

// ── Job queue ─── moved to routes/jobs.ts ────────────────────────────────────
app.route('/', jobRoutes)

// ── PIL Slide Generation ───────────────────────────────────────────────────────

app.post('/api/generate-slide', async (c) => {
  const body = await c.req.json()
  const { slideId, ...slideData } = body

  const filename = `slide_${slideId || Date.now()}.png`
  const outputPath = join(OUTPUT_DIR, filename)
  const payload = JSON.stringify({ ...slideData, handle: creatorHandle(), ...fontPayload(), output: outputPath })
  const scriptPath = join(APP_ROOT, 'generate_slide.py')

  const proc = Bun.spawn([pythonBin(), scriptPath, payload], { stdout: 'ignore', stderr: 'pipe' })
  const [exitCode, stderr] = await Promise.all([
    proc.exited, new Response(proc.stderr).text(),
  ])

  if (exitCode !== 0) return c.json({ error: `PIL generation failed: ${stderr}` }, 500)
  return c.json({ url: `/files/${filename}`, filename })
})

// Export all slides as PNG, PDF, or both → <exportDir>/<slug>/
app.post('/api/export-all', async (c) => {
  const { slides, carouselSlug, format = 'png' } = await c.req.json()
  // format: 'png' | 'pdf' | 'both'
  const slug    = carouselSlug || `carousel_${Date.now()}`
  const slugDir = join(exportDir(), slug)
  mkdirSync(slugDir, { recursive: true })
  const scriptPath = join(APP_ROOT, 'generate_slide.py')

  // Run the check first and hand the findings back with the result. It does
  // not block: a warning should not stop an export, and an error is usually
  // something you want to see rendered before you fix it.
  let check: any = null
  try {
    const cp = Bun.spawn([pythonBin(), join(APP_ROOT, 'check_slides.py'),
                          JSON.stringify({ slides })], { stdout: 'pipe', stderr: 'ignore' })
    const [cc, co] = await Promise.all([cp.exited, new Response(cp.stdout).text()])
    if (cc === 0) check = JSON.parse(co)
  } catch { /* a broken check must never stop an export */ }

  // Step 1: always generate PNGs — rendered in parallel, one python process per slide
  type Render = { slide: any; filename: string; outputPath: string; payload: string }
  const handle = creatorHandle()   // invariant across the batch
  const fonts  = fontPayload()     // likewise — one settings read, not one per slide
  const renders: Render[] = slides.map((slide: any) => {
    const filename   = `slide_${slide.slideNumber}.png`
    const outputPath = join(slugDir, filename)
    // Media URLs are resolved to absolute paths here, on the server, which owns
    // OUTPUT_DIR — the client has no business knowing where that lives on disk.
    const payload = JSON.stringify({
      ...slide,
      totalSlides:        slides.length,
      handle,
      ...fonts,
      backgroundImagePath: resolveMediaPath(slide.backgroundImage) ?? undefined,
      backgroundVideoPath: resolveMediaPath(slide.backgroundVideo) ?? undefined,
      insetImagePath:      resolveMediaPath(slide.insetImageUrl) ?? undefined,
      output: outputPath,
    })
    return { slide, filename, outputPath, payload }
  })

  const outcomes = await Promise.all(renders.map(async ({ slide, payload }) => {
    const proc     = Bun.spawn([pythonBin(), scriptPath, payload], { stdout: 'ignore', stderr: 'pipe' })
    const exitCode = await proc.exited
    if (exitCode !== 0) {
      return { ok: false as const, slideNumber: slide.slideNumber, stderr: await new Response(proc.stderr).text() }
    }
    return { ok: true as const }
  }))

  const failed = outcomes.find((o) => !o.ok)
  if (failed && !failed.ok) {
    return c.json({ error: `Slide ${failed.slideNumber} failed: ${failed.stderr}` }, 500)
  }

  // Keep slide order stable for the PDF regardless of which render finished first
  const pngPaths   = renders.map((r) => r.outputPath)
  const pngResults = renders.map((r) => ({
    slideNumber: r.slide.slideNumber,
    url:         `/carousel-output/${slug}/${r.filename}`,
    filename:    r.filename,
  }))

  // Step 2: generate PDF if requested
  let pdfResult: { url: string; filename: string } | null = null
  if (format === 'pdf' || format === 'both') {
    const pdfFilename = `${slug}.pdf`
    const pdfPath     = join(slugDir, pdfFilename)
    const pdfPayload  = JSON.stringify(pngPaths)

    const proc = Bun.spawn([pythonBin(), scriptPath, '--pdf', pdfPayload, pdfPath], { stdout: 'ignore', stderr: 'pipe' })
    const exitCode = await proc.exited
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      return c.json({ error: `PDF generation failed: ${stderr}` }, 500)
    }
    pdfResult = { url: `/carousel-output/${slug}/${pdfFilename}`, filename: pdfFilename }
  }

  return c.json({
    slides: format === 'pdf' ? [] : pngResults,
    pdf: pdfResult,
    slug,
    outputDir: slugDir,
    check,
  })
})

// One card that carries the whole carousel: the headline from every slide,
// stacked in a terminal block. A recap someone can screenshot, and the still
// a short video is built from. Reuses the terminal variant rather than being
// a new layout, so it looks like the set it came from.
app.post('/api/summary-slide', async (c) => {
  const {
    carouselId, headline, emphasisLine, points: override, save = false,
    video: makeVideo = false, videoSeconds = 5, audio,
    // A card read for five seconds on a phone needs bigger type than one you
    // can stop and pinch-zoom, so video defaults larger than the still.
    textScale, videoMargin = 55 / 1080,
  } = await c.req.json()
  const path = join(CAROUSELS_DIR, `${carouselId}.json`)
  if (!existsSync(path)) return c.json({ error: 'Carousel not found' }, 404)
  const carousel = JSON.parse(readFileSync(path, 'utf8'))
  const slides: any[] = carousel.slides ?? []
  if (!slides.length) return c.json({ error: 'Carousel has no slides' }, 400)

  const cover = slides[0] ?? {}
  // Skip the cover and any CTA: they are framing, not points. Prefer the
  // emphasis line, which is the takeaway — headlines here are labels like
  // "the test" that mean nothing lifted out of their slide. Caller can
  // override entirely.
  const points: string[] = Array.isArray(override) && override.length
    ? override.map((p: unknown) => String(p).trim()).filter(Boolean)
    : slides
        .filter((sl) => sl.type !== 'cover' && sl.type !== 'cta')
        .map((sl) => (sl.emphasisLine || sl.headline || '').trim())
        .filter(Boolean)

  const summary = {
    slideNumber: 1,
    type: 'cover',
    variant: 'terminal',
    headline: headline || 'all of it',
    emphasisLine: emphasisLine || (cover.emphasisLine ?? ''),
    bgColor: cover.bgColor || '#12141A',
    textColor: cover.textColor || '#EEECE8',
    accentColor: cover.accentColor || '#E07355',
    terminalTitle: 'summary',
    terminalLines: points.map((p, i) => `${i + 1}. ${p}`),
    textScale: textScale ?? (makeVideo ? 1.3 : 1.0),
  }

  const slug = slugFromTitle(carousel.title)
  const slugDir = join(exportDir(), slug)
  mkdirSync(slugDir, { recursive: true })
  const outputPath = join(slugDir, 'summary.png')
  const payload = JSON.stringify({
    ...summary, totalSlides: 1, handle: creatorHandle(), ...fontPayload(), output: outputPath,
  })
  const proc = Bun.spawn([pythonBin(), join(APP_ROOT, 'generate_slide.py'), payload],
                         { stdout: 'ignore', stderr: 'pipe' })
  const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
  if (code !== 0) return c.json({ error: `summary render failed: ${stderr}` }, 500)

  if (save) {
    carousel.slides = [...slides, { ...summary, slideNumber: slides.length + 1, type: 'content' }]
    writeFileSync(path, JSON.stringify(carousel, null, 2))
  }

  // Optionally carry it through to a vertical clip: reframe for TikTok, then
  // hold it for a few seconds with an audio bed if one is configured.
  let video: string | undefined
  let hasAudio = false
  if (makeVideo) {
    const framed = join(slugDir, 'summary-tiktok.png')
    // Tighter margin than a swipeable carousel: a single card has no
    // neighbouring slides to clear, so it can use more of the frame.
    const p1 = Bun.spawn([pythonBin(), join(APP_ROOT, 'tiktok_safe.py'), JSON.stringify({
      input: outputPath, output: framed, bgColor: summary.bgColor,
      margin: Math.round(videoMargin * 1080),
    })], { stdout: 'ignore', stderr: 'pipe' })
    const [c1, e1] = await Promise.all([p1.exited, new Response(p1.stderr).text()])
    if (c1 !== 0) return c.json({ error: `summary reframe failed: ${e1}` }, 500)

    const bed = resolveAudio(audio)
    hasAudio = !!bed
    const videoPath = join(slugDir, `${slug}-summary.mp4`)
    const p2 = Bun.spawn([pythonBin(), join(APP_ROOT, 'slides_to_video.py'), JSON.stringify({
      inputs: [framed], output: videoPath, perSlide: videoSeconds, coverBoost: 1,
      ...(bed ? { audio: bed } : {}),
    })], { stdout: 'ignore', stderr: 'pipe' })
    const [c2, e2] = await Promise.all([p2.exited, new Response(p2.stderr).text()])
    if (c2 !== 0) return c.json({ error: `summary video failed: ${e2}` }, 500)
    video = `/carousel-output/${encodeURIComponent(slug)}/${slug}-summary.mp4`
  }

  return c.json({
    ok: true, slug, points,
    url: `/carousel-output/${encodeURIComponent(slug)}/summary.png`,
    slide: summary, savedToCarousel: save,
    video, hasAudio,
    // Say it plainly rather than shipping a silent clip that looks finished
    audioNote: makeVideo && !hasAudio
      ? 'No audio bed configured. Drop a track in audio/ and set audioPath, or let TikTok add one at post time.'
      : undefined,
  })
})

// What is wrong with this carousel before you export it. Measures with the
// same fonts and geometry as the renderer, so a finding here is a finding in
// the export rather than an approximation.
app.post('/api/check', async (c) => {
  const { slides, strict = false } = await c.req.json()
  if (!Array.isArray(slides)) return c.json({ error: 'slides array is required' }, 400)
  const proc = Bun.spawn([pythonBin(), join(APP_ROOT, 'check_slides.py'),
                          JSON.stringify({ slides, strict, ...fontPayload() })],
                         { stdout: 'pipe', stderr: 'pipe' })
  const [code, out, err] = await Promise.all([
    proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text(),
  ])
  if (code !== 0) return c.json({ error: `check failed: ${err}` }, 500)
  try { return c.json(JSON.parse(out)) } catch { return c.json({ error: `bad check output: ${out}` }, 500) }
})

// ── Platform variants and video ─── moved to routes/renditions.ts ────────────
app.route('/', renditionRoutes)

// ── Exported carousel library ─────────────────────────────────────────────────

// GET /api/exports
// Everything previously exported to disk, newest first. This is distinct from
// /api/carousels: those are editable projects, these are finished output.
// A carousel folder holds the default set at its root, and one subfolder per
// platform variant (tiktok/, linkedin/, …). Variants were invisible before:
// you could not tell from the UI that a TikTok set existed, let alone view it.
function readSlideSet(dir: string, urlPrefix: string) {
  let files: string[] = []
  try { files = readdirSync(dir) } catch { return null }

  // slide_1.png, slide_2.mp4 … sorted numerically, not lexically. A slide can
  // be a video, and an mp4 wins over a png of the same number since it is the
  // newer artifact for that slide.
  const byNumber = new Map<number, string>()
  for (const f of files) {
    const m = f.match(/^slide_(\d+)\.(png|jpe?g|mp4)$/i)
    if (!m) continue
    const n = parseInt(m[1])
    if (!byNumber.has(n) || m[2].toLowerCase() === 'mp4') byNumber.set(n, f)
  }
  const slides = [...byNumber.entries()].sort((a, b) => a[0] - b[0]).map(([, f]) => f)
  if (!slides.length) return null

  let modified = 0
  try { modified = statSync(join(dir, slides[0])).mtimeMs } catch { /* ignore */ }

  // Read off the cover, because the gallery cannot otherwise tell a tall set
  // from a 4:5 one and a hardcoded 4:5 thumbnail box crops a third off every
  // slide. Falls back to 4:5 when the cover is a video, which has no PNG header.
  const size = pngSize(join(dir, slides[0]))
  const aspect = size ? size.height / size.width : 1350 / 1080

  return {
    slideCount: slides.length,
    slides: slides.map((f) => `${urlPrefix}/${f}`),
    cover: `${urlPrefix}/${slides[0]}`,
    aspect,
    files,
    modified,
  }
}

app.get('/api/exports', (c) => {
  const dir = exportDir()
  if (!existsSync(dir)) return c.json({ exportDir: dir, carousels: [] })

  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const slugDir = join(dir, e.name)
      const base = `/carousel-output/${encodeURIComponent(e.name)}`
      const root = readSlideSet(slugDir, base)
      if (!root) return null

      // Any subfolder holding slide_N files is a platform variant, named after
      // the folder. Nothing is hardcoded, so a new one just shows up.
      const variants: Record<string, any> = {}
      let subdirs: string[] = []
      try {
        subdirs = readdirSync(slugDir, { withFileTypes: true })
          .filter((d) => d.isDirectory()).map((d) => d.name)
      } catch { /* ignore */ }
      for (const name of subdirs) {
        const set = readSlideSet(join(slugDir, name), `${base}/${encodeURIComponent(name)}`)
        if (set) variants[name] = { slideCount: set.slideCount, slides: set.slides, cover: set.cover, aspect: set.aspect, modified: set.modified }
      }

      const pdf = root.files.find((f) => f.toLowerCase().endsWith('.pdf'))
      // Carousel-level videos: any mp4 at the root that is not a slide, e.g.
      // the whole set played as one vertical clip. Without this the file is
      // written to disk and then invisible to the app that wrote it.
      const videos = root.files
        .filter((f) => /\.(mp4|mov|webm)$/i.test(f) && !/^slide_\d+\./i.test(f))
        .sort()
        .map((f) => ({ filename: f, url: `${base}/${f}` }))
      // A variant older than the default set means someone re-exported and the
      // variant was left behind. Surfacing it beats silently posting stale art.
      const stale = Object.keys(variants).filter((k) => variants[k].modified < root.modified - 1000)

      return {
        slug: e.name,
        slideCount: root.slideCount,
        slides: root.slides,
        cover: root.cover,
        aspect: root.aspect,
        pdf: pdf ? `${base}/${pdf}` : null,
        hasCaptions: root.files.includes('captions.md'),
        videos,
        modified: root.modified,
        variants,                       // { tiktok: {...}, … }
        platforms: ['default', ...Object.keys(variants)],
        staleVariants: stale,
      }
    })
    .filter(Boolean) as any[]

  entries.sort((a, b) => b.modified - a.modified)
  return c.json({ exportDir: dir, carousels: entries })
})

// Captions written alongside an export, so they can be read without leaving the app
app.get('/api/exports/:slug/captions', (c) => {
  const path = resolveMediaPath(`/carousel-output/${c.req.param('slug')}/captions.md`)
  if (!path) return c.json({ error: 'No captions for this carousel' }, 404)
  return c.json({ markdown: readFileSync(path, 'utf8') })
})

// ── Generated image library ───────────────────────────────────────────────────

// Images available to apply to a slide, from two sources:
//   generated — bg_*.png this app produced, in output/
//   local     — anything under the images directory, including batches made by
//               the Claude Code kie-* skills. Scanned one level deep so
//               per-session subfolders show up as groups.
app.get('/api/images', (c) => {
  const IMG = /\.(png|jpe?g|webp)$/i
  const items: any[] = []

  try {
    for (const f of readdirSync(OUTPUT_DIR)) {
      if (!f.startsWith('bg_') || !IMG.test(f)) continue
      let mtime = 0
      try { mtime = statSync(join(OUTPUT_DIR, f)).mtimeMs } catch { /* skip */ }
      items.push({ source: 'generated', group: 'Generated here', filename: f, url: `/files/${f}`, mtime })
    }
  } catch { /* no output dir yet */ }

  const root = imagesDir()
  const walk = (dir: string, group: string, depth: number) => {
    let entries: any[] = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (depth < 2) walk(full, e.name, depth + 1)
        continue
      }
      if (!IMG.test(e.name)) continue
      const rel = full.slice(root.length + 1).split(sep).map(encodeURIComponent).join('/')
      let mtime = 0
      try { mtime = statSync(full).mtimeMs } catch { /* skip */ }
      items.push({ source: 'local', group, filename: e.name, url: `/local-images/${rel}`, mtime })
    }
  }
  walk(root, 'Local images', 0)

  items.sort((a, b) => b.mtime - a.mtime)
  return c.json({ imagesDir: root, images: items })
})

// Serve a file from the local image library
app.get('/local-images/*', async (c) => {
  const rel = new URL(c.req.url).pathname.slice('/local-images/'.length)
  const filePath = resolveMediaPath(`/local-images/${rel}`)
  if (!filePath) return c.text('Not found', 404)
  return new Response(Bun.file(filePath), {
    headers: { 'Content-Type': mediaType(filePath), 'Cache-Control': 'no-store',
               'Accept-Ranges': 'bytes' },
  })
})

app.delete('/api/images/:filename', (c) => {
  const filename = c.req.param('filename')
  if (!filename.startsWith('bg_') || !filename.endsWith('.png')) return c.json({ error: 'Invalid filename' }, 400)
  const filePath = join(OUTPUT_DIR, filename)
  if (existsSync(filePath)) unlinkSync(filePath)
  return c.json({ ok: true })
})

// ── Static file serving ───────────────────────────────────────────────────────

// Serve exported carousel output from <exportDir>/<slug>/
// Wildcard, not :slug/:filename — a platform variant lives one level deeper
// (<slug>/tiktok/slide_1.png) and a two-segment route silently fell through to
// the SPA, answering an <img> with index.html. resolveMediaPath still blocks
// anything escaping the export directory.
app.get('/carousel-output/*', async (c) => {
  const rel = new URL(c.req.url).pathname.slice('/carousel-output/'.length)
  const filePath = resolveMediaPath(`/carousel-output/${rel}`)
  if (!filePath) return c.text('Not found', 404)
  const filename = rel.split('/').pop() || rel
  const file = Bun.file(filePath)
  const contentType = mediaType(filename)
  const disposition = contentType === 'application/pdf'
    ? `attachment; filename="${filename}"` : 'inline'
  return new Response(file, {
    // Accept-Ranges lets the player seek instead of refusing to scrub
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store',
               'Content-Disposition': disposition, 'Accept-Ranges': 'bytes' },
  })
})

app.get('/files/:filename', async (c) => {
  const filename = c.req.param('filename')
  const filePath = resolveMediaPath(`/files/${filename}`)
  if (!filePath) return c.text('Not found', 404)
  const file = Bun.file(filePath)
  const contentType = mediaType(filename)
  const disposition = contentType === 'application/pdf'
    ? `attachment; filename="${filename}"` : 'inline'
  return new Response(file, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'Content-Disposition': disposition, 'Accept-Ranges': 'bytes' },
  })
})

// Serve the built client. Static assets must be matched before the SPA
// fallback, otherwise every /assets/*.js request is answered with index.html
// and the built app loads a blank page.

// Browsers refuse to execute a type="module" script served without a JavaScript
// MIME type, so serving assets with no Content-Type breaks the built app.
app.get('*', async (c) => {
  const indexPath = join(DIST_DIR, 'index.html')
  if (!existsSync(indexPath)) return c.text('Run `bun run client` for the dev server', 200)

  const urlPath = new URL(c.req.url).pathname
  const asset   = resolve(DIST_DIR, '.' + urlPath)
  if ((asset === DIST_DIR || asset.startsWith(DIST_DIR + sep)) && existsSync(asset) && statSync(asset).isFile()) {
    const ext  = asset.slice(asset.lastIndexOf('.')).toLowerCase()
    const type = MIME[ext]
    return new Response(Bun.file(asset), type ? { headers: { 'Content-Type': type } } : undefined)
  }
  // Unknown path → hand back index.html so client-side routing works
  return new Response(Bun.file(indexPath), { headers: { 'Content-Type': 'text/html' } })
})

// Only when this file is the process entry point. Importing it — which the
// route tests do, to drive app.fetch without binding a port — should not print
// a banner into the test output.
if (import.meta.main) {
  console.log('🎨 Social Studio running on http://localhost:3010')
  reportPython()
  if (seeded.length) {
    console.log(`   added ${seeded.length} example carousel${seeded.length > 1 ? 's' : ''} to get you started`)
  }
}

export default { port: 3010, fetch: app.fetch }
