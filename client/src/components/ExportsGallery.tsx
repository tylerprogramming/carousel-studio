import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'

/**
 * Everything exported to disk.
 *
 * Distinct from the Library drawer: that lists editable projects, this lists
 * finished output — the PNG sets and PDFs sitting in the export directory.
 *
 * It renders two ways. Docked, it is a column in the editor row, because this
 * is the panel you check work against: as a modal, spotting a bad slide meant
 * closing the gallery, fixing the slide, and reopening it to look again. Docked
 * the canvas stays live behind you and the round trip disappears.
 *
 * The overlay is kept for narrow windows, where the editor row isn't rendered
 * at all and there is no column to dock into.
 *
 * It stays a viewer either way. Picking an export does not load it into the
 * editor — the thing on disk is finished, and the editable original is one
 * click away in the Library.
 *
 * This is also where the old TikTok panel's "Exported for TikTok" block ended
 * up: the reframed 9:16 thumbnails, the carousel videos and the stale-variant
 * warning already existed here, for every platform, so keeping a second copy
 * bolted to one platform's editor was the only reason that panel survived.
 * Docked it opens on the carousel you are editing, so it answers the same
 * question in the same click, and videos play in the phone frame next door.
 */

interface SlideSet {
  slideCount: number
  slides: string[]
  cover: string
  /** height/width of the cover, measured on disk by the server. */
  aspect?: number
  modified: number
}

interface ExportedCarousel {
  slug: string
  slideCount: number
  slides: string[]
  cover: string
  aspect?: number
  pdf: string | null
  hasCaptions: boolean
  modified: number
  /** Whole-carousel videos, e.g. the set played as one vertical clip */
  videos?: { filename: string; url: string }[]
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

// What a set is shaped like, as measured on disk. A tall carousel exports at
// 9:16 with no tiktok/ folder involved, so the default set is not always 4:5
// and a hardcoded box cropped its bottom third.
const FOUR_FIVE = 1350 / 1080
const ratio = (aspect?: number) => `1 / ${aspect ?? FOUR_FIVE}`

interface Props {
  onClose: () => void
  /** Render as a column in the editor row instead of an overlay. */
  docked?: boolean
  /** Export folder of the carousel being edited, opened on first render. */
  currentSlug?: string
  /** Hand a video to the phone frame in the canvas instead of playing it here. */
  onPlay?: (url: string) => void
  /** What the phone is currently playing, so the tile can show as selected. */
  playingUrl?: string | null
}

function timeAgo(ms: number) {
  if (!ms) return ''
  const mins = Math.floor((Date.now() - ms) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days < 30 ? `${days}d ago` : new Date(ms).toLocaleDateString()
}

const isVideo = (src: string) => /\.(mp4|mov|webm)$/i.test(src)

/** A slide is a PNG or, for a moving cover, an MP4. Pick the right element. */
function SlideMedia({ src, className, alt, controls, style }: {
  src: string; className?: string; alt: string; controls?: boolean; style?: React.CSSProperties
}) {
  if (isVideo(src)) {
    return (
      <video
        src={src}
        // Thumbnails loop silently; the big player gets real controls so the
        // finished clip can actually be watched and scrubbed.
        autoPlay={!controls}
        loop={!controls}
        muted={!controls}
        controls={controls}
        playsInline
        className={className}
        style={style}
        aria-label={alt}
      />
    )
  }
  return <img src={src} alt={alt} loading="lazy" className={className} style={style} />
}

export default function ExportsGallery({
  onClose, docked = false, currentSlug, onPlay, playingUrl = null,
}: Props) {
  const [items, setItems] = useState<ExportedCarousel[]>([])
  const [dir, setDir] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<ExportedCarousel | null>(null)
  // Which platform set the detail pane is showing. Reset when the card changes.
  const [platform, setPlatform] = useState('default')
  const [preview, setPreview] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [buildNote, setBuildNote] = useState<string | null>(null)
  useEffect(() => { setPlatform('default'); setPreview(null); setBuildNote(null) }, [open?.slug])

  // Docked, a 9:16 clip in a 360px column is a postage stamp, and the phone
  // frame one column over is already the right shape and already on screen.
  // The overlay has nothing behind it, so it keeps its own player.
  function openMedia(url: string) {
    if (onPlay && isVideo(url)) { onPlay(url); return }
    setPreview(url)
  }
  const selectedMedia = onPlay ? (playingUrl ?? preview) : preview

  // Open on the carousel being edited rather than making you find it in a grid
  // of nine. Once per mount — hitting "All exports" has to stick, and the slug
  // changes on every keystroke in the title field.
  const autoOpened = useRef(false)
  useEffect(() => {
    if (!docked || autoOpened.current || !items.length) return
    autoOpened.current = true
    const match = items.find((c) => c.slug === currentSlug)
    if (match) setOpen(match)
  }, [docked, currentSlug, items])

  async function buildCarouselVideo(slug: string, perSlide: number) {
    setBuilding(true); setBuildNote(null)
    try {
      const res = await fetch('/api/carousel-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carouselSlug: slug, perSlide, fade: 0.2 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setBuildNote(
        data.tooFast
          ? `${data.slideCount} slides at ${data.perSlide}s each = ${data.duration}s. Too fast to read body copy — try a longer hold.`
          : `${data.slideCount} slides at ${data.perSlide}s each = ${data.duration}s.`,
      )
      await load(slug)
      openMedia(data.url)
    } catch (err) {
      setBuildNote(String(err instanceof Error ? err.message : err))
    } finally {
      setBuilding(false)
    }
  }

  async function buildTikTok(slug: string) {
    setBuilding(true); setBuildNote(null)
    try {
      const res = await fetch('/api/export-tiktok', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carouselSlug: slug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setBuildNote(
        data.staticFromVideo?.length
          ? `Built ${data.count} slides. Slide ${data.staticFromVideo[0].match(/\d+/)[0]} is a video on Instagram and is static here.`
          : `Built ${data.count} slides.`,
      )
      await load(slug)
    } catch (err) {
      setBuildNote(String(err instanceof Error ? err.message : err))
    } finally {
      setBuilding(false)
    }
  }
  const [captions, setCaptions] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Shared so building a variant can refresh the list, and so the open card
  // picks up the variant it just produced instead of showing stale data.
  const load = useCallback(async (reselectSlug?: string) => {
    try {
      const res = await fetch('/api/exports')
      const data = await res.json()
      const list: ExportedCarousel[] = data.carousels ?? []
      setItems(list)
      setDir(data.exportDir ?? '')
      if (reselectSlug) {
        const fresh = list.find((c) => c.slug === reselectSlug)
        if (fresh) setOpen(fresh)
      }
    } catch { /* leave whatever is on screen */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setCaptions(null)
    if (!open?.hasCaptions) return
    fetch(`/api/exports/${encodeURIComponent(open.slug)}/captions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCaptions(d.markdown))
      .catch(() => {})
  }, [open])

  const shown = items.filter((i) => i.slug.toLowerCase().includes(query.toLowerCase()))

  const filterInput = (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Filter…"
      className={cn(
        'h-8 rounded-lg border border-border bg-secondary px-3 text-xs outline-none focus:border-brand',
        docked ? 'w-full' : 'ml-auto w-48',
      )}
    />
  )

  const grid = (
    <>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && !items.length && (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">Nothing exported yet.</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Hit Export All and finished carousels show up here, read straight off disk.
          </p>
        </div>
      )}
      <div className={cn(
        'grid gap-4',
        // A docked column is ~360px wide, so the cards have to be small enough
        // to still land two across.
        docked
          ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))]'
          : 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]',
      )}>
        {shown.map((c) => (
          <button
            key={c.slug}
            onClick={() => setOpen(c)}
            className={cn(
              'group flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all',
              open?.slug === c.slug ? 'border-brand' : 'border-border hover:border-brand/50',
            )}
          >
            <div className="relative w-full overflow-hidden bg-secondary" style={{ aspectRatio: ratio(c.aspect) }}>
              <SlideMedia src={c.cover} alt={c.slug} className="h-full w-full object-cover" />
              <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-px text-[10px] font-bold text-white">
                {c.slideCount}
              </span>
            </div>
            <div className="p-2">
              <div className="truncate text-[11px] font-semibold text-foreground" title={c.slug}>{c.slug}</div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>{timeAgo(c.modified)}</span>
                {c.pdf && <span className="rounded bg-secondary px-1">PDF</span>}
                {c.hasCaptions && <span className="rounded bg-secondary px-1">CAP</span>}
                {!!c.videos?.length && (
                  <span className="rounded bg-brand/15 px-1 text-brand" title="Has a full-carousel video">
                    VID
                  </span>
                )}
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
    </>
  )

  const detail = open && (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-foreground">{open.slug}</div>
          <div className="text-[11px] text-muted-foreground">
            {(platform === 'default' ? open.slideCount : open.variants?.[platform]?.slideCount ?? 0)} slides
            {platform !== 'default' && ` · ${labelFor(platform)}`} · {timeAgo(open.modified)}
          </div>
        </div>
        {/* Docked, closing the detail is the only way back to the list, so it
            says so. In the overlay the list is still on screen next to it. */}
        <button
          onClick={() => setOpen(null)}
          className={cn(
            'shrink-0 leading-none text-muted-foreground hover:text-foreground',
            docked ? 'text-[11px] font-semibold' : 'text-lg',
          )}
        >
          {docked ? '← All exports' : '×'}
        </button>
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

      {preview && (
        <div className="mb-3">
          <div className="overflow-hidden rounded-lg border border-border bg-black">
            <SlideMedia src={preview} alt="preview" controls
                        className="max-h-[420px] w-full object-contain" />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="truncate text-[10px] text-muted-foreground">
              {preview.split('/').pop()}
            </span>
            <button onClick={() => setPreview(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground">
              close
            </button>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {/* Offered again when the set is stale. The button used to disappear the
            moment a tiktok/ folder existed, so the "rebuild before posting"
            warning below pointed at a control that was no longer on screen —
            /api/export-tiktok overwrites, so there was never a reason to hide
            it. */}
        {(!open.variants?.tiktok || open.staleVariants?.includes('tiktok')) && (
          <button
            onClick={() => buildTikTok(open.slug)}
            disabled={building}
            className={cn(
              'flex-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50',
              open.staleVariants?.includes('tiktok')
                ? 'border-destructive/40 bg-destructive/10 text-destructive hover:border-destructive'
                : 'border-border bg-card text-muted-foreground hover:border-brand hover:text-brand',
            )}
          >
            {building ? 'Working…' : open.variants?.tiktok ? 'Rebuild TikTok set' : 'Build TikTok set'}
          </button>
        )}
        {[2, 2.5, 3].map((secs) => (
          <button
            key={secs}
            onClick={() => buildCarouselVideo(open.slug, secs)}
            disabled={building}
            title={`Hold each slide ${secs}s — about ${Math.round(secs * (open.slideCount + 0.4))}s total`}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {building ? '…' : `${secs}s/slide`}
          </button>
        ))}
      </div>
      {buildNote && (
        <p className="mb-3 rounded-lg border border-border bg-secondary p-2 text-[11px] text-muted-foreground">
          {buildNote}
        </p>
      )}

      {!!open.videos?.length && (
        <div className="mb-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
            full-carousel video
          </div>
          <div className="flex flex-col gap-1.5">
            {open.videos.map((v) => (
              <div key={v.url} className="flex items-center gap-1.5">
                <button
                  onClick={() => openMedia(v.url)}
                  className={cn(
                    'min-w-0 flex-1 truncate rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold',
                    selectedMedia === v.url
                      ? 'border-brand text-brand'
                      : 'border-border text-muted-foreground hover:border-brand hover:text-brand',
                  )}
                  title={onPlay ? `${v.filename} — plays in the phone` : v.filename}
                >
                  ▶ {v.filename}
                </button>
                <a href={v.url} download
                   className="shrink-0 rounded-lg border border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:border-brand hover:text-brand">
                  ↓
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <button key={s} onClick={() => openMedia(s)}
             title={isVideo(s) ? 'Play' : 'View'}
             className={cn(
               'relative overflow-hidden rounded-md border hover:border-brand',
               selectedMedia === s ? 'border-brand ring-2 ring-brand/30' : 'border-border',
             )}>
            <SlideMedia
              src={s}
              alt={`slide ${i + 1}`}
              className="w-full object-cover"
              style={{ aspectRatio: ratio(platform === 'default' ? open.aspect : open.variants?.[platform]?.aspect) }}
            />
            {isVideo(s) && (
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                MP4
              </span>
            )}
          </button>
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
    </>
  )

  if (docked) {
    // One column, not two: 360px has no room for a list beside a detail pane,
    // so opening an export swaps the list out and the back button swaps it in.
    return (
      <aside className="flex w-[360px] min-w-[360px] shrink-0 flex-col overflow-hidden border-l border-border bg-card">
        <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="min-w-0">
              <h2 className="text-[13px] font-bold text-foreground">Exports</h2>
              <p className="truncate text-[10px] text-muted-foreground" title={dir}>
                {loading ? 'Reading disk…' : `${items.length} on disk`}
              </p>
            </div>
            <button
              onClick={onClose}
              title="Close exports"
              className="ml-auto text-xl leading-none text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
          {filterInput}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {open ? detail : grid}
        </div>
      </aside>
    )
  }

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
          {filterInput}
          <button onClick={onClose} className="text-2xl leading-none text-muted-foreground hover:text-foreground">×</button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto p-5">{grid}</div>

          {open && (
            <div className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-border bg-background p-4">
              {detail}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
