import { useEffect } from 'react'
import { useSettings } from './useSettings'

/**
 * Load the configured typefaces into the browser, from the same files the
 * renderer draws with.
 *
 * This is the browser half of a two-sided change. `fontPath` in settings tells
 * generate_slide.py which face to use; without this, the preview would carry on
 * showing Inter while the export came out in something else — the parity
 * contract broken in the way that is hardest to notice, because both halves
 * look perfectly fine on their own.
 *
 * The families are named `CustomBody` and `CustomMono` rather than after the
 * font itself. The actual family name lives inside the file and reading it in
 * the browser means parsing the font, while all SlidePreview needs is a stable
 * handle to put at the front of its stack.
 */

const injected = new Map<string, HTMLStyleElement>()

function injectFace(family: string, url: string) {
  const key = `${family}:${url}`
  if (injected.has(key)) return
  // Clear any previous file for this family, so switching fonts does not leave
  // the old @font-face winning by declaration order.
  for (const [k, el] of injected) {
    if (k.startsWith(`${family}:`)) { el.remove(); injected.delete(k) }
  }
  const style = document.createElement('style')
  style.dataset.font = family
  style.textContent =
    `@font-face{font-family:'${family}';src:url('${url}');font-weight:100 900;font-display:block}`
  document.head.appendChild(style)
  injected.set(key, style)
}

export function useCustomFonts() {
  const { settings } = useSettings()
  const body = (settings.fontPath || '').trim()
  const mono = (settings.monoFontPath || '').trim()

  useEffect(() => {
    // The server serves fonts by basename out of fonts/, so an absolute path in
    // settings still resolves to the file the renderer opened.
    const nameOf = (p: string) => p.split(/[/\\]/).pop() ?? ''
    if (body) injectFace('CustomBody', `/fonts/${encodeURIComponent(nameOf(body))}`)
    if (mono) injectFace('CustomMono', `/fonts/${encodeURIComponent(nameOf(mono))}`)
  }, [body, mono])

  return {
    /** Prepended to the preview's stacks. Empty when nothing is configured,
     *  which leaves the vendored defaults in place. */
    bodyFamily: body ? `'CustomBody', ` : '',
    monoFamily: mono ? `'CustomMono', ` : '',
  }
}
