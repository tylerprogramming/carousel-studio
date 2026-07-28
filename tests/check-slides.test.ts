import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { FIXTURES, ROOT, pyScript } from './helpers'

/**
 * check_slides.py, against slides whose findings are known.
 *
 * The checker is the one piece of this repo that is only useful if it is
 * trusted, and its first version was not: it reported five errors on slides
 * that render correctly. Being accurate mattered more than being thorough,
 * because a checker you have learned to ignore is worse than no checker.
 *
 * So there are two halves here. Broken slides must produce exactly the codes
 * they are built to produce, and a deck that is genuinely correct must produce
 * nothing at all.
 */

interface Finding { slide: number; level: 'error' | 'warning'; code: string; message: string }
interface Result { ok: boolean; counts: { error: number; warning: number }; findings: Finding[] }

const read = (name: string) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'))
const check = (slides: unknown[], strict = false): Result =>
  pyScript<Result>('check_slides.py', JSON.stringify({ slides, strict }))

const cases: { name: string; expect: string[]; slide: Record<string, unknown> }[] =
  read('findings.json').cases
const cleanDeck: Record<string, unknown>[] = read('clean-deck.json').slides

describe('a correct carousel is reported as correct', () => {
  const result = check(cleanDeck)

  // The headline assertion. Not "no errors" — no findings of any level. A
  // warning on a slide that is fine is the same trust problem as an error.
  test('the clean deck produces no findings at all', () => {
    expect(result.findings).toEqual([])
  })

  test('and passes under strict', () => {
    expect(check(cleanDeck, true).ok).toBe(true)
  })

  // Each slide alone, so a failure names the slide instead of the deck.
  for (const slide of cleanDeck) {
    test(`slide ${slide.slideNumber} (${slide.type}/${slide.variant})`, () => {
      expect(check([slide]).findings).toEqual([])
    })
  }
})

describe('a broken slide is reported as broken', () => {
  for (const c of cases) {
    test(c.name, () => {
      const codes = check([c.slide]).findings.map(f => f.code).sort()
      // Exact set. A subset assertion would pass while the checker quietly
      // grew a false positive on the same slide.
      expect(codes).toEqual([...c.expect].sort())
    })
  }
})

describe('result shape', () => {
  test('an empty carousel is an error, not a crash', () => {
    const r = check([])
    expect(r.ok).toBe(false)
    expect(r.findings.map(f => f.code)).toEqual(['no_slides'])
  })

  test('counts match the findings they summarise', () => {
    const slides = cases.map((c, i) => ({ ...c.slide, slideNumber: i + 1 }))
    const r = check(slides)
    expect(r.counts.error).toBe(r.findings.filter(f => f.level === 'error').length)
    expect(r.counts.warning).toBe(r.findings.filter(f => f.level === 'warning').length)
    expect(r.counts.error + r.counts.warning).toBe(r.findings.length)
  })

  test('every finding carries a slide number, a level and a message', () => {
    for (const f of check(cases.map((c, i) => ({ ...c.slide, slideNumber: i + 1 }))).findings) {
      expect(f.slide).toBeGreaterThan(0)
      expect(['error', 'warning']).toContain(f.level)
      expect(f.message.length).toBeGreaterThan(0)
    }
  })

  test('warnings alone pass, and fail under strict', () => {
    const warnOnly = cases.find(c => c.name.startsWith('CTA slide'))!.slide
    expect(check([warnOnly]).ok).toBe(true)
    expect(check([warnOnly], true).ok).toBe(false)
  })

  test('an error fails whether or not strict is set', () => {
    const err = cases.find(c => c.expect.includes('empty_headline'))!.slide
    expect(check([err]).ok).toBe(false)
    expect(check([err], true).ok).toBe(false)
  })
})

describe('coverage', () => {
  // Pulled out of the source rather than listed here, so adding a check
  // without a fixture fails instead of shipping untested.
  const declared = [...readFileSync(join(ROOT, 'check_slides.py'), 'utf8')
    .matchAll(/add\((?:ERROR|WARN),\s*'([a-z_]+)'/g)].map(m => m[1])

  test('the source declares the codes we think it does', () => {
    expect(declared.length).toBeGreaterThan(0)
  })

  test('every check has a fixture', () => {
    const covered = new Set(cases.flatMap(c => c.expect))
    expect([...new Set(declared)].filter(c => !covered.has(c))).toEqual([])
  })

  test('every fixture points at a real check', () => {
    const known = new Set([...declared, 'no_slides'])
    expect([...new Set(cases.flatMap(c => c.expect))].filter(c => !known.has(c))).toEqual([])
  })
})
