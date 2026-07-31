import { copyFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

import { APP_ROOT, CAROUSELS_DIR } from './paths'

/**
 * Put the example decks in front of a first-time user.
 *
 * `carousels/` is gitignored, so a fresh clone used to open on an empty editor:
 * two runtimes installed, an API key added, and nothing on screen to tell you
 * what the tool does or what a good deck looks like. The examples answer both
 * before you have typed anything, and they are ordinary carousels — editable,
 * deletable, and useful as a starting point.
 *
 * Only ever runs into an empty directory. It is not a sync: once you have your
 * own carousels, deleting an example keeps it deleted, and an example you have
 * edited is yours and is never overwritten.
 */

export const EXAMPLES_DIR = join(APP_ROOT, 'examples')

export function seedExamples(): string[] {
  let existing: string[] = []
  try {
    existing = readdirSync(CAROUSELS_DIR).filter((f) => f.endsWith('.json'))
  } catch {
    return []                       // no carousels dir yet; ensureDirs runs first
  }
  if (existing.length) return []    // you have your own — leave well alone

  let examples: string[] = []
  try {
    examples = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.json'))
  } catch {
    return []                       // running without the examples folder is fine
  }

  const seeded: string[] = []
  for (const file of examples) {
    const dest = join(CAROUSELS_DIR, file)
    if (existsSync(dest)) continue
    try {
      copyFileSync(join(EXAMPLES_DIR, file), dest)
      seeded.push(file)
    } catch { /* a failed copy is not worth stopping startup for */ }
  }
  return seeded
}
