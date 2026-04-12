import { useState, useRef } from 'react'
import { Slide } from '../types'
import ImageLibrary from './ImageLibrary'

// ── Design tokens ──────────────────────────────────────────────────────────────
const BLUE       = '#5B6CF2'
const BLUE_LIGHT = '#EEF0FD'
const BLUE_HOVER = '#4A59E0'
const TEXT       = '#1C1E2E'
const MUTED      = '#8890A4'
const BORDER     = '#E5EAF5'
const BG         = '#F0F4FF'
const WHITE      = '#FFFFFF'
const CORAL      = '#E07355'

type ImgScope = 'single' | 'all' | 'each'

export interface BgImageCardProps {
  slide: Slide
  allSlides: Slide[]
  onBgImage: (url: string, scope: 'single' | 'all', slideNumber?: number) => void
  onBgImageEach: (updates: { slideNumber: number; url: string }[]) => void
  onSlideChange: (updated: Slide) => void
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function WandIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 2L9.8 4.2L12 5L9.8 5.8L9 8L8.2 5.8L6 5L8.2 4.2L9 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
      <path d="M2 13L8.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M12.5 9L13 10.2L14 10.5L13 10.8L12.5 12L12 10.8L11 10.5L12 10.2L12.5 9Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 1L7.6 4.8L11.5 6.5L7.6 8.2L6.5 12L5.4 8.2L1.5 6.5L5.4 4.8L6.5 1Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: 'bgcard-spin 0.75s linear infinite', flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BgImageCard({
  slide,
  allSlides,
  onBgImage,
  onBgImageEach,
  onSlideChange,
}: BgImageCardProps) {
  const [scope, setScope]             = useState<ImgScope>('single')
  const [prompt, setPrompt]           = useState('')
  const [useLikeness, setUseLikeness] = useState(false)
  const [generating, setGenerating]   = useState(false)
  const [progress, setProgress]       = useState('')
  const [error, setError]             = useState('')
  const [libraryKey, setLibraryKey]   = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  function handleCancel() {
    abortRef.current?.abort()
    abortRef.current = null
    setGenerating(false)
    setProgress('')
  }

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    setProgress(scope === 'each' ? 'Starting batch...' : 'Generating image...')
    const abort = new AbortController()
    abortRef.current = abort
    try {
      const prefix = `bg_${Date.now()}`
      const res = await fetch('/api/generate-bg-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          prompt: prompt.trim(),
          scope,
          slides: scope === 'each'
            ? allSlides.map((s) => ({ slideNumber: s.slideNumber, headline: s.headline, emphasisLine: s.emphasisLine }))
            : [],
          outputPrefix: prefix,
          useLikeness,
        }),
      })
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      const batch: { slideNumber: number; url: string }[] = []
      let finished = false
      const finish = (err?: string) => {
        if (finished) return
        finished = true
        reader.cancel().catch(() => {})
        abortRef.current = null
        if (err) setError(err)
        setGenerating(false)
        setProgress('')
        setLibraryKey((k) => k + 1)
      }
      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) { finish(); break }
        const text = dec.decode(value, { stream: true })
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'progress') { setProgress(evt.message) }
            else if (evt.type === 'error') { finish(evt.message || 'Generation failed'); break outer }
            else if (evt.type === 'image') {
              if (scope === 'each') { batch.push({ slideNumber: evt.slideNumber, url: evt.url }); setProgress(`Slide ${evt.slideNumber} done...`) }
              else {
                if (scope === 'all') onBgImage(evt.url, 'all')
                if (scope === 'single') onBgImage(evt.url, 'single', slide.slideNumber)
              }
            } else if (evt.type === 'complete') {
              if (scope === 'each') onBgImageEach(batch)
              finish()
              break outer
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') setError(String(err))
      setGenerating(false)
      setProgress('')
      abortRef.current = null
    }
  }

  function autoFill() {
    const parts = [slide.headline, slide.emphasisLine].filter(Boolean)
    setPrompt(parts.length
      ? `Abstract background for: "${parts.join(' — ')}". Modern minimal, geometric shapes, no text.`
      : '')
  }

  const scopeOptions: { value: ImgScope; label: string }[] = [
    { value: 'single', label: 'This Slide' },
    { value: 'all',    label: 'All Slides' },
    { value: 'each',   label: 'Each Slide' },
  ]

  const canGenerate = !generating && (scope === 'each' || prompt.trim().length > 0)
  const overlayOpacity = slide.overlayOpacity ?? 0.45
  const overlayColor   = slide.overlayColor ?? '#000000'

  return (
    <div style={{
      width: 290,
      minWidth: 290,
      flexShrink: 0,
      background: WHITE,
      borderRight: `1px solid ${BORDER}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
    }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ color: MUTED, display: 'flex', alignItems: 'center' }}>
          <WandIcon />
        </span>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: TEXT,
          flex: 1,
        }}>
          Background
        </span>
        {slide.backgroundImage && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: '#16a34a',
            fontSize: 11,
            fontWeight: 600,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#16a34a',
              display: 'inline-block',
            }} />
            Active
          </span>
        )}
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>

        {/* ── Section: Generate For ─────────────────────────────────── */}
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom: 8,
          }}>
            Generate For
          </div>
          <div style={{
            background: BG,
            borderRadius: 999,
            padding: 3,
            display: 'flex',
            gap: 2,
          }}>
            {scopeOptions.map((opt) => {
              const active = scope === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setScope(opt.value)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    borderRadius: 999,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: active ? WHITE : 'transparent',
                    color: active ? TEXT : MUTED,
                    boxShadow: active ? '0 1px 4px rgba(28,30,46,0.10)' : 'none',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Section: Prompt ───────────────────────────────────────── */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}>
            <label style={{
              fontSize: 11,
              fontWeight: 600,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}>
              {scope === 'each' ? 'Base Style' : 'Prompt'}
            </label>
            {scope !== 'each' && (
              <button
                onClick={autoFill}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: BLUE,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
              >
                Auto ↺
              </button>
            )}
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={scope === 'each' ? 'Optional base style...' : 'e.g. teal gradient, minimal geometric...'}
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 11,
              padding: '8px 10px',
              fontSize: 11,
              color: TEXT,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = BLUE }}
            onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = BORDER }}
          />
        </div>

        {/* ── Likeness toggle ───────────────────────────────────────── */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={useLikeness}
            onChange={(e) => setUseLikeness(e.target.checked)}
            style={{
              width: 14,
              height: 14,
              accentColor: BLUE,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, color: MUTED }}>Use my likeness</span>
        </label>

        {/* ── Generate / Cancel buttons ─────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 10,
              border: 'none',
              background: canGenerate ? BLUE : '#C5CADF',
              color: WHITE,
              fontSize: 13,
              fontWeight: 600,
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (canGenerate) (e.currentTarget as HTMLElement).style.background = BLUE_HOVER
            }}
            onMouseLeave={(e) => {
              if (canGenerate) (e.currentTarget as HTMLElement).style.background = BLUE
            }}
          >
            {generating ? (
              <>
                <SpinnerIcon />
                {progress || 'Generating...'}
              </>
            ) : (
              <>
                <SparkleIcon />
                {scope === 'each' ? `Generate ${allSlides.length} Images` : 'Generate Background'}
              </>
            )}
          </button>
          {generating && (
            <button
              onClick={handleCancel}
              style={{
                height: 38, width: 38, borderRadius: 10, flexShrink: 0,
                border: `1.5px solid #FECACA`, background: '#FFF1F2',
                color: '#DC2626', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Cancel generation"
            >×</button>
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 9,
            padding: '8px 12px',
            fontSize: 11,
            color: '#DC2626',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* ── Active Image section ───────────────────────────────────── */}
        {slide.backgroundImage && (
          <>
            <div style={{ height: 1, background: BORDER, flexShrink: 0 }} />

            <div>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: MUTED,
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                marginBottom: 10,
              }}>
                Active Image
              </div>

              {/* Image preview */}
              <div style={{
                position: 'relative',
                aspectRatio: '4/5',
                borderRadius: 10,
                overflow: 'hidden',
                marginBottom: 12,
              }}>
                <img
                  src={slide.backgroundImage}
                  alt="Active background"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  background: '#16a34a',
                  color: WHITE,
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '2px 7px',
                  borderRadius: 999,
                }}>
                  Active
                </div>
              </div>

              {/* Overlay opacity slider */}
              <div style={{ marginBottom: 10 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <span style={{ fontSize: 11, color: MUTED }}>Overlay opacity</span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: TEXT,
                    background: BG,
                    borderRadius: 5,
                    padding: '1px 6px',
                  }}>
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={overlayOpacity}
                  onChange={(e) => onSlideChange({ ...slide, overlayOpacity: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: BLUE, cursor: 'pointer' }}
                />
              </div>

              {/* Overlay color buttons + Remove */}
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { label: 'Dark overlay',  val: '#000000' },
                  { label: 'Light overlay', val: '#ffffff' },
                ].map((opt) => {
                  const active = overlayColor === opt.val
                  return (
                    <button
                      key={opt.val}
                      onClick={() => onSlideChange({ ...slide, overlayColor: opt.val })}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 7,
                        border: `1px solid ${active ? BLUE : BORDER}`,
                        background: active ? BLUE_LIGHT : BG,
                        color: active ? BLUE : MUTED,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
                <button
                  onClick={() => onSlideChange({ ...slide, backgroundImage: undefined })}
                  style={{
                    padding: '6px 10px',
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 7,
                    border: '1px solid #FECACA',
                    background: '#FEF2F2',
                    color: '#DC2626',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FEE2E2' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2' }}
                >
                  Remove
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Image Library section ─────────────────────────────────── */}
        <>
          <div style={{ height: 1, background: BORDER, flexShrink: 0 }} />
          <ImageLibrary
            compact={true}
            refreshKey={libraryKey}
            onApply={(url) => onSlideChange({ ...slide, backgroundImage: url })}
          />
        </>

      </div>

      {/* ── Spin keyframes ────────────────────────────────────────────── */}
      <style>{`
        @keyframes bgcard-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
