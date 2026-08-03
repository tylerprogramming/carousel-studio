import { useState } from 'react'
import { Slide } from '../types'
import { Label } from './ui/label'
import { Input } from './ui/input'

/**
 * The whole carousel as one card.
 *
 * Lifts the takeaway from each slide onto a single frame — useful as a closing
 * slide, a standalone post, or a recap clip. The server does the lifting: it
 * skips the cover and any CTA (framing, not points) and prefers each slide's
 * emphasis line, because headlines here are often labels like "the test" that
 * mean nothing once removed from their slide.
 *
 * The points are shown before rendering rather than after, and are editable,
 * because an automatic summary is right most of the time and wrong in a way you
 * only notice when you read it. Rendering first and judging afterwards wastes
 * the render.
 */

interface Props {
  carouselId: string
  slides: Slide[]
  onClose: () => void
}

/** Mirrors the server's selection so the preview is honest about what it will
 *  actually use. Any drift here shows up as points that change on render. */
function liftPoints(slides: Slide[]): string[] {
  return slides
    .filter((s) => s.type !== 'cover' && s.type !== 'cta')
    .map((s) => (s.emphasisLine || s.headline || '').trim())
    .filter(Boolean)
}

export default function SummarySlideModal({ carouselId, slides, onClose }: Props) {
  const [headline, setHeadline] = useState('all of it')
  const [points, setPoints] = useState<string[]>(() => liftPoints(slides))
  const [asVideo, setAsVideo] = useState(false)
  const [seconds, setSeconds] = useState(5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [made, setMade] = useState<{ url?: string; video?: string; audioNote?: string } | null>(null)

  const setPoint = (i: number, v: string) =>
    setPoints((p) => p.map((x, n) => (n === i ? v : x)))
  const removePoint = (i: number) => setPoints((p) => p.filter((_, n) => n !== i))

  async function generate() {
    setBusy(true); setError(''); setMade(null)
    try {
      const res = await fetch('/api/summary-slide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carouselId, headline,
          points: points.map((p) => p.trim()).filter(Boolean),
          save: true,
          video: asVideo,
          videoSeconds: seconds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Render failed')
      setMade(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background p-5 shadow-xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Summary card</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">Close</button>
        </div>
        <p className="mb-4 text-[11px] text-muted-foreground">
          Every slide's takeaway on one frame. The cover and CTA are left out —
          they frame the carousel rather than make a point.
        </p>

        <Label className="mb-1 block">Headline</Label>
        <Input value={headline} onChange={(e) => setHeadline(e.target.value)} className="mb-4" />

        <div className="mb-1 flex items-baseline justify-between">
          <Label>Points</Label>
          <span className="text-[10px] text-muted-foreground">{points.length} lifted from your slides</span>
        </div>
        {points.length === 0 ? (
          <p className="mb-4 rounded border border-dashed border-border px-3 py-3 text-[11px] text-muted-foreground">
            Nothing to lift. The points come from each slide's emphasis line, and
            none of the content slides have one.
          </p>
        ) : (
          <div className="mb-4 space-y-1.5">
            {points.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{i + 1}</span>
                <Input value={p} onChange={(e) => setPoint(i, e.target.value)} className="text-[12px]" />
                <button onClick={() => removePoint(i)}
                  className="shrink-0 px-1 text-[11px] text-muted-foreground hover:text-red-600"
                  title="Leave this one out">×</button>
              </div>
            ))}
          </div>
        )}

        <label className="mb-3 flex items-center gap-2 text-[12px]">
          <input type="checkbox" checked={asVideo} onChange={(e) => setAsVideo(e.target.checked)} />
          Also render it as a clip
        </label>

        {asVideo && (
          <div className="mb-4">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[10px] font-medium text-muted-foreground">Seconds</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{seconds}s</span>
            </div>
            <Input type="range" min={3} max={15} step={1} value={seconds}
                   onChange={(e) => setSeconds(Number(e.target.value))} />
            <p className="mt-1 text-[10px] text-muted-foreground">
              A card held on screen needs longer than a slide you can swipe back to.
            </p>
          </div>
        )}

        <button onClick={generate} disabled={busy || points.length === 0}
          className="w-full rounded bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50">
          {busy ? 'Rendering…' : asVideo ? 'Render card and clip' : 'Render card'}
        </button>

        {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}

        {made && (
          <div className="mt-4 space-y-3">
            {made.url && <img src={made.url} alt="Summary card" className="w-full rounded border border-border" />}
            {made.video && <video src={made.video} controls loop className="w-full rounded border border-border" />}
            {made.audioNote && (
              <p className="text-[11px] text-amber-700">{made.audioNote}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
