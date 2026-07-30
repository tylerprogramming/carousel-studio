import { useEffect, useState } from 'react'

/**
 * App settings, fetched once and shared.
 *
 * The creator's handle drives the CTA slide and the username shown in the
 * Instagram / LinkedIn / TikTok preview mockups, so it lives in settings.json
 * rather than being hardcoded per component.
 */

export interface Settings {
  handle?: string
  brandVoice?: string
  exportDir?: string
  likenessPath?: string
  likenessDescription?: string
  /** Interpreter used to render slides. Unset, the first one with Pillow wins. */
  pythonPath?: string
  /** Body typeface. A filename in fonts/, or an absolute path. */
  fontPath?: string
  /** Monospace typeface for the terminal variant. Same rules. */
  monoFontPath?: string
}

const DEFAULT_HANDLE = '@yourhandle'

let cache: Settings | null = null
let inflight: Promise<Settings> | null = null
const listeners = new Set<(s: Settings) => void>()

function fetchSettings(): Promise<Settings> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((s: Settings) => {
        cache = s
        inflight = null
        listeners.forEach((fn) => fn(s))
        return s
      })
  }
  return inflight
}

export async function saveSettings(patch: Settings): Promise<Settings> {
  const res = await fetch('/api/settings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await res.json()
  cache = data.settings ?? { ...(cache ?? {}), ...patch }
  listeners.forEach((fn) => fn(cache!))
  return cache!
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(cache ?? {})

  useEffect(() => {
    let alive = true
    fetchSettings().then((s) => { if (alive) setSettings(s) })
    const listener = (s: Settings) => setSettings(s)
    listeners.add(listener)
    return () => { alive = false; listeners.delete(listener) }
  }, [])

  const handle = (settings.handle || DEFAULT_HANDLE).trim()
  const withAt = handle.startsWith('@') ? handle : `@${handle}`

  return {
    settings,
    /** Handle including the leading @, e.g. "@yourhandle" */
    handle: withAt,
    /** Bare username without the @, for mockups that render it separately */
    username: withAt.slice(1),
  }
}
