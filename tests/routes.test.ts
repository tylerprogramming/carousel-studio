import { describe, expect, test } from 'bun:test'
import { app } from '../server'

/**
 * Every route answers.
 *
 * server.ts had no test of any kind — the other three suites all exercise the
 * Python side — which made it the one file where a refactor had nothing
 * underneath it. This is the floor: each route is reachable, returns the shape
 * it promises, and none of them fall through to the SPA catch-all.
 *
 * That last one is not hypothetical. `/carousel-output/:slug/:filename` once
 * matched only two segments, so platform-variant paths dropped through to
 * `app.get('*')` and came back as index.html — an <img> pointing at HTML, which
 * renders as a broken icon and reports 200. A route that 404s is obvious; a
 * route that silently returns the wrong content type is not.
 *
 * Read-only by design. Everything here is a GET or a POST that renders nothing
 * and writes nothing, so the suite never touches saved carousels or the export
 * directory.
 */

const get = (path: string) => app.fetch(new Request(`http://localhost${path}`))
const post = (path: string, body: unknown) =>
  app.fetch(new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))

/** index.html coming back from an /api/ path means the route did not match. */
const isSpaFallback = (ct: string | null, text: string) =>
  (ct ?? '').includes('text/html') && text.includes('<div id="root">')

describe('read-only API routes', () => {
  const cases: [string, string][] = [
    ['/api/settings', 'object'],
    ['/api/health', 'object'],
    ['/api/themes', 'any'],
    ['/api/carousels', 'any'],
    ['/api/frameworks', 'any'],
    ['/api/jobs', 'any'],
    ['/api/images', 'any'],
    ['/api/exports', 'any'],
    ['/api/flash-videos', 'any'],
  ]

  for (const [path, kind] of cases) {
    test(`GET ${path}`, async () => {
      const res = await get(path)
      const text = await res.text()
      expect(isSpaFallback(res.headers.get('content-type'), text)).toBe(false)
      expect(res.status).toBeLessThan(500)
      // Every one of these is JSON. A 200 that cannot be parsed is a failure
      // the client would meet as an unhandled exception.
      const body = JSON.parse(text)
      if (kind === 'object') expect(typeof body).toBe('object')
    })
  }
})

interface HealthBody {
  ok: boolean
  python: { bin: string; pillow: string } | null
  searched: string[]
  ffmpeg: boolean
  capabilities: { render: boolean; video: boolean }
}

describe('health reports what the renderer needs', () => {
  test('names an interpreter, or says plainly that it could not', async () => {
    const h = await (await get('/api/health')).json() as HealthBody
    expect(typeof h.ok).toBe('boolean')
    expect(Array.isArray(h.searched)).toBe(true)
    expect(h.searched.length).toBeGreaterThan(0)
    expect(typeof h.capabilities.render).toBe('boolean')
    expect(typeof h.capabilities.video).toBe('boolean')
    // Video needs both. Claiming otherwise would send someone to the wrong bug.
    if (h.capabilities.video) expect(h.capabilities.render && h.ffmpeg).toBe(true)
    if (h.ok) {
      expect(h.python!.bin.length).toBeGreaterThan(0)
      expect(h.python!.pillow.length).toBeGreaterThan(0)
    } else {
      expect(h.python).toBeNull()
    }
  })
})

describe('the checker is reachable over HTTP', () => {
  test('POST /api/check returns findings, not a stack trace', async () => {
    const res = await post('/api/check', {
      slides: [{ headline: '', variant: 'terminal', type: 'content' }],
    })
    const body = await res.json() as { error?: string; findings: { code: string }[] }
    // An empty headline is a known error code; getting it back proves the
    // route, the interpreter and check_slides.py are all wired up.
    expect(body.error).toBeUndefined()
    expect(body.findings.map((f) => f.code)).toContain('empty_headline')
  })
})

describe('missing things 404 rather than becoming a web page', () => {
  // Each of these once had, or could have, a path shape that fell through to
  // the SPA catch-all and answered 200 with HTML.
  const paths = [
    '/api/carousels/definitely-not-a-real-carousel',
    '/api/exports/not-a-real-slug/captions',
    '/carousel-output/not-a-real-slug/slide_1.png',
    '/carousel-output/not-a-real-slug/tiktok/slide_1.jpg',   // the variant path
    '/local-images/not-a-real-image.png',
    '/files/not-a-real-file.png',
  ]

  for (const path of paths) {
    test(path, async () => {
      const res = await get(path)
      const text = await res.text()
      expect(isSpaFallback(res.headers.get('content-type'), text)).toBe(false)
      expect(res.status).toBe(404)
    })
  }
})

describe('the SPA catch-all still catches', () => {
  test('an unknown non-API path is handed to the client router', async () => {
    const res = await get('/some/client/route')
    expect(res.status).toBe(200)
  })
})
