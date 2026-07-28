import { describe, expect, test } from 'bun:test'
import { TALL_SAFE, terminalGeometry } from '../client/src/lib/geometry'
import { py } from './helpers'

/**
 * The renderer parity contract, as a test.
 *
 * generate_slide.py and SlidePreview.tsx are two implementations of one design,
 * and every number that differs between the 4:5 canvas and the 9:16 one lives
 * in a table on each side. Until now "these two tables agree" was a paragraph
 * in the README. A paragraph does not fail CI.
 *
 * Python is the specification; TypeScript follows it. So the failure messages
 * below are phrased as "the TS table is wrong", because that is the side that
 * has to move.
 */

/** rail_y -> railY. The two tables are field-for-field but not casing-for-casing. */
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

function pythonGeometry(tall: boolean): Record<string, number> {
  const raw = py<Record<string, number>>(
    'import json, generate_slide as g; ' +
    `print(json.dumps(g.terminal_geometry(${tall ? 'True' : 'False'})))`,
  )
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [camel(k), v]))
}

describe('geometry parity: generate_slide.py <-> lib/geometry.ts', () => {
  for (const [label, tall] of [['4:5 terminal', false], ['9:16 tall', true]] as const) {
    describe(label, () => {
      const expected = pythonGeometry(tall)
      const actual = terminalGeometry(tall) as unknown as Record<string, number>

      // Whole-object equality, not per-field. A field added to one table and
      // forgotten on the other is exactly the drift this exists to catch, and
      // a loop over the Python keys alone would not see an extra TS key.
      test('tables match field for field', () => {
        expect(actual).toEqual(expected)
      })

      // Same assertion, one field at a time. Redundant on a pass, but on a
      // failure it names the constant instead of printing two ten-key objects
      // and leaving you to diff them by eye.
      for (const key of Object.keys(expected)) {
        test(`${key}`, () => {
          expect(actual[key]).toBe(expected[key])
        })
      }
    })
  }
})

describe('TikTok safe area', () => {
  // The tall geometry is derived from these three numbers on both sides, so
  // they can drift while every table field still looks self-consistent.
  const expected = py<Record<string, number>>(
    'import json, generate_slide as g; ' +
    'print(json.dumps({"top": g.TALL_SAFE_TOP, "right": g.TALL_SAFE_RIGHT, "bottom": g.TALL_SAFE_BOTTOM}))',
  )

  test('keep-out zones match', () => {
    // Widened off TALL_SAFE's `as const` literal types, which cannot be
    // compared against numbers read out of Python.
    const actual: Record<string, number> = { ...TALL_SAFE }
    expect(actual).toEqual(expected)
  })

  test('tall canvas size matches', () => {
    const size = py<{ width: number; height: number }>(
      'import json, generate_slide as g; ' +
      'print(json.dumps({"width": g.TALL_WIDTH, "height": g.TALL_HEIGHT}))',
    )
    const g = terminalGeometry(true)
    expect({ width: g.width, height: g.height }).toEqual(size)
  })
})
