import { Hono } from 'hono'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'

import { APP_ROOT, imagesDir } from '../lib/paths'
import { expandPath } from '../lib/paths'
import { loadEnv, readSettings } from '../lib/settings'
import { pythonBin } from '../lib/python'

/**
 * Background image generation, as a job queue.
 *
 * Lifted out of server.ts whole: the state, the helpers and the four routes
 * that touch it were already the most self-contained thing in that file, and
 * nothing outside referred to any of it.
 */
export const jobRoutes = new Hono()

// ── Job queue ─────────────────────────────────────────────────────────────────
//
// Image generation used to hold an SSE connection open for the whole run, owned
// by the Background panel. That blocked a second run, lost results if you
// switched carousels mid-flight, and died on a page refresh.
//
// Jobs live on the server instead. POST returns a jobId immediately, work
// continues in the background, and the client polls. Results carry the
// carouselId they were started for, so they can never land on the wrong one.

type JobResult = { slideNumber?: number; url: string; filename: string }

/**
 * Prompt for a single slide in an "each slide" run. The user's prompt becomes
 * the style layer; the slide's own headline and emphasis line supply the subject,
 * which is why that scope needs no per-slide prompt writing.
 */
function buildAutoPrompt(slide: any, basePrompt: string): string {
  const topic = [slide.headline, slide.emphasisLine].filter(Boolean).join(' - ')
  const base  = basePrompt?.trim() ? `${basePrompt}. ` : ''
  return `${base}Abstract background image for a carousel slide about: "${topic}". Modern, minimal, clean aesthetic. No text, no people. Geometric shapes, soft gradients, professional.`
}

/** Filesystem-safe fragment of a title or prompt. */
function slugFragment(text: string, words = 4): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, words)
    .join('-')
    .slice(0, 48)
}

interface Job {
  id: string
  kind: 'bg-image'
  label: string
  carouselId?: string
  scope: 'single' | 'all' | 'each'
  model?: string
  status: 'running' | 'done' | 'error' | 'cancelled'
  total: number
  done: number
  results: JobResult[]
  errors: string[]
  createdAt: number
  finishedAt?: number
  /** Set by DELETE; checked between spawns and used to kill children. */
  cancelled?: boolean
  procs: Set<{ kill: () => void }>
}

const jobs = new Map<string, Job>()

function pruneJobs() {
  // Keep finished jobs around briefly so a reloading client can still collect
  // results, then drop them. This registry is intentionally in-memory only.
  const cutoff = Date.now() - 30 * 60_000
  for (const [id, j] of jobs) {
    if (j.status !== 'running' && (j.finishedAt ?? 0) < cutoff) jobs.delete(id)
  }
}

function publicJob(j: Job) {
  const { procs, cancelled, ...rest } = j
  return rest
}

jobRoutes.get('/api/jobs', (c) => {
  pruneJobs()
  const carouselId = c.req.query('carouselId')
  const list = [...jobs.values()]
    .filter((j) => !carouselId || !j.carouselId || j.carouselId === carouselId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(publicJob)
  return c.json(list)
})

jobRoutes.get('/api/jobs/:id', (c) => {
  const j = jobs.get(c.req.param('id'))
  if (!j) return c.json({ error: 'Not found' }, 404)
  return c.json(publicJob(j))
})

jobRoutes.delete('/api/jobs/:id', (c) => {
  const j = jobs.get(c.req.param('id'))
  if (!j) return c.json({ error: 'Not found' }, 404)
  j.cancelled = true
  for (const p of j.procs) { try { p.kill() } catch { /* already gone */ } }
  if (j.status === 'running') { j.status = 'cancelled'; j.finishedAt = Date.now() }
  return c.json(publicJob(j))
})

// POST /api/jobs/generate-bg
// body: { prompt, scope, slides, carouselId?, model?, useLikeness?, referenceImages? }
// Returns { jobId } straight away.
jobRoutes.post('/api/jobs/generate-bg', async (c) => {
  const {
    prompt, scope = 'single', slides = [], carouselId, carouselTitle,
    model, useLikeness = false, referenceImages = [],
  } = await c.req.json()

  loadEnv()
  if (!process.env.KIE_API_KEY) {
    return c.json({ error: 'KIE_API_KEY not set. Add it to .env in the project root.' }, 400)
  }
  if (scope !== 'each' && !prompt?.trim()) {
    return c.json({ error: 'prompt is required' }, 400)
  }

  const settings = readSettings()
  const refs: string[] = [...referenceImages]
  const likeness = settings.likenessPath ? expandPath(settings.likenessPath) : ''
  if (useLikeness && likeness && existsSync(likeness)) refs.unshift(likeness)
  const likenessHint = useLikeness && settings.likenessDescription ? ` ${settings.likenessDescription}` : ''
  const finalPrompt = prompt ? `${prompt}${likenessHint}` : prompt

  const targets: any[] = scope === 'each' ? slides : [null]
  const job: Job = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: 'bg-image',
    label: scope === 'each' ? `Backgrounds for ${targets.length} slides` : (prompt || '').slice(0, 48) || 'Background',
    carouselId, scope, model,
    status: 'running',
    total: targets.length,
    done: 0,
    results: [], errors: [],
    createdAt: Date.now(),
    procs: new Set(),
  }
  jobs.set(job.id, job)

  const bgScript = join(APP_ROOT, 'generate_bg_image.py')

  // Images are filed by what they are for, not when they were made: one folder
  // per carousel, and a filename describing the slide and the prompt.
  const folder = slugFragment(carouselTitle || '', 6) || 'unsorted'
  const destDir = join(imagesDir(), folder)
  mkdirSync(destDir, { recursive: true })
  const promptSlug = slugFragment(prompt || '', 4) || 'background'

  const nameFor = (slideNumber?: number) => {
    const base = slideNumber != null
      ? `slide-${String(slideNumber).padStart(2, '0')}-${promptSlug}`
      : scope === 'all' ? `all-slides-${promptSlug}` : `${promptSlug}`
    // Never clobber an earlier take of the same idea
    let name = `${base}.png`
    let n = 2
    while (existsSync(join(destDir, name))) name = `${base}-${n++}.png`
    return name
  }

  // Deliberately not awaited — the response goes back now.
  ;(async () => {
    await Promise.all(targets.map(async (slide: any) => {
      if (job.cancelled) return
      const filename = nameFor(slide?.slideNumber)
      const payload = JSON.stringify({
        prompt: slide ? buildAutoPrompt(slide, finalPrompt) : finalPrompt,
        output: join(destDir, filename),
        referenceImages: refs,
        model,
      })
      const proc = Bun.spawn([pythonBin(), bgScript, payload], { stdout: 'ignore', stderr: 'pipe' })
      job.procs.add(proc as any)
      try {
        const code = await proc.exited
        if (job.cancelled) return
        if (code !== 0) {
          job.errors.push(`${slide ? `Slide ${slide.slideNumber}: ` : ''}${await new Response(proc.stderr).text()}`.slice(0, 400))
        } else {
          job.results.push({
            slideNumber: slide?.slideNumber,
            url: `/local-images/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`,
            filename,
          })
        }
      } finally {
        job.procs.delete(proc as any)
        job.done += 1
      }
    }))
    if (!job.cancelled) {
      job.status = job.results.length ? 'done' : 'error'
      job.finishedAt = Date.now()
    }
  })()

  return c.json({ jobId: job.id, job: publicJob(job) })
})
