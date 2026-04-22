import { useState, useCallback, useEffect, useRef } from 'react'
import { Slide } from '../types'
import SlidePreview from './SlidePreview'
import FlashBatchModal from './FlashBatchModal'
import FlashLibraryModal from './FlashLibraryModal'

const TIKTOK   = '#FE2C55'
const TIKTOK_D = '#c4002c'
const TEXT_C   = '#1C1E2E'
const MUTED    = '#8890A4'
const BORDER   = '#E5EAF5'
const BG       = '#F0F4FF'
const WHITE    = '#FFFFFF'
const BLUE     = '#5B6CF2'

type FlashStyle = 'statement' | 'video' | 'terminal'

interface TtText { headline: string; emphasisLine: string; bodyText: string }

interface Props {
  slides: Slide[]
  activeIndex: number
  carouselId: string
}

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
    </svg>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: MUTED,
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 9,
  border: `1.5px solid ${BORDER}`, background: BG,
  color: TEXT_C, fontSize: 14, fontWeight: 600,
  outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box', resize: 'vertical',
  transition: 'border-color 0.15s',
}

export default function TikTokPanel({ slides, activeIndex, carouselId }: Props) {
  const slide = slides[activeIndex] ?? slides[0]

  // TT-specific text — separate from carousel, initialized from slide
  const [ttText, setTtText] = useState<TtText>({
    headline:    slide?.headline    ?? '',
    emphasisLine: slide?.emphasisLine ?? '',
    bodyText:    slide?.bodyText    ?? '',
  })
  const [style, setStyle]       = useState<FlashStyle>(slide?.backgroundVideo ? 'video' : 'statement')
  const [duration, setDuration] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [showBatch, setShowBatch] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const prevIndexRef            = useRef(activeIndex)

  // Reset TT text when slide changes
  useEffect(() => {
    if (prevIndexRef.current === activeIndex) return
    prevIndexRef.current = activeIndex
    setTtText({
      headline:    slide?.headline    ?? '',
      emphasisLine: slide?.emphasisLine ?? '',
      bodyText:    slide?.bodyText    ?? '',
    })
    setStyle(slide?.backgroundVideo ? 'video' : 'statement')
    setVideoUrl(null)
    setError(null)
  }, [activeIndex, slide])

  // Build a preview slide using TT-specific text (doesn't touch carousel data)
  const previewSlide: Slide | undefined = slide ? {
    ...slide,
    headline:    ttText.headline,
    emphasisLine: ttText.emphasisLine,
    bodyText:    ttText.bodyText,
  } : undefined

  const generateMp4 = useCallback(async () => {
    if (!slide) return
    setGenerating(true)
    setError(null)
    try {
      const resp = await fetch('/api/flash-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carouselId,
          slideNumber: slide.slideNumber,
          style, duration,
          headline:    ttText.headline,
          emphasisLine: ttText.emphasisLine,
          bgColor: slide.bgColor,
          textColor: slide.textColor,
          accentColor: slide.accentColor,
          backgroundVideo: slide.backgroundVideo,
          backgroundImage: slide.backgroundImage,
          overlayOpacity: slide.overlayOpacity,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || data.error) setError(data.error || 'Generation failed')
      else setVideoUrl(data.url + '?t=' + Date.now())
    } catch (err) { setError(String(err)) }
    finally { setGenerating(false) }
  }, [slide, style, duration, ttText, carouselId])

  // Phone: fill available space, 9:16 ratio
  const PHONE_W = 360
  const PHONE_H = Math.round(PHONE_W * 16 / 9)
  const SLIDE_W = PHONE_W
  const SLIDE_H = Math.round(SLIDE_W * 1350 / 1080)
  const SCALE   = SLIDE_W / 1080
  const slideTop = Math.round((PHONE_H - SLIDE_H) / 2)

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: BG }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {showBatch && <FlashBatchModal onClose={() => setShowBatch(false)} />}
      {showLibrary && <FlashLibraryModal onClose={() => setShowLibrary(false)} />}

      {/* ── Left: controls ── */}
      <div style={{
        width: 300, flexShrink: 0, borderRight: `1px solid ${BORDER}`,
        background: WHITE, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px 12px', borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28, background: TIKTOK, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, flexShrink: 0,
          }}>
            <TikTokIcon size={15} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT_C }}>Flash Video</div>
            <div style={{ fontSize: 10, color: MUTED }}>Slide {slide?.slideNumber} · separate from carousel</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setShowLibrary(true)}
              style={{
                padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${BORDER}`,
                background: BG, color: TEXT_C, fontSize: 10, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = TEXT_C }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER }}
            >
              Library
            </button>
            <button
              onClick={() => setShowBatch(true)}
              style={{
                padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${TIKTOK}`,
                background: '#fff0f3', color: TIKTOK, fontSize: 10, fontWeight: 800,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = TIKTOK; e.currentTarget.style.color = WHITE }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff0f3'; e.currentTarget.style.color = TIKTOK }}
            >
              Generate All
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Style */}
          <div>
            <div style={labelStyle}>Style</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['statement', 'video', 'terminal'] as FlashStyle[]).map((s) => {
                const disabled = s === 'video' && !slide?.backgroundVideo
                const active   = style === s
                return (
                  <button key={s} onClick={() => !disabled && setStyle(s)} disabled={disabled}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      border: `1.5px solid ${active ? TIKTOK : BORDER}`,
                      background: active ? '#fff0f3' : BG,
                      color: disabled ? '#ccc' : active ? TIKTOK : TEXT_C,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
                    }}>
                    {s === 'statement' ? '📝 Text' : s === 'video' ? '🎬 Video' : '💻 Term'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Duration */}
          <div>
            <div style={labelStyle}>Duration</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[4, 5, 7].map((d) => (
                <button key={d} onClick={() => setDuration(d)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    border: `1.5px solid ${duration === d ? BLUE : BORDER}`,
                    background: duration === d ? '#eef0fd' : BG,
                    color: duration === d ? BLUE : TEXT_C,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* TT-specific text — does NOT update the carousel */}
          <div>
            <div style={labelStyle}>Headline</div>
            <textarea rows={2} value={ttText.headline}
              onChange={(e) => setTtText((t) => ({ ...t, headline: e.target.value }))}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = TIKTOK }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = BORDER }}
            />
          </div>

          <div>
            <div style={labelStyle}>Emphasis Line</div>
            <textarea rows={2} value={ttText.emphasisLine}
              onChange={(e) => setTtText((t) => ({ ...t, emphasisLine: e.target.value }))}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = TIKTOK }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = BORDER }}
            />
          </div>

          <div>
            <div style={labelStyle}>Body Text</div>
            <textarea rows={3} value={ttText.bodyText}
              onChange={(e) => setTtText((t) => ({ ...t, bodyText: e.target.value }))}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = TIKTOK }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = BORDER }}
            />
          </div>

          {/* Generate */}
          <button onClick={generateMp4} disabled={generating}
            style={{
              padding: '12px 0', background: generating ? MUTED : TIKTOK, border: 'none',
              borderRadius: 10, color: WHITE, fontSize: 13, fontWeight: 800,
              cursor: generating ? 'default' : 'pointer',
              boxShadow: generating ? 'none' : '0 3px 14px rgba(254,44,85,0.38)',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onMouseEnter={(e) => { if (!generating) e.currentTarget.style.background = TIKTOK_D }}
            onMouseLeave={(e) => { if (!generating) e.currentTarget.style.background = generating ? MUTED : TIKTOK }}
          >
            {generating
              ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: WHITE, borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Generating…</>
              : <><TikTokIcon size={14} /> Generate MP4</>
            }
          </button>

          {videoUrl && (
            <a href={videoUrl} download style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 0', borderRadius: 9, border: `1.5px solid ${TIKTOK}`,
              color: TIKTOK, fontSize: 12, fontWeight: 700, textDecoration: 'none',
              background: '#fff0f3', transition: 'all 0.15s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = TIKTOK; e.currentTarget.style.color = WHITE }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff0f3'; e.currentTarget.style.color = TIKTOK }}
            >
              ⬇ Download MP4
            </a>
          )}

          {error && (
            <div style={{ padding: '9px 11px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, color: '#dc2626', fontSize: 11 }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: big TikTok phone ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          TikTok Preview
        </div>

        {/* Phone frame */}
        <div style={{
          width: PHONE_W + 20, height: PHONE_H + 42,
          background: '#0f0f0f', borderRadius: 46,
          padding: '10px 10px 8px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0,
        }}>
          {/* Dynamic island */}
          <div style={{ width: 96, height: 12, background: '#000', borderRadius: 6, marginBottom: 6, flexShrink: 0 }} />

          {/* Screen */}
          <div style={{
            width: PHONE_W, height: PHONE_H, borderRadius: 28, overflow: 'hidden',
            background: slide?.bgColor ?? '#111', position: 'relative', flexShrink: 0,
          }}>
            {/* Live slide preview (uses TT text, not carousel text) */}
            <div style={{ position: 'absolute', left: 0, top: slideTop, width: SLIDE_W, height: SLIDE_H, overflow: 'hidden' }}>
              {previewSlide && <SlidePreview slide={previewSlide} scale={SCALE} totalSlides={slides.length} />}
            </div>

            {/* TikTok UI overlay */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 13, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                <span style={{ color: WHITE, fontSize: 13, fontWeight: 700, textShadow: '0 1px 5px rgba(0,0,0,0.9)' }}>For You</span>
              </div>
              <div style={{ position: 'absolute', right: 7, bottom: 90, display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
                {[{ icon: '❤️', count: '24K' }, { icon: '💬', count: '312' }, { icon: '↗️', count: 'Share' }].map((item, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ fontSize: 22, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))' }}>{item.icon}</div>
                    <span style={{ color: WHITE, fontSize: 10, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{item.count}</span>
                  </div>
                ))}
              </div>
              <div style={{ position: 'absolute', bottom: 14, left: 10, right: 50 }}>
                <div style={{ color: WHITE, fontSize: 12, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.9)', marginBottom: 2 }}>@tylerreedai</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, textShadow: '0 1px 3px rgba(0,0,0,0.9)', lineHeight: 1.4, marginBottom: 4 }}>
                  {ttText.headline.slice(0, 55)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10 }}>🎵</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9 }}>Original Sound - tylerreedai</span>
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: TIKTOK, opacity: 0.8 }} />
            </div>

            {/* Generated MP4 replaces preview once ready */}
            {videoUrl && (
              <video key={videoUrl} src={videoUrl} autoPlay loop muted playsInline
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 10 }} />
            )}
          </div>

          {/* Home bar */}
          <div style={{ width: 55, height: 4, background: '#2a2a2a', borderRadius: 2, marginTop: 7, flexShrink: 0 }} />
        </div>
      </div>
    </div>
  )
}
