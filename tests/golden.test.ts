import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'bun'
import { join } from 'path'
import { ROOT } from './helpers'

/**
 * The exporter, against renders that are known to be right.
 *
 * check_slides.py catches the bugs that can be written down as a rule. This
 * catches the rest: the headline that quietly clipped to "/embedded-captio"
 * broke no rule, it just came out wrong, and nothing but looking at the pixels
 * would have found it before it was posted.
 *
 * The grading, the thresholds and the numbers they were calibrated against are
 * in tests/golden.py. This file only runs it and reports what failed.
 */

interface SlideResult { name: string; status: string; soft: number; hard: number; peak?: number }
interface Report { ok: boolean; error?: string; thresholds?: object; slides?: SlideResult[] }

const proc = spawnSync(['python3', join(ROOT, 'tests', 'golden.py'), 'compare'], { cwd: ROOT })
const report: Report = JSON.parse(proc.stdout.toString() || '{}')

describe('golden renders', () => {
  test('the comparison ran at all', () => {
    // A missing goldens directory or a renderer that crashed is its own
    // failure, not five confusing per-slide ones.
    expect(report.error).toBeUndefined()
    expect(report.slides?.length).toBeGreaterThan(0)
  })

  for (const slide of report.slides ?? []) {
    test(`${slide.name} renders as committed`, () => {
      if (slide.status !== 'ok') {
        // Bun prints the message on failure, so put the numbers and the way
        // out in it rather than leaving "expected ok, got changed".
        const detail = `${slide.name}: ${slide.status} ` +
          `(soft ${slide.soft}, hard ${slide.hard}). ` +
          `Look at tests/fixtures/golden/_failed/, then if the change is ` +
          `intended run: bun run test:golden:update`
        expect(detail).toBe(`${slide.name}: ok`)
      }
      expect(slide.status).toBe('ok')
    })
  }
})
