import { useState, useEffect, useRef, useCallback } from 'react'
import { Slide, CarouselConfig, CarouselCaptions, defaultSlides, genId, withIds } from './types'
import { useIsMobile } from './hooks/useMediaQuery'
import { useHistory } from './hooks/useHistory'
import { useJobs, Job } from './hooks/useJobs'
import { useSlideCheck, worstLevel } from './hooks/useSlideCheck'
import { cn } from './lib/utils'
import SlideList from './components/SlideList'
import Inspector from './components/Inspector'
import SlideEditor from './components/SlideEditor'
import SlidePreview, { slideAspect } from './components/SlidePreview'
import PlatformPreview from './components/PlatformPreview'
import GenerateModal from './components/GenerateModal'
import SavedCarouselsDrawer from './components/SavedCarouselsDrawer'
import BatchModal from './components/BatchModal'
import ExportsGallery from './components/ExportsGallery'
import JobStrip from './components/JobStrip'
import HealthBanner from './components/HealthBanner'
import ReadinessRail from './components/ReadinessRail'
import CheckBadge from './components/CheckBadge'
import {
  AppLogo, IgLogo, LiLogo, TikTokLogo, FolderIcon, SparkleIcon, BoltIcon,
  UndoIcon, RedoIcon, SlidesTabIcon, EditTabIcon, BgTabIcon, PreviewTabIcon,
} from './components/icons'

type MobileTab = 'slides' | 'edit' | 'bg' | 'preview'

const CAROUSEL_ID_KEY = 'carousel_studio_current_id'

const PLATFORMS = [
  { id: 'instagram', short: 'IG', label: 'Instagram', Logo: IgLogo },
  { id: 'linkedin',  short: 'LI', label: 'LinkedIn',  Logo: LiLogo },
  { id: 'tiktok',    short: 'TT', label: 'TikTok',    Logo: TikTokLogo },
] as const

function newId() { return `carousel_${Date.now()}` }

// Collapses any run of non-alphanumerics to a single dash. Must stay in step
// with slugFromTitle() in server.ts, or exporting writes to a second folder
// and the first one silently goes stale.
function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'carousel'
}

export default function App() {
  const isMobile = useIsMobile()

  const [carouselId, setCarouselId] = useState<string>(() => localStorage.getItem(CAROUSEL_ID_KEY) || newId())
  const {
    state: config, set: setConfig, reset: resetConfig,
    undo, redo, canUndo, canRedo,
  } = useHistory<CarouselConfig>({
    title: 'My Carousel',
    platform: 'instagram',
    slides: defaultSlides(),
  })

  const [activeIndex, setActiveIndex]   = useState(0)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [exporting, setExporting]       = useState(false)
  const [exportedUrls, setExportedUrls] = useState<{ label: string; url: string }[]>([])
  const [exportMsg, setExportMsg]       = useState('')
  const [showGenerate, setShowGenerate] = useState(false)
  const [showSaved, setShowSaved]       = useState(false)
  const [showBatch, setShowBatch]       = useState(false)
  const [showExports, setShowExports]   = useState(false)
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf' | 'both'>('both')
  const [mobileTab, setMobileTab]       = useState<MobileTab>('preview')
  const [saveStatus, setSaveStatus]     = useState<'saved' | 'unsaved' | 'saving'>('saved')
  // Bumped when an export finishes, which is the only moment the readiness rail
  // needs to look at the disk again.
  const [readinessKey, setReadinessKey] = useState(0)
  // An export the Exports panel handed to the phone frame in the canvas. Held
  // here because the two live in different columns.
  const [playingExport, setPlayingExport] = useState<string | null>(null)

  // On mount, reload the last-used carousel rather than starting blank
  const isLoaded = useRef(false)
  useEffect(() => {
    const storedId = localStorage.getItem(CAROUSEL_ID_KEY)
    if (!storedId) { isLoaded.current = true; return }
    fetch(`/api/carousels/${storedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.slides) {
          resetConfig({
            title: data.title, platform: data.platform ?? 'instagram',
            slides: withIds(data.slides), captions: data.captions ?? {},
          })
          setCarouselId(data.id)
        }
      })
      .catch(() => {})
      .finally(() => { isLoaded.current = true })
  }, [resetConfig])

  const saveCarousel = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/carousels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: carouselId, ...config }),
      })
      const data = await res.json()
      localStorage.setItem(CAROUSEL_ID_KEY, carouselId)
      setSaveStatus('saved')
      return data
    } catch {
      setSaveStatus('unsaved')
    }
  }, [carouselId, config])

  // Debounced autosave — skipped until the initial load settles, otherwise a
  // refresh would overwrite the stored carousel with the default one.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isLoaded.current) return
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { saveCarousel() }, 4000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [config, carouselId, saveCarousel])

  function loadCarousel(data: any) {
    setCarouselId(data.id)
    // Captions have to come back with the rest of the carousel. Dropping them
    // here meant the next autosave wrote the config back without them.
    resetConfig({
      title: data.title, platform: data.platform ?? 'instagram',
      slides: withIds(data.slides), captions: data.captions ?? {},
    })
    setActiveIndex(0); setPreviewIndex(0); setShowSaved(false)
    localStorage.setItem(CAROUSEL_ID_KEY, data.id)
    setSaveStatus('saved')
  }

  function newCarousel() {
    setCarouselId(newId())
    resetConfig({ title: 'New Carousel', platform: 'instagram', slides: defaultSlides(), captions: {} })
    setActiveIndex(0); setPreviewIndex(0)
    setSaveStatus('unsaved')
  }

  function handleSelect(i: number) {
    setActiveIndex(i); setPreviewIndex(i)
    if (isMobile) setMobileTab('edit')
  }

  function updateSlide(updated: Slide) {
    // SlideEditor signals "apply this to every slide" by tagging the slide with
    // the keys to propagate, rather than a flag per control. Shift-clicking any
    // control in the editor sets this.
    const keys = (updated as any)._applyKeysToAll as (keyof Slide)[] | undefined
    if (keys?.length) {
      const { _applyKeysToAll, ...clean } = updated as any
      setConfig((c) => ({
        ...c,
        slides: c.slides.map((s, i) => {
          if (i === activeIndex) return clean
          const patch: Partial<Slide> = {}
          for (const k of keys) (patch as any)[k] = (clean as any)[k]
          return { ...s, ...patch }
        }),
      }), { coalesce: false })
      return
    }
    setConfig((c) => ({ ...c, slides: c.slides.map((s, i) => (i === activeIndex ? updated : s)) }))
  }

  function updateCaptions(next: CarouselCaptions) {
    // Stamped on write so the Library can tell fresh copy from copy that
    // predates the slides it describes.
    setConfig((c) => ({ ...c, captions: { ...next, updatedAt: new Date().toISOString() } }))
  }

  const renumber = (slides: Slide[]) => slides.map((s, i) => ({ ...s, slideNumber: i + 1 }))

  function addSlide() {
    setConfig((c) => {
      const last = c.slides[c.slides.length - 1]
      const inserted: Slide = {
        id: genId(), type: 'content', slideNumber: c.slides.length,
        stepNumber: c.slides.length - 1,
        headline: 'New Feature', emphasisLine: 'Your emphasis here', bodyText: 'Add supporting detail.',
        bgColor: last?.bgColor ?? '#F5F0EB',
        textColor: last?.textColor ?? '#1B1B1B',
        accentColor: last?.accentColor ?? '#E07355',
      }
      // Keep the CTA last — new content slides go immediately before it
      return { ...c, slides: renumber([...c.slides.slice(0, -1), inserted, c.slides[c.slides.length - 1]]) }
    }, { coalesce: false })

    const newIdx = Math.max(0, config.slides.length - 1)
    setActiveIndex(newIdx); setPreviewIndex(newIdx)
    if (isMobile) setMobileTab('edit')
  }

  function duplicateSlide(i: number) {
    setConfig((c) => {
      const copy = { ...c.slides[i], id: genId() }
      const slides = [...c.slides]
      slides.splice(i + 1, 0, copy)
      return { ...c, slides: renumber(slides) }
    }, { coalesce: false })
    setActiveIndex(i + 1); setPreviewIndex(i + 1)
  }

  function removeSlide(i: number) {
    setConfig((c) => ({ ...c, slides: renumber(c.slides.filter((_, idx) => idx !== i)) }), { coalesce: false })
    const clamp = (p: number) => Math.max(0, Math.min(p, config.slides.length - 2))
    setActiveIndex(clamp); setPreviewIndex(clamp)
  }

  function reorder(from: number, to: number) {
    setConfig((c) => {
      const slides = [...c.slides]
      const [moved] = slides.splice(from, 1)
      slides.splice(to, 0, moved)
      return { ...c, slides: renumber(slides) }
    }, { coalesce: false })
    setActiveIndex(to); setPreviewIndex(to)
  }

  function handleGenerated(slides: Slide[], title: string) {
    setConfig((c) => ({
      ...c, title,
      slides: slides.map((s, i) => ({ ...s, id: s.id || genId(), slideNumber: i + 1 })),
    }), { coalesce: false })
    setActiveIndex(0); setPreviewIndex(0)
    if (isMobile) setMobileTab('preview')
  }

  function applyBgImage(url: string, scope: 'single' | 'all', slideNumber?: number) {
    setConfig((c) => ({
      ...c,
      slides: c.slides.map((s, i) => {
        if (scope === 'all') return { ...s, backgroundImage: url }
        const isTarget = slideNumber !== undefined ? s.slideNumber === slideNumber : i === activeIndex
        return isTarget ? { ...s, backgroundImage: url } : s
      }),
    }), { coalesce: false })
  }

  function applyBgImageEach(updates: { slideNumber: number; url: string }[]) {
    setConfig((c) => ({
      ...c,
      slides: c.slides.map((s) => {
        const match = updates.find((u) => u.slideNumber === s.slideNumber)
        return match ? { ...s, backgroundImage: match.url } : s
      }),
    }), { coalesce: false })
  }

  // A finished background job applies itself. Results carry their carouselId,
  // so a job started before switching carousels can never land on the wrong one.
  const applyJob = useCallback((job: Job) => {
    if (!job.results.length) return
    setConfig((c) => ({
      ...c,
      slides: c.slides.map((s) => {
        if (job.scope === 'all') return { ...s, backgroundImage: job.results[0].url }
        const hit = job.results.find((r) => r.slideNumber === s.slideNumber)
        return hit ? { ...s, backgroundImage: hit.url } : s
      }),
    }), { coalesce: false })
  }, [setConfig])

  const { jobs, running, start: startJob, cancel: cancelJob } = useJobs(carouselId, config.title, applyJob)

  // Layout defects, found while editing rather than after export. Advisory
  // only — nothing here stops Export.
  const check = useSlideCheck(config.slides)

  const handleExport = useCallback(async () => {
    setExporting(true); setExportMsg(''); setExportedUrls([])
    try {
      await saveCarousel()
      // Media URLs go over as-is — the server resolves them to disk paths.
      const res = await fetch('/api/export-all', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: config.slides, carouselSlug: slugify(config.title), format: exportFormat }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const links: { label: string; url: string }[] = []
      data.slides?.forEach((s: any, i: number) => links.push({ label: `Slide ${i + 1}`, url: s.url }))
      if (data.pdf) links.push({ label: '📄 PDF', url: data.pdf.url })
      setExportedUrls(links)
      const parts = [data.slides?.length && `${data.slides.length} PNGs`, data.pdf && 'PDF'].filter(Boolean)
      setExportMsg(`Exported: ${parts.join(' + ')}`)
    } catch (err) {
      setExportMsg(`Error: ${err}`)
    } finally {
      setExporting(false)
      // Even a failed run can leave slides behind, so re-check either way.
      setReadinessKey((k) => k + 1)
    }
  }, [config, exportFormat, saveCarousel])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      // Undo/redo stay live while typing — that's where they're most wanted
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if (typing) return

      switch (e.key.toLowerCase()) {
        case 's': e.preventDefault(); saveCarousel(); break
        case 'd': e.preventDefault(); duplicateSlide(activeIndex); break
        case 'e': e.preventDefault(); handleExport(); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, saveCarousel, handleExport, activeIndex])

  const activeSlide = config.slides[activeIndex]

  // ── Controls bar ────────────────────────────────────────────────────────────
  // Actions live in the header now. What stays here is the export format, which
  // belongs next to the preview it describes.
  const controlsPanel = (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Export as
      </span>
      <div className="flex gap-0.5 rounded-lg border-[1.5px] border-border bg-secondary p-[3px]">
        {(['png', 'pdf', 'both'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setExportFormat(f)}
            className={cn(
              'rounded-md px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-[0.05em] transition-all',
              exportFormat === f ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f === 'both' ? 'PNG+PDF' : f.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <span className="text-[11px] text-muted-foreground">
        Slide {previewIndex + 1} of {config.slides.length}
      </span>
    </div>
  )

  const saveIndicator = (
    <button
      onClick={saveCarousel}
      title={saveStatus === 'saved' ? 'All changes saved' : 'Click to save (⌘S)'}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-[5px] transition-all',
        saveStatus === 'saved'  && 'border-emerald-200 bg-emerald-50',
        saveStatus === 'saving' && 'border-amber-200 bg-amber-50',
        saveStatus === 'unsaved' && 'border-border bg-secondary',
      )}
    >
      <span
        className={cn(
          'h-[7px] w-[7px] shrink-0 rounded-full transition-colors',
          saveStatus === 'saved'  && 'bg-emerald-500 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]',
          saveStatus === 'saving' && 'bg-amber-500',
          saveStatus === 'unsaved' && 'bg-muted-foreground',
        )}
      />
      <span
        className={cn(
          'text-[11px] font-semibold',
          saveStatus === 'saved'  && 'text-emerald-600',
          saveStatus === 'saving' && 'text-amber-600',
          saveStatus === 'unsaved' && 'text-muted-foreground',
        )}
      >
        {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved'}
      </span>
    </button>
  )

  const header = (
    <header className="z-50 flex h-14 shrink-0 items-center gap-2.5 border-b border-border bg-card px-4 shadow-soft">
      <div className="flex shrink-0 items-center gap-2.5">
        <AppLogo size={28} />
        <div className="leading-none">
          <span className="text-sm font-extrabold tracking-[-0.02em] text-foreground">Carousel</span>
          <span className="text-sm font-extrabold tracking-[-0.02em] text-brand"> Studio</span>
        </div>
      </div>

      <div className="ml-1 h-[22px] w-px shrink-0 bg-border" />

      <input
        className="header-input rounded-lg border-[1.5px] border-border bg-secondary px-3 py-[5px] text-[13px] font-semibold text-foreground outline-none transition-colors"
        style={{ width: isMobile ? 140 : 220 }}
        value={config.title}
        onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
        placeholder="Carousel title..."
      />

      {saveIndicator}

      {!isMobile && (
        <div className="flex gap-0.5 rounded-[9px] border-[1.5px] border-border bg-secondary p-[3px]">
          {PLATFORMS.map(({ id, short, Logo }) => (
            <button
              key={id}
              onClick={() => setConfig((c) => ({ ...c, platform: id }), { coalesce: false })}
              className={cn(
                'flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-xs font-semibold transition-all',
                config.platform === id
                  ? id === 'tiktok' ? 'bg-tiktok text-white' : 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Logo size={15} /> {short}
            </button>
          ))}
        </div>
      )}

      {!isMobile && (
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowSaved(true)}
            className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:border-brand hover:text-brand">
            <FolderIcon /> Library
          </button>
          <button onClick={() => setShowExports((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 py-1.5 text-xs font-semibold transition-all',
              showExports
                ? 'border-brand bg-brand-light text-brand'
                : 'border-border bg-card text-muted-foreground hover:border-brand hover:text-brand',
            )}>
            <FolderIcon /> Exports
          </button>
          <div className="flex items-center gap-0.5 rounded-lg border-[1.5px] border-border bg-secondary p-0.5">
            <button onClick={undo} disabled={!canUndo} title="Undo (⌘Z)"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors enabled:hover:bg-card enabled:hover:text-brand disabled:opacity-30">
              <UndoIcon />
            </button>
            <button onClick={redo} disabled={!canRedo} title="Redo (⇧⌘Z)"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors enabled:hover:bg-card enabled:hover:text-brand disabled:opacity-30">
              <RedoIcon />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1" />

      {!isMobile && (
        <div className="flex items-center gap-2">
          <CheckBadge
            errors={check.errors} warnings={check.warnings} loaded={check.loaded}
            onJump={() => { if (check.firstIndex >= 0) handleSelect(check.firstIndex) }}
          />
          <button onClick={() => setShowGenerate(true)}
            className="flex items-center gap-1.5 rounded-[9px] border-[1.5px] border-brand bg-brand-light px-3 py-[7px] text-xs font-bold text-brand transition-all hover:bg-brand hover:text-white">
            <SparkleIcon /> Generate
          </button>
          <button onClick={() => setShowBatch(true)}
            className="flex items-center gap-1.5 rounded-[9px] border-[1.5px] border-batch-border bg-batch-light px-3 py-[7px] text-xs font-bold text-batch transition-all hover:border-batch hover:bg-batch hover:text-white">
            <BoltIcon /> Batch
          </button>
          <button onClick={handleExport} disabled={exporting} title="Export (⌘E)"
            className="whitespace-nowrap rounded-[9px] bg-brand px-4 py-[7px] text-xs font-bold text-white shadow-[0_2px_8px_var(--blue-dim)] transition-colors hover:bg-brand-hover disabled:bg-muted-foreground disabled:shadow-none">
            {exporting ? '…' : 'Export All'}
          </button>
        </div>
      )}

      {isMobile && (
        <>
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-brand bg-brand-light px-3 py-1.5 text-xs font-bold text-brand"
          >
            <SparkleIcon />
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:bg-muted-foreground"
          >
            {exporting ? '…' : '⬇'}
          </button>
        </>
      )}
    </header>
  )

  const isError = exportMsg.startsWith('Error')
  const exportToast = exportMsg ? (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-2.5 border-b px-4 py-2.5 text-[13px] font-medium',
        isError ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-600',
      )}
    >
      <span className="font-semibold">{isError ? '⚠️' : '✓'}</span>
      <span>{exportMsg}</span>
      {exportedUrls.map((item, i) => (
        <a key={i} href={item.url} download className="text-xs underline">{item.label}</a>
      ))}
      <button
        onClick={() => { setExportMsg(''); setExportedUrls([]) }}
        className="ml-auto text-xl leading-none opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </div>
  ) : null

  const MOBILE_TABS = [
    { tab: 'slides'  as const, label: 'Slides',  Icon: SlidesTabIcon },
    { tab: 'edit'    as const, label: 'Edit',    Icon: EditTabIcon },
    { tab: 'bg'      as const, label: 'BG',      Icon: BgTabIcon },
    { tab: 'preview' as const, label: 'Preview', Icon: PreviewTabIcon },
  ]

  const mobileTabs = isMobile ? (
    <div className="z-50 flex h-16 shrink-0 items-stretch border-t border-border bg-card shadow-[0_-2px_10px_rgba(30,40,100,0.06)]">
      {MOBILE_TABS.map(({ tab, label, Icon }) => (
        <button
          key={tab}
          onClick={() => setMobileTab(tab)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 border-t-[2.5px] transition-all',
            mobileTab === tab ? 'border-brand text-brand' : 'border-transparent text-muted-foreground',
          )}
        >
          <Icon />
          <span className="text-[10px] font-semibold tracking-[0.03em]">{label}</span>
        </button>
      ))}
    </div>
  ) : null

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} onGenerated={handleGenerated} platform={config.platform} />}
      {showSaved && <SavedCarouselsDrawer onClose={() => setShowSaved(false)} onLoad={loadCarousel} onNew={newCarousel} currentId={carouselId} />}
      {showBatch && <BatchModal onClose={() => setShowBatch(false)} onDone={() => { setShowBatch(false); setShowSaved(true) }} />}
      {/* Below 1200px the editor row isn't rendered, so there is no column to
          dock into and Exports falls back to covering the screen. */}
      {showExports && isMobile && <ExportsGallery onClose={() => setShowExports(false)} />}

      {header}
      {/* Silent unless this machine cannot render, or cannot make video. Above
          the job strip because it is a precondition for the jobs, not one. */}
      <HealthBanner />
      <JobStrip jobs={running} onCancel={cancelJob} />
      {exportToast}

      {/* One row, every platform. Picking TikTok used to swap this whole thing
          for a bespoke panel, which took the Inspector and the readiness rail
          off screen with it — you could not write a caption on a TikTok
          carousel. The platform now changes what the canvas draws and nothing
          else. */}
      {!isMobile && (
        <div className="flex flex-1 overflow-hidden">
          <SlideList
            slides={config.slides} activeIndex={activeIndex} onSelect={handleSelect}
            onAdd={addSlide} onRemove={removeSlide} onReorder={reorder} onDuplicate={duplicateSlide}
            findingsFor={check.findingsFor}
          />
          <div className="flex min-w-[320px] flex-1 flex-col overflow-hidden bg-background">
            {controlsPanel}
            <div className="flex-1 overflow-hidden">
              <PlatformPreview
                slides={config.slides} activeIndex={previewIndex} platform={config.platform}
                onIndexChange={(i) => { setPreviewIndex(i); setActiveIndex(i) }}
                playingUrl={playingExport} onStopPlaying={() => setPlayingExport(null)}
              />
            </div>
          </div>
          {/* Exports takes the Inspector's slot rather than adding a fourth
              column: 184 + 320 canvas + 360 + 360 is 1224px of hard
              minimum, so beside the Inspector the canvas would sit at its
              floor on any 1200px window. Same slot also means one toggle
              swaps between "change this slide" and "check what shipped",
              and the canvas and selection survive the swap. */}
          {showExports ? (
            <ExportsGallery
              docked
              currentSlug={slugify(config.title)}
              onPlay={setPlayingExport}
              playingUrl={playingExport}
              onClose={() => { setShowExports(false); setPlayingExport(null) }}
            />
          ) : activeSlide && (
            <Inspector
              slide={activeSlide} allSlides={config.slides} onChange={updateSlide}
              onSlideChange={updateSlide}
              captions={config.captions ?? {}} onCaptionsChange={updateCaptions}
              carouselTitle={config.title} platform={config.platform} slug={slugify(config.title)}
              startJob={startJob} runningJobs={running}
              findings={check.findingsFor(activeSlide)}
            />
          )}
        </div>
      )}

      {/* Under the editor, not inside it: the question is about the carousel,
          not the slide you happen to have selected. */}
      {!isMobile && (
        <ReadinessRail
          carouselId={carouselId}
          slug={slugify(config.title)}
          captions={config.captions ?? {}}
          refreshKey={readinessKey}
        />
      )}

      {isMobile && (
        <>
          <div className="flex-1 overflow-hidden">
            {mobileTab === 'slides' && (
              <div className="h-full overflow-y-auto bg-card p-4">
                <input
                  className="header-input mb-3 w-full rounded-[10px] border-[1.5px] border-border bg-secondary px-3.5 py-2.5 text-sm font-semibold text-foreground outline-none"
                  value={config.title}
                  onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
                  placeholder="Carousel title..."
                />
                <div className="mb-4 flex gap-2">
                  {PLATFORMS.map(({ id, label, Logo }) => (
                    <button
                      key={id}
                      onClick={() => setConfig((c) => ({ ...c, platform: id }), { coalesce: false })}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] px-1 py-2.5 text-xs font-semibold transition-all',
                        config.platform === id
                          ? id === 'tiktok' ? 'border-tiktok bg-tiktok/10 text-tiktok' : 'border-brand bg-brand-light text-brand'
                          : 'border-border bg-card text-muted-foreground',
                      )}
                    >
                      <Logo size={16} /> {label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {config.slides.map((slide, i) => {
                    const thumbW = Math.floor((window.innerWidth - 52) / 2)
                    const level = worstLevel(check.findingsFor(slide))
                    return (
                      <div
                        key={slide.id}
                        onClick={() => handleSelect(i)}
                        style={{ width: thumbW, height: Math.round(thumbW * slideAspect(slide)) }}
                        className={cn(
                          'relative shrink-0 cursor-pointer overflow-hidden rounded-[10px] border-2 transition-all',
                          i === activeIndex ? 'border-brand shadow-[0_0_0_3px_var(--blue-light)]' : 'border-border',
                        )}
                      >
                        <SlidePreview slide={slide} scale={thumbW / 1080} totalSlides={config.slides.length} />
                        <div className="absolute bottom-1.5 right-1.5 z-10 rounded-md bg-black/55 px-[7px] py-0.5 text-[10px] font-bold text-white">
                          {i + 1}
                        </div>
                        {/* Same mark as the desktop strip. The messages behind
                            it are in the Inspector, on the BG tab. */}
                        {level && (
                          <div
                            className={cn(
                              'absolute bottom-2 left-2 z-10 h-[11px] w-[11px] rounded-full ring-2 ring-white/85',
                              level === 'error' ? 'bg-destructive' : 'bg-amber-500',
                            )}
                          />
                        )}
                        {config.slides.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeSlide(i) }}
                            className="absolute right-1.5 top-1.5 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/50 text-sm text-white"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )
                  })}
                  <button
                    onClick={addSlide}
                    className="flex aspect-[4/5] items-center justify-center rounded-[10px] border-2 border-dashed border-border bg-background text-3xl text-muted-foreground transition-all hover:border-brand hover:text-brand"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {mobileTab === 'edit' && activeSlide && (
              <div className="flex h-full overflow-hidden">
                <div className="min-w-0 flex-1 overflow-y-auto border-r border-border">
                  <SlideEditor slide={activeSlide} allSlides={config.slides} onChange={updateSlide} section="content" />
                </div>
                <div className="flex w-[210px] shrink-0 flex-col items-center gap-2.5 overflow-y-auto bg-background px-2.5 py-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                    Live Preview
                  </div>
                  <div
                    className="shrink-0 overflow-hidden rounded-lg shadow-modal"
                    style={{ width: 190, height: Math.round(190 * slideAspect(activeSlide)) }}
                  >
                    <SlidePreview slide={activeSlide} scale={190 / 1080} totalSlides={config.slides.length} />
                  </div>
                  <div className="text-[11px] font-semibold text-muted-foreground">
                    Slide {activeIndex + 1} / {config.slides.length}
                  </div>
                </div>
              </div>
            )}

            {mobileTab === 'bg' && activeSlide && (
              <div className="flex h-full flex-col overflow-hidden">
                <Inspector
                  slide={activeSlide} allSlides={config.slides} onChange={updateSlide}
                  onSlideChange={updateSlide}
                  captions={config.captions ?? {}} onCaptionsChange={updateCaptions}
                  carouselTitle={config.title} platform={config.platform} slug={slugify(config.title)}
                  startJob={startJob} runningJobs={running}
                  findings={check.findingsFor(activeSlide)}
                />
              </div>
            )}

            {mobileTab === 'preview' && (
              <div className="flex h-full flex-col overflow-hidden">
                {controlsPanel}
                <div className="flex flex-1 justify-center overflow-auto pt-2">
                  <div className="origin-top" style={{ zoom: 0.78 }}>
                    <PlatformPreview
                      slides={config.slides} activeIndex={previewIndex} platform={config.platform}
                      onIndexChange={(i) => { setPreviewIndex(i); setActiveIndex(i) }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          {mobileTabs}
        </>
      )}
    </div>
  )
}
