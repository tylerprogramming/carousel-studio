import { useState } from 'react'
import { Slide } from '../types'
import { Label } from './ui/label'
import { Input } from './ui/input'

/**
 * Make one slide move, inside an otherwise still carousel.
 *
 * Instagram takes a video slide next to image slides, so slide 1 can move while
 * the rest hold. That is what this is for, and it is a different thing from a
 * Reel: this writes `slide_N.mp4` into the export folder alongside the PNGs, so
 * the whole post stays one folder. flash_video.py makes a standalone 1080x1920
 * clip instead.
 *
 * The slide's own furniture is rendered on alpha and composited over its
 * background, so the type is identical to the still — the same renderer draws
 * both. Without a background there is nothing to composite over, which is why
 * this only offers itself when there is one.
 */

interface Props {
  slide: Slide
  slideNumber: number
  carouselSlug: string
}

export default function SlideVideoCard({ slide, slideNumber, carouselSlug }: Props) {
  const [duration, setDuration] = useState(5)
  // A slow push-in stops a still frame reading as a stall. Past about 1.15 it
  // starts to feel like a zoom rather than drift.
  const [zoom, setZoom] = useState(1.08)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [made, setMade] = useState<{ url: string; filename: string } | null>(null)

  const source = slide.backgroundVideo ? 'video' : slide.backgroundImage ? 'image' : null

  async function generate() {
    setBusy(true); setError(''); setMade(null)
    try {
      const res = await fetch('/api/slide-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slide: { ...slide, slideNumber }, carouselSlug, duration, zoom,
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
    <div className="border-t border-border px-4 py-4">
      <div className="mb-1 flex items-baseline justify-between">
        <Label>Make this slide move</Label>
        <span className="text-[10px] text-muted-foreground">slide {slideNumber}</span>
      </div>

      {!source ? (
        <p className="mt-2 rounded border border-dashed border-border px-3 py-3 text-[11px] text-muted-foreground">
          Add a background image or video above first. The slide's text is drawn
          on top of it, so there needs to be something underneath to move.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Writes <code>slide_{slideNumber}.mp4</code> next to the exported PNGs, so the whole
            post stays in one folder. Instagram plays it next to the still slides.
            {source === 'image' && ' A still gets a slow push-in.'}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[10px] font-medium text-muted-foreground">Seconds</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">{duration}s</span>
              </div>
              <Input type="range" min={2} max={15} step={1} value={duration}
                     onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
            {source === 'image' && (
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">Push-in</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{zoom.toFixed(2)}x</span>
                </div>
                <Input type="range" min={1} max={1.2} step={0.01} value={zoom}
                       onChange={(e) => setZoom(Number(e.target.value))} />
              </div>
            )}
          </div>

          <button onClick={generate} disabled={busy}
            className="mt-3 w-full rounded bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground disabled:opacity-50">
            {busy ? `Rendering ${duration}s…` : 'Render slide video'}
          </button>

          {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}

          {made && (
            <div className="mt-3">
              <video src={made.url} controls loop className="w-full rounded border border-border" />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Written as <code>{made.filename}</code>. Re-exporting the carousel will not
                overwrite it — the exporter writes PNGs.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
