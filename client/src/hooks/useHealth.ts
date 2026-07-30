import { useEffect, useState } from 'react'

/**
 * Can this machine actually render?
 *
 * Every export shells out to Python and Pillow, and until now the answer only
 * existed at the moment you pressed Export — as a Python traceback in a toast,
 * after the carousel was finished. That is the most expensive possible time to
 * learn that a dependency is missing.
 *
 * Fetched once at startup. There is no polling: installing Pillow is something
 * you do deliberately, and if you do it while the app is open, reloading is not
 * a hardship. `refresh` exists for after a settings save, since pythonPath can
 * change which interpreter is chosen.
 */

export interface Health {
  ok: boolean
  python: {
    bin: string
    version: string
    pillow: string
    freetype: string | null
    raqm: string | null
  } | null
  searched: string[]
  configured: string | null
  ffmpeg: boolean
  capabilities: { render: boolean; video: boolean }
}

let cache: Health | null = null
let inflight: Promise<Health | null> | null = null
const listeners = new Set<(h: Health | null) => void>()

function fetchHealth(force = false): Promise<Health | null> {
  if (cache && !force) return Promise.resolve(cache)
  if (!inflight || force) {
    inflight = fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      // A failed fetch means the server is down, which the app has its own
      // symptoms for. Reporting it as "Python is missing" would be a worse lie
      // than saying nothing.
      .catch(() => null)
      .then((h: Health | null) => {
        cache = h
        inflight = null
        listeners.forEach((fn) => fn(h))
        return h
      })
  }
  return inflight
}

export function refreshHealth() { return fetchHealth(true) }

export function useHealth() {
  const [health, setHealth] = useState<Health | null>(cache)

  useEffect(() => {
    let alive = true
    fetchHealth().then((h) => { if (alive) setHealth(h) })
    const listener = (h: Health | null) => setHealth(h)
    listeners.add(listener)
    return () => { alive = false; listeners.delete(listener) }
  }, [])

  return health
}
