import { useEffect, useState } from 'react'
import { Slide } from '../types'
import { cn } from '../lib/utils'
import { Label } from './ui/label'
import { Input } from './ui/input'

/**
 * A single slide as a short standalone Reel.
 *
 * This existed, was retired in 2.1.x when the editor was rebuilt, and the
 * Python behind it was never removed — so `flash_video.py` kept working from
 * the command line while the app pretended the feature was gone. It is back
 * because it is still used.
 *
 * Not the same thing as a carousel video. `slides_to_video.py` plays a whole
 * set as one clip; this is one slide, held, at 1080x1920 for Reels and Shorts.
 *
 * Everything is prefilled from the slide you are looking at, because that is
 * where the copy and the colours already are — the point is one click, not a
 * second editor.
 */

interface FlashVideo {
  id: string
  carouselTitle: string | null
  slideNumber: number
  style: string
  duration: number
  headline: string
  url?: string
}

const STYLES = [
  { id: 'statement', label: 'Statement', hint: 'Big type on a flat ground. The default.' },
  { id: 'terminal',  label: 'Terminal',  hint: 'The terminal window, held still.' },
  { id: 'video',     label: 'Over video', hint: 'Text over a clip. Needs a background video on the slide.' },
] as const

interface Props {
  slide: Slide
  slideNumber: number
  carouselId: string
  carouselTitle: string
  onClose: () => void
}

export default function FlashVideoModal({ slide, slideNumber, carouselId, carouselTitle, onClose }: Props) {
  // A terminal slide starts on the terminal style; anything else on statement.
  // Over-video is never the default because it needs a clip that may not exist.
  const [style, setStyle] = useState<string>(
    slide.variant === 'terminal' || slide.variant === 'tall' ? 'terminal' : 'statement')
  // Four to five seconds is the useful range for a static frame: long enough to
  // read, short enough to loop. Adjustable because the right number depends on
  // how much copy is on the slide.
  const [duration, setDuration] = useState(5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [made, setMade] = useState<FlashVideo | null>(null)
  const [library, setLibrary] = useState<FlashVideo[]>([])

  useEffect(() => {
    fetch('/api/flash-videos').then((r) => r.json()).then(setLibrary).catch(() => setLibrary([]))
  }, [made])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const needsClip = style === 'video' && !slide.backgroundVideo

  async function generate() {
    setBusy(true); setError(''); setMade(null)
    try {
      const res = await fetch('/api/flash-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carouselId, carouselTitle, slideNumber, style, duration,
          // Straight off the slide. A Reel that says something different from
          // the carousel it came from is a second thing to keep in step.
          headline:     slide.headline,
          emphasisLine: slide.emphasisLine,
          subText:      slide.bodyText,
          bgColor:      slide.bgColor,
          textColor:    slide.textColor,
          accentColor:  slide.accentColor,
          terminalLines: slide.terminalLines,
          backgroundVideo: slide.backgroundVideo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setMade(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background p-5 shadow-xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Reel from slide {slideNumber}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">Close</button>
        </div>

        <p className="mb-4 line-clamp-2 rounded bg-muted px-3 py-2 text-[12px] text-muted-foreground">
          {slide.headline || <span className="italic">This slide has no headline.</span>}
        </p>

        <Label className="mb-2 block">Style</Label>
        <div className="mb-1 grid grid-cols-3 gap-2">
          {STYLES.map((s) => (
            <button key={s.id} onClick={() => setStyle(s.id)}
              className={cn('rounded border px-2 py-2 text-[12px] transition',
                style === s.id ? 'border-primary bg-primary/10 font-medium' : 'border-input hover:bg-muted')}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="mb-4 text-[10px] text-muted-foreground">
          {STYLES.find((s) => s.id === style)?.hint}
        </p>

        {needsClip && (
          <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            This slide has no background video, so there is nothing for the text to sit over.
            Add one in the Image tab, or pick another style.
          </p>
        )}

        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <Label>Duration</Label>
            <span className="text-[12px] tabular-nums text-muted-foreground">{duration}s</span>
          </div>
          <Input type="range" min={2} max={15} step={1} value={duration}
                 onChange={(e) => setDuration(Number(e.target.value))} />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Four or five seconds suits most static frames — long enough to read, short enough to loop.
          </p>
        </div>

        <button onClick={generate} disabled={busy || needsClip}
          className="w-full rounded bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50">
          {busy ? `Rendering ${duration}s…` : 'Make the Reel'}
        </button>

        {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}

        {made && (
          <div className="mt-4">
            <video src={made.url} controls loop className="w-full rounded border border-border" />
            <a href={made.url} download
               className="mt-2 inline-block text-[12px] text-primary hover:underline">
              Download {made.id}.mp4
            </a>
          </div>
        )}

        {library.length > 0 && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">
              Made earlier ({library.length})
            </p>
            <ul className="space-y-1">
              {library.slice(0, 8).map((v) => (
                <li key={v.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="truncate text-muted-foreground">
                    {v.headline || v.carouselTitle || v.id}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {v.style} · {v.duration}s
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
