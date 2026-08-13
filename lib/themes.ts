import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * A theme is one JSON file in themes/. Drop a file in, reload the app, and it
 * shows up — no rebuild, no code change. See themes/README.md for the fields.
 *
 * This lives here rather than inline in server.ts so it can be tested against a
 * directory of deliberately broken files. It used to be four lines in a route
 * handler, and the promise the README makes — that one bad file is skipped on
 * its own without hiding the others — was not true: a file missing `name` threw
 * inside the sort comparator, which is outside the per-file try, so the route's
 * outer catch returned an empty list and every theme disappeared from the
 * swatch row at once.
 */

export interface Theme {
  id: string
  name: string
  bgColor: string
  textColor: string
  accentColor: string
  builtin: true
  [key: string]: unknown
}

/** Reads every valid theme in `dir`, sorted the way the swatch row shows them.
 *  Never throws: an unreadable directory is an empty palette list, not a 500. */
export function loadThemes(dir: string): Theme[] {
  let files: string[]
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }

  const themes = files
    .map((f) => {
      try {
        const t = JSON.parse(readFileSync(join(dir, f), 'utf8'))
        // The three colours are what a theme *is*. Anything else has a default.
        if (!t.bgColor || !t.textColor || !t.accentColor) return null
        const slug = f.replace(/\.json$/, '')
        // Both fall back to the filename, which is what themes/README.md
        // documents and is always something a person can recognise.
        return { ...t, id: t.id || slug, name: t.name || slug, builtin: true } as Theme
      } catch {
        return null   // one malformed file must not hide the rest
      }
    })
    .filter(Boolean) as Theme[]

  // Explicit `order` keeps the swatch row stable; readdir order is not. Name
  // breaks ties, so two themes claiming the same slot still sort predictably
  // rather than swapping places between reads.
  return themes.sort(
    (a, b) => (Number(a.order ?? 999) - Number(b.order ?? 999)) || a.name.localeCompare(b.name),
  )
}
