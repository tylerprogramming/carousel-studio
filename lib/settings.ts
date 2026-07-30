import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// Deliberately not from ./paths: paths.ts imports readSettings for exportDir()
// and friends, so importing SETTINGS_FILE back from it would be a cycle. This
// is the one path this module needs and it is the same join.
const SETTINGS_FILE = join(import.meta.dir, '..', 'settings.json')

/**
 * settings.json, cached.
 *
 * readSettings() reads like a cheap accessor, which is how it ended up inside
 * the per-slide export loop. It is a readFileSync plus a JSON.parse.
 */
let cache: Record<string, any> | null = null

/** Things that derive from settings and must be recomputed when it changes.
 *  A registry rather than a direct call, so this module does not have to know
 *  about the Python resolver — which imports it. */
const invalidators: (() => void)[] = []
export function onSettingsChange(fn: () => void) { invalidators.push(fn) }

export function readSettings(): Record<string, any> {
  if (cache) return cache
  try { cache = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) } catch { cache = {} }
  return cache!
}

export function writeSettings(data: Record<string, any>) {
  const merged = { ...readSettings(), ...data }
  cache = null
  invalidators.forEach((fn) => fn())
  writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2))
}

/** Creator handle shown on CTA slides and in the platform preview mockups. */
export function creatorHandle(): string {
  const h = (readSettings().handle || '@yourhandle').trim()
  return h.startsWith('@') ? h : `@${h}`
}

/**
 * Load API keys. A .env in the project root is the normal case; ~/.claude/.env
 * is also read so the app works inside a Claude Code setup without duplicating
 * keys. Real environment variables always win over both.
 */
export function loadEnv() {
  for (const envPath of [join(import.meta.dir, '..', '.env'), join(homedir(), '.claude', '.env')]) {
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
