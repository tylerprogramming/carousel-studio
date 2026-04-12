import { Slide } from '../types'

interface SlidePreviewProps {
  slide: Slide
  scale?: number
  totalSlides?: number
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }
}
function luminance({ r, g, b }: { r:number;g:number;b:number }) { return 0.299*r + 0.587*g + 0.114*b }
function blend(fg: string, bg: string, f: number) {
  const a = hexToRgb(fg), b2 = hexToRgb(bg)
  return `rgb(${Math.round(a.r*f+b2.r*(1-f))},${Math.round(a.g*f+b2.g*(1-f))},${Math.round(a.b*f+b2.b*(1-f))})`
}

export default function SlidePreview({ slide, scale = 1, totalSlides = 7 }: SlidePreviewProps) {
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

  return (
    <div style={{
      width: W, height: H, position: 'relative', overflow: 'hidden', flexShrink: 0,
      background: slide.backgroundImage ? '#111' : slide.bgColor,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Background image */}
      {slide.backgroundImage && (
        <>
          <img src={slide.backgroundImage} alt="" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          }} />
          {/* Overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: overlayColor === '#ffffff'
              ? `rgba(255,255,255,${overlayOpacity})`
              : `rgba(0,0,0,${overlayOpacity})`,
          }} />
        </>
      )}

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
        position:'absolute', bottom:s(52), left:0, right:0, height:s(44), zIndex:3,
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
          position:'absolute', top:0, bottom:s(18), left:PAD, right:PAD, zIndex:2,
          display:'flex', flexDirection:'column', justifyContent:'center', gap:s(20),
        }}>
          {slide.headline && <div style={{ fontSize:sf(72), fontWeight:900, lineHeight:1.1, color:slide.textColor, textTransform:'uppercase', letterSpacing:'-0.01em' }}>{slide.headline}</div>}
          {slide.emphasisLine && <div style={{ fontSize:sf(52), fontWeight:700, lineHeight:1.2, color:slide.accentColor }}>{slide.emphasisLine}</div>}
          {slide.bodyText && <div style={{ fontSize:sf(38), fontWeight:400, lineHeight:1.5, color:bodyMuted }}>{slide.bodyText}</div>}
        </div>
      )}

      {slide.type === 'cta' && (
        <div style={{
          position:'absolute', top:0, bottom:s(18), left:PAD, right:PAD, zIndex:2,
          display:'flex', flexDirection:'column', justifyContent:'center', gap:s(24),
        }}>
          {slide.headline && <div style={{ fontSize:sf(72), fontWeight:900, lineHeight:1.1, color:slide.accentColor, textTransform:'uppercase' }}>{slide.headline}</div>}
          {slide.emphasisLine && <div style={{ fontSize:sf(52), fontWeight:700, lineHeight:1.2, color:slide.textColor }}>{slide.emphasisLine}</div>}
          {slide.bodyText && <div style={{ fontSize:sf(38), fontWeight:400, lineHeight:1.5, color:bodyMuted }}>{slide.bodyText}</div>}
        </div>
      )}

      {slide.type === 'content' && (
        <div style={{ position:'absolute', top:s(130), bottom:s(18), left:PAD, right:PAD, zIndex:2, display:'flex', flexDirection:'column' }}>
          {slide.stepNumber != null && (
            <div style={{ fontSize:sf(130), fontWeight:900, lineHeight:1, color:slide.accentColor, marginBottom:s(28) }}>
              {slide.stepNumber}.
            </div>
          )}
          {slide.headline && <div style={{ fontSize:sf(70), fontWeight:900, lineHeight:1.1, color:slide.textColor, textTransform:'uppercase', marginBottom:s(16) }}>{slide.headline}</div>}
          {slide.emphasisLine && <div style={{ fontSize:sf(50), fontWeight:700, lineHeight:1.25, color:slide.accentColor, marginBottom:s(16) }}>{slide.emphasisLine}</div>}
          {slide.bodyText && <div style={{ fontSize:sf(38), fontWeight:400, lineHeight:1.55, color:bodyMuted }}>{slide.bodyText}</div>}
        </div>
      )}
    </div>
  )
}
