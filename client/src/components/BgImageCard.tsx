import { useState } from 'react'
import { Slide } from '../types'
import ImageLibrary from './ImageLibrary'
import { BG, BLUE, BLUE_HOVER, BLUE_LIGHT, BORDER, CORAL, MUTED, TEXT, WHITE } from '../lib/tokens'

// ── Design tokens ──────────────────────────────────────────────────────────────
type ImgScope = 'single' | 'all' | 'each'

export interface BgImageCardProps {
  slide: Slide
  allSlides: Slide[]
  onSlideChange: (updated: Slide) => void
  /** Queues a background job and returns immediately with its id. */
  startJob: (body: Record<string, unknown>) => Promise<string>
  runningJobs: { id: string }[]
}

/** Kie.ai image models. Seedance is the video line; Seedream is the image one. */
const MODELS: { value: string; label: string; hint: string }[] = [
  { value: '',                label: 'Auto',         hint: 'Nano Banana Pro when using your likeness, otherwise Nano Banana 2' },
  { value: 'nano-banana-2',   label: 'Nano Banana 2', hint: 'Fast and cheap. The everyday default.' },
  { value: 'nano-banana-pro', label: 'Nano Banana Pro', hint: 'Best faces and likeness fidelity.' },
  { value: 'seedream-4.5',    label: 'Seedream 4.5',  hint: 'Different aesthetic, high detail at 2K/4K.' },
  { value: 'seedream-5-lite', label: 'Seedream 5 Lite', hint: 'Fastest and cheapest Seedream.' },
]

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function BgImageCard({
  slide,
  allSlides,
  onSlideChange,
  startJob,
  runningJobs,
}: BgImageCardProps) {
  const [scope, setScope]             = useState<ImgScope>('single')
  const [prompt, setPrompt]           = useState('')
  const [model, setModel]             = useState('')
  const [useLikeness, setUseLikeness] = useState(false)
  const [error, setError]             = useState('')
  const [queued, setQueued]           = useState('')
  const [libraryKey, setLibraryKey]   = useState(0)

  // Generation is queued on the server, so this panel no longer owns the run.
  // You can start one and immediately keep editing, switch slides, or reload.
  const generating = runningJobs.length > 0

  async function handleGenerate() {
    setError('')
    setQueued('')
    try {
      await startJob({
        prompt: prompt.trim(),
        scope,
        model: model || undefined,
        useLikeness,
        outputPrefix: `bg_${Date.now()}`,
        slides: scope === 'each'
          ? allSlides.map((s) => ({ slideNumber: s.slideNumber, headline: s.headline, emphasisLine: s.emphasisLine }))
          : [],
      })
      setQueued(scope === 'each'
        ? `Queued ${allSlides.length} images. They apply as they finish.`
        : 'Queued. It applies when it finishes.')
      setLibraryKey((k) => k + 1)
      setTimeout(() => setLibraryKey((k) => k + 1), 8000)
    } catch (err: any) {
      setError(String(err?.message || err))
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
            <>
              <SparkleIcon />
              {scope === 'each' ? `Generate ${allSlides.length} Images` : 'Generate Background'}
            </>
          </button>
        </div>

        {queued && (
          <div style={{
            background: BLUE_LIGHT, border: `1px solid ${BLUE}33`, borderRadius: 9,
            padding: '8px 12px', fontSize: 11.5, color: BLUE, marginTop: 8,
          }}>
            {queued} Progress is in the bar at the top.
          </div>
        )}

        {/* ── Model ─────────────────────────────────────────────────── */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
            Model
          </div>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 9,
              border: `1.5px solid ${BORDER}`, background: BG, color: TEXT,
              fontSize: 12, fontWeight: 600, outline: 'none', fontFamily: 'inherit',
            }}
          >
            {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 5, lineHeight: 1.45 }}>
            {MODELS.find((m) => m.value === model)?.hint}
          </div>
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
    </div>
  )
}
