import { useRef } from 'react'
import { Slide } from '../types'
import SlidePreview from './SlidePreview'

interface Props {
  slides: Slide[]
  activeIndex: number
  onIndexChange: (i: number) => void
  platform?: 'instagram' | 'linkedin' | 'tiktok'
}

const PHONE_W     = 390
const SLIDE_SCALE = PHONE_W / 1080
const SLIDE_H     = Math.round(PHONE_W * 1350 / 1080)
// TikTok: 9:16 aspect ratio phone screen height (matches Instagram phone's overall chrome height)
const TT_VIDEO_H  = Math.round(PHONE_W * 16 / 9)

// ── Shared phone shell ────────────────────────────────────────────────────────
function PhoneShell({ children, bg = '#fff' }: { children: React.ReactNode; bg?: string }) {
  return (
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
      <div style={{ background: bg, borderRadius: 36, overflow: 'hidden' }}>
        {children}
      </div>
      {/* Home indicator */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
        <div style={{ width: 110, height: 5, background: '#555', borderRadius: 3 }} />
      </div>
    </div>
  )
}

// ── Status bar ────────────────────────────────────────────────────────────────
function StatusBar({ dark = false }: { dark?: boolean }) {
  const c = dark ? '#fff' : '#000'
  return (
    <div style={{ background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 22px 6px', fontFamily: 'system-ui', fontWeight: 600, fontSize: 13, color: c }}>
      <span>6:20</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="16" height="12" viewBox="0 0 16 12"><rect x="0" y="3" width="3" height="9" rx="1" fill={c}/><rect x="4.5" y="2" width="3" height="10" rx="1" fill={c}/><rect x="9" y="0" width="3" height="12" rx="1" fill={c}/><rect x="13.5" y="0" width="2.5" height="12" rx="1" fill={c} opacity="0.25"/></svg>
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5C11 2.5 13.5 4 15 6.3L13.5 7.6C12.3 5.7 10.3 4.5 8 4.5S3.7 5.7 2.5 7.6L1 6.3C2.5 4 5 2.5 8 2.5Z" fill={c}/><path d="M8 5.5C10 5.5 11.7 6.5 12.8 8L11.3 9.3C10.5 8.2 9.3 7.5 8 7.5S5.5 8.2 4.7 9.3L3.2 8C4.3 6.5 6 5.5 8 5.5Z" fill={c}/><circle cx="8" cy="11" r="1.5" fill={c}/></svg>
        <div style={{ width: 26, height: 13, border: `1.5px solid ${c}`, borderRadius: 3.5, display: 'flex', alignItems: 'center', padding: '1.5px 2px', gap: 1 }}>
          <div style={{ width: '72%', height: '100%', background: c, borderRadius: 1.5 }} />
          <div style={{ width: 2, height: 7, background: c, borderRadius: 1, marginLeft: 1 }} />
        </div>
      </div>
    </div>
  )
}

// ── Carousel strip ─────────────────────────────────────────────────────────────
function CarouselStrip({ slides, activeIndex, onMouseDown, onMouseUp, width = PHONE_W, height = SLIDE_H }: {
  slides: Slide[]; activeIndex: number
  onMouseDown: (e: React.MouseEvent) => void
  onMouseUp: (e: React.MouseEvent) => void
  width?: number; height?: number
}) {
  const scale = width / 1080
  return (
    <div style={{ width, height, overflow: 'hidden', cursor: 'grab', userSelect: 'none', position: 'relative' }}
      onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
      <div style={{ display: 'flex', width: width * slides.length, transform: `translateX(-${activeIndex * width}px)`, transition: 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)' }}>
        {slides.map((sl) => (
          <div key={sl.id} style={{ width, flexShrink: 0, overflow: 'hidden' }}>
            <SlidePreview slide={sl} scale={scale} totalSlides={slides.length} />
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: 10, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
        {activeIndex + 1}/{slides.length}
      </div>
    </div>
  )
}

// ── Instagram preview ─────────────────────────────────────────────────────────
function InstagramPhone({ slides, activeIndex, onIndexChange }: Omit<Props, 'platform'>) {
  const dragRef = useRef<{ startX: number; dragging: boolean }>({ startX: 0, dragging: false })
  function onMouseDown(e: React.MouseEvent) { dragRef.current = { startX: e.clientX, dragging: true } }
  function onMouseUp(e: React.MouseEvent) {
    if (!dragRef.current.dragging) return
    const dx = e.clientX - dragRef.current.startX
    dragRef.current.dragging = false
    if (dx < -40 && activeIndex < slides.length - 1) onIndexChange(activeIndex + 1)
    else if (dx > 40 && activeIndex > 0) onIndexChange(activeIndex - 1)
  }

  return (
    <PhoneShell bg="#fff">
      <StatusBar />
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
            <div style={{ width: 58, height: 58, borderRadius: '50%', background: i === 0 ? '#f4f4f5' : 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', padding: i === 0 ? 0 : 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      {/* Carousel */}
      <CarouselStrip slides={slides} activeIndex={activeIndex} onMouseDown={onMouseDown} onMouseUp={onMouseUp} />
      {/* Actions */}
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
          <button key={i} onClick={() => onIndexChange(i)} style={{ width: i === activeIndex ? 18 : 6, height: 6, borderRadius: 3, background: i === activeIndex ? '#0095f6' : '#ddd', border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.25s' }} />
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
    </PhoneShell>
  )
}

// ── LinkedIn preview ───────────────────────────────────────────────────────────
function LinkedInPhone({ slides, activeIndex, onIndexChange }: Omit<Props, 'platform'>) {
  const dragRef = useRef<{ startX: number; dragging: boolean }>({ startX: 0, dragging: false })
  function onMouseDown(e: React.MouseEvent) { dragRef.current = { startX: e.clientX, dragging: true } }
  function onMouseUp(e: React.MouseEvent) {
    if (!dragRef.current.dragging) return
    const dx = e.clientX - dragRef.current.startX
    dragRef.current.dragging = false
    if (dx < -40 && activeIndex < slides.length - 1) onIndexChange(activeIndex + 1)
    else if (dx > 40 && activeIndex > 0) onIndexChange(activeIndex - 1)
  }

  return (
    <PhoneShell bg="#f3f2ef">
      <StatusBar />
      {/* LinkedIn header */}
      <div style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 8px', borderBottom: '0.5px solid #e0e0e0' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#0A66C2"/><path d="M6.5 9.5H4.5V19.5H6.5V9.5Z" fill="white"/><circle cx="5.5" cy="6.5" r="1.5" fill="white"/><path d="M19.5 13.5C19.5 11.3 18 9.5 15.5 9.5C14.2 9.5 13.1 10.1 12.5 11V9.5H10.5V19.5H12.5V14.5C12.5 12.8 13.6 11.5 15 11.5C16.4 11.5 17.5 12.3 17.5 14V19.5H19.5V13.5Z" fill="white"/></svg>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#666" strokeWidth="1.8"/><path d="M21 21l-4.35-4.35" stroke="#666" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#666" strokeWidth="1.8" strokeLinejoin="round"/></svg>
        </div>
      </div>
      {/* Feed post card */}
      <div style={{ background: '#fff', margin: '8px 0 4px', borderTop: '0.5px solid #e0e0e0', borderBottom: '0.5px solid #e0e0e0' }}>
        {/* Post author */}
        <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 12px 8px', gap: 9 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#18181b', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0A66C2' }}>
            <span style={{ color: '#f5f0eb', fontSize: 14, fontWeight: 700 }}>T</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#000' }}>Tyler Reed</div>
            <div style={{ fontSize: 10.5, color: '#666', lineHeight: 1.3 }}>AI Content Creator · 12,847 followers</div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>2h · <span style={{ color: '#666' }}>🌐</span></div>
          </div>
          <button style={{ background: 'none', border: '1px solid #0A66C2', color: '#0A66C2', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Follow</button>
        </div>
        {/* Carousel */}
        <CarouselStrip slides={slides} activeIndex={activeIndex} onMouseDown={onMouseDown} onMouseUp={onMouseUp} />
        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '6px 0 4px' }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => onIndexChange(i)} style={{ width: i === activeIndex ? 16 : 5, height: 5, borderRadius: 3, background: i === activeIndex ? '#0A66C2' : '#c9c9c9', border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.25s' }} />
          ))}
        </div>
        {/* Reactions */}
        <div style={{ padding: '4px 12px 6px', borderTop: '0.5px solid #e0e0e0' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
            <span>👍❤️💡</span> <span style={{ fontWeight: 500 }}>1,842 reactions</span> · <span>203 comments</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '0.5px solid #e0e0e0', paddingTop: 6 }}>
            {['Like', 'Comment', 'Repost', 'Send'].map((action) => (
              <button key={action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 10, fontWeight: 600, padding: '2px 4px' }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  {action === 'Like' && <path d="M6 9V17H3V9H6ZM6 9C6 9 7 7 9 5C11 3 12 3 12 5V7H16C17.1 7 18 7.9 18 9L17 15C16.7 16.2 15.6 17 14.4 17H8C6.9 17 6 16.1 6 15V9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>}
                  {action === 'Comment' && <path d="M17 11C17 13.8 14.3 16 11 16C9.9 16 8.8 15.7 7.9 15.2L3 17L4.8 12.9C4.3 12.1 4 11.1 4 10C4 7.2 6.7 5 10 5C13.3 5 17 7.2 17 10V11Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>}
                  {action === 'Repost' && <path d="M5 8L3 10L5 12M15 12L17 10L15 8M3 10H9M11 10H17M9 10V7C9 6.4 9.4 6 10 6H11C11.6 6 12 6.4 12 7V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>}
                  {action === 'Send' && <path d="M18 3L9 12M18 3L12 18L9 12L3 9L18 3Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>}
                </svg>
                {action}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PhoneShell>
  )
}

// ── TikTok preview ─────────────────────────────────────────────────────────────
function TikTokPhone({ slides, activeIndex, onIndexChange }: Omit<Props, 'platform'>) {
  const dragRef = useRef<{ startX: number; dragging: boolean }>({ startX: 0, dragging: false })
  function onMouseDown(e: React.MouseEvent) { dragRef.current = { startX: e.clientX, dragging: true } }
  function onMouseUp(e: React.MouseEvent) {
    if (!dragRef.current.dragging) return
    const dx = e.clientX - dragRef.current.startX
    dragRef.current.dragging = false
    if (dx < -40 && activeIndex < slides.length - 1) onIndexChange(activeIndex + 1)
    else if (dx > 40 && activeIndex > 0) onIndexChange(activeIndex - 1)
  }

  return (
    <PhoneShell bg="#000">
      {/* Full-screen video area: CSS scale fills 9:16 height, overflow clips sides */}
      <div style={{ position: 'relative', width: PHONE_W, height: TT_VIDEO_H, background: '#000', overflow: 'hidden' }}>
        {/* Scale the normal carousel strip up to fill the full height */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          transformOrigin: 'top center',
          transform: `scale(${TT_VIDEO_H / SLIDE_H})`,
        }}>
          <CarouselStrip slides={slides} activeIndex={activeIndex} onMouseDown={onMouseDown} onMouseUp={onMouseUp} />
        </div>

        {/* Status bar overlay — transparent over slide */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px 6px', fontFamily: 'system-ui', fontWeight: 600, fontSize: 12, color: '#fff' }}>
          <span>6:20</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <svg width="14" height="11" viewBox="0 0 16 12"><rect x="0" y="3" width="3" height="9" rx="1" fill="#fff"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill="#fff"/><rect x="9" y="0" width="3" height="12" rx="1" fill="#fff"/><rect x="13.5" y="0" width="2.5" height="12" rx="1" fill="#fff" opacity="0.4"/></svg>
            <svg width="14" height="11" viewBox="0 0 16 12"><path d="M8 2.5C11 2.5 13.5 4 15 6.3L13.5 7.6C12.3 5.7 10.3 4.5 8 4.5S3.7 5.7 2.5 7.6L1 6.3C2.5 4 5 2.5 8 2.5Z" fill="#fff"/><path d="M8 5.5C10 5.5 11.7 6.5 12.8 8L11.3 9.3C10.5 8.2 9.3 7.5 8 7.5S5.5 8.2 4.7 9.3L3.2 8C4.3 6.5 6 5.5 8 5.5Z" fill="#fff"/><circle cx="8" cy="11" r="1.5" fill="#fff"/></svg>
            <div style={{ width: 22, height: 11, border: '1.5px solid #fff', borderRadius: 3, display: 'flex', alignItems: 'center', padding: '1.5px 2px' }}>
              <div style={{ width: '70%', height: '100%', background: '#fff', borderRadius: 1 }} />
            </div>
          </div>
        </div>

        {/* Right action bar — overlaid, positioned from bottom of video area */}
        <div style={{ position: 'absolute', right: 8, bottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, zIndex: 20 }}>
          {/* Profile avatar */}
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#18181b', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#f5f0eb', fontSize: 13, fontWeight: 700 }}>T</span>
            </div>
            <div style={{ position: 'absolute', bottom: -9, left: '50%', transform: 'translateX(-50%)', width: 18, height: 18, borderRadius: '50%', background: '#FE2C55', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 15, lineHeight: 1, fontWeight: 400 }}>+</span>
            </div>
          </div>
          {/* Like */}
          <ActionBtn icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M16.792 3.904A4.989 4.989 0 0121.5 9.122c0 3.517-3.559 7.399-8.397 10.903a.75.75 0 01-.904 0C7.059 16.52 3.5 12.638 3.5 9.122a4.989 4.989 0 014.708-5.218 4.21 4.21 0 013.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.76a4.21 4.21 0 013.679-1.944z" fill="white"/></svg>} label="65K" />
          {/* Comment */}
          <ActionBtn icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M20.656 17.008a9.993 9.993 0 10-3.59 3.615L22 22z" fill="white"/></svg>} label="1,976" />
          {/* Bookmark */}
          <ActionBtn icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><polygon points="20 3 4 3 4 22 12 18 20 22 20 3" fill="white"/></svg>} label="70.2K" />
          {/* Share */}
          <ActionBtn icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" fill="white"/></svg>} label="15.6K" />
          {/* Music disc */}
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#222,#555)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#111', border: '2px solid rgba(255,255,255,0.5)' }} />
          </div>
        </div>

        {/* Bottom caption overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 60, padding: '30px 12px 12px', background: 'linear-gradient(transparent, rgba(0,0,0,0.55))', zIndex: 20 }}>
          <div style={{ fontFamily: 'system-ui', color: '#fff', fontSize: 12, fontWeight: 700, marginBottom: 2 }}>@tylerreed</div>
          <div style={{ fontFamily: 'system-ui', color: 'rgba(255,255,255,0.9)', fontSize: 11, lineHeight: 1.4 }}>
            Slide {activeIndex + 1} of {slides.length} — swipe to see more 👆
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M9 18V5l12-2v13M9 18C9 19.1 8.1 20 7 20s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM21 16c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"/></svg>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10.5, fontFamily: 'system-ui' }}>AI for Creators · Original sound</span>
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, zIndex: 21 }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => onIndexChange(i)} style={{ width: i === activeIndex ? 16 : 5, height: 4, borderRadius: 2, background: i === activeIndex ? '#FE2C55' : 'rgba(255,255,255,0.45)', border: 'none', padding: 0, cursor: 'pointer', transition: 'all 0.25s' }} />
          ))}
        </div>
      </div>

      {/* TikTok bottom nav */}
      <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 4px 5px', borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
        {[
          { label: 'Home', active: true, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z" fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round"/></svg> },
          { label: 'Search', active: false, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8"/><path d="M21 21l-4.35-4.35" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round"/></svg> },
          { label: '', active: false, icon: (
            <div style={{ width: 44, height: 28, borderRadius: 8, background: 'none', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '55%', background: '#25F4EE', borderRadius: '6px 0 0 6px' }} />
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '55%', background: '#FE2C55', borderRadius: '0 6px 6px 0' }} />
              <div style={{ position: 'relative', width: '68%', height: '100%', background: '#fff', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <span style={{ color: '#000', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>+</span>
              </div>
            </div>
          )},
          { label: 'Inbox', active: false, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v12H4zM4 4l8 8 8-8" stroke="rgba(255,255,255,0.55)" strokeWidth="1.7" strokeLinejoin="round"/></svg> },
          { label: 'Profile', active: false, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(255,255,255,0.55)" strokeWidth="1.7"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="rgba(255,255,255,0.55)" strokeWidth="1.7" strokeLinecap="round"/></svg> },
        ].map((item) => (
          <div key={item.label || 'plus'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', minWidth: 44 }}>
            {item.icon}
            {item.label && <span style={{ fontSize: 9, color: item.active ? '#fff' : 'rgba(255,255,255,0.55)', fontFamily: 'system-ui', fontWeight: 600 }}>{item.label}</span>}
          </div>
        ))}
      </div>
    </PhoneShell>
  )
}

function ActionBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {icon}
      <span style={{ color: '#fff', fontSize: 10, fontWeight: 600, fontFamily: 'system-ui' }}>{label}</span>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PlatformPreview({ slides, activeIndex, onIndexChange, platform = 'instagram' }: Props) {
  if (!slides[activeIndex]) return null

  const bgColor = platform === 'instagram' ? '#FFF3F0'   // warm Instagram coral tint
                : platform === 'linkedin'  ? '#F0F7FF'   // LinkedIn blue tint
                : '#F2F2F2'                               // TikTok: near-white with subtle black tint
  const label = platform === 'instagram' ? 'Instagram Preview' : platform === 'linkedin' ? 'LinkedIn Preview' : 'TikTok Preview'

  function prev() { if (activeIndex > 0) onIndexChange(activeIndex - 1) }
  function next() { if (activeIndex < slides.length - 1) onIndexChange(activeIndex + 1) }

  const arrowBtn = (onClick: () => void, dir: '←' | '→', side: 'left' | 'right') => (
    <button onClick={onClick} style={{
      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
      [side]: 8,
      width: 34, height: 34, borderRadius: '50%',
      border: '1.5px solid rgba(0,0,0,0.12)',
      background: 'rgba(255,255,255,0.92)',
      color: '#18181b', cursor: 'pointer', fontSize: 15,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'all 0.15s', zIndex: 10,
      backdropFilter: 'blur(4px)',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#fff' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)' }}
    >{dir}</button>
  )

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', overflowY: 'auto', padding: '20px 0',
      background: bgColor,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
        {label}
      </div>

      {/* Phone wrapped in relative div so arrows can overlay the sides */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {platform === 'instagram' && <InstagramPhone slides={slides} activeIndex={activeIndex} onIndexChange={onIndexChange} />}
        {platform === 'linkedin'  && <LinkedInPhone  slides={slides} activeIndex={activeIndex} onIndexChange={onIndexChange} />}
        {platform === 'tiktok'    && <TikTokPhone    slides={slides} activeIndex={activeIndex} onIndexChange={onIndexChange} />}

        {activeIndex > 0               && arrowBtn(prev, '←', 'left')}
        {activeIndex < slides.length-1 && arrowBtn(next, '→', 'right')}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>
        {activeIndex + 1} of {slides.length}
      </div>
    </div>
  )
}
