import { useEffect, useState } from 'react'
import { CarouselCaptions } from '../types'
import { cn } from '../lib/utils'

/**
 * "Can this be posted yet", answered where you actually work.
 *
 * The Library shows a dot per carousel and the Exports gallery shows what is on
 * disk, but you are never in either one while you are editing — nine carousels
 * once reached the day before posting with no captions because nothing in the
 * editor said anything was missing.
 *
 * The caption and gate come from the config in memory so the rail answers while
 * you type. What is on disk has to come from the server, which is fetched once
 * per carousel and again after an export rather than polled.
 *
 * Blocking vs optional matches carouselStatus() in server.ts: a caption and an
 * export decide `ready`; a gate keyword and a TikTok set are worth seeing but
 * do not hold a post back.
 */

/** The half of the answer that lives on disk. Shape from carouselStatus(). */
interface DiskStatus {
  exported: string[]
  hasVideo: boolean
}

interface Props {
  carouselId: string
  /** Export folder for the live title, which may be ahead of the saved one. */
  slug: string
  captions: CarouselCaptions
  /** Bumped by App when an export finishes, to trigger the one refetch. */
  refreshKey?: number
}

export default function ReadinessRail({ carouselId, slug, captions, refreshKey = 0 }: Props) {
  const [disk, setDisk]     = useState<DiskStatus | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    // Short delay because the slug is derived from the title as it is typed,
    // and every keystroke would otherwise be a request.
    const t = setTimeout(() => {
      fetch(`/api/carousels/${carouselId}/readiness?slug=${encodeURIComponent(slug)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setDisk({ exported: d.exported ?? [], hasVideo: !!d.hasVideo }); setLoaded(true) })
        .catch(() => { /* aborted or offline: keep showing the last answer */ })
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [carouselId, slug, refreshKey])

  const exported = disk?.exported ?? []

  // These four mirror the readiness flags in server.ts. Change them together.
  const conditions = [
    {
      label: 'caption',
      ok: !!(captions.instagram || captions.linkedin || captions.tiktok),
      blocking: true,
      blocker: 'no caption',
      hint: 'No caption written yet. Write one in the Caption tab on the right.',
      done: 'Caption written.',
    },
    {
      label: 'gate',
      ok: !!captions.gate,
      blocking: false,
      blocker: 'no gate',
      hint: 'No gate keyword. Set one in the Caption tab if this post asks for a comment. Optional.',
      done: `Gate keyword: ${captions.gate}`,
    },
    {
      label: 'exported',
      ok: exported.includes('default'),
      blocking: true,
      blocker: 'not exported',
      hint: 'No slides on disk yet. Hit Export All in the header (⌘E).',
      done: 'Slides exported.',
    },
    {
      label: 'tiktok set',
      ok: exported.some((k) => k !== 'default'),
      blocking: false,
      blocker: 'no tiktok set',
      hint: 'No TikTok set. Switch the platform to TT in the header and export from the TikTok panel. Optional.',
      done: 'TikTok set exported.',
    },
  ]

  const blockers = conditions.filter((c) => c.blocking && !c.ok)

  return (
    <div className="flex h-9 shrink-0 items-center gap-4 border-t border-border bg-card px-4">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
        Ready?
      </span>

      {conditions.map((c) => (
        <span
          key={c.label}
          title={c.ok ? c.done : c.hint}
          className="flex shrink-0 cursor-default items-center gap-1.5"
        >
          <span
            className={cn(
              'h-[7px] w-[7px] shrink-0 rounded-full transition-colors',
              c.ok ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(34,197,94,0.18)]' : 'bg-border',
            )}
          />
          <span className={cn('text-[11px] font-semibold', c.ok ? 'text-foreground' : 'text-muted-foreground')}>
            {c.label}
          </span>
        </span>
      ))}

      <div className="flex-1" />

      {/* Stated either way. An indicator that vanishes when everything is fine
          is one you stop trusting when it is not. */}
      <span
        className={cn(
          'truncate text-[11px] font-semibold',
          !loaded ? 'text-muted-foreground' : blockers.length ? 'text-coral-dark' : 'text-emerald-600',
        )}
      >
        {!loaded
          ? 'Checking exports…'
          : blockers.length
            ? `Not ready: ${blockers.map((b) => b.blocker).join(', ')}`
            : 'Ready to post'}
      </span>
    </div>
  )
}
