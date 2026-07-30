import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { describeSlide, describeSlides, fitAlt } from '../lib/alt'
import { FIXTURES } from './helpers'

/**
 * Alt text, which has to work without an API key.
 *
 * These slides are almost entirely text, so the useful description is mostly
 * mechanical — the headline and the commands are the content. That makes it
 * testable, and it means accessibility is not the one feature gated behind a
 * credit card.
 */

const deck = JSON.parse(readFileSync(join(FIXTURES, 'clean-deck.json'), 'utf8')).slides

describe('every slide gets a description', () => {
  const described = describeSlides(deck)

  test('one per slide, in order', () => {
    expect(described).toHaveLength(deck.length)
    described.forEach((t, i) => expect(t.startsWith(`Slide ${i + 1} of ${deck.length}`)).toBe(true))
  })

  test('none are empty or trivially short', () => {
    for (const t of described) expect(t.length).toBeGreaterThan(20)
  })

  test('the terminal commands are read out, not summarised', () => {
    // A slide whose content IS a command must not come back as "a terminal
    // window" — that is precisely the information a screen reader needs.
    const withTerminal = described[1]
    expect(withTerminal).toContain('hyperframes transcribe clip.mp4')
  })

  test('a slide with no text still says so rather than returning nothing', () => {
    expect(describeSlide({}, 0, 1)).toBe('Slide 1 of 1. No text on this slide.')
  })

  test('a step number is spoken', () => {
    expect(describeSlide({ headline: 'Cut it', stepNumber: 2 }, 0, 3)).toContain('Step 2: Cut it.')
  })

  test('a photo is mentioned, because the text does not account for it', () => {
    expect(describeSlide({ headline: 'Hi', backgroundImage: '/x.png' }, 0, 1)).toContain('Photo background.')
  })
})

describe('fitting Instagram\'s 100 character limit', () => {
  test('short text is returned untouched', () => {
    expect(fitAlt('Slide 1 of 2. Short.')).toBe('Slide 1 of 2. Short.')
  })

  test('long text is cut at a sentence, not mid-word', () => {
    const long = describeSlides(deck)[1]
    expect(long.length).toBeGreaterThan(100)
    const fitted = fitAlt(long)
    expect(fitted.length).toBeLessThanOrEqual(100)
    expect(/[.!?]$/.test(fitted)).toBe(true)
  })

  test('an unbroken run with no sentence end still cuts on a word boundary', () => {
    const runOn = 'word '.repeat(40).trim()
    const fitted = fitAlt(runOn)
    expect(fitted.length).toBeLessThanOrEqual(100)
    expect(fitted.endsWith('word')).toBe(true)
  })
})
