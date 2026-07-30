import { useState } from 'react'
import { useHealth } from '../hooks/useHealth'

/**
 * Says up front when this machine cannot do the work.
 *
 * It is silent when everything is present, which is the normal case and the
 * only way a banner like this stays worth reading. There are two things it will
 * speak up about, and they are not the same severity:
 *
 * - No Python with Pillow. Nothing renders. You would otherwise build a whole
 *   carousel and meet a traceback at Export, so this is loud and stays put.
 * - No ffmpeg. Video is unavailable; PNG and PDF are completely fine. That is a
 *   missing feature, not a broken app, so it is quiet and dismissible.
 */
export default function HealthBanner() {
  const health = useHealth()
  const [dismissed, setDismissed] = useState(false)

  // No answer yet, or the server is unreachable — the app has louder symptoms
  // for that than a banner.
  if (!health) return null

  if (!health.capabilities.render) {
    return (
      <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-900">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-px text-base leading-none">⚠</span>
          <div className="min-w-0">
            <p className="font-semibold">
              No Python with Pillow found. Slides will not render.
            </p>
            <p className="mt-1 text-red-800">
              Install it with <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-[12px]">pip install -r requirements.txt</code>
              , then reload.
            </p>
            {health.configured && (
              <p className="mt-1 text-red-800">
                <code className="font-mono text-[12px]">pythonPath</code> is set to{' '}
                <code className="font-mono text-[12px]">{health.configured}</code>, which cannot import Pillow.
              </p>
            )}
            <details className="mt-1.5">
              <summary className="cursor-pointer text-red-700 hover:text-red-900">
                Interpreters tried
              </summary>
              <ul className="mt-1 space-y-0.5 font-mono text-[12px] text-red-800">
                {health.searched.map((bin) => <li key={bin}>{bin}</li>)}
              </ul>
            </details>
          </div>
        </div>
      </div>
    )
  }

  // Rendering works; only video is short. Worth one line, not a wall.
  if (!health.ffmpeg && !dismissed) {
    return (
      <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-900">
        <span className="min-w-0 flex-1">
          <span className="font-medium">ffmpeg not found</span>
          {' — video export is unavailable. PNG and PDF work normally.'}
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded px-2 py-0.5 text-amber-800 hover:bg-amber-100"
        >
          Dismiss
        </button>
      </div>
    )
  }

  return null
}
