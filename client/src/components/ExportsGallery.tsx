import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'

/**
 * Everything exported to disk.
 *
 * Distinct from the Library drawer: that lists editable projects, this lists
 * finished output — the PNG sets and PDFs sitting in the export directory.
 */

interface SlideSet {
  slideCount: number
  slides: string[]
  cover: string
  modified: number
}

interface ExportedCarousel {
  slug: string
  slideCount: number
  slides: string[]
  cover: string
  pdf: string | null
  hasCaptions: boolean
  modified: number
  /** Platform variants keyed by folder name, e.g. { tiktok: {...} } */
  variants?: Record<string, SlideSet>
  /** Variants older than the default set — re-exported without them */
  staleVariants?: string[]
}

/** Short label for a platform chip. */
const PLATFORM_LABEL: Record<string, string> = {
  default: 'IG', tiktok: 'TikTok', linkedin: 'LinkedIn', instagram: 'IG',
}
const labelFor = (key: string) => PLATFORM_LABEL[key] ?? key

interface Props { onClose: () => void }

function timeAgo(ms: number) {
  if (!ms) return ''
  const mins = Math.floor((Date.now() - ms) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days < 30 ? `${days}d ago` : new Date(ms).toLocaleDateString()
}

/** A slide is a PNG or, for a moving cover, an MP4. Pick the right element. */
function SlideMedia({ src, className, alt }: { src: string; className?: string; alt: string }) {
  if (/\.(mp4|mov|webm)$/i.test(src)) {
    return (
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className={className}
        aria-label={alt}
      />
    )
  }
  return <img src={src} alt={alt} loading="lazy" className={className} />
}

export default function ExportsGallery({ onClose }: Props) {
  const [items, setItems] = useState<ExportedCarousel[]>([])
  const [dir, setDir] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<ExportedCarousel | null>(null)
  // Which platform set the detail pane is showing. Reset when the card changes.
  const [platform, setPlatform] = useState('default')
  useEffect(() => { setPlatform('default') }, [open?.slug])
  const [captions, setCaptions] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/exports')
      .then((r) => r.json())
      .then((d) => { setItems(d.carousels ?? []); setDir(d.exportDir ?? '') })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setCaptions(null)
    if (!open?.hasCaptions) return
    fetch(`/api/exports/${encodeURIComponent(open.slug)}/captions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCaptions(d.markdown))
      .catch(() => {})
  }, [open])

  const shown = items.filter((i) => i.slug.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="animate-fade-in flex h-[86vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl bg-card shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">Exported carousels</h2>
            <p className="truncate text-[11px] text-muted-foreground" title={dir}>
              {loading ? 'Reading disk…' : `${items.length} on disk · ${dir}`}
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className="ml-auto h-8 w-48 rounded-lg border border-border bg-secondary px-3 text-xs outline-none focus:border-brand"
          />
          <button onClick={onClose} className="text-2xl leading-none text-muted-foreground hover:text-foreground">×</button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && !items.length && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">Nothing exported yet.</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Hit Export All and finished carousels show up here, read straight off disk.
                </p>
              </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
              {shown.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setOpen(c)}
                  className={cn(
                    'group flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all',
                    open?.slug === c.slug ? 'border-brand' : 'border-border hover:border-brand/50',
                  )}
                >
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-secondary">
                    <SlideMedia src={c.cover} alt={c.slug} className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-px text-[10px] font-bold text-white">
                      {c.slideCount}
                    </span>
                  </div>
                  <div className="p-2">
                    <div className="truncate text-[11px] font-semibold text-foreground" title={c.slug}>{c.slug}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{timeAgo(c.modified)}</span>
                      {c.pdf && <span className="rounded bg-secondary px-1">PDF</span>}
                      {c.hasCaptions && <span className="rounded bg-secondary px-1">CAP</span>}
                      {Object.keys(c.variants ?? {}).map((key) => (
                        <span
                          key={key}
                          title={c.staleVariants?.includes(key)
                            ? `${labelFor(key)} set is older than the main set — re-export it`
                            : `${labelFor(key)} version available`}
                          className={cn(
                            'rounded px-1',
                            c.staleVariants?.includes(key)
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-brand/15 text-brand',
                          )}
                        >
                          {labelFor(key)}{c.staleVariants?.includes(key) ? ' !' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* detail */}
          {open && (
            <div className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-border bg-background p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-foreground">{open.slug}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {(platform === 'default' ? open.slideCount : open.variants?.[platform]?.slideCount ?? 0)} slides
                    {platform !== 'default' && ` · ${labelFor(platform)}`} · {timeAgo(open.modified)}
                  </div>
                </div>
                <button onClick={() => setOpen(null)} className="text-lg leading-none text-muted-foreground">×</button>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {open.pdf && (
                  <a href={open.pdf} download
                     className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand hover:text-brand">
                    Download PDF
                  </a>
                )}
                <a href={open.cover} download
                   className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand hover:text-brand">
                  Download cover
                </a>
              </div>

              {Object.keys(open.variants ?? {}).length > 0 && (
                <div className="mb-3 flex gap-1">
                  {['default', ...Object.keys(open.variants ?? {})].map((key) => (
                    <button
                      key={key}
                      onClick={() => setPlatform(key)}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all',
                        platform === key
                          ? 'bg-brand text-white'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                      )}
                    >
                      {labelFor(key)}
                      {open.staleVariants?.includes(key) && ' !'}
                    </button>
                  ))}
                </div>
              )}

              {open.staleVariants?.includes(platform) && (
                <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
                  This set is older than the main one. It was not refreshed on the last
                  export, so posting it would ship stale slides.
                </p>
              )}

              <div className={cn('mb-4 grid gap-2', platform === 'default' ? 'grid-cols-3' : 'grid-cols-4')}>
                {(platform === 'default' ? open.slides : open.variants?.[platform]?.slides ?? []).map((s, i) => (
                  <a key={s} href={s} target="_blank" rel="noreferrer"
                     className="overflow-hidden rounded-md border border-border hover:border-brand">
                    <SlideMedia
                      src={s}
                      alt={`slide ${i + 1}`}
                      className={cn('w-full object-cover', platform === 'default' ? 'aspect-[4/5]' : 'aspect-[9/16]')}
                    />
                  </a>
                ))}
              </div>

              {open.hasCaptions && (
                <>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                    captions.md
                  </div>
                  <pre className="whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-[11px] leading-relaxed text-foreground">
                    {captions ?? 'Loading…'}
                  </pre>
                  {captions && (
                    <button
                      onClick={() => navigator.clipboard.writeText(captions)}
                      className="mt-2 self-start rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-brand hover:text-brand"
                    >
                      Copy captions
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
