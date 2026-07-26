import { useState, useCallback, useEffect, useRef } from 'react'
import { Slide } from '../types'
import SlidePreview from './SlidePreview'

import { BLUE, BORDER, BG, MUTED, TEXT as TEXT_C, TIKTOK, TIKTOK_D, TIKTOK_SAFE, WHITE } from '../lib/tokens'
import { useSettings } from '../hooks/useSettings'



interface Props {
  slides: Slide[]
  activeIndex: number
  carouselId: string
  /** Used to find what has already been exported for this carousel */
  carouselTitle: string
}

/** Mirrors slugify() in App.tsx and slugFromTitle() in server.ts. */
function exportSlug(title: string) {
  return (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'carousel'
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

export default function TikTokPanel({ slides, activeIndex, carouselId, carouselTitle }: Props) {
  const { handle, username } = useSettings()
  const slide = slides[activeIndex] ?? slides[0]

  // What already exists on disk for this carousel: the reframed TikTok slides
  // and any full-carousel video. Fetched here so choosing TikTok shows the real
  // output, not just a mockup of the Instagram slides.
  const [exported, setExported] = useState<{
    videos: { filename: string; url: string }[]
    tiktokSlides: string[]
    stale: boolean
  }>({ videos: [], tiktokSlides: [], stale: false })

  // Clicking an exported video plays it in the phone frame on the right, which
  // is already a 9:16 display, instead of throwing you into a browser tab.
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  // The slide is inset to the safe area, but it is padded with the slide's own
  // background colour, so the inset is invisible. This outlines it.
  const [showGuide, setShowGuide] = useState(true)

  // Re-measure on resize so the preview keeps filling the window
  const [viewportH, setViewportH] = useState(
    typeof window === 'undefined' ? 900 : window.innerHeight,
  )
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const slug = exportSlug(carouselTitle)
  const loadExported = useCallback(async () => {
    try {
      const res = await fetch('/api/exports')
      const data = await res.json()
      const match = (data.carousels ?? []).find((c: any) => c.slug === slug)
      setExported({
        videos: match?.videos ?? [],
        tiktokSlides: match?.variants?.tiktok?.slides ?? [],
        // Re-exporting refreshes the 4:5 set and leaves the reframed one
        // behind, so the two disagree with nothing to show for it.
        stale: !!match?.staleVariants?.includes('tiktok'),
      })
    } catch { /* leave empty */ }
  }, [slug])
  useEffect(() => { loadExported() }, [loadExported])

  // TT-specific text — separate from carousel, initialized from slide
  const [generating, setGenerating] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const prevIndexRef            = useRef(activeIndex)


  // The panel previews the real slide now. It used to preview a separate text
  // draft that only fed the removed single-slide Flash Video export.
  const previewSlide: Slide | undefined = slide


  // Phone: fill available space, 9:16 ratio
  // Size the phone from the window, the way the Instagram preview fills its
  // space. A 9:16 frame at a fixed 360px looked tiny next to the 4:5 one.
  const PHONE_H = Math.min(880, Math.max(520, viewportH - 190))
  const PHONE_W = Math.round(PHONE_H * 9 / 16)
  // Inset to the TikTok safe area, matching tiktok_safe.py, so this shows the
  // exported framing rather than a full-bleed slide TikTok would cover with
  // its own UI. This is the preview that renders when TikTok is selected.
  const SLIDE_W   = Math.round(PHONE_W * (1 - TIKTOK_SAFE.margin * 2))
  const SLIDE_H   = Math.round(SLIDE_W * 1350 / 1080)
  const SCALE     = SLIDE_W / 1080
  const slideTop  = Math.round((PHONE_H - SLIDE_H) * TIKTOK_SAFE.topBias)
  const slideLeft = Math.round(PHONE_W * TIKTOK_SAFE.margin)

  const exportedBlock = (exported.videos.length > 0 || exported.tiktokSlides.length > 0) && (
    <div style={{ marginBottom: 16 }}>
      <div style={labelStyle}>Exported for TikTok</div>

      {/* Videos and slides share one grid at one size. A big inline player took
          the whole panel for something you mostly just need to confirm exists;
          clicking a tile opens it full size in a new tab. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
        {exported.videos.map((v) => (
          <button key={v.url} onClick={() => setPlayingUrl(playingUrl === v.url ? null : v.url)}
                  title={`${v.filename} — plays in the phone`}
                  style={{
                    position: 'relative', display: 'block', padding: 0, cursor: 'pointer',
                    borderRadius: 6, overflow: 'hidden', background: 'none',
                    border: `2px solid ${playingUrl === v.url ? TIKTOK : BORDER}`,
                  }}>
            <video src={v.url} autoPlay loop muted playsInline
                   style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', display: 'block' }} />
            <span style={{
              position: 'absolute', bottom: 2, right: 2, background: TIKTOK, color: WHITE,
              fontSize: 8, fontWeight: 800, borderRadius: 3, padding: '1px 3px',
            }}>MP4</span>
          </button>
        ))}
        {exported.tiktokSlides.map((url, i) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" title={`Slide ${i + 1}`}
             style={{ display: 'block', borderRadius: 6, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
            <img src={url} alt={`tiktok slide ${i + 1}`} loading="lazy"
                 style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', display: 'block' }} />
          </a>
        ))}
      </div>

      <div style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>
        {exported.videos.length > 0 && `${exported.videos.length} video · `}
        {exported.tiktokSlides.length} reframed slides (1080x1920)
      </div>

      {exported.stale && (
        <div style={{
          marginTop: 6, padding: '6px 8px', borderRadius: 6,
          background: '#FEE9E3', color: '#B4432B', fontSize: 10, lineHeight: 1.45,
        }}>
          These are older than the main export. Rebuild the TikTok set before
          posting, or you will ship slides you have since changed.
        </div>
      )}
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: BG }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>


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
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT_C }}>TikTok</div>
            <div style={{ fontSize: 10, color: MUTED }}>Exported sets, and a single-slide clip</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {exportedBlock}

        </div>
      </div>

      {/* ── Right: big TikTok phone ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {playingUrl ? 'Playing export' : 'TikTok Preview'}
          </span>
          {playingUrl ? (
            <button onClick={() => setPlayingUrl(null)}
                    style={{ fontSize: 10, fontWeight: 700, color: TIKTOK, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              back to slide
            </button>
          ) : (
            <button onClick={() => setShowGuide((v) => !v)}
                    title="The slide is inset to clear TikTok's caption and action rail. The padding is the slide's own colour, so this outlines it."
                    style={{ fontSize: 10, fontWeight: 700, color: showGuide ? TIKTOK : MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              safe area
            </button>
          )}
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
            {playingUrl ? (
              <video src={playingUrl} controls autoPlay loop playsInline
                     style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
            ) : (
              <>
                <div style={{ position: 'absolute', left: slideLeft, top: slideTop, width: SLIDE_W, height: SLIDE_H, overflow: 'hidden' }}>
                  {previewSlide && <SlidePreview slide={previewSlide} scale={SCALE} totalSlides={slides.length} />}
                </div>
                {showGuide && (
                  <div style={{
                    position: 'absolute', left: slideLeft, top: slideTop, width: SLIDE_W, height: SLIDE_H,
                    border: '1px dashed rgba(255,255,255,0.35)', pointerEvents: 'none', zIndex: 5,
                  }} />
                )}
              </>
            )}

            {/* TikTok UI overlay */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 13, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                <span style={{ color: WHITE, fontSize: 13, fontWeight: 700, textShadow: '0 1px 5px rgba(0,0,0,0.9)' }}>For You</span>
              </div>
              <div style={{ position: 'absolute', right: Math.round(PHONE_W * 0.02), bottom: Math.round(PHONE_H * 0.14), display: 'flex', flexDirection: 'column', gap: Math.round(PHONE_H * 0.028), alignItems: 'center' }}>
                {[{ icon: '❤️', count: '24K' }, { icon: '💬', count: '312' }, { icon: '↗️', count: 'Share' }].map((item, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ fontSize: 22, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))' }}>{item.icon}</div>
                    <span style={{ color: WHITE, fontSize: 10, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{item.count}</span>
                  </div>
                ))}
              </div>
              <div style={{ position: 'absolute', bottom: Math.round(PHONE_H * 0.022), left: Math.round(PHONE_W * 0.028), right: Math.round(PHONE_W * 0.14) }}>
                <div style={{ color: WHITE, fontSize: 12, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.9)', marginBottom: 2 }}>{handle}</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, textShadow: '0 1px 3px rgba(0,0,0,0.9)', lineHeight: 1.4, marginBottom: 4 }}>
                  {(slide?.headline || '').slice(0, 55)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10 }}>🎵</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9 }}>Original Sound - {username}</span>
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
