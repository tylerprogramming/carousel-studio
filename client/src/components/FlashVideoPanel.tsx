import { useState, useCallback, useRef, useEffect } from 'react'
import { Slide } from '../types'
import SlidePreview from './SlidePreview'

const TIKTOK   = '#FE2C55'
const TIKTOK_D = '#c4002c'
const TEXT     = '#1C1E2E'
const MUTED    = '#8890A4'
const BORDER   = '#E5EAF5'
const BG       = '#F0F4FF'
const WHITE    = '#FFFFFF'
const BLUE     = '#5B6CF2'

type FlashStyle = 'statement' | 'video' | 'terminal'

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

export default function FlashVideoPanel({ slides, activeIndex, carouselId }: Props) {
  const [style, setStyle]       = useState<FlashStyle>('statement')
  const [duration, setDuration] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const prevIndexRef            = useRef(activeIndex)

  const slide = slides[activeIndex] ?? slides[0]

  // Clear generated MP4 when slide changes
  useEffect(() => {
    if (prevIndexRef.current === activeIndex) return
    prevIndexRef.current = activeIndex
    setVideoUrl(null)
    setError(null)
    setStyle(slide?.backgroundVideo ? 'video' : 'statement')
  }, [activeIndex, slide])

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
          headline: slide.headline ?? '',
          emphasisLine: slide.emphasisLine ?? '',
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
  }, [slide, style, duration, carouselId])

  // Phone dimensions — slide is 4:5, TT frame is 9:16
  // We'll show the slide centered in the phone with bg color fill
  const PHONE_W   = 270
  const PHONE_H   = Math.round(PHONE_W * 16 / 9)
  const SLIDE_W   = PHONE_W
  const SLIDE_H   = Math.round(SLIDE_W * 1350 / 1080)
  const SCALE     = SLIDE_W / 1080
  // Slide sits centered vertically in phone
  const slideTop  = Math.round((PHONE_H - SLIDE_H) / 2)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Label */}
      <div style={{ textAlign: 'center', paddingTop: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          TikTok Preview · Slide {slide?.slideNumber ?? 1}
        </span>
      </div>

      {/* Phone */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '10px 20px' }}>
        <div style={{
          width: PHONE_W + 18, height: PHONE_H + 38,
          background: '#0f0f0f', borderRadius: 40,
          padding: '9px 9px 7px',
          boxShadow: '0 20px 70px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0,
        }}>
          {/* Dynamic island */}
          <div style={{ width: 80, height: 10, background: '#000', borderRadius: 5, marginBottom: 5, flexShrink: 0 }} />

          {/* Screen */}
          <div style={{
            width: PHONE_W, height: PHONE_H, borderRadius: 24, overflow: 'hidden',
            background: slide?.bgColor ?? '#111', position: 'relative', flexShrink: 0,
          }}>
            {/* Slide preview centered in the 9:16 frame */}
            <div style={{
              position: 'absolute', left: 0, top: slideTop, width: SLIDE_W, height: SLIDE_H,
              overflow: 'hidden',
            }}>
              {slide && <SlidePreview slide={slide} scale={SCALE} totalSlides={slides.length} />}
            </div>

            {/* TikTok UI overlay */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {/* For You */}
              <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                <span style={{ color: WHITE, fontSize: 13, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>For You</span>
              </div>
              {/* Right actions */}
              <div style={{ position: 'absolute', right: 7, bottom: 80, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                {[{ icon: '❤️', count: '24K' }, { icon: '💬', count: '312' }, { icon: '↗️', count: 'Share' }].map((item, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ fontSize: 22, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))' }}>{item.icon}</div>
                    <span style={{ color: WHITE, fontSize: 10, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{item.count}</span>
                  </div>
                ))}
              </div>
              {/* Bottom info */}
              <div style={{ position: 'absolute', bottom: 14, left: 10, right: 50 }}>
                <div style={{ color: WHITE, fontSize: 12, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.9)', marginBottom: 2 }}>@tylerreedai</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, textShadow: '0 1px 3px rgba(0,0,0,0.9)', lineHeight: 1.4, marginBottom: 4 }}>
                  {slide?.headline?.slice(0, 55)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10 }}>🎵</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9 }}>Original Sound - tylerreedai</span>
                </div>
              </div>
              {/* TikTok red border at bottom */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: TIKTOK, opacity: 0.8 }} />
            </div>

            {/* MP4 overlay when generated */}
            {videoUrl && (
              <video key={videoUrl} src={videoUrl} autoPlay loop muted playsInline
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 5 }} />
            )}
          </div>

          {/* Home bar */}
          <div style={{ width: 55, height: 4, background: '#2a2a2a', borderRadius: 2, marginTop: 7, flexShrink: 0 }} />
        </div>
      </div>

      {/* Controls bar */}
      <div style={{
        background: WHITE, borderTop: `1px solid ${BORDER}`,
        padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
      }}>
        {/* Style + Duration */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['statement', 'video', 'terminal'] as FlashStyle[]).map((s) => {
            const disabled = s === 'video' && !slide?.backgroundVideo
            const active   = style === s
            return (
              <button key={s} onClick={() => !disabled && setStyle(s)} disabled={disabled}
                style={{
                  padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                  border: `1.5px solid ${active ? TIKTOK : BORDER}`,
                  background: active ? '#fff0f3' : BG,
                  color: disabled ? '#ccc' : active ? TIKTOK : TEXT,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
                }}>
                {s === 'statement' ? '📝 Text' : s === 'video' ? '🎬 Video' : '💻 Term'}
              </button>
            )
          })}
          <div style={{ width: 1, height: 20, background: BORDER, margin: '0 2px' }} />
          {[4, 5, 7].map((d) => (
            <button key={d} onClick={() => setDuration(d)}
              style={{
                padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                border: `1.5px solid ${duration === d ? BLUE : BORDER}`,
                background: duration === d ? '#eef0fd' : BG,
                color: duration === d ? BLUE : TEXT,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
              {d}s
            </button>
          ))}
        </div>

        {/* Generate + download row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={generateMp4} disabled={generating}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 0', background: generating ? MUTED : TIKTOK, border: 'none',
              borderRadius: 9, color: WHITE, fontSize: 12, fontWeight: 800,
              cursor: generating ? 'default' : 'pointer',
              boxShadow: generating ? 'none' : '0 2px 10px rgba(254,44,85,0.35)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { if (!generating) e.currentTarget.style.background = TIKTOK_D }}
            onMouseLeave={(e) => { if (!generating) e.currentTarget.style.background = generating ? MUTED : TIKTOK }}
          >
            {generating
              ? <><span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: WHITE, borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Generating MP4…</>
              : <><TikTokIcon size={13} /> Generate MP4</>
            }
          </button>

          {videoUrl && (
            <a href={videoUrl} download style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '9px 14px', background: BG, borderRadius: 9,
              border: `1.5px solid ${BORDER}`, color: TEXT,
              fontSize: 12, fontWeight: 700, textDecoration: 'none', transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = TIKTOK; e.currentTarget.style.color = TIKTOK }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT }}
            >
              ⬇ Download
            </a>
          )}
        </div>

        {error && (
          <div style={{ padding: '8px 10px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 7, color: '#dc2626', fontSize: 11 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
