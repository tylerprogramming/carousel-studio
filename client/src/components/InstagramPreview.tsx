import { useRef } from 'react'
import { Slide } from '../types'
import SlidePreview from './SlidePreview'

interface Props {
  slides: Slide[]
  activeIndex: number
  onIndexChange: (i: number) => void
}

const PHONE_W    = 390
const SLIDE_SCALE = PHONE_W / 1080

export default function InstagramPreview({ slides, activeIndex, onIndexChange }: Props) {
  const dragRef = useRef<{ startX: number; dragging: boolean }>({ startX: 0, dragging: false })
  const slideH  = Math.round(PHONE_W * 1350 / 1080)
  const slide   = slides[activeIndex]

  function prev() { if (activeIndex > 0) onIndexChange(activeIndex - 1) }
  function next() { if (activeIndex < slides.length - 1) onIndexChange(activeIndex + 1) }

  function onMouseDown(e: React.MouseEvent) { dragRef.current = { startX: e.clientX, dragging: true } }
  function onMouseUp(e: React.MouseEvent) {
    if (!dragRef.current.dragging) return
    const dx = e.clientX - dragRef.current.startX
    dragRef.current.dragging = false
    if (dx < -40) next()
    else if (dx > 40) prev()
  }

  if (!slide) return null

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', overflowY: 'auto', padding: '24px 0',
      background: '#f4f4f5',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
        Preview
      </div>

      {/* Phone */}
      <div style={{
        width: PHONE_W + 26,
        background: '#1c1c1e',
        borderRadius: 52,
        padding: '12px 13px',
        boxShadow: '0 0 0 1.5px #333, 0 24px 60px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}>
        {/* Dynamic island */}
        <div style={{ width: 118, height: 32, background: '#000', borderRadius: 20, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1c1c1e', border: '2px solid #333' }} />
          <div style={{ width: 32, height: 10, borderRadius: 5, background: '#111' }} />
        </div>

        {/* Screen */}
        <div style={{ background: '#fff', borderRadius: 36, overflow: 'hidden' }}>

          {/* Status bar */}
          <div style={{ background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 22px 6px', fontFamily: 'system-ui', fontWeight: 600, fontSize: 13, color: '#000' }}>
            <span>6:20</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <svg width="16" height="12" viewBox="0 0 16 12"><rect x="0" y="3" width="3" height="9" rx="1" fill="#000"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill="#000"/><rect x="9" y="0" width="3" height="12" rx="1" fill="#000"/><rect x="13.5" y="0" width="2.5" height="12" rx="1" fill="#000" opacity="0.25"/></svg>
              <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5C11 2.5 13.5 4 15 6.3L13.5 7.6C12.3 5.7 10.3 4.5 8 4.5S3.7 5.7 2.5 7.6L1 6.3C2.5 4 5 2.5 8 2.5Z" fill="#000"/><path d="M8 5.5C10 5.5 11.7 6.5 12.8 8L11.3 9.3C10.5 8.2 9.3 7.5 8 7.5S5.5 8.2 4.7 9.3L3.2 8C4.3 6.5 6 5.5 8 5.5Z" fill="#000"/><circle cx="8" cy="11" r="1.5" fill="#000"/></svg>
              <div style={{ width: 26, height: 13, border: '1.5px solid #000', borderRadius: 3.5, display: 'flex', alignItems: 'center', padding: '1.5px 2px', gap: 1 }}>
                <div style={{ width: '72%', height: '100%', background: '#000', borderRadius: 1.5 }} />
                <div style={{ width: 2, height: 7, background: '#000', borderRadius: 1, marginLeft: 1 }} />
              </div>
            </div>
          </div>

          {/* IG header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 8px', borderBottom: '0.5px solid #efefef' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#000', letterSpacing: '-0.5px' }}>Instagram</span>
            <div style={{ display: 'flex', gap: 16 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2.982c2.937 0 3.285.011 4.445.064 3.066.14 4.492 1.589 4.632 4.632.053 1.16.064 1.508.064 4.445s-.011 3.285-.064 4.445c-.14 3.04-1.562 4.492-4.632 4.632-1.16.053-1.506.064-4.445.064-2.937 0-3.285-.011-4.445-.064-3.066-.14-4.492-1.596-4.632-4.632C2.993 15.285 2.982 14.937 2.982 12s.011-3.285.064-4.445c.14-3.04 1.562-4.492 4.632-4.632 1.16-.053 1.508-.064 4.445-.064zm0-1.982C9.013 1 8.638 1.014 7.465 1.067 3.495 1.254 1.254 3.492 1.067 7.465 1.014 8.638 1 9.013 1 12c0 2.987.014 3.362.067 4.535.187 3.97 2.425 6.211 6.398 6.398C8.638 22.986 9.013 23 12 23c2.987 0 3.362-.014 4.535-.067 3.967-.187 6.211-2.423 6.398-6.398C22.986 15.362 23 14.987 23 12c0-2.987-.014-3.362-.067-4.535C22.748 3.498 20.506 1.254 16.535 1.067 15.362 1.014 14.987 1 12 1zm0 5.838a5.162 5.162 0 100 10.324 5.162 5.162 0 000-10.324zM12 15a3 3 0 110-6 3 3 0 010 6zm5.338-9.87a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z" fill="#000"/></svg>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>

          {/* Stories */}
          <div style={{ display: 'flex', gap: 10, padding: '10px 12px', borderBottom: '0.5px solid #efefef', overflow: 'hidden' }}>
            {['You', 'ai_hacks', 'builders', 'devtools'].map((name, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <div style={{
                  width: 58, height: 58, borderRadius: '50%',
                  background: i === 0 ? '#f4f4f5' : 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
                  padding: i === 0 ? 0 : 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: i===0?58:51, height: i===0?58:51, borderRadius: '50%', background: ['#f4f4f5','#18181b','#e07355','#5BA4CF'][i], border: i===0?'1px solid #ddd':'2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i === 0 && <span style={{ fontSize: 20, color: '#a1a1aa' }}>+</span>}
                  </div>
                </div>
                <span style={{ fontSize: 9.5, color: '#000', fontFamily: 'system-ui', maxWidth: 58, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              </div>
            ))}
          </div>

          {/* Post header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 9 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#18181b', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#f5f0eb', fontSize: 13, fontWeight: 700 }}>T</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#000' }}>tylerreed</div>
              <div style={{ fontSize: 10.5, color: '#888' }}>Sponsored</div>
            </div>
            <button style={{ background: 'none', border: '1px solid #0095f6', color: '#0095f6', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Follow</button>
            <span style={{ fontSize: 18, color: '#000', cursor: 'pointer' }}>···</span>
          </div>

          {/* Carousel slides */}
          <div
            style={{ width: PHONE_W, height: slideH, overflow: 'hidden', cursor: 'grab', userSelect: 'none', position: 'relative' }}
            onMouseDown={onMouseDown} onMouseUp={onMouseUp}
          >
            <div style={{ display: 'flex', width: PHONE_W * slides.length, transform: `translateX(-${activeIndex * PHONE_W}px)`, transition: 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)' }}>
              {slides.map((sl) => (
                <div key={sl.id} style={{ width: PHONE_W, flexShrink: 0, overflow: 'hidden' }}>
                  <SlidePreview slide={sl} scale={SLIDE_SCALE} totalSlides={slides.length} />
                </div>
              ))}
            </div>
            {/* Counter */}
            <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: 10, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
              {activeIndex + 1}/{slides.length}
            </div>
          </div>

          {/* Action row */}
          <div style={{ padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M16.792 3.904A4.989 4.989 0 0121.5 9.122c0 3.517-3.559 7.399-8.397 10.903a.75.75 0 01-.904 0C7.059 16.52 3.5 12.638 3.5 9.122a4.989 4.989 0 014.708-5.218 4.21 4.21 0 013.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.76a4.21 4.21 0 013.679-1.944z" stroke="#000" strokeWidth="1.5"/></svg>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20.656 17.008a9.993 9.993 0 10-3.59 3.615L22 22z" stroke="#000" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polygon points="20 3 4 3 4 22 12 18 20 22 20 3" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>

          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, padding: '3px 0 6px' }}>
            {slides.map((_, i) => (
              <button key={i} onClick={() => onIndexChange(i)} style={{
                width: i === activeIndex ? 18 : 6, height: 6, borderRadius: 3,
                background: i === activeIndex ? '#0095f6' : '#ddd',
                border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.25s',
              }} />
            ))}
          </div>

          {/* Likes + caption */}
          <div style={{ padding: '2px 14px 14px', fontFamily: 'system-ui' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#000' }}>1,247 likes</div>
            <div style={{ fontSize: 12.5, color: '#000', marginTop: 2 }}>
              <span style={{ fontWeight: 600 }}>tylerreed</span>{' '}
              <span style={{ color: '#555' }}>Swipe through all {slides.length} slides →</span>
            </div>
          </div>
        </div>

        {/* Home indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <div style={{ width: 110, height: 5, background: '#555', borderRadius: 3 }} />
        </div>
      </div>

      {/* Nav arrows */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
        {[
          { fn: prev, icon: '←', disabled: activeIndex === 0 },
          { fn: next, icon: '→', disabled: activeIndex === slides.length - 1 },
        ].map(({ fn, icon, disabled }) => (
          <button key={icon} onClick={fn} disabled={disabled} style={{
            width: 38, height: 38, borderRadius: '50%', border: '1px solid #e4e4e7',
            background: disabled ? '#f9f9f9' : '#fff', color: disabled ? '#d4d4d8' : '#18181b',
            cursor: disabled ? 'default' : 'pointer', fontSize: 16, transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: disabled ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>{icon}</button>
        ))}
        <span style={{ fontSize: 12, color: '#a1a1aa' }}>
          {activeIndex + 1} of {slides.length}
        </span>
      </div>
    </div>
  )
}
