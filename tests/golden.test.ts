import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'bun'
import { join } from 'path'
import { ROOT, python } from './helpers'

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
interface Provenance { platform: string; pillow: string; mono: string }
interface Report {
  ok: boolean
  error?: string
  skipped?: boolean
  reason?: string
  likely_cause?: string
  note?: string
  expected?: Provenance
  actual?: Provenance
  thresholds?: object
  slides?: SlideResult[]
}

// Resolved, not the literal 'python3' — golden.py renders through sys.executable,
// so which interpreter starts it decides which Pillow and FreeType the pixels
// come from.
const proc = spawnSync([python(), join(ROOT, 'tests', 'golden.py'), 'compare'], { cwd: ROOT })
const report: Report = JSON.parse(proc.stdout.toString() || '{}')

/**
 * The goldens record the platform, Pillow version and mono font that produced
 * them. A different OS resolves a different mono font — Menlo on macOS,
 * vendored JetBrains Mono elsewhere — so these renders genuinely cannot be
 * reproduced there, and failing would be telling the reader off for something
 * they cannot fix.
 *
 * Skipping is only honest if it is loud, so it prints why, and CI asserts on
 * the macOS runner that this did not skip. A quietly skipped suite is worse
 * than a deleted one: it still looks like coverage.
 */
if (report.skipped) {
  console.log(`\n  ─ golden renders skipped: ${report.reason}` +
    `\n    goldens: ${JSON.stringify(report.expected)}` +
    `\n    here:    ${JSON.stringify(report.actual)}` +
    `\n    Regenerate for this platform with: bun run test:golden:update\n`)
}

describe.skipIf(!!report.skipped)('golden renders', () => {
  test('the comparison ran at all', () => {
    // A missing goldens directory, drifted Pillow, or a renderer that crashed
    // is its own failure, not five confusing per-slide ones.
    expect(report.error).toBeUndefined()
    expect(report.slides?.length).toBeGreaterThan(0)
  })

  for (const slide of report.slides ?? []) {
    test(`${slide.name} renders as committed`, () => {
      if (slide.status !== 'ok') {
        // Bun prints the message on failure, so put the numbers, the likely
        // cause and the way out in it rather than leaving "expected ok, got
        // changed".
        const detail = `${slide.name}: ${slide.status} ` +
          `(soft ${slide.soft}, hard ${slide.hard}). ` +
          (report.likely_cause
            ? report.likely_cause
            : `Look at tests/fixtures/golden/_failed/, then if the change is ` +
              `intended run: bun run test:golden:update`)
        expect(detail).toBe(`${slide.name}: ok`)
      }
      expect(slide.status).toBe('ok')
    })
  }
})
