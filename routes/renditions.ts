import { Hono } from 'hono'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

import { APP_ROOT, OUTPUT_DIR, audioDir, exportDir, resolveAudio, resolveMediaPath } from '../lib/paths'
import { creatorHandle, readSettings } from '../lib/settings'
import { pngSize, slugFromTitle } from '../lib/media'
import { pythonBin } from '../lib/python'

/**
 * Other renditions of a finished carousel: a TikTok-safe reframe, the set as
 * one video, a single slide as a clip, and standalone Reels.
 *
 * Grouped because they all take something already rendered and produce another
 * version of it, and because they are the only routes that need ffmpeg — which
 * is why /api/health reports render and video as separate capabilities.
 */
export const renditionRoutes = new Hono()

// ── Platform variants ─────────────────────────────────────────────────────────

/** The frame a `tall` slide is drawn at, and what TikTok wants. */
const TALL_W = 1080, TALL_H = 1920

// Re-frame an exported carousel for TikTok: every slide is placed inside a
// 1080x1920 canvas clear of TikTok's caption block, action rail and tab chrome.
// Writes to <slug>/tiktok/ so the gallery picks it up as a variant.
// Available here and from the CLI (tiktok_safe.py) so both routes agree.
renditionRoutes.post('/api/export-tiktok', async (c) => {
  // JPG by default: TikTok photo slideshows take JPG, not PNG.
  const { carouselSlug, bgColor = '#12141A', margin, topBias, format = 'jpg' } = await c.req.json()
  if (!carouselSlug) return c.json({ error: 'carouselSlug is required' }, 400)

  const slugDir = join(exportDir(), carouselSlug)
  if (!existsSync(slugDir)) return c.json({ error: `No export at ${carouselSlug}` }, 404)

  const outDir = join(slugDir, 'tiktok')
  mkdirSync(outDir, { recursive: true })
  const script = join(APP_ROOT, 'tiktok_safe.py')

  // Only stills reframe. Where a slide is a video, its PNG counterpart is used,
  // so the TikTok set is complete but that slide does not move.
  const stills = readdirSync(slugDir).filter((f) => /^slide_\d+\.png$/i.test(f))
  const videos = readdirSync(slugDir).filter((f) => /^slide_\d+\.mp4$/i.test(f))
  const stillNumbers = new Set(stills.map((f) => f.match(/\d+/)![0]))
  if (!stills.length) return c.json({ error: 'No slide PNGs to reframe' }, 400)

  // A `tall` carousel exports at 1080x1920 already, so there is nothing to
  // reframe: tiktok_safe.py writes those through untouched (the decision lives
  // there so the CLI behaves the same). Measured here only to say so in the
  // response, since "reframed 7 slides" would be a lie about a tall set.
  const passedThrough = stills.filter((name) => {
    const size = pngSize(join(slugDir, name))
    return !!size && size.width === TALL_W && size.height === TALL_H
  })

  const outcomes = await Promise.all(stills.map(async (name) => {
    const payload = JSON.stringify({
      input: join(slugDir, name), output: join(outDir, name), bgColor, format,
      ...(margin != null ? { margin } : {}), ...(topBias != null ? { topBias } : {}),
    })
    const proc = Bun.spawn([pythonBin(), script, payload], { stdout: 'ignore', stderr: 'pipe' })
    const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
    return code === 0 ? { ok: true as const, name } : { ok: false as const, name, stderr }
  }))

  const failed = outcomes.filter((o) => !o.ok)
  if (failed.length) return c.json({ error: `Failed: ${failed.map((f: any) => f.name).join(', ')}` }, 500)

  return c.json({
    ok: true,
    count: stills.length,
    outputDir: outDir,
    // Already 9:16, copied through rather than scaled into a padded frame.
    passedThrough,
    // A video slide reframed from its still: the set is complete, but that
    // slide is static on TikTok. Saying so beats implying the motion carried.
    staticFromVideo: videos.filter((v) => stillNumbers.has(v.match(/\d+/)![0])),
    // A video slide with no still at all really is missing from the set.
    missing: videos.filter((v) => !stillNumbers.has(v.match(/\d+/)![0])),
  })
})

// Play a whole carousel as one short vertical video. A photo carousel and a
// video are different formats on TikTok with different reach, and this is the
// video one: the slides you already have, held a beat each, at 1080x1920.
// Prefers the tiktok/ reframed set so nothing sits under TikTok's UI.
renditionRoutes.post('/api/carousel-video', async (c) => {
  const { carouselSlug, perSlide = 2.5, fade = 0.2, audio, coverBoost } = await c.req.json()
  if (!carouselSlug) return c.json({ error: 'carouselSlug is required' }, 400)

  const slugDir = join(exportDir(), carouselSlug)
  if (!existsSync(slugDir)) return c.json({ error: `No export at ${carouselSlug}` }, 404)

  // The reframed set already clears TikTok's overlays; fall back to the 4:5
  // slides, which slides_to_video will letterbox rather than crop.
  const tiktokDir = join(slugDir, 'tiktok')
  const sourceDir = existsSync(tiktokDir) ? tiktokDir : slugDir
  const inputs = readdirSync(sourceDir)
    .filter((f) => /^slide_\d+\.png$/i.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]))
    .map((f) => join(sourceDir, f))
  if (!inputs.length) return c.json({ error: 'No slide PNGs found' }, 400)

  const filename = `${carouselSlug}-tiktok.mp4`
  const outputPath = join(slugDir, filename)
  const payload = JSON.stringify({
    inputs, output: outputPath, perSlide, fade,
    ...(coverBoost != null ? { coverBoost } : {}),
    ...(resolveAudio(audio) ? { audio: resolveAudio(audio) } : {}),
  })
  const proc = Bun.spawn([pythonBin(), join(APP_ROOT, 'slides_to_video.py'), payload],
                         { stdout: 'ignore', stderr: 'pipe' })
  const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
  if (code !== 0) return c.json({ error: `carousel video failed: ${stderr}` }, 500)

  // Cover is held coverBoost times longer, so the total is not a flat multiple
  const boost = coverBoost ?? 1.4
  const duration = Math.round(perSlide * (boost + inputs.length - 1) * 10) / 10
  return c.json({
    ok: true,
    url: `/carousel-output/${encodeURIComponent(carouselSlug)}/${filename}`,
    filename, slideCount: inputs.length, perSlide, duration,
    usedReframed: sourceDir === tiktokDir,
    // Under a second and a half, body copy cannot be read at a glance.
    tooFast: perSlide < 1.5,
  })
})

// ── Slide video (a moving carousel slide) ─────────────────────────────────────

// Instagram carousels take video slides next to image slides, so slide 1 can
// move while the rest stay still. Renders the slide furniture on alpha, then
// composites it over a still (slow push-in) or a supplied clip. Writes the mp4
// next to the exported PNGs so the whole post lives in one folder.
// Not flash-video: that one is 1080x1920 for standalone Reels.
renditionRoutes.post('/api/slide-video', async (c) => {
  const { slide, carouselSlug, duration = 5, zoom = 1.08, audio } = await c.req.json()
  if (!slide) return c.json({ error: 'slide is required' }, 400)

  const slug    = carouselSlug || `carousel_${Date.now()}`
  const slugDir = join(exportDir(), slug)
  mkdirSync(slugDir, { recursive: true })

  const overlayPath = join(OUTPUT_DIR, `overlay_${Date.now()}.png`)
  const overlayPayload = JSON.stringify({
    ...slide, handle: creatorHandle(), transparent: true, output: overlayPath,
  })
  const slideScript = join(APP_ROOT, 'generate_slide.py')
  const overlayProc = Bun.spawn([pythonBin(), slideScript, overlayPayload], { stdout: 'ignore', stderr: 'pipe' })
  if (await overlayProc.exited !== 0) {
    return c.json({ error: `overlay render failed: ${await new Response(overlayProc.stderr).text()}` }, 500)
  }

  const filename = `slide_${slide.slideNumber ?? 1}.mp4`
  const outputPath = join(slugDir, filename)
  const payload = JSON.stringify({
    overlay: overlayPath,
    source:  resolveMediaPath(slide.backgroundVideo) ?? resolveMediaPath(slide.backgroundImage) ?? undefined,
    audio:   resolveAudio(audio),
    duration, zoom, output: outputPath,
  })
  const videoProc = Bun.spawn([pythonBin(), join(APP_ROOT, 'slide_video.py'), payload],
                       { stdout: 'ignore', stderr: 'pipe' })
  const code = await videoProc.exited
  try { unlinkSync(overlayPath) } catch { /* best effort */ }
  if (code !== 0) {
    return c.json({ error: `slide video failed: ${await new Response(videoProc.stderr).text()}` }, 500)
  }
  return c.json({ url: `/carousel-output/${slug}/${filename}`, filename, outputDir: slugDir })
})

// ── Flash video generation ────────────────────────────────────────────────────

renditionRoutes.post('/api/flash-video', async (c) => {
  const body = await c.req.json()
  const { carouselId, slideNumber, carouselTitle } = body
  const ts = Date.now()
  const filename = `flash_${carouselId || 'carousel'}_s${slideNumber || 1}_${ts}.mp4`
  const outputPath = join(OUTPUT_DIR, filename)
  const payload = JSON.stringify({ ...body, output: outputPath, outputDir: OUTPUT_DIR })
  const scriptPath = join(APP_ROOT, 'flash_video.py')
  const proc = Bun.spawn([pythonBin(), scriptPath, payload], { stdout: 'ignore', stderr: 'pipe' })
  const [exitCode, stderr] = await Promise.all([
    proc.exited, new Response(proc.stderr).text(),
  ])
  if (exitCode !== 0) return c.json({ error: `Flash video failed: ${stderr}` }, 500)

  // Save JSON sidecar
  const meta = {
    id: filename.replace('.mp4', ''),
    carouselId: carouselId || null,
    carouselTitle: carouselTitle || null,
    slideNumber: slideNumber || 1,
    style: body.style || 'statement',
    duration: body.duration || 5,
    headline: body.headline || '',
    emphasisLine: body.emphasisLine || '',
    subText: body.subText || '',
    ctaText: body.ctaText || '',
    listItems: body.listItems || [],
    summaryLine: body.summaryLine || '',
    handle: body.handle || creatorHandle(),
    bgColor: body.bgColor || '#F5F0EB',
    textColor: body.textColor || '#1B1B1B',
    accentColor: body.accentColor || '#E07355',
    backgroundVideo: body.backgroundVideo || null,
    backgroundImage: body.backgroundImage || null,
    overlayOpacity: body.overlayOpacity ?? 0.45,
    mp4: filename,
    url: `/files/${filename}`,
    generatedAt: new Date().toISOString(),
  }
  writeFileSync(join(OUTPUT_DIR, filename.replace('.mp4', '.json')), JSON.stringify(meta, null, 2))

  // Update flash_index.json (newest first, deduplicated by carouselId+slideNumber)
  const indexPath = join(OUTPUT_DIR, 'flash_index.json')
  let index: any[] = []
  try { index = JSON.parse(readFileSync(indexPath, 'utf8')) } catch { /* new */ }
  index = index.filter((e: any) => !(e.carouselId === meta.carouselId && e.slideNumber === meta.slideNumber))
  index.unshift(meta)
  writeFileSync(indexPath, JSON.stringify(index, null, 2))

  return c.json({ url: `/files/${filename}`, filename, meta })
})

renditionRoutes.get('/api/flash-videos', (c) => {
  const indexPath = join(OUTPUT_DIR, 'flash_index.json')
  try { return c.json(JSON.parse(readFileSync(indexPath, 'utf8'))) } catch { return c.json([]) }
})
