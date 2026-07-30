import { Hono } from 'hono'
import Anthropic from '@anthropic-ai/sdk'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

import { CAROUSELS_DIR, FRAMEWORKS_DIR, exportDir } from '../lib/paths'
import { creatorHandle, loadEnv, readSettings } from '../lib/settings'
import { describeSlides } from '../lib/alt'

/**
 * Everything that asks a model for words: slide copy and captions.
 *
 * Kept together because they share the schema-constrained output shape and the
 * same client setup, and separate from the rest because nothing else in the app
 * needs an API key at all — you can work on the renderer, the editor and the
 * tests without one.
 */
export const aiRoutes = new Hono()

// ── AI Generation ─────────────────────────────────────────────────────────────

aiRoutes.post('/api/ai-generate', async (c) => {
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
aiRoutes.post('/api/bulk-generate', async (c) => {
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

function parseSlidesReply(text: string): { slides: any[]; title: string } {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  const parsed = JSON.parse(cleaned)
  return {
    slides: parsed.slides ?? [],
    title:  parsed.title  ?? '',
  }
}

/**
 * Scrub a string destined for the monospace terminal window.
 *
 * Models reliably try to decorate these lines with emoji, and the emoji come
 * back mangled — a real reply contained "bash \x1f4BB workspace", a broken
 * U+1F4BB, plus runs of literal tabs. Anything outside printable ASCII renders
 * as tofu in a mono face, so it is stripped here rather than at render time:
 * the stored carousel should be clean.
 */
function cleanMono(s: unknown): string {
  if (typeof s !== 'string') return ''
  return s
    .replace(/[✓✔]/g, '✓')      // normalise both check marks
    .replace(/[\t\r\n]+/g, ' ')                // tabs/newlines break the layout
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')      // control characters
    .replace(/[^\x20-\x7E✓→—]/g, '') // ASCII plus check, arrow, em dash
    .replace(/ {2,}(?=\S)/g, (m) => (m.length > 4 ? '  ' : m)) // collapse runaway padding
    .trimEnd()
}

// JSON Schema the model's response is constrained to, so the reply is always
// valid JSON in the right shape — no markdown fences to strip, no reshaping.
function slidesSchema(slideCount: number, variant?: string) {
  // 'tall' is the terminal layout on a taller canvas, so it wants the same
  // fields written the same way. Only the canvas differs.
  const terminal = variant === 'terminal' || variant === 'tall'
  const props: Record<string, any> = {
    slideNumber:  { type: 'integer' },
    headline:     { type: 'string', description: terminal ? '1-3 words, lowercase, like a CLI subcommand' : '3-6 words, punchy and bold' },
    emphasisLine: { type: 'string', description: '5-12 words, the key insight or hook' },
    bodyText:     { type: 'string', description: '1-3 sentences, practical and specific' },
  }
  if (terminal) {
    props.terminalTitle = { type: 'string', description: 'Window title, e.g. "claude - skill install". PLAIN ASCII ONLY, no emoji. Empty string on the cover and CTA slides.' }
    props.terminalLines = {
      type: 'array',
      items: { type: 'string' },
      description: 'Up to 5 lines of a realistic terminal session. "$ " prefixes the command, "  ✓ " prefixes results. Max 52 characters per line. PLAIN ASCII ONLY — no emoji, no tabs, no box-drawing characters; they render as empty boxes in a monospace font. Empty array on the cover and CTA slides.',
    }
  }
  return {
    type: 'object',
    properties: {
      title: { type: 'string', description: '3-5 word carousel title' },
      slides: {
        type: 'array',
        description: `Exactly ${slideCount} slides, one per slideNumber in order`,
        items: {
          type: 'object',
          properties: props,
          required: Object.keys(props),
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
      output_config: { format: { type: 'json_schema', schema: slidesSchema(framework.slideCount, framework.variant) } },
    })
    if (message.stop_reason === 'refusal') {
      throw new Error('Claude declined this topic. Try rewording it.')
    }
    // output_config.format guarantees the first text block is valid JSON
    const text = message.content.find((b) => b.type === 'text')?.text ?? '{}'
    const parsed = parseSlidesReply(text)
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
          json_schema: { name: 'carousel', strict: true, schema: slidesSchema(framework.slideCount, framework.variant) },
        },
      }),
    })
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`)
    const data = await res.json() as any
    const parsed = parseSlidesReply(data.choices?.[0]?.message?.content ?? '{}')
    slides = parsed.slides; title = parsed.title
  }

  // Merge framework structure with AI content
  const aiByNum: Record<number, any> = {}
  for (const s of (slides ?? [])) aiByNum[s.slideNumber] = s
  const merged = framework.slides.map((fwSlide: any) => {
    const ai = aiByNum[fwSlide.slideNumber] ?? {}
    const { purpose, ...fw } = fwSlide
    const base: any = {
      ...fw,
      headline: ai.headline || '', emphasisLine: ai.emphasisLine || '', bodyText: ai.bodyText || '',
      bgColor: '#F5F0EB', textColor: '#1B1B1B', accentColor: '#E07355',
    }
    if (framework.variant === 'terminal' || framework.variant === 'tall') {
      // Terminal frameworks bring their own palette and layout
      Object.assign(base, {
        variant: framework.variant,
        bgColor: '#12141A', textColor: '#EEECE8', accentColor: '#E07355',
        terminalTitle: cleanMono(ai.terminalTitle) || undefined,
        terminalLines: (ai.terminalLines || []).map(cleanMono).filter(Boolean),
      })
    }
    return base
  })
  for (const s of merged) {
    // The green CTA palette belongs to the editorial layout. Both terminal
    // variants keep the dark one they were just given.
    if (s.type === 'cta' && s.variant !== 'terminal' && s.variant !== 'tall') { s.bgColor = '#1B4332'; s.textColor = '#F5F0EB'; s.accentColor = '#E07355' }
  }

  return { slides: merged, title: title ?? topic }
}

// ── Caption Generation ────────────────────────────────────────────────────────

// POST /api/captions
// body: { title, platform, slides, slug?, save? }
// Writes captions.md next to the exported slides when `save` is set.
aiRoutes.post('/api/captions', async (c) => {
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

Write captions for this carousel, and alt text for every one of its ${slides.length} slides.

The slides are almost entirely text, so the alt text should read the slide out
rather than describe how it looks. Someone who cannot see the image needs the
headline and the commands, not the colour scheme.`

  const schema = {
    type: 'object',
    properties: {
      instagram: { type: 'string', description: 'Instagram caption. Hook on line one, then value, then a soft CTA. No hashtags in this field.' },
      hashtags:  { type: 'array', items: { type: 'string' }, description: 'Exactly 5 Instagram hashtags, each starting with #' },
      linkedin:  { type: 'string', description: 'LinkedIn caption. Slightly longer and more professional. No hashtags at all.' },
      altText: {
        type: 'array',
        items: { type: 'string' },
        description: 'Alt text for every slide, in order, one entry per slide. Read the slide out: its headline, its emphasis line, and any terminal commands verbatim. Do not describe colours, fonts or layout. Start each with "Slide N of M".',
      },
    },
    required: ['instagram', 'hashtags', 'linkedin', 'altText'],
    additionalProperties: false,
  }

  try {
    let parsed: { instagram: string; hashtags: string[]; linkedin: string; altText?: string[] }

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
    const stripEmDashes = (s: string) => (s || '').replace(/\s*—\s*/g, ' ')
    const captions = {
      instagram: stripEmDashes(parsed.instagram),
      hashtags:  (parsed.hashtags ?? []).map((h) => (h.startsWith('#') ? h : `#${h}`)),
      linkedin:  stripEmDashes(parsed.linkedin),
      // Composed locally first, then replaced by the model's version only where
      // it actually returned one. A model that skips a slide, or returns a
      // one-word entry, must not leave that slide with no description at all —
      // the fallback is derived from the slide's own text and is always valid.
      altText: describeSlides(slides).map((fallback, i) => {
        const written = stripEmDashes(parsed.altText?.[i] ?? '')
        return written.length >= 15 ? written : fallback
      }),
    }

    let savedTo: string | null = null
    if (save && slug) {
      const dir = join(exportDir(), slug)
      mkdirSync(dir, { recursive: true })
      const alt = captions.altText.map((t, i) => `${i + 1}. ${t}`).join('\n')
      const md = `# ${title}\n\n## Instagram\n\n${captions.instagram}\n\n${captions.hashtags.join(' ')}\n\n## LinkedIn\n\n${captions.linkedin}\n\n## Alt text\n\nOne per slide, in order. Paste when posting — Instagram takes it per image under Advanced settings.\n\n${alt}\n`
      const path = join(dir, 'captions.md')
      writeFileSync(path, md)
      savedTo = path
    }

    return c.json({ ...captions, savedTo })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})
