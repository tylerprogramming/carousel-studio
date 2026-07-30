/**
 * Alt text for a slide.
 *
 * Carousels are among the least accessible formats on the internet: the words
 * are baked into a picture, so a screen reader gets nothing at all unless
 * someone types them out again.
 *
 * These slides are almost entirely text, which makes the useful description
 * mostly mechanical — the headline, the emphasis line and the terminal commands
 * *are* the content. So this is deterministic and needs no API key. Accessibility
 * should not be the one feature that requires a credit card.
 *
 * /api/captions asks a model to improve on it with the whole carousel in view,
 * and falls back to this whenever it declines or returns short.
 */

export interface AltSlide {
  slideNumber?: number
  type?: string
  headline?: string
  emphasisLine?: string
  bodyText?: string
  terminalLines?: string[]
  backgroundImage?: string
  stepNumber?: number | null
}

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()

/** End a clause with a single full stop, whatever it already ends with. */
function sentence(s: string): string {
  const t = clean(s)
  if (!t) return ''
  return /[.!?:]$/.test(t) ? t : `${t}.`
}

/**
 * Describe one slide as someone would read it aloud.
 *
 * Deliberately not a description of the design. "A dark slide with an orange
 * accent" tells a screen-reader user nothing they can act on; the headline and
 * the command do. The visual note at the end is one clause, and only when there
 * is a photo — because then there is something on screen the text does not
 * account for.
 */
export function describeSlide(slide: AltSlide, index: number, total: number): string {
  const position = `Slide ${slide.slideNumber ?? index + 1} of ${total}`
  const parts: string[] = []

  const headline = clean(slide.headline)
  if (headline) {
    parts.push(slide.stepNumber != null
      ? `Step ${slide.stepNumber}: ${sentence(headline)}`
      : sentence(headline))
  }

  const emphasis = clean(slide.emphasisLine)
  if (emphasis) parts.push(sentence(emphasis))

  const body = clean(slide.bodyText)
  if (body) parts.push(sentence(body))

  // The commands are the substance of a terminal slide, so they are read out
  // rather than summarised as "a terminal window".
  const lines = (slide.terminalLines ?? []).map(clean).filter(Boolean)
  if (lines.length) {
    parts.push(`Terminal showing: ${lines.join('; ')}.`)
  }

  if (slide.backgroundImage) parts.push('Photo background.')

  if (!parts.length) return `${position}. No text on this slide.`
  return `${position}. ${parts.join(' ')}`.replace(/\s+/g, ' ').trim()
}

/** Alt text for every slide, in order. */
export function describeSlides(slides: AltSlide[]): string[] {
  return slides.map((s, i) => describeSlide(s, i, slides.length))
}

/**
 * Instagram caps alt text at 100 characters per image, which is shorter than
 * most of these come out. Rather than truncate mid-word, cut at the last
 * sentence that fits, and failing that the last word.
 */
export function fitAlt(text: string, limit = 100): string {
  const t = clean(text)
  if (t.length <= limit) return t

  const sentences = t.match(/[^.!?]+[.!?]/g) ?? []
  let out = ''
  for (const s of sentences) {
    if ((out + s).trim().length > limit) break
    out += s
  }
  out = out.trim()
  if (out) return out

  const words = t.slice(0, limit).split(' ')
  words.pop()                                  // the word the limit cut in half
  return words.join(' ').replace(/[,;:]$/, '')
}
