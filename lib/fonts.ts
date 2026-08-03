import { existsSync, readdirSync } from 'fs'
import { basename, extname, isAbsolute, join } from 'path'

import { APP_ROOT, DATA_ROOT, expandPath } from './paths'
import { readSettings } from './settings'

/**
 * Which typefaces the app draws with.
 *
 * Both halves of the parity contract have to agree, so this is the one place
 * that decides: the renderer is handed these paths in its payload, and the
 * browser is served the same files. A CSS font stack the exporter cannot read,
 * or a vendored file the browser never sees, breaks the promise that the
 * preview is a preview.
 */

/** Shipped with the app: Inter and JetBrains Mono. Replaced on every upgrade. */
export const FONTS_DIR = join(APP_ROOT, 'fonts')

/** Yours. Only distinct from the above when the app is installed rather than
 *  cloned — but then it matters, because a typeface you dropped into
 *  node_modules would be gone on the next upgrade. Searched first, so your file
 *  wins over a shipped one of the same name. */
export const USER_FONTS_DIR = join(DATA_ROOT, 'fonts')

/** Both, nearest first. The same directory twice when running from a clone,
 *  which is why it is deduped. */
function fontDirs(): string[] {
  return [...new Set([USER_FONTS_DIR, FONTS_DIR])]
}

/** Where a bare font filename actually resolves. */
export function findFontFile(name: string): string | null {
  for (const dir of fontDirs()) {
    const p = join(dir, name)
    if (existsSync(p)) return p
  }
  return null
}

const FONT_EXT = new Set(['.ttf', '.otf', '.ttc', '.woff2'])

export interface FontChoice {
  /** As written in settings — a bare filename, or an absolute path. */
  configured: string
  /** Absolute path, or '' when nothing usable is configured. */
  path: string
  /** URL the browser can load it from, or '' when it is the vendored default. */
  url: string
}

/** Resolve one configured font. A bare name means a file in fonts/, which is
 *  the normal case; an absolute or ~ path is taken as given. Anything that does
 *  not exist resolves to nothing, and the caller falls back — a typo in
 *  settings.json should not stop you rendering. */
function resolve(configured: string): FontChoice {
  const name = (configured || '').trim()
  if (!name) return { configured: '', path: '', url: '' }
  const abs = isAbsolute(name) || name.startsWith('~')
    ? expandPath(name)
    : findFontFile(name) ?? ''
  if (!abs || !existsSync(abs)) return { configured: name, path: '', url: '' }
  return { configured: name, path: abs, url: `/fonts/${encodeURIComponent(basename(abs))}` }
}

export function bodyFont(): FontChoice { return resolve(readSettings().fontPath) }
export function monoFont(): FontChoice { return resolve(readSettings().monoFontPath) }

/** Added to every render and check payload, so the exporter and the checker
 *  measure with the face the preview is showing. Empty when nothing is
 *  configured, which leaves the renderer on its vendored default. */
export function fontPayload(): { fontPath?: string; monoFontPath?: string } {
  const body = bodyFont(), mono = monoFont()
  return {
    ...(body.path ? { fontPath: body.path } : {}),
    ...(mono.path ? { monoFontPath: mono.path } : {}),
  }
}

/** Everything in fonts/, for the picker. The two vendored faces are marked so
 *  the UI can say which are yours. */
export function listFonts() {
  const files = [...new Set(fontDirs().flatMap((dir) => {
    try { return readdirSync(dir).filter((f) => FONT_EXT.has(extname(f).toLowerCase())) }
    catch { return [] }          // missing dir is fine; the renderer has fallbacks
  }))]

  const body = bodyFont(), mono = monoFont()
  return files.sort().map((file) => ({
    file,
    url: `/fonts/${encodeURIComponent(file)}`,
    vendored: file === 'Inter-Variable.ttf' || file === 'JetBrainsMono-Regular.ttf',
    selectedAs: file === basename(body.path) ? 'body'
              : file === basename(mono.path) ? 'mono'
              : null,
  }))
}
