import { Hono } from 'hono'
import { cors } from 'hono/cors'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, resolve, sep } from 'path'
import { homedir } from 'os'

const app = new Hono()
app.use('*', cors())

const OUTPUT_DIR           = join(import.meta.dir, 'output')
const FRAMEWORKS_DIR        = join(import.meta.dir, 'frameworks')
const CAROUSELS_DIR         = join(import.meta.dir, 'carousels')
// Where finished carousels land. Defaults to a folder inside the app so a fresh
// clone works with no configuration; point it somewhere else (e.g. a content
// repo) with CAROUSEL_EXPORT_DIR or `exportDir` in settings.json.
function exportDir(): string {
  const configured = process.env.CAROUSEL_EXPORT_DIR || readSettings().exportDir
  if (!configured) return join(import.meta.dir, 'exports')
  return configured.startsWith('~')
    ? join(homedir(), configured.slice(1).replace(/^[/\\]/, ''))
    : resolve(configured)
}
const SETTINGS_FILE         = join(import.meta.dir, 'settings.json')

function readSettings(): Record<string, any> {
  try { return JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) } catch { return {} }
}
function writeSettings(data: Record<string, any>) {
  writeFileSync(SETTINGS_FILE, JSON.stringify({ ...readSettings(), ...data }, null, 2))
}

/** Creator handle shown on CTA slides and in the platform preview mockups. */
function creatorHandle(): string {
  const h = (readSettings().handle || '@yourhandle').trim()
  return h.startsWith('@') ? h : `@${h}`
}

mkdirSync(OUTPUT_DIR,    { recursive: true })
mkdirSync(CAROUSELS_DIR, { recursive: true })

// Resolve a client-side media URL to an absolute path on disk.
// Accepts '/files/<name>' (generated output) and '/carousel-output/<slug>/<name>'
// (exported carousels). Returns null for anything else, or for any path that
// escapes its base directory.
function resolveMediaPath(url: string | undefined): string | null {
  if (!url) return null
  let base: string
  let rel: string
  if (url.startsWith('/files/')) {
    base = OUTPUT_DIR
    rel  = url.slice('/files/'.length)
  } else if (url.startsWith('/carousel-output/')) {
    base = exportDir()
    rel  = url.slice('/carousel-output/'.length)
  } else {
    return null
  }
  const resolved = resolve(base, decodeURIComponent(rel))
  if (resolved !== base && !resolved.startsWith(base + sep)) return null
  return existsSync(resolved) ? resolved : null
}

// Load API keys. A .env in the project root is the normal case; ~/.claude/.env
// is also read so the app works inside a Claude Code setup without duplicating
// keys. Real environment variables always win over both.
function loadEnv() {
  for (const envPath of [join(import.meta.dir, '.env'), join(homedir(), '.claude', '.env')]) {
    try {
      for (const line of readFileSync(envPath, 'utf8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        const key = t.slice(0, eq).trim()
        const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = val
      }
    } catch { /* file absent — fine */ }
  }
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

// JSON Schema the model's response is constrained to, so the reply is always
// valid JSON in the right shape — no markdown fences to strip, no reshaping.
function slidesSchema(slideCount: number) {
  return {
    type: 'object',
    properties: {
      title: { type: 'string', description: '3-5 word carousel title' },
      slides: {
        type: 'array',
        description: `Exactly ${slideCount} slides, one per slideNumber in order`,
        items: {
          type: 'object',
          properties: {
            slideNumber:  { type: 'integer' },
            headline:     { type: 'string', description: '3-6 words, punchy and bold' },
            emphasisLine: { type: 'string', description: '5-12 words, the key insight or hook' },
            bodyText:     { type: 'string', description: '1-3 sentences, practical and specific' },
          },
          required: ['slideNumber', 'headline', 'emphasisLine', 'bodyText'],
          additionalProperties: false,
        },
      },
    },
    required: ['title', 'slides'],
    additionalProperties: false,
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
  // Each slide's purpose comes from the framework and tells the model what job
  // that slide does in the arc. The output shape is enforced by the schema, so
  // the prompt only has to cover intent and voice.
  const slidePurposes = framework.slides
    .map((s: any) => `${s.slideNumber}. (${s.type}) ${s.purpose}`)
    .join('\n')

  const userPrompt = `Topic: "${topic}"
Platform: ${platform}
Framework: ${framework.name} — ${framework.description}
${handleLine}

Write all ${framework.slideCount} slides. Each one below lists its slideNumber, type, and the job it does:

${slidePurposes}

Per slide:
- headline: 3-6 words, punchy and bold
- emphasisLine: 5-12 words, the key insight or hook for this slide
- bodyText: 1-3 sentences, practical and specific, no filler

Every slide needs real content written for its specific purpose — no placeholders, no empty strings, no repeating the same point across slides.`

  const systemPrompt = framework.systemPrompt

  let slides: any[]
  let title: string

  if (anthropicKey) {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: { type: 'json_schema', schema: slidesSchema(framework.slideCount) } },
    })
    if (message.stop_reason === 'refusal') {
      throw new Error('Claude declined this topic. Try rewording it.')
    }
    // output_config.format guarantees the first text block is valid JSON
    const text = message.content.find((b) => b.type === 'text')?.text ?? '{}'
    const parsed = parseJSON(text)
    slides = parsed.slides; title = parsed.title
  } else {
    // Fallback path. Uses the same JSON Schema as the Claude path via OpenAI's
    // structured outputs, so both providers return an identically shaped reply.
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'carousel', strict: true, schema: slidesSchema(framework.slideCount) },
        },
      }),
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

// ── Caption Generation ────────────────────────────────────────────────────────

// POST /api/captions
// body: { title, platform, slides, slug?, save? }
// Writes captions.md next to the exported slides when `save` is set.
app.post('/api/captions', async (c) => {
  const { title, platform = 'instagram', slides = [], slug, save } = await c.req.json()
  if (!Array.isArray(slides) || slides.length === 0) return c.json({ error: 'slides are required' }, 400)

  loadEnv()
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey    = process.env.OPENAI_API_KEY
  if (!anthropicKey && !openaiKey) return c.json({ error: 'No AI API key found' }, 400)

  const outline = slides
    .map((s: any) => `${s.slideNumber}. ${s.headline} — ${s.emphasisLine}. ${s.bodyText}`)
    .join('\n')

  // `brandVoice` in settings.json lets each user describe their own voice; the
  // baseline below is deliberately generic so a fresh install writes decent
  // captions with no configuration.
  const brandVoice = (readSettings().brandVoice || '').trim()
  const system = [
    'You write social captions for a creator posting an educational carousel.',
    'Voice: direct and concrete. Short sentences. Write to one person, not an audience.',
    'Hard rules: never use em dashes. Never invent statistics, results, or testimonials.',
    'Never open with filler like "In today\'s world" or "Let\'s be honest".',
    brandVoice && `Additional voice guidance from the creator: ${brandVoice}`,
  ].filter(Boolean).join(' ')

  const prompt = `Carousel title: "${title}"
Primary platform: ${platform}

Slides:
${outline}

Write captions for this carousel.`

  const schema = {
    type: 'object',
    properties: {
      instagram: { type: 'string', description: 'Instagram caption. Hook on line one, then value, then a soft CTA. No hashtags in this field.' },
      hashtags:  { type: 'array', items: { type: 'string' }, description: 'Exactly 5 Instagram hashtags, each starting with #' },
      linkedin:  { type: 'string', description: 'LinkedIn caption. Slightly longer and more professional. No hashtags at all.' },
    },
    required: ['instagram', 'hashtags', 'linkedin'],
    additionalProperties: false,
  }

  try {
    let parsed: { instagram: string; hashtags: string[]; linkedin: string }

    if (anthropicKey) {
      const anthropic = new Anthropic({ apiKey: anthropicKey })
      const message = await anthropic.messages.create({
        model: 'claude-opus-5',
        max_tokens: 8000,
        thinking: { type: 'adaptive' },
        system,
        messages: [{ role: 'user', content: prompt }],
        output_config: { format: { type: 'json_schema', schema } },
      })
      if (message.stop_reason === 'refusal') throw new Error('Claude declined this topic.')
      parsed = JSON.parse(message.content.find((b) => b.type === 'text')?.text ?? '{}')
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
          response_format: { type: 'json_schema', json_schema: { name: 'captions', strict: true, schema } },
        }),
      })
      if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`)
      const data = await res.json() as any
      parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    }

    // Strip em dashes defensively — a standing rule for this creator's content
    const clean = (s: string) => (s || '').replace(/\s*—\s*/g, ' ')
    const captions = {
      instagram: clean(parsed.instagram),
      hashtags:  (parsed.hashtags ?? []).map((h) => (h.startsWith('#') ? h : `#${h}`)),
      linkedin:  clean(parsed.linkedin),
    }

    let savedTo: string | null = null
    if (save && slug) {
      const dir = join(exportDir(), slug)
      mkdirSync(dir, { recursive: true })
      const md = `# ${title}\n\n## Instagram\n\n${captions.instagram}\n\n${captions.hashtags.join(' ')}\n\n## LinkedIn\n\n${captions.linkedin}\n`
      const path = join(dir, 'captions.md')
      writeFileSync(path, md)
      savedTo = path
    }

    return c.json({ ...captions, savedTo })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

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

  // When using likeness, append person description to prompt so the model generates the right gender/look
  const likenessHint = useLikeness && settings.likenessDescription ? ` ${settings.likenessDescription}` : ''
  const finalPrompt = prompt ? `${prompt}${likenessHint}` : prompt

  if (!process.env.KIE_API_KEY) {
    return c.json({ error: 'KIE_API_KEY not set. Add it to .env in the project root.' }, 400)
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
            const autoPrompt = buildAutoPrompt(slide, finalPrompt)
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
          if (!finalPrompt?.trim()) { send({ type: 'error', message: 'prompt is required' }); controller.close(); return }
          const filename   = `${outputPrefix}.png`
          const outputPath = join(OUTPUT_DIR, filename)
          const payload    = JSON.stringify({ prompt: finalPrompt, output: outputPath, referenceImages: refs })

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

// ── Flash video generation ────────────────────────────────────────────────────

app.post('/api/flash-video', async (c) => {
  const body = await c.req.json()
  const { carouselId, slideNumber, carouselTitle } = body
  const ts = Date.now()
  const filename = `flash_${carouselId || 'carousel'}_s${slideNumber || 1}_${ts}.mp4`
  const outputPath = join(OUTPUT_DIR, filename)
  const payload = JSON.stringify({ ...body, output: outputPath, outputDir: OUTPUT_DIR })
  const scriptPath = join(import.meta.dir, 'flash_video.py')
  const proc = Bun.spawn(['python3', scriptPath, payload], { stdout: 'pipe', stderr: 'pipe' })
  const exitCode = await proc.exited
  const stderr = await new Response(proc.stderr).text()
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

app.get('/api/flash-videos', (c) => {
  const indexPath = join(OUTPUT_DIR, 'flash_index.json')
  try { return c.json(JSON.parse(readFileSync(indexPath, 'utf8'))) } catch { return c.json([]) }
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
  const contentType = filename.endsWith('.pdf') ? 'application/pdf'
    : filename.endsWith('.mp4') ? 'video/mp4'
    : filename.endsWith('.webm') ? 'video/webm'
    : 'image/png'
  const disposition = filename.endsWith('.pdf') ? `attachment; filename="${filename}"` : 'inline'
  return new Response(file, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'Content-Disposition': disposition, 'Accept-Ranges': 'bytes' },
  })
})

app.get('*', async (c) => {
  const distPath = join(import.meta.dir, 'client', 'dist', 'index.html')
  if (existsSync(distPath)) return new Response(Bun.file(distPath))
  return c.text('Run `bun run client` for the dev server', 200)
})

console.log('🎨 Carousel Maker server running on http://localhost:3010')
export default { port: 3010, fetch: app.fetch }
