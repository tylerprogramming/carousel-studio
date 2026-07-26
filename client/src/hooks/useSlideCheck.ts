import { useEffect, useMemo, useState } from 'react'
import { Slide } from '../types'

/**
 * The pre-export check, run while you edit.
 *
 * check_slides.py measures with the renderer's own fonts and geometry, so it
 * catches things the browser preview does not — a headline clipped to
 * "/embedded-captio" shipped and was scheduled to post because the finding
 * only ever arrived as a line of JSON attached to the export response. A
 * sentence saying "slide 3" is not read the way a mark on slide 3 is, so the
 * findings are pulled forward to where the editing happens.
 *
 * It spawns a Python process per call, which is why this debounces rather than
 * firing per keystroke.
 */

export interface Finding {
  /** slideNumber, not array index — see the id mapping below. */
  slide: number
  level: 'error' | 'warning'
  code: string
  message: string
}

interface CheckResponse {
  ok: boolean
  counts: { error: number; warning: number }
  findings: Finding[]
}

const DEBOUNCE_MS = 800
const NONE: Finding[] = []

/** Errors first. A warning is advice; an error renders wrong. */
export function sortFindings(findings: Finding[]) {
  return [...findings].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))
}

/** The worse of a slide's findings, which is what a single dot can say. */
export function worstLevel(findings: Finding[]): 'error' | 'warning' | null {
  if (findings.some((f) => f.level === 'error')) return 'error'
  return findings.length ? 'warning' : null
}

/**
 * Findings arrive keyed by slideNumber, which is rewritten on every insert,
 * delete and reorder. Re-key them to slide ids against the deck they were
 * measured on, so a finding stays on its slide when the deck moves under it.
 * The positional fallback covers a slide whose slideNumber is out of step.
 */
export function groupById(findings: Finding[], checked: Slide[]) {
  const byId: Record<string, Finding[]> = {}
  for (const f of findings) {
    const slide = checked.find((s) => s.slideNumber === f.slide) ?? checked[f.slide - 1]
    if (!slide) continue
    ;(byId[slide.id] ??= []).push(f)
  }
  return byId
}

export interface SlideCheck {
  errors: number
  warnings: number
  /** Index of the first slide with a finding, errors before warnings. -1 if clean. */
  firstIndex: number
  /** False until the first answer lands, so nothing claims "clear" too early. */
  loaded: boolean
  /** This slide's findings, empty for a clean one. */
  findingsFor: (slide: Slide) => Finding[]
}

export function useSlideCheck(slides: Slide[]): SlideCheck {
  const [byId, setById] = useState<Record<string, Finding[]>>({})
  const [loaded, setLoaded] = useState(false)

  // Re-check on what the slides say, not on the array's identity. Undo, load
  // and autosave all hand back new arrays with identical content.
  const payload = useMemo(() => JSON.stringify({ slides }), [slides])

  useEffect(() => {
    const ctrl = new AbortController()
    // The deck as sent. A result landing after another edit is still mapped
    // against the slides it was measured on, never the ones on screen now.
    const checked = slides
    const t = setTimeout(() => {
      fetch('/api/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: payload, signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: CheckResponse | null) => {
          if (!data?.findings) return
          setById(groupById(data.findings, checked))
          setLoaded(true)
        })
        .catch(() => {
          // Aborted, offline, or Python missing. Keep the last answer: going
          // quiet here would read as an all-clear, which is the failure this
          // whole thing exists to prevent.
        })
    }, DEBOUNCE_MS)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [payload])

  // Counted over the current slides so a deleted slide takes its findings with
  // it, and the header total always agrees with the dots in the list.
  const summary = useMemo(() => {
    let errors = 0, warnings = 0, firstError = -1, firstWarning = -1
    slides.forEach((s, i) => {
      for (const f of byId[s.id] ?? NONE) {
        if (f.level === 'error') { errors++; if (firstError < 0) firstError = i }
        else { warnings++; if (firstWarning < 0) firstWarning = i }
      }
    })
    return { errors, warnings, firstIndex: firstError >= 0 ? firstError : firstWarning }
  }, [slides, byId])

  return { loaded, ...summary, findingsFor: (slide: Slide) => byId[slide.id] ?? NONE }
}
