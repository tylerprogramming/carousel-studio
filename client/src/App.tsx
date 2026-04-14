import { useState, useCallback, useEffect, useRef } from 'react'
import { Slide, CarouselConfig, defaultSlides, genId } from './types'
import { useIsMobile, useIsWide } from './hooks/useMediaQuery'
import SlideList from './components/SlideList'
import SlideEditor from './components/SlideEditor'
import SlidePreview from './components/SlidePreview'
import BgImageCard from './components/BgImageCard'
import InstagramPreview from './components/InstagramPreview'
import GenerateModal from './components/GenerateModal'
import SavedCarouselsDrawer from './components/SavedCarouselsDrawer'
import BatchModal from './components/BatchModal'

type MobileTab = 'slides' | 'edit' | 'bg' | 'preview'

const CAROUSEL_ID_KEY = 'carousel_maker_current_id'

// ── Design tokens ─────────────────────────────────────────────────────────────
const BLUE       = '#5B6CF2'
const BLUE_LIGHT = '#EEF0FD'
const BLUE_HOVER = '#4A59E0'
const CORAL      = '#E07355'
const TEXT       = '#1C1E2E'
const MUTED      = '#8890A4'
const BORDER     = '#E5EAF5'
const BG         = '#F0F4FF'
const WHITE      = '#FFFFFF'

// ── Logo SVG ──────────────────────────────────────────────────────────────────
function AppLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="30" rx="7.5" fill={BLUE}/>
      <rect x="4.5" y="5.5" width="11" height="14" rx="2" fill="white" opacity="0.35"/>
      <rect x="8.5" y="8.5" width="11" height="14" rx="2" fill="white" opacity="0.6"/>
      <rect x="12.5" y="11.5" width="11" height="14" rx="2" fill="white"/>
    </svg>
  )
}

// ── Platform logo SVGs ────────────────────────────────────────────────────────
function IgLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433"/>
          <stop offset="25%" stopColor="#e6683c"/>
          <stop offset="50%" stopColor="#dc2743"/>
          <stop offset="75%" stopColor="#cc2366"/>
          <stop offset="100%" stopColor="#bc1888"/>
        </linearGradient>
      </defs>
      <path d="M12 2.982c2.937 0 3.285.011 4.445.064 3.066.14 4.492 1.589 4.632 4.632.053 1.16.064 1.508.064 4.445s-.011 3.285-.064 4.445c-.14 3.04-1.562 4.492-4.632 4.632-1.16.053-1.506.064-4.445.064-2.937 0-3.285-.011-4.445-.064-3.066-.14-4.492-1.596-4.632-4.632C2.993 15.285 2.982 14.937 2.982 12s.011-3.285.064-4.445c.14-3.04 1.562-4.492 4.632-4.632 1.16-.053 1.508-.064 4.445-.064zm0-1.982C9.013 1 8.638 1.014 7.465 1.067 3.495 1.254 1.254 3.492 1.067 7.465 1.014 8.638 1 9.013 1 12c0 2.987.014 3.362.067 4.535.187 3.97 2.425 6.211 6.398 6.398C8.638 22.986 9.013 23 12 23c2.987 0 3.362-.014 4.535-.067 3.967-.187 6.211-2.423 6.398-6.398C22.986 15.362 23 14.987 23 12c0-2.987-.014-3.362-.067-4.535C22.748 3.498 20.506 1.254 16.535 1.067 15.362 1.014 14.987 1 12 1zm0 5.838a5.162 5.162 0 100 10.324 5.162 5.162 0 000-10.324zM12 15a3 3 0 110-6 3 3 0 010 6zm5.338-9.87a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z" fill="url(#ig-grad)"/>
    </svg>
  )
}

function LiLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#0A66C2"/>
      <path d="M6.5 9.5H4.5V19.5H6.5V9.5Z" fill="white"/>
      <circle cx="5.5" cy="6.5" r="1.5" fill="white"/>
      <path d="M19.5 13.5C19.5 11.3 18 9.5 15.5 9.5C14.2 9.5 13.1 10.1 12.5 11V9.5H10.5V19.5H12.5V14.5C12.5 12.8 13.6 11.5 15 11.5C16.4 11.5 17.5 12.3 17.5 14V19.5H19.5V13.5Z" fill="white"/>
    </svg>
  )
}

function TikTokLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z" fill="currentColor"/>
    </svg>
  )
}

// ── Icon components ───────────────────────────────────────────────────────────
function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 3.5A1 1 0 0 1 2.5 2.5H6l1.5 2H13.5A1 1 0 0 1 14.5 5.5V12.5A1 1 0 0 1 13.5 13.5H2.5A1 1 0 0 1 1.5 12.5V3.5Z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1L8.2 5.2L12.5 7L8.2 8.8L7 13L5.8 8.8L1.5 7L5.8 5.2L7 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg width="13" height="14" viewBox="0 0 13 14" fill="none">
      <path d="M7.5 1L2 8H6.5L5.5 13L11 6H6.5L7.5 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function newId() { return `carousel_${Date.now()}` }

export default function App() {
  const isMobile = useIsMobile()
  const isWide   = useIsWide()

  const [carouselId, setCarouselId] = useState<string>(() => localStorage.getItem(CAROUSEL_ID_KEY) || newId())
  const [config, setConfig] = useState<CarouselConfig>({
    title: 'My Carousel',
    platform: 'instagram',
    slides: defaultSlides(),
  })
  const [activeIndex, setActiveIndex]     = useState(0)
  const [previewIndex, setPreviewIndex]   = useState(0)
  const [exporting, setExporting]         = useState(false)
  const [exportedUrls, setExportedUrls]   = useState<{ label: string; url: string }[]>([])
  const [exportMsg, setExportMsg]         = useState('')
  const [showGenerate, setShowGenerate]   = useState(false)
  const [showSaved, setShowSaved]         = useState(false)
  const [showBatch, setShowBatch]         = useState(false)
  const [exportFormat, setExportFormat]   = useState<'png' | 'pdf' | 'both'>('both')
  const [mobileTab, setMobileTab]         = useState<MobileTab>('preview')
  const [saveStatus, setSaveStatus]       = useState<'saved' | 'unsaved' | 'saving'>('saved')

  // On mount: load the last-used carousel from the server instead of defaulting to blank
  const isLoaded = useRef(false)
  useEffect(() => {
    const storedId = localStorage.getItem(CAROUSEL_ID_KEY)
    if (!storedId) { isLoaded.current = true; return }
    fetch(`/api/carousels/${storedId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.slides) {
          setConfig({ title: data.title, platform: data.platform ?? 'instagram', slides: data.slides })
          setCarouselId(data.id)
        }
      })
      .catch(() => {})
      .finally(() => { isLoaded.current = true })
  }, [])

  // Auto-save debounced — skip until initial load is complete
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isLoaded.current) return
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { saveCarousel() }, 4000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [config, carouselId])

  async function saveCarousel() {
    setSaveStatus('saving')
    try {
      const res  = await fetch('/api/carousels', {
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
  }

  function loadCarousel(data: any) {
    setCarouselId(data.id)
    setConfig({ title: data.title, platform: data.platform, slides: data.slides })
    setActiveIndex(0)
    setPreviewIndex(0)
    setShowSaved(false)
    localStorage.setItem(CAROUSEL_ID_KEY, data.id)
    setSaveStatus('saved')
  }

  function newCarousel() {
    const id = newId()
    setCarouselId(id)
    setConfig({ title: 'New Carousel', platform: 'instagram', slides: defaultSlides() })
    setActiveIndex(0)
    setPreviewIndex(0)
    setSaveStatus('unsaved')
  }

  function handleSelect(i: number) {
    setActiveIndex(i)
    setPreviewIndex(i)
    if (isMobile) setMobileTab('edit')
  }

  function updateSlide(updated: Slide) {
    const applyBgToAll     = (updated as any)._applyBgToAll
    const applyColorsToAll = (updated as any)._applyColorsToAll
    if (applyBgToAll) {
      const { _applyBgToAll, ...clean } = updated as any
      setConfig((c) => ({ ...c, slides: c.slides.map((s, i) => i === activeIndex ? clean : { ...s, bgColor: clean.bgColor }) }))
      return
    }
    if (applyColorsToAll) {
      const { _applyColorsToAll, ...clean } = updated as any
      setConfig((c) => ({ ...c, slides: c.slides.map((s, i) => i === activeIndex ? clean : { ...s, bgColor: clean.bgColor, textColor: clean.textColor, accentColor: clean.accentColor }) }))
      return
    }
    const applyTextScaleToAll = (updated as any)._applyTextScaleToAll
    if (applyTextScaleToAll) {
      const { _applyTextScaleToAll, ...clean } = updated as any
      setConfig((c) => ({ ...c, slides: c.slides.map((s, i) => i === activeIndex ? clean : { ...s, textScale: clean.textScale }) }))
      return
    }
    setConfig((c) => ({ ...c, slides: c.slides.map((s, i) => i === activeIndex ? updated : s) }))
  }

  function addSlide() {
    const last = config.slides[config.slides.length - 1]
    const newSlide: Slide = {
      id: genId(), type: 'content', slideNumber: config.slides.length + 1,
      stepNumber: config.slides.length, headline: 'New Feature',
      emphasisLine: 'Your emphasis here', bodyText: 'Add supporting detail.',
      bgColor: last?.bgColor ?? '#F5F0EB', textColor: last?.textColor ?? '#1B1B1B', accentColor: last?.accentColor ?? '#E07355',
    }
    setConfig((c) => ({ ...c, slides: [...c.slides.slice(0, -1), newSlide, c.slides[c.slides.length - 1]] }))
    const newIdx = config.slides.length - 1
    setActiveIndex(newIdx)
    setPreviewIndex(newIdx)
    if (isMobile) setMobileTab('edit')
  }

  function removeSlide(i: number) {
    setConfig((c) => ({ ...c, slides: c.slides.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, slideNumber: idx + 1 })) }))
    setActiveIndex((p) => Math.max(0, Math.min(p, config.slides.length - 2)))
    setPreviewIndex((p) => Math.max(0, Math.min(p, config.slides.length - 2)))
  }

  function reorder(from: number, to: number) {
    setConfig((c) => {
      const slides = [...c.slides]
      const [moved] = slides.splice(from, 1)
      slides.splice(to, 0, moved)
      return { ...c, slides: slides.map((s, i) => ({ ...s, slideNumber: i + 1 })) }
    })
  }

  function handleGenerated(slides: Slide[], title: string) {
    setConfig((c) => ({ ...c, title, slides: slides.map((s, i) => ({ ...s, id: s.id || genId(), slideNumber: i + 1 })) }))
    setActiveIndex(0); setPreviewIndex(0)
    if (isMobile) setMobileTab('preview')
  }

  function applyBgImage(url: string, scope: 'single' | 'all', slideNumber?: number) {
    setConfig((c) => ({
      ...c,
      slides: c.slides.map((s, i) => {
        if (scope === 'all') return { ...s, backgroundImage: url }
        if (scope === 'single' && (slideNumber !== undefined ? s.slideNumber === slideNumber : i === activeIndex)) return { ...s, backgroundImage: url }
        return s
      }),
    }))
  }

  function applyBgImageEach(updates: { slideNumber: number; url: string }[]) {
    setConfig((c) => ({
      ...c,
      slides: c.slides.map((s) => {
        const match = updates.find((u) => u.slideNumber === s.slideNumber)
        return match ? { ...s, backgroundImage: match.url } : s
      }),
    }))
  }

  async function handleExport() {
    setExporting(true); setExportMsg(''); setExportedUrls([])
    try {
      await saveCarousel()
      const slug = config.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'carousel'
      const slidesWithPaths = config.slides.map((s) => ({
        ...s,
        backgroundImagePath: s.backgroundImage
          ? `/Users/tylerreed/carousel-maker/output/${s.backgroundImage.replace('/files/', '')}`
          : undefined,
      }))
      const res  = await fetch('/api/export-all', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: slidesWithPaths, carouselSlug: slug, format: exportFormat }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const links: { label: string; url: string }[] = []
      if (data.slides?.length) data.slides.forEach((s: any, i: number) => links.push({ label: `Slide ${i + 1}`, url: s.url }))
      if (data.pdf) links.push({ label: '📄 PDF', url: data.pdf.url })
      setExportedUrls(links)
      const parts = [data.slides?.length && `${data.slides.length} PNGs`, data.pdf && 'PDF'].filter(Boolean)
      setExportMsg(`Exported: ${parts.join(' + ')}`)
    } catch (err) { setExportMsg(`Error: ${err}`) }
    finally { setExporting(false) }
  }

  const activeSlide = config.slides[activeIndex]

  // ── Controls panel (shown above preview) ─────────────────────────────────────
  const controlsPanel = (
    <div style={{
      background: WHITE, borderBottom: `1px solid ${BORDER}`,
      padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
    }}>
      {/* Row 1: Platform + Library + Generate + Batch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Platform */}
        <div style={{ display: 'flex', background: BG, borderRadius: 9, padding: 3, gap: 2, border: `1.5px solid ${BORDER}` }}>
          {([
            { id: 'instagram', label: 'IG',  logo: <IgLogo size={15} />,      soon: false },
            { id: 'linkedin',  label: 'LI',  logo: <LiLogo size={15} />,      soon: false },
            { id: 'tiktok',    label: 'TT',  logo: <TikTokLogo size={15} />,  soon: true  },
          ] as const).map((p) => (
            <button
              key={p.id}
              onClick={() => !p.soon && setConfig((c) => ({ ...c, platform: p.id }))}
              title={p.soon ? 'Coming soon' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', border: 'none', borderRadius: 7,
                background: config.platform === p.id ? WHITE : 'transparent',
                color: p.soon ? '#ccc' : config.platform === p.id ? TEXT : MUTED,
                fontSize: 12, fontWeight: 600,
                cursor: p.soon ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: p.soon ? 0.45 : 1,
                boxShadow: config.platform === p.id ? '0 1px 3px rgba(30,40,100,0.1)' : 'none',
                position: 'relative',
              }}
            >
              {p.logo} {p.label}
              {p.soon && <span style={{ fontSize: 8, fontWeight: 700, color: MUTED, letterSpacing: '0.04em', marginLeft: 1 }}>SOON</span>}
            </button>
          ))}
        </div>

        {/* Library */}
        <button
          onClick={() => setShowSaved(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
            borderRadius: 8, border: `1.5px solid ${BORDER}`, background: WHITE,
            color: MUTED, cursor: 'pointer', transition: 'all 0.15s', fontSize: 12, fontWeight: 600,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.color = BLUE; e.currentTarget.style.background = BLUE_LIGHT }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = MUTED; e.currentTarget.style.background = WHITE }}
        >
          <FolderIcon /> Library
        </button>

        <div style={{ flex: 1 }} />

        {/* Generate */}
        <button
          onClick={() => setShowGenerate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9,
            border: `1.5px solid ${BLUE}`, background: BLUE_LIGHT, color: BLUE,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = BLUE; e.currentTarget.style.color = WHITE }}
          onMouseLeave={(e) => { e.currentTarget.style.background = BLUE_LIGHT; e.currentTarget.style.color = BLUE }}
        >
          <SparkleIcon /> Generate
        </button>

        {/* Batch */}
        <button
          onClick={() => setShowBatch(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9,
            border: '1.5px solid #C4B5FD', background: '#F5F3FF', color: '#7C3AED',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#7C3AED'; e.currentTarget.style.color = WHITE; e.currentTarget.style.borderColor = '#7C3AED' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C3AED'; e.currentTarget.style.borderColor = '#C4B5FD' }}
        >
          <BoltIcon /> Batch
        </button>
      </div>

      {/* Row 2: Format + Export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Export as</span>
        <div style={{ display: 'flex', background: BG, borderRadius: 8, padding: 3, gap: 2, border: `1.5px solid ${BORDER}` }}>
          {(['png', 'pdf', 'both'] as const).map((f) => (
            <button key={f} onClick={() => setExportFormat(f)} style={{
              padding: '3px 9px', border: 'none', borderRadius: 6,
              background: exportFormat === f ? WHITE : 'transparent',
              color: exportFormat === f ? TEXT : MUTED,
              fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              boxShadow: exportFormat === f ? '0 1px 3px rgba(30,40,100,0.1)' : 'none',
            }}>
              {f === 'both' ? 'PNG+PDF' : f.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            padding: '7px 18px', background: exporting ? MUTED : BLUE,
            border: 'none', borderRadius: 9, color: WHITE,
            fontSize: 12, fontWeight: 700, cursor: exporting ? 'default' : 'pointer',
            whiteSpace: 'nowrap', transition: 'background 0.15s',
            boxShadow: exporting ? 'none' : '0 2px 8px rgba(91,108,242,0.3)',
          }}
          onMouseEnter={(e) => { if (!exporting) e.currentTarget.style.background = BLUE_HOVER }}
          onMouseLeave={(e) => { if (!exporting) e.currentTarget.style.background = BLUE }}
        >
          {exporting ? '…' : 'Export All'}
        </button>
      </div>
    </div>
  )

  // ── Save indicator ────────────────────────────────────────────────────────────
  const saveIndicator = (
    <button
      onClick={saveCarousel}
      title={saveStatus === 'saved' ? 'All changes saved' : 'Click to save'}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
        borderRadius: 20, border: `1.5px solid ${saveStatus === 'saved' ? '#D1FAE5' : saveStatus === 'saving' ? '#FEF3C7' : BORDER}`,
        background: saveStatus === 'saved' ? '#F0FDF4' : saveStatus === 'saving' ? '#FFFBEB' : '#F9FAFB',
        cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: saveStatus === 'saved' ? '#22C55E' : saveStatus === 'saving' ? '#F59E0B' : MUTED,
        boxShadow: saveStatus === 'saved' ? '0 0 0 3px rgba(34,197,94,0.2)' : undefined,
        transition: 'background 0.2s',
      }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: saveStatus === 'saved' ? '#16A34A' : saveStatus === 'saving' ? '#D97706' : MUTED, letterSpacing: '0.01em' }}>
        {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved'}
      </span>
    </button>
  )

  // ── Header (minimal: logo + title + save only) ───────────────────────────────
  const header = (
    <header style={{
      height: 56, background: WHITE,
      borderBottom: `1px solid ${BORDER}`,
      boxShadow: '0 1px 3px rgba(30,40,100,0.05)',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
      flexShrink: 0, zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        <AppLogo size={28} />
        <div style={{ lineHeight: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>Carousel</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: BLUE, letterSpacing: '-0.02em' }}> Studio</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 22, background: BORDER, flexShrink: 0, marginLeft: 4 }} />

      {/* Title input */}
      <input
        className="header-input"
        value={config.title}
        onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
        style={{
          background: BG, border: `1.5px solid ${BORDER}`, borderRadius: 8,
          padding: '5px 11px', color: TEXT, fontSize: 13, fontWeight: 600,
          outline: 'none', width: isMobile ? 140 : 220, transition: 'border-color 0.15s',
        }}
        placeholder="Carousel title..."
      />

      {/* Save status */}
      {saveIndicator}

      <div style={{ flex: 1 }} />

      {/* Mobile: generate + export in header */}
      {isMobile && (
        <>
          <button
            onClick={() => setShowGenerate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${BLUE}`, background: BLUE_LIGHT, color: BLUE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            <SparkleIcon />
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ padding: '6px 13px', background: exporting ? MUTED : BLUE, border: 'none', borderRadius: 8, color: WHITE, fontSize: 12, fontWeight: 700, cursor: exporting ? 'default' : 'pointer' }}
          >
            {exporting ? '…' : '⬇'}
          </button>
        </>
      )}
    </header>
  )

  // ── Export toast ──────────────────────────────────────────────────────────────
  const exportToast = exportMsg ? (
    <div style={{
      padding: '9px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: exportMsg.startsWith('Error') ? '#FFF1F2' : '#F0FDF4',
      borderBottom: `1px solid ${exportMsg.startsWith('Error') ? '#FECDD3' : '#BBF7D0'}`,
      color: exportMsg.startsWith('Error') ? '#DC2626' : '#16A34A', fontSize: 13, fontWeight: 500,
    }}>
      <span style={{ fontWeight: 600 }}>{exportMsg.startsWith('Error') ? '⚠️' : '✓'}</span>
      <span>{exportMsg}</span>
      {exportedUrls.map((item, i) => (
        <a key={i} href={item.url} download style={{ color: 'inherit', textDecoration: 'underline', fontSize: 12 }}>{item.label}</a>
      ))}
      <button onClick={() => { setExportMsg(''); setExportedUrls([]) }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 20, lineHeight: 1, opacity: 0.7 }}>×</button>
    </div>
  ) : null

  // ── Mobile bottom tab bar ─────────────────────────────────────────────────────
  const mobileTabs = isMobile ? (
    <div style={{
      height: 64, background: WHITE, borderTop: `1px solid ${BORDER}`,
      display: 'flex', alignItems: 'stretch', flexShrink: 0, zIndex: 50,
      boxShadow: '0 -2px 10px rgba(30,40,100,0.06)',
    }}>
      {([
        { tab: 'slides',  label: 'Slides',  icon: (
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="11" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="2" y="14" width="16" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        )},
        { tab: 'edit',    label: 'Edit',    icon: (
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M13.5 3.5L16.5 6.5L7 16H4V13L13.5 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        )},
        { tab: 'bg',      label: 'BG',      icon: (
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M2 13L6 9L9 12L13 8L18 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )},
        { tab: 'preview', label: 'Preview', icon: (
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M2 10C2 10 5 4 10 4C15 4 18 10 18 10C18 10 15 16 10 16C5 16 2 10 2 10Z" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        )},
      ] as { tab: MobileTab; label: string; icon: React.ReactNode }[]).map(({ tab, label, icon }) => (
        <button
          key={tab}
          onClick={() => setMobileTab(tab)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: WHITE,
            color: mobileTab === tab ? BLUE : MUTED,
            borderTop: mobileTab === tab ? `2.5px solid ${BLUE}` : '2.5px solid transparent',
          }}
        >
          {icon}
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.03em' }}>{label}</span>
        </button>
      ))}
    </div>
  ) : null

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} onGenerated={handleGenerated} platform={config.platform} />}
      {showSaved && <SavedCarouselsDrawer onClose={() => setShowSaved(false)} onLoad={loadCarousel} onNew={newCarousel} currentId={carouselId} />}
      {showBatch && <BatchModal onClose={() => setShowBatch(false)} onDone={() => { setShowBatch(false); setShowSaved(true) }} />}

      {header}
      {exportToast}

      {/* ── Desktop 4-column ── */}
      {!isMobile && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 1. Slide strip */}
          <SlideList slides={config.slides} activeIndex={activeIndex} onSelect={handleSelect} onAdd={addSlide} onRemove={removeSlide} onReorder={reorder} />

          {/* 2. Content editor */}
          {activeSlide && (
            <SlideEditor slide={activeSlide} allSlides={config.slides} onChange={updateSlide} />
          )}

          {/* 3. Background image card */}
          {activeSlide && (
            <BgImageCard
              slide={activeSlide}
              allSlides={config.slides}
              onBgImage={applyBgImage}
              onBgImageEach={applyBgImageEach}
              onSlideChange={updateSlide}
            />
          )}

          {/* 4. Preview + controls */}
          <div style={{ flex: '1 1 340px', minWidth: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG }}>
            {controlsPanel}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <InstagramPreview slides={config.slides} activeIndex={previewIndex} onIndexChange={(i) => { setPreviewIndex(i); setActiveIndex(i) }} platform={config.platform} />
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile single-panel ── */}
      {isMobile && (
        <>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {mobileTab === 'slides' && (
              <div style={{ height: '100%', overflowY: 'auto', background: WHITE, padding: 16 }}>
                {/* Mobile title */}
                <input
                  className="header-input"
                  value={config.title}
                  onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
                  style={{
                    width: '100%', background: BG, border: `1.5px solid ${BORDER}`,
                    borderRadius: 10, padding: '9px 13px', color: TEXT,
                    fontSize: 14, fontWeight: 600, outline: 'none', marginBottom: 12,
                  }}
                  placeholder="Carousel title..."
                />
                {/* Mobile platform */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {([
                    { id: 'instagram', label: 'Instagram', logo: <IgLogo size={16} />,     soon: false },
                    { id: 'linkedin',  label: 'LinkedIn',  logo: <LiLogo size={16} />,     soon: false },
                    { id: 'tiktok',    label: 'TikTok',    logo: <TikTokLogo size={16} />, soon: true  },
                  ] as const).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => !p.soon && setConfig((c) => ({ ...c, platform: p.id }))}
                      title={p.soon ? 'Coming soon' : undefined}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '9px 4px',
                        border: `1.5px solid ${!p.soon && config.platform === p.id ? BLUE : BORDER}`,
                        borderRadius: 10,
                        background: !p.soon && config.platform === p.id ? BLUE_LIGHT : WHITE,
                        color: p.soon ? '#ccc' : config.platform === p.id ? BLUE : MUTED,
                        fontSize: 12, fontWeight: 600,
                        cursor: p.soon ? 'not-allowed' : 'pointer',
                        opacity: p.soon ? 0.5 : 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {p.logo} {p.label}
                      {p.soon && <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.04em' }}>SOON</span>}
                    </button>
                  ))}
                </div>
                {/* Mobile slide grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {config.slides.map((slide, i) => {
                    const THUMB_W = Math.floor((window.innerWidth - 52) / 2)
                    const thumbScale = THUMB_W / 1080
                    const THUMB_H = Math.round(THUMB_W * 1350 / 1080)
                    return (
                      <div
                        key={slide.id}
                        onClick={() => handleSelect(i)}
                        style={{
                          borderRadius: 10, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                          border: `2px solid ${i === activeIndex ? BLUE : BORDER}`,
                          width: THUMB_W, height: THUMB_H,
                          boxShadow: i === activeIndex ? `0 0 0 3px ${BLUE_LIGHT}` : 'none',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                          flexShrink: 0,
                        }}
                      >
                        <SlidePreview slide={slide} scale={thumbScale} totalSlides={config.slides.length} />
                        <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, zIndex: 2 }}>{i + 1}</div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeSlide(i) }}
                          style={{
                            position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 14,
                            cursor: 'pointer', display: config.slides.length > 1 ? 'flex' : 'none',
                            alignItems: 'center', justifyContent: 'center', zIndex: 2,
                          }}
                        >×</button>
                      </div>
                    )
                  })}
                  <button
                    onClick={addSlide}
                    style={{
                      background: BG, border: `2px dashed ${BORDER}`, borderRadius: 10,
                      aspectRatio: '4/5', cursor: 'pointer', fontSize: 28, color: MUTED,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.color = BLUE }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = MUTED }}
                  >+</button>
                </div>
              </div>
            )}
            {mobileTab === 'edit' && activeSlide && (
              <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
                {/* Left: editor */}
                <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', borderRight: `1px solid ${BORDER}` }}>
                  <SlideEditor slide={activeSlide} allSlides={config.slides} onChange={updateSlide} />
                </div>
                {/* Right: live preview panel */}
                <div style={{
                  width: 210, flexShrink: 0, background: BG,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '16px 10px', gap: 10, overflowY: 'auto',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Live Preview</div>
                  <div style={{ width: 190, height: Math.round(190 * 1350 / 1080), borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.18)', flexShrink: 0 }}>
                    <SlidePreview slide={activeSlide} scale={190 / 1080} totalSlides={config.slides.length} />
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
                    Slide {activeIndex + 1} / {config.slides.length}
                  </div>
                </div>
              </div>
            )}
            {mobileTab === 'bg' && activeSlide && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <BgImageCard
                  slide={activeSlide}
                  allSlides={config.slides}
                  onBgImage={applyBgImage}
                  onBgImageEach={applyBgImageEach}
                  onSlideChange={updateSlide}
                />
              </div>
            )}
            {mobileTab === 'preview' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {controlsPanel}
                <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                  <div style={{ zoom: 0.78, transformOrigin: 'top center' }}>
                    <InstagramPreview slides={config.slides} activeIndex={previewIndex} onIndexChange={(i) => { setPreviewIndex(i); setActiveIndex(i) }} platform={config.platform} />
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
