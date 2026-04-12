import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const app = new Hono()
app.use('*', cors())

const OUTPUT_DIR           = join(import.meta.dir, 'output')
const FRAMEWORKS_DIR        = join(import.meta.dir, 'frameworks')
const CAROUSELS_DIR         = join(import.meta.dir, 'carousels')
const CONTENT_CAROUSEL_DIR  = join(homedir(), 'content', 'carousel')
const SETTINGS_FILE         = join(import.meta.dir, 'settings.json')
mkdirSync(OUTPUT_DIR,          { recursive: true })
mkdirSync(CAROUSELS_DIR,       { recursive: true })
mkdirSync(CONTENT_CAROUSEL_DIR, { recursive: true })

function readSettings(): Record<string, any> {
  try { return JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) } catch { return {} }
}
function writeSettings(data: Record<string, any>) {
  writeFileSync(SETTINGS_FILE, JSON.stringify({ ...readSettings(), ...data }, null, 2))
}

// Load env from ~/.claude/.env
function loadEnv() {
  const envPath = join(homedir(), '.claude', '.env')
  try {
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      const key = t.slice(0, eq).trim()
      const val = t.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* ignore */ }
}
loadEnv()

// ── App Settings (likeness path, etc.) ───────────────────────────────────────

app.get('/api/settings', (c) => c.json(readSettings()))

app.post('/api/settings', async (c) => {
  const body = await c.req.json()
  writeSettings(body)
  return c.json({ ok: true, settings: readSettings() })
})

// ── Carousel Save / Load ──────────────────────────────────────────────────────

// List all saved carousels (newest first)
app.get('/api/carousels', (c) => {
  const files = readdirSync(CAROUSELS_DIR).filter((f) => f.endsWith('.json'))
  const list = files
    .map((f) => {
      try {
        const d = JSON.parse(readFileSync(join(CAROUSELS_DIR, f), 'utf8'))
        return { id: d.id, title: d.title, platform: d.platform, slideCount: d.slides?.length ?? 0, savedAt: d.savedAt }
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
      const { systemPrompt, ...rest } = fw
      return rest
    })
    return c.json(frameworks)
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// ── AI Generation ─────────────────────────────────────────────────────────────

app.post('/api/ai-generate', async (c) => {
  const { topic, frameworkId, platform = 'instagram', handle = '' } = await c.req.json()
  if (!topic?.trim()) return c.json({ error: 'topic is required' }, 400)
  if (!frameworkId)    return c.json({ error: 'frameworkId is required' }, 400)
  try {
    const result = await generateSlides(topic, frameworkId, platform, handle)
    return c.json(result)
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// Bulk generate + auto-save multiple carousels at once
// POST /api/bulk-generate
// body: { items: [{topic, frameworkId, platform?, handle?}] }
// returns: { results: [{id, title, savedAt, error?}] }
app.post('/api/bulk-generate', async (c) => {
  const { items } = await c.req.json()
  if (!Array.isArray(items) || items.length === 0) return c.json({ error: 'items array is required' }, 400)

  const results: { id: string; title: string; savedAt: string; error?: string }[] = []

  for (const item of items) {
    const { topic, frameworkId, platform = 'instagram', handle = '' } = item
    if (!topic?.trim() || !frameworkId) {
      results.push({ id: '', title: topic ?? '', savedAt: '', error: 'Missing topic or frameworkId' })
      continue
    }
    try {
      const { slides, title } = await generateSlides(topic, frameworkId, platform, handle)
      const id      = `carousel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const savedAt = new Date().toISOString()
      const data    = { id, title, platform, slides, savedAt }
      writeFileSync(join(CAROUSELS_DIR, `${id}.json`), JSON.stringify(data, null, 2))
      results.push({ id, title, savedAt })
    } catch (err) {
      results.push({ id: '', title: topic, savedAt: '', error: String(err) })
    }
  }

  return c.json({ results })
})

function parseJSON(text: string): { slides: any[]; title: string } {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  const parsed = JSON.parse(cleaned)
  return {
    slides: parsed.slides ?? [],
    title:  parsed.title  ?? '',
  }
}

// Shared AI generation logic used by both /api/ai-generate and /api/bulk-generate
async function generateSlides(topic: string, frameworkId: string, platform = 'instagram', handle = ''): Promise<{ slides: any[]; title: string }> {
  loadEnv()
  const fwPath = join(FRAMEWORKS_DIR, `${frameworkId}.json`)
  if (!existsSync(fwPath)) throw new Error(`Framework "${frameworkId}" not found`)
  const framework = JSON.parse(readFileSync(fwPath, 'utf8'))

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey    = process.env.OPENAI_API_KEY
  if (!anthropicKey && !openaiKey) throw new Error('No AI API key found')

  const handleLine = handle ? `Creator handle: ${handle} — use it on the CTA slide.` : ''
  const slideTemplate = framework.slides.map((s: any) => {
    const base: any = { slideNumber: s.slideNumber, type: s.type, purpose: s.purpose, headline: '', emphasisLine: '', bodyText: '' }
    if (s.stepNumber !== undefined) base.stepNumber = s.stepNumber
    return base
  })

  const userPrompt = `Topic: "${topic}"
Platform: ${platform}
Framework: ${framework.name} — ${framework.description}
${handleLine}

You MUST write content for EVERY slide below. Fill in headline, emphasisLine, and bodyText for all ${framework.slideCount} slides. Do not leave any empty.

Rules:
- headline: 3-6 words, punchy and bold
- emphasisLine: 5-12 words, the key insight or hook for this slide
- bodyText: 1-3 sentences, practical and specific, no filler
- Every slide must have real content — no placeholders, no empty strings

Return ONLY valid JSON. No markdown fences. No explanation. Just the JSON object:
{
  "title": "3-5 word carousel title",
  "slides": ${JSON.stringify(slideTemplate, null, 2)}
}

Now fill in the headline, emphasisLine, and bodyText for each slide based on the purpose field. Return the completed JSON.`

  const systemPrompt = framework.systemPrompt

  let slides: any[]
  let title: string

  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4096, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
    })
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
    const data = await res.json() as any
    const parsed = parseJSON(data.content?.[0]?.text ?? '')
    slides = parsed.slides; title = parsed.title
  } else {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], response_format: { type: 'json_object' } }),
    })
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`)
    const data = await res.json() as any
    const parsed = parseJSON(data.choices?.[0]?.message?.content ?? '{}')
    slides = parsed.slides; title = parsed.title
  }

  // Merge framework structure with AI content
  const aiByNum: Record<number, any> = {}
  for (const s of (slides ?? [])) aiByNum[s.slideNumber] = s
  const merged = framework.slides.map((fwSlide: any) => {
    const ai = aiByNum[fwSlide.slideNumber] ?? {}
    const { purpose, ...fw } = fwSlide
    return { ...fw, headline: ai.headline || '', emphasisLine: ai.emphasisLine || '', bodyText: ai.bodyText || '', bgColor: '#F5F0EB', textColor: '#1B1B1B', accentColor: '#E07355' }
  })
  for (const s of merged) {
    if (s.type === 'cta') { s.bgColor = '#1B4332'; s.textColor = '#F5F0EB'; s.accentColor = '#E07355' }
  }

  return { slides: merged, title: title ?? topic }
}

// ── Background Image Generation ───────────────────────────────────────────────

// POST /api/generate-bg-image
// scope: 'single' | 'all' | 'each'
// For 'single'/'all': one image, one prompt
// For 'each': auto-prompts per slide, generates N images → SSE stream
app.post('/api/generate-bg-image', async (c) => {
  const { prompt, scope, slides = [], outputPrefix = `bg_${Date.now()}`, useLikeness = false, referenceImages = [] } = await c.req.json()
  const settings = readSettings()
  const refs: string[] = [...referenceImages]
  if (useLikeness && settings.likenessPath && existsSync(settings.likenessPath)) refs.unshift(settings.likenessPath)

  if (!process.env.KIE_API_KEY) {
    return c.json({ error: 'KIE_API_KEY not set in ~/.claude/.env' }, 400)
  }

  const bgScript = join(import.meta.dir, 'generate_bg_image.py')

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        if (scope === 'each' && slides.length > 0) {
          // Generate one image per slide using auto-prompts from slide content
          for (const slide of slides) {
            const autoPrompt = buildAutoPrompt(slide, prompt)
            const filename   = `${outputPrefix}_slide${slide.slideNumber}.png`
            const outputPath = join(OUTPUT_DIR, filename)
            const payload    = JSON.stringify({ prompt: autoPrompt, output: outputPath, referenceImages: refs })

            send({ type: 'progress', slideNumber: slide.slideNumber, message: `Generating slide ${slide.slideNumber}...` })

            const proc      = Bun.spawn(['python3', bgScript, payload], { stdout: 'pipe', stderr: 'pipe' })
            const exitCode  = await proc.exited
            if (exitCode !== 0) {
              const stderr = await new Response(proc.stderr).text()
              send({ type: 'error', slideNumber: slide.slideNumber, message: stderr })
              continue
            }
            send({ type: 'image', slideNumber: slide.slideNumber, url: `/files/${filename}`, filename })
          }
          send({ type: 'complete' })

        } else {
          // Single or All: one image
          if (!prompt?.trim()) { send({ type: 'error', message: 'prompt is required' }); controller.close(); return }
          const filename   = `${outputPrefix}.png`
          const outputPath = join(OUTPUT_DIR, filename)
          const payload    = JSON.stringify({ prompt, output: outputPath, referenceImages: refs })

          send({ type: 'progress', message: 'Generating background image...' })

          const proc     = Bun.spawn(['python3', bgScript, payload], { stdout: 'pipe', stderr: 'pipe' })
          const exitCode = await proc.exited
          if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text()
            send({ type: 'error', message: stderr })
          } else {
            send({ type: 'image', url: `/files/${filename}`, filename })
            send({ type: 'complete' })
          }
        }
      } catch (err) {
        send({ type: 'error', message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
})

function buildAutoPrompt(slide: any, basePrompt: string): string {
  const topic = [slide.headline, slide.emphasisLine].filter(Boolean).join(' - ')
  const base  = basePrompt?.trim() ? `${basePrompt}. ` : ''
  return `${base}Abstract background image for Instagram carousel slide about: "${topic}". Modern, minimal, clean aesthetic. No text, no people. Geometric shapes, soft gradients, professional.`
}

// ── PIL Slide Generation ───────────────────────────────────────────────────────

app.post('/api/generate-slide', async (c) => {
  const body = await c.req.json()
  const { slideId, ...slideData } = body

  const filename = `slide_${slideId || Date.now()}.png`
  const outputPath = join(OUTPUT_DIR, filename)
  const payload = JSON.stringify({ ...slideData, output: outputPath })
  const scriptPath = join(import.meta.dir, 'generate_slide.py')

  const proc = Bun.spawn(['python3', scriptPath, payload], { stdout: 'pipe', stderr: 'pipe' })
  const exitCode = await proc.exited
  const stderr = await new Response(proc.stderr).text()

  if (exitCode !== 0) return c.json({ error: `PIL generation failed: ${stderr}` }, 500)
  return c.json({ url: `/files/${filename}`, filename })
})

// Export all slides as PNG, PDF, or both → ~/content/carousel/<slug>/
app.post('/api/export-all', async (c) => {
  const { slides, carouselSlug, format = 'png' } = await c.req.json()
  // format: 'png' | 'pdf' | 'both'
  const slug    = carouselSlug || `carousel_${Date.now()}`
  const slugDir = join(CONTENT_CAROUSEL_DIR, slug)
  mkdirSync(slugDir, { recursive: true })
  const scriptPath = join(import.meta.dir, 'generate_slide.py')

  // Step 1: always generate PNGs
  const pngPaths: string[] = []
  const pngResults: { slideNumber: number; url: string; filename: string }[] = []

  for (const slide of slides) {
    const filename   = `slide_${slide.slideNumber}.png`
    const outputPath = join(slugDir, filename)
    const payload    = JSON.stringify({ ...slide, output: outputPath })

    const proc = Bun.spawn(['python3', scriptPath, payload], { stdout: 'pipe', stderr: 'pipe' })
    const exitCode = await proc.exited
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      return c.json({ error: `Slide ${slide.slideNumber} failed: ${stderr}` }, 500)
    }
    pngPaths.push(outputPath)
    pngResults.push({ slideNumber: slide.slideNumber, url: `/carousel-output/${slug}/${filename}`, filename })
  }

  // Step 2: generate PDF if requested
  let pdfResult: { url: string; filename: string } | null = null
  if (format === 'pdf' || format === 'both') {
    const pdfFilename = `${slug}.pdf`
    const pdfPath     = join(slugDir, pdfFilename)
    const pdfPayload  = JSON.stringify(pngPaths)

    const proc = Bun.spawn(['python3', scriptPath, '--pdf', pdfPayload, pdfPath], { stdout: 'pipe', stderr: 'pipe' })
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
  })
})

// ── Generated image library ───────────────────────────────────────────────────

app.get('/api/images', (c) => {
  const files = readdirSync(OUTPUT_DIR)
    .filter((f) => f.startsWith('bg_') && f.endsWith('.png'))
    .map((f) => {
      const stat = Bun.file(join(OUTPUT_DIR, f))
      return { filename: f, url: `/files/${f}`, size: stat.size }
    })
    .sort((a, b) => {
      // Sort by timestamp embedded in filename: bg_<timestamp>...
      const ta = parseInt(a.filename.split('_')[1]) || 0
      const tb = parseInt(b.filename.split('_')[1]) || 0
      return tb - ta // newest first
    })
  return c.json(files)
})

app.delete('/api/images/:filename', (c) => {
  const filename = c.req.param('filename')
  if (!filename.startsWith('bg_') || !filename.endsWith('.png')) return c.json({ error: 'Invalid filename' }, 400)
  const filePath = join(OUTPUT_DIR, filename)
  if (existsSync(filePath)) unlinkSync(filePath)
  return c.json({ ok: true })
})

// ── Static file serving ───────────────────────────────────────────────────────

// Serve exported carousel output from ~/content/carousel/<slug>/
app.get('/carousel-output/:slug/:filename', async (c) => {
  const { slug, filename } = c.req.param()
  const filePath = join(CONTENT_CAROUSEL_DIR, slug, filename)
  if (!existsSync(filePath)) return c.text('Not found', 404)
  const file = Bun.file(filePath)
  const contentType = filename.endsWith('.pdf') ? 'application/pdf' : 'image/png'
  const disposition = filename.endsWith('.pdf') ? `attachment; filename="${filename}"` : 'inline'
  return new Response(file, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'Content-Disposition': disposition },
  })
})

app.get('/files/:filename', async (c) => {
  const filename = c.req.param('filename')
  const filePath = join(OUTPUT_DIR, filename)
  if (!existsSync(filePath)) return c.text('Not found', 404)
  const file = Bun.file(filePath)
  const contentType = filename.endsWith('.pdf') ? 'application/pdf' : 'image/png'
  const disposition = filename.endsWith('.pdf') ? `attachment; filename="${filename}"` : 'inline'
  return new Response(file, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'Content-Disposition': disposition },
  })
})

app.get('*', async (c) => {
  const distPath = join(import.meta.dir, 'client', 'dist', 'index.html')
  if (existsSync(distPath)) return new Response(Bun.file(distPath))
  return c.text('Run `bun run client` for the dev server', 200)
})

console.log('🎨 Carousel Maker server running on http://localhost:3010')
export default { port: 3010, fetch: app.fetch }
