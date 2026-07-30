import { existsSync, readdirSync } from 'fs'
import { basename, extname, isAbsolute, join } from 'path'

import { APP_ROOT, expandPath } from './paths'
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

export const FONTS_DIR = join(APP_ROOT, 'fonts')

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
    : join(FONTS_DIR, name)
  if (!existsSync(abs)) return { configured: name, path: '', url: '' }
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
  let files: string[] = []
  try {
    files = readdirSync(FONTS_DIR).filter((f) => FONT_EXT.has(extname(f).toLowerCase()))
  } catch { /* no fonts dir — the renderer has its own fallbacks */ }

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
