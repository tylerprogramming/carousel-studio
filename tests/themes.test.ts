import { describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadThemes } from '../lib/themes'
import { ROOT } from './helpers'

/**
 * Themes are the one part of this app a user extends by dropping a file in a
 * folder, with no code and no rebuild. That makes the failure modes theirs, not
 * ours, and the only useful question is what a *wrong* file does.
 *
 * The rule themes/README.md promises: a bad file is skipped on its own and the
 * others still load. That promise was broken by a file missing `name` — the
 * sort comparator called `.localeCompare` on undefined, which threw outside the
 * per-file try, and the route's outer catch turned one typo into an empty
 * swatch row. Nothing pointed at the file responsible.
 *
 * Written against a temp directory rather than the real themes/, so the suite
 * stays read-only with respect to anything shipped.
 */

const DIR = join(ROOT, 'tests', 'fixtures', 'themes-tmp')

const valid = (over: Record<string, unknown> = {}) => JSON.stringify({
  name: 'Valid', bgColor: '#FFFFFF', textColor: '#000000', accentColor: '#FF0000', ...over,
})

/** Builds a throwaway themes directory, runs the loader, cleans up. */
function withThemes<T>(files: Record<string, string>, fn: (themes: ReturnType<typeof loadThemes>) => T): T {
  rmSync(DIR, { recursive: true, force: true })
  mkdirSync(DIR, { recursive: true })
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(DIR, name), body)
    return fn(loadThemes(DIR))
  } finally {
    rmSync(DIR, { recursive: true, force: true })
  }
}

describe('loadThemes', () => {
  test('a file missing `name` does not take the others down with it', () => {
    const themes = withThemes({
      'good.json': valid({ name: 'Good' }),
      'nameless.json': JSON.stringify({ bgColor: '#FFF', textColor: '#000', accentColor: '#F00' }),
      'also-good.json': valid({ name: 'Also Good' }),
    }, (t) => t)

    // All three, because a missing name is a default and not a defect.
    expect(themes.map((t) => t.name).sort()).toEqual(['Also Good', 'Good', 'nameless'])
  })

  test('name and id both fall back to the filename, as documented', () => {
    const [theme] = withThemes({
      'burnt-orange.json': JSON.stringify({ bgColor: '#FFF', textColor: '#000', accentColor: '#F00' }),
    }, (t) => t)

    expect(theme.id).toBe('burnt-orange')
    expect(theme.name).toBe('burnt-orange')
  })

  test('broken JSON is skipped alone', () => {
    const themes = withThemes({
      'ok.json': valid({ name: 'Ok' }),
      'truncated.json': '{ "bgColor": "#FFF", ',
    }, (t) => t)

    expect(themes.map((t) => t.name)).toEqual(['Ok'])
  })

  test('a theme missing one of the three colours is skipped', () => {
    const themes = withThemes({
      'ok.json': valid({ name: 'Ok' }),
      'no-accent.json': JSON.stringify({ name: 'No Accent', bgColor: '#FFF', textColor: '#000' }),
    }, (t) => t)

    expect(themes.map((t) => t.name)).toEqual(['Ok'])
  })

  test('order sorts the row, and name breaks a tie', () => {
    const themes = withThemes({
      'c.json': valid({ name: 'Zed', order: 1 }),
      'a.json': valid({ name: 'Alpha', order: 2 }),
      'b.json': valid({ name: 'Beta', order: 2 }),
      'd.json': valid({ name: 'Unordered' }),          // no order sorts last
    }, (t) => t)

    expect(themes.map((t) => t.name)).toEqual(['Zed', 'Alpha', 'Beta', 'Unordered'])
  })

  test('an unreadable directory is an empty list, not a throw', () => {
    expect(loadThemes(join(ROOT, 'no', 'such', 'directory'))).toEqual([])
  })
})

describe('the shipped themes', () => {
  const shipped = loadThemes(join(ROOT, 'themes'))

  test('all load', () => {
    // If this drops to zero, every swatch is gone from the editor.
    expect(shipped.length).toBeGreaterThan(5)
  })

  test('each has an id, a name and three colours', () => {
    for (const t of shipped) {
      expect(t.id, `${t.id}: id`).toBeTruthy()
      expect(t.name, `${t.id}: name`).toBeTruthy()
      for (const key of ['bgColor', 'textColor', 'accentColor'] as const) {
        expect(t[key], `${t.id}: ${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    }
  })

  test('no two claim the same order slot', () => {
    // Ties still sort deterministically, so this is not a crash — it is that
    // the swatch row ignores where you meant to put the theme.
    const ordered = shipped.filter((t) => t.order !== undefined)
    const slots = ordered.map((t) => t.order)
    expect(slots).toEqual([...new Set(slots)])
  })
})
