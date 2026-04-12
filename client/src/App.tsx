import { useState, useCallback, useEffect, useRef } from 'react'
import { Slide, CarouselConfig, defaultSlides, genId } from './types'
import { useIsMobile, useIsWide } from './hooks/useMediaQuery'
import SlideList from './components/SlideList'
import SlideEditor from './components/SlideEditor'
import InstagramPreview from './components/InstagramPreview'
import GenerateModal from './components/GenerateModal'
import SavedCarouselsDrawer from './components/SavedCarouselsDrawer'
import BatchModal from './components/BatchModal'

type MobileTab = 'slides' | 'edit' | 'preview'

const CAROUSEL_ID_KEY = 'carousel_maker_current_id'

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

  // Auto-save debounced
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
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
      setExportMsg(`✓ Exported: ${parts.join(' + ')}`)
    } catch (err) { setExportMsg(`Error: ${err}`) }
    finally { setExporting(false) }
  }

  const activeSlide = config.slides[activeIndex]

  // ── Shared header (desktop + mobile) ─────────────────────────────────────────
  const header = (
    <header style={{
      height: isMobile ? 52 : 52, background: '#18181b', borderBottom: '1px solid #27272a',
      display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0, zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'baseline', flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#fafafa', letterSpacing: '-0.02em' }}>Carousel</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#e07355', letterSpacing: '-0.02em', marginLeft: 3 }}>Maker</span>
      </div>

      {/* Title input — hidden on mobile to save space */}
      {!isMobile && (
        <input
          value={config.title}
          onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
          style={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: 7, padding: '5px 10px', color: '#fafafa', fontSize: 13, fontWeight: 500, outline: 'none', width: 180, marginLeft: 6 }}
          placeholder="Carousel title..."
          onFocus={(e) => (e.target.style.borderColor = '#e07355')}
          onBlur={(e)  => (e.target.style.borderColor = '#3f3f46')}
        />
      )}

      {/* Save status */}
      {!isMobile && (
        <button onClick={saveCarousel} style={{
          padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          border: 'none', background: saveStatus === 'saved' ? '#27272a' : '#3f3f46',
          color: saveStatus === 'saved' ? '#4ade80' : saveStatus === 'saving' ? '#fbbf24' : '#a1a1aa',
          transition: 'all 0.2s', letterSpacing: '0.02em',
        }}>
          {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'saving' ? '…Saving' : '⬆ Save'}
        </button>
      )}

      {/* Load saved */}
      <button onClick={() => setShowSaved(true)} style={{
        padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: '1px solid #3f3f46', background: 'transparent', color: '#a1a1aa', transition: 'all 0.15s',
      }}
        title="Load saved carousels"
        onMouseEnter={(e) => (e.currentTarget.style.color = '#fafafa')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
      >📂</button>

      {/* Platform */}
      {!isMobile && (
        <div style={{ display: 'flex', border: '1px solid #3f3f46', borderRadius: 7, overflow: 'hidden' }}>
          {(['instagram', 'linkedin'] as const).map((p) => (
            <button key={p} onClick={() => setConfig((c) => ({ ...c, platform: p }))} style={{
              padding: '5px 10px', border: 'none',
              background: config.platform === p ? '#e07355' : 'transparent',
              color: config.platform === p ? '#fff' : '#a1a1aa',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {p === 'instagram' ? '📸 IG' : '💼 LI'}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Generate */}
      <button onClick={() => setShowGenerate(true)} style={{
        padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        border: '1px solid #3f3f46', background: '#27272a', color: '#fafafa', transition: 'all 0.15s',
      }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#e07355'; e.currentTarget.style.color = '#e07355' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#fafafa' }}
      >
        ✨ {isMobile ? '' : 'Generate'}
      </button>

      {!isMobile && (
        <button onClick={() => setShowBatch(true)} style={{
          padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          border: '1px solid #3f3f46', background: '#27272a', color: '#fafafa', transition: 'all 0.15s',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#a78bfa'; e.currentTarget.style.color = '#a78bfa' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#fafafa' }}
        >
          ⚡ Batch
        </button>
      )}

      {/* Format + Export */}
      {!isMobile && (
        <div style={{ display: 'flex', border: '1px solid #3f3f46', borderRadius: 7, overflow: 'hidden' }}>
          {(['png', 'pdf', 'both'] as const).map((f) => (
            <button key={f} onClick={() => setExportFormat(f)} style={{
              padding: '5px 8px', border: 'none',
              borderRight: f !== 'both' ? '1px solid #3f3f46' : 'none',
              background: exportFormat === f ? '#3f3f46' : 'transparent',
              color: exportFormat === f ? '#fafafa' : '#a1a1aa',
              fontSize: 10, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {f === 'both' ? 'PNG+PDF' : f.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      <button onClick={handleExport} disabled={exporting} style={{
        padding: '6px 14px', background: exporting ? '#3f3f46' : '#e07355',
        border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 700,
        cursor: exporting ? 'default' : 'pointer', whiteSpace: 'nowrap',
      }}>
        {exporting ? '…' : isMobile ? '⬇' : 'Export All'}
      </button>
    </header>
  )

  // ── Export toast ─────────────────────────────────────────────────────────────
  const exportToast = exportMsg ? (
    <div style={{
      padding: '7px 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: exportMsg.startsWith('Error') ? '#fef2f2' : '#f0fdf4',
      borderBottom: `1px solid ${exportMsg.startsWith('Error') ? '#fecaca' : '#bbf7d0'}`,
      color: exportMsg.startsWith('Error') ? '#dc2626' : '#16a34a', fontSize: 13,
    }}>
      <span>{exportMsg}</span>
      {exportedUrls.map((item, i) => <a key={i} href={item.url} download style={{ color: 'inherit', textDecoration: 'underline', fontSize: 12 }}>{item.label}</a>)}
      <button onClick={() => { setExportMsg(''); setExportedUrls([]) }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 18 }}>×</button>
    </div>
  ) : null

  // ── Mobile bottom tab bar ────────────────────────────────────────────────────
  const mobileTabs = isMobile ? (
    <div style={{
      height: 60, background: '#18181b', borderTop: '1px solid #27272a',
      display: 'flex', alignItems: 'stretch', flexShrink: 0, zIndex: 50,
    }}>
      {([
        { tab: 'slides',  icon: '⊞', label: 'Slides' },
        { tab: 'edit',    icon: '✏️', label: 'Edit' },
        { tab: 'preview', icon: '👁', label: 'Preview' },
      ] as { tab: MobileTab; icon: string; label: string }[]).map(({ tab, icon, label }) => (
        <button key={tab} onClick={() => setMobileTab(tab)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 3, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          background: mobileTab === tab ? '#27272a' : 'transparent',
          borderTop: mobileTab === tab ? '2px solid #e07355' : '2px solid transparent',
          color: mobileTab === tab ? '#e07355' : '#71717a',
        }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
        </button>
      ))}
    </div>
  ) : null

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f4f4f5', overflow: 'hidden' }}>
      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} onGenerated={handleGenerated} platform={config.platform} />}
      {showSaved && <SavedCarouselsDrawer onClose={() => setShowSaved(false)} onLoad={loadCarousel} onNew={newCarousel} currentId={carouselId} />}
      {showBatch && <BatchModal onClose={() => setShowBatch(false)} onDone={() => { setShowBatch(false); setShowSaved(true) }} />}

      {header}
      {exportToast}

      {/* ── Desktop 3-column ── */}
      {!isMobile && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <SlideList slides={config.slides} activeIndex={activeIndex} onSelect={handleSelect} onAdd={addSlide} onRemove={removeSlide} onReorder={reorder} />
          {activeSlide && (
            <SlideEditor slide={activeSlide} allSlides={config.slides} onChange={updateSlide} onBgImage={applyBgImage} onBgImageEach={applyBgImageEach} twoCol={isWide} />
          )}
          <div style={{ flex: '1 1 360px', minWidth: 320, overflow: 'hidden' }}>
            <InstagramPreview slides={config.slides} activeIndex={previewIndex} onIndexChange={(i) => { setPreviewIndex(i); setActiveIndex(i) }} />
          </div>
        </div>
      )}

      {/* ── Mobile single-panel ── */}
      {isMobile && (
        <>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {mobileTab === 'slides' && (
              <div style={{ height: '100%', overflowY: 'auto', background: '#fff', padding: 12 }}>
                {/* Mobile title edit */}
                <input
                  value={config.title}
                  onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
                  style={{ width: '100%', background: '#f9f9f9', border: '1px solid #e4e4e7', borderRadius: 8, padding: '8px 12px', color: '#18181b', fontSize: 14, fontWeight: 500, outline: 'none', marginBottom: 12 }}
                  placeholder="Carousel title..."
                />
                {/* Platform on mobile */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {(['instagram', 'linkedin'] as const).map((p) => (
                    <button key={p} onClick={() => setConfig((c) => ({ ...c, platform: p }))} style={{
                      flex: 1, padding: '8px 0', border: `1.5px solid ${config.platform === p ? '#e07355' : '#e4e4e7'}`,
                      borderRadius: 8, background: config.platform === p ? '#fff3f0' : '#f9f9f9',
                      color: config.platform === p ? '#e07355' : '#71717a', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {p === 'instagram' ? '📸 Instagram' : '💼 LinkedIn'}
                    </button>
                  ))}
                </div>
                {/* Mobile slide grid (2 columns) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {config.slides.map((slide, i) => {
                    const THUMB_W = (window.innerWidth - 44) / 2
                    const scale   = THUMB_W / 1080
                    const THUMB_H = Math.round(THUMB_W * 1350 / 1080)
                    return (
                      <div key={slide.id} onClick={() => handleSelect(i)} style={{
                        borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                        border: i === activeIndex ? '2px solid #e07355' : '2px solid #e4e4e7',
                        background: slide.bgColor, height: THUMB_H,
                      }}>
                        {/* Slide number */}
                        <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{i + 1}</div>
                        {/* Remove */}
                        <button onClick={(e) => { e.stopPropagation(); removeSlide(i) }} style={{
                          position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', fontSize: 13,
                          cursor: 'pointer', display: config.slides.length > 1 ? 'flex' : 'none',
                          alignItems: 'center', justifyContent: 'center',
                        }}>×</button>
                      </div>
                    )
                  })}
                  {/* Add tile */}
                  <button onClick={addSlide} style={{
                    background: '#f9f9f9', border: '1.5px dashed #d4d4d8', borderRadius: 8,
                    aspectRatio: '4/5', cursor: 'pointer', fontSize: 28, color: '#a1a1aa',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>+</button>
                </div>
              </div>
            )}

            {mobileTab === 'edit' && activeSlide && (
              <div style={{ height: '100%', overflowY: 'auto' }}>
                <SlideEditor slide={activeSlide} allSlides={config.slides} onChange={updateSlide} onBgImage={applyBgImage} onBgImageEach={applyBgImageEach} twoCol={false} />
              </div>
            )}

            {mobileTab === 'preview' && (
              <div style={{ height: '100%', overflow: 'hidden' }}>
                <InstagramPreview slides={config.slides} activeIndex={previewIndex} onIndexChange={(i) => { setPreviewIndex(i); setActiveIndex(i) }} />
              </div>
            )}
          </div>
          {mobileTabs}
        </>
      )}
    </div>
  )
}
