import { memo } from 'react'
import { Slide } from '../types'
import { useSettings } from '../hooks/useSettings'

interface SlidePreviewProps {
  slide: Slide
  scale?: number
  totalSlides?: number
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }
}
function hexToRgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
function luminance({ r, g, b }: { r:number;g:number;b:number }) { return 0.299*r + 0.587*g + 0.114*b }
function blend(fg: string, bg: string, f: number) {
  const a = hexToRgb(fg), b2 = hexToRgb(bg)
  return `rgb(${Math.round(a.r*f+b2.r*(1-f))},${Math.round(a.g*f+b2.g*(1-f))},${Math.round(a.b*f+b2.b*(1-f))})`
}

/**
 * Terminal variant.
 *
 * Dark, mono, with the detail carried by a terminal window rather than a body
 * paragraph. Mirrored in generate_slide.py — change both together.
 */
function TerminalSlide({ slide, scale, totalSlides }: Required<SlidePreviewProps>) {
  const { handle, username } = useSettings()
  const ts = slide.textScale ?? 1
  const s = (px: number) => Math.round(px * scale)
  const sf = (px: number) => Math.round(px * scale * ts)

  const BG = slide.bgColor || '#12141A'
  const FG = slide.textColor || '#EEECE8'
  const AC = slide.accentColor || '#E07355'
  const DIM = 'rgba(238,236,232,0.45)'
  const MONO = "'Menlo','SFMono-Regular',ui-monospace,monospace"

  const W = s(1080), H = s(1350), PAD = s(84)
  const lines = slide.terminalLines ?? []

  return (
    <div style={{
      width: W, height: H, position: 'relative', overflow: 'hidden', flexShrink: 0,
      background: BG, fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Moving background, so the editor shows what the mp4 export will do. */}
      {slide.backgroundVideo && (
        <video
          src={slide.backgroundVideo}
          autoPlay loop muted playsInline
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover',
            objectPosition: `${50 + (slide.bgPanX ?? 0) / 2}% ${50 + (slide.bgPanY ?? 0) / 2}%`,
          }}
        />
      )}

      {/* Optional photo behind the chrome. Mirrored in generate_slide.py. */}
      {slide.backgroundImage && !slide.backgroundVideo && (
        <img
          src={slide.backgroundImage}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover',
            objectPosition: `${50 + (slide.bgPanX ?? 0) / 2}% ${50 + (slide.bgPanY ?? 0) / 2}%`,
          }}
        />
      )}

      {/* Bottom fade to the slide's own background colour. The squared stops
          match the falloff Pillow draws, so preview and export agree. */}
      {(slide.bottomFade ?? 0) > 0 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: `${(slide.bottomFade ?? 0) * 100}%`,
          background: `linear-gradient(to bottom, ${hexToRgba(BG, 0)} 0%, ${hexToRgba(BG, 0.25)} 50%, ${hexToRgba(BG, 0.56)} 75%, ${BG} 100%)`,
        }} />
      )}

      {/* top rail */}
      <div style={{ position: 'absolute', top: s(74), left: PAD, right: PAD, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: MONO, fontSize: s(26), color: DIM, letterSpacing: '0.08em' }}>
          {username}
        </span>
        <span style={{ fontFamily: MONO, fontSize: s(26), color: DIM, letterSpacing: '0.08em' }}>
          {slide.type === 'cover' ? 'v1.0' : `${String(slide.slideNumber).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`}
        </span>
      </div>

      {/* headline */}
      <div style={{ position: 'absolute', top: s(200), left: PAD, right: PAD }}>
        {slide.stepNumber != null && slide.type === 'content' && (
          <div style={{
            display: 'inline-block', background: AC, color: BG,
            fontSize: sf(48), fontWeight: 900, lineHeight: 1,
            padding: `${s(14)}px ${s(24)}px`, borderRadius: 0, marginBottom: s(28),
          }}>{slide.stepNumber}</div>
        )}
        {slide.headline && (
          <div style={{
            fontSize: sf(slide.type === 'cover' ? 118 : 108), fontWeight: 800,
            lineHeight: 1.06, color: FG, letterSpacing: '-0.02em', marginBottom: s(20),
          }}>{slide.headline}</div>
        )}
        {slide.emphasisLine && (
          slide.type === 'cover' ? (
            <span style={{
              // `inline` + cloned decoration so a long line wraps into stacked
              // pills rather than overflowing the slide edge
              display: 'inline', background: AC, color: BG,
              // lineHeight matches the pill height so wrapped lines stack flush
              // and read as one highlight, mirroring generate_slide.py
              fontSize: sf(50), fontWeight: 700, lineHeight: 1.66,
              padding: `${s(10)}px ${s(18)}px`, borderRadius: 0,
              boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
            } as React.CSSProperties}>{slide.emphasisLine}</span>
          ) : (
            <div style={{ fontSize: sf(44), fontWeight: 600, color: AC }}>{slide.emphasisLine}</div>
          )
        )}
      </div>

      {/* terminal window */}
      {lines.length > 0 && (
        <div style={{
          position: 'absolute', left: PAD, right: PAD, top: s(700),
          background: '#0B0D12', borderRadius: s(16), overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{
            height: s(62), background: '#23272F', display: 'flex', alignItems: 'center',
            paddingLeft: s(24), gap: s(10),
          }}>
            {['#FF5F56', '#FFBD2E', '#27C93F'].map((c) => (
              <span key={c} style={{ width: s(15), height: s(15), borderRadius: '50%', background: c }} />
            ))}
            <span style={{ fontFamily: MONO, fontSize: s(24), color: DIM, marginLeft: s(20) }}>
              {slide.terminalTitle ?? 'claude'}
            </span>
          </div>
          <div style={{ padding: `${s(26)}px ${s(30)}px` }}>
            {lines.map((ln, i) => {
              // '>' is the Claude Code prompt; '$' is a shell
              // '>' is the Claude Code prompt, '$' a shell. Mirrored in generate_slide.py.
              const isCmd = ln.startsWith('$') || ln.startsWith('>')
              const isOk = ln.trimStart().startsWith('✓')
              return (
                <div key={i} style={{
                  fontFamily: MONO, fontSize: sf(29), lineHeight: 1.9,
                  color: isCmd ? FG : isOk ? '#6EDC8C' : DIM,
                  whiteSpace: 'pre-wrap',
                }}>{ln}</div>
              )
            })}
          </div>
        </div>
      )}

      {/* Body copy. Sits under the terminal window when there is one. */}
      {slide.bodyText && (
        <div style={{
          position: 'absolute', left: PAD, right: PAD,
          // With a photo behind, 720 lands the copy on the brightest part of
          // the frame. Drop it into the faded zone above the footer instead.
          ...(lines.length > 0
            ? { top: s(700) + s(62 + 52 + Math.round(29 * 1.9) * lines.length) + s(46) }
            : slide.backgroundImage ? { bottom: s(150) } : { top: s(720) }),
          fontFamily: MONO, fontSize: sf(32), lineHeight: 1.65,
          color: slide.bodyTextColor || FG,
        }}>{slide.bodyText}</div>
      )}

      {/* footer */}
      <div style={{ position: 'absolute', bottom: s(64), left: PAD, right: PAD, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: MONO, fontSize: s(26), color: DIM }}>{handle}</span>
        {slide.slideNumber < totalSlides && (
          <span style={{ fontFamily: MONO, fontSize: s(26), color: AC }}>swipe →</span>
        )}
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: s(8), background: AC }} />
    </div>
  )
}

function SlidePreview({ slide, scale = 1, totalSlides = 7 }: SlidePreviewProps) {
  if (slide.variant === 'terminal') {
    return <TerminalSlide slide={slide} scale={scale} totalSlides={totalSlides} />
  }

  const ts    = slide.textScale ?? 1
  const s     = (px: number) => Math.round(px * scale)
  const sf    = (px: number) => Math.round(px * scale * ts)   // font-size scaled
  const bg    = hexToRgb(slide.bgColor)
  const isDark = luminance(bg) < 128
  const counterColor  = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)'
  const bodyMuted     = slide.backgroundImage
    ? (slide.overlayColor === '#ffffff' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.75)')
    : blend(slide.textColor, slide.bgColor, 0.68)

  const overlayColor   = slide.overlayColor   ?? '#000000'
  const overlayOpacity = slide.overlayOpacity ?? 0.45

  const W = s(1080), H = s(1350), PAD = s(80)

  const insetH = slide.insetImageUrl ? Math.round(H * (slide.insetHeightPct ?? 38) / 100) : 0
  const insetPos = slide.insetPosition ?? 'bottom'
  const vo = slide.insetVerticalOffset ?? 0
  // Bottom inset sits above the footer row (footer: bottom s(26), height s(44) → top at s(70)). Add 8px gap.
  const insetBottomEdge = s(78 + vo)
  const insetTopEdge = s(60 + vo)
  const contentBottom = insetPos === 'bottom' && insetH > 0 ? insetBottomEdge + insetH + s(16) : s(18)
  const contentTop = insetPos === 'top' && insetH > 0 ? insetTopEdge + insetH + s(16) : s(130)

  return (
    <div style={{
      width: W, height: H, position: 'relative', overflow: 'hidden', flexShrink: 0,
      background: (slide.backgroundImage || slide.backgroundVideo) ? '#111' : slide.bgColor,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Background image */}
      {slide.backgroundImage && !slide.backgroundVideo && (
        <>
          <img src={slide.backgroundImage} alt="" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: `${50 + (slide.bgPanX ?? 0) / 2}% ${50 + (slide.bgPanY ?? 0) / 2}%`,
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: overlayColor === '#ffffff'
              ? `rgba(255,255,255,${overlayOpacity})`
              : `rgba(0,0,0,${overlayOpacity})`,
          }} />
        </>
      )}

      {/* Background video */}
      {slide.backgroundVideo && (
        <>
          <video src={slide.backgroundVideo} autoPlay loop muted playsInline style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: `${50 + (slide.bgPanX ?? 0) / 2}% ${50 + (slide.bgPanY ?? 0) / 2}%`,
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: overlayColor === '#ffffff'
              ? `rgba(255,255,255,${overlayOpacity})`
              : `rgba(0,0,0,${overlayOpacity})`,
          }} />
        </>
      )}

      {/* Inset image/video panel */}
      {slide.insetImageUrl && (() => {
        const borderColor = slide.insetBorderColor ?? '#FFFFFF'
        const borderWidth = slide.insetBorderWidth ?? 4
        const pad = slide.insetPadding ?? 0
        const zoom = Math.max(1, slide.insetZoom ?? 1)
        const panX = slide.insetPanX ?? 0
        const panY = slide.insetPanY ?? 0
        const pos = insetPos

        const style: React.CSSProperties = {
          position: 'absolute',
          left: s(pad),
          width: W - s(pad) * 2,
          height: insetH,
          border: `${Math.round(borderWidth * scale)}px solid ${borderColor}`,
          overflow: 'hidden',
          zIndex: 3,
          ...(pos === 'bottom' ? { bottom: insetBottomEdge } : { top: insetTopEdge }),
        }

        // At zoom=1: cover fills box, object-position pans the crop window (no distortion, no bars)
        // At zoom>1: scale+translate for finer zoom-in control
        const mediaStyle: React.CSSProperties = zoom <= 1 ? {
          width: '100%', height: '100%', objectFit: 'cover',
          objectPosition: `${50 + panX / 2}% ${50 + panY / 2}%`,
        } : {
          width: '100%', height: '100%', objectFit: 'cover',
          transform: `scale(${zoom}) translate(${panX / 2}%, ${panY / 2}%)`,
          transformOrigin: 'center center',
        }

        const isVideo = slide.insetImageUrl.endsWith('.mp4') || slide.insetImageUrl.endsWith('.webm')

        return (
          <div style={style}>
            {isVideo
              ? <video src={slide.insetImageUrl} autoPlay loop muted playsInline style={mediaStyle} />
              : <img src={slide.insetImageUrl} alt="" style={mediaStyle} />
            }
          </div>
        )
      })()}

      {/* Corner TL accent */}
      <div style={{ position:'absolute', top:0, left:0, width:s(14), height:s(88), background:slide.accentColor, zIndex:2 }} />
      <div style={{ position:'absolute', top:0, left:0, width:s(88), height:s(14), background:slide.accentColor, zIndex:2 }} />

      {/* Counter TR */}
      <div style={{
        position:'absolute', top:s(48), right:PAD, fontSize:s(28), fontWeight:500,
        color: slide.backgroundImage ? 'rgba(255,255,255,0.5)' : counterColor, zIndex:2,
        letterSpacing:'0.04em',
      }}>
        {slide.slideNumber} / {totalSlides}
      </div>

      {/* Save for later / Swipe row — hidden on last slide */}
      {slide.slideNumber < totalSlides && <div style={{
        position:'absolute', bottom: s(26), left:0, right:0, height:s(44), zIndex:4,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        paddingLeft:s(90), paddingRight:s(90),
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:s(8), color: slide.footerColor ?? '#FFFFFF', fontSize:s(26), fontWeight:600, letterSpacing:'0.06em', opacity:0.88 }}>
          <svg width={s(18)} height={s(24)} viewBox="0 0 18 24" fill={slide.footerColor ?? '#FFFFFF'} style={{ opacity:0.75, flexShrink:0 }}>
            <path d="M2 0 H16 A2 2 0 0 1 18 2 V24 L9 18 L0 24 V2 A2 2 0 0 1 2 0 Z" />
          </svg>
          SAVE FOR LATER
        </div>
        <div style={{ color: slide.footerColor ?? '#FFFFFF', fontSize:s(26), fontWeight:700, letterSpacing:'0.1em', opacity:0.88 }}>
          SWIPE &gt;
        </div>
      </div>}

      {/* Bottom accent */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:s(18), background:slide.accentColor, zIndex:2 }} />

      {/* Content */}
      {slide.type === 'cover' && (
        <div style={{
          position:'absolute', top:0, bottom:contentBottom, left:PAD, right:PAD, zIndex:2,
          display:'flex', flexDirection:'column', justifyContent:'center', gap:s(20),
        }}>
          {slide.headline && <div style={{ fontSize:sf(72), fontWeight:900, lineHeight:1.1, color:slide.textColor, textTransform:'uppercase', letterSpacing:'-0.01em' }}>{slide.headline}</div>}
          {slide.emphasisLine && <div style={{ fontSize:sf(52), fontWeight:700, lineHeight:1.2, color:slide.accentColor }}>{slide.emphasisLine}</div>}
          {slide.bodyText && <div style={{ fontSize:sf(38), fontWeight:400, lineHeight:1.5, color:slide.bodyTextColor ?? bodyMuted }}>{slide.bodyText}</div>}
        </div>
      )}

      {slide.type === 'cta' && (
        <div style={{
          position:'absolute', top:0, bottom:contentBottom, left:PAD, right:PAD, zIndex:2,
          display:'flex', flexDirection:'column', justifyContent:'center', gap:s(24),
        }}>
          {slide.headline && <div style={{ fontSize:sf(72), fontWeight:900, lineHeight:1.1, color:slide.accentColor, textTransform:'uppercase' }}>{slide.headline}</div>}
          {slide.emphasisLine && <div style={{ fontSize:sf(52), fontWeight:700, lineHeight:1.2, color:slide.textColor }}>{slide.emphasisLine}</div>}
          {slide.bodyText && <div style={{ fontSize:sf(38), fontWeight:400, lineHeight:1.5, color:slide.bodyTextColor ?? bodyMuted }}>{slide.bodyText}</div>}
        </div>
      )}

      {slide.type === 'content' && (
        <div style={{ position:'absolute', top:contentTop, bottom:contentBottom, left:PAD, right:PAD, zIndex:2, display:'flex', flexDirection:'column' }}>
          {slide.stepNumber != null && (
            <div style={{ fontSize:sf(130), fontWeight:900, lineHeight:1, color:slide.accentColor, marginBottom:s(28) }}>
              {slide.stepNumber}.
            </div>
          )}
          {slide.headline && <div style={{ fontSize:sf(70), fontWeight:900, lineHeight:1.1, color:slide.textColor, textTransform:'uppercase', marginBottom:s(16) }}>{slide.headline}</div>}
          {slide.emphasisLine && <div style={{ fontSize:sf(50), fontWeight:700, lineHeight:1.25, color:slide.accentColor, marginBottom:s(16) }}>{slide.emphasisLine}</div>}
          {slide.bodyText && <div style={{ fontSize:sf(38), fontWeight:400, lineHeight:1.55, color:slide.bodyTextColor ?? bodyMuted }}>{slide.bodyText}</div>}
        </div>
      )}
    </div>
  )
}

// Props are already identity-stable: updateSlide returns the same object for
// slides it did not touch, and scale/totalSlides are numbers.
export default memo(SlidePreview)
