import { Slide } from '../types'
import SlidePreview from './SlidePreview'

interface Props {
  slides: Slide[]
  activeIndex: number
  onSelect: (i: number) => void
  onAdd: () => void
  onRemove: (i: number) => void
  onReorder: (from: number, to: number) => void
}

export default function SlideList({ slides, activeIndex, onSelect, onAdd, onRemove }: Props) {
  const THUMB_W = 148
  const THUMB_H = Math.round(THUMB_W * 1350 / 1080)
  const scale   = THUMB_W / 1080

  return (
    <div style={{
      width: 180, minWidth: 180, flexShrink: 0,
      background: '#ffffff', borderRight: '1px solid #e4e4e7',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #e4e4e7' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Slides
        </span>
      </div>

      {/* Thumbnails */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            onClick={() => onSelect(i)}
            style={{
              borderRadius: 7, overflow: 'hidden', cursor: 'pointer', position: 'relative',
              border: i === activeIndex ? '2px solid #e07355' : '2px solid #e4e4e7',
              transition: 'border-color 0.15s',
              width: THUMB_W, height: THUMB_H, flexShrink: 0,
            }}
          >
            <SlidePreview slide={slide} scale={scale} totalSlides={slides.length} />

            {/* Slide # badge */}
            <div style={{
              position: 'absolute', bottom: 4, right: 4,
              background: 'rgba(0,0,0,0.55)', color: '#fff',
              borderRadius: 6, padding: '1px 5px', fontSize: 9, fontWeight: 700,
            }}>
              {i + 1}
            </div>

            {/* Remove */}
            {slides.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(i) }}
                className="thumb-remove"
                style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
                  cursor: 'pointer', fontSize: 10, lineHeight: 1, opacity: 0, transition: 'opacity 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            )}
          </div>
        ))}
      </div>

      {/* Add button */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid #e4e4e7' }}>
        <button
          onClick={onAdd}
          style={{
            width: '100%', padding: '7px 0', background: '#f4f4f5',
            border: '1px dashed #d4d4d8', borderRadius: 7, color: '#a1a1aa',
            cursor: 'pointer', fontSize: 18, transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#e07355'; (e.currentTarget as HTMLElement).style.color = '#e07355' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#d4d4d8'; (e.currentTarget as HTMLElement).style.color = '#a1a1aa' }}
        >+</button>
      </div>

      <style>{`.thumb-remove { opacity: 0 !important; } div:hover > .thumb-remove { opacity: 1 !important; }`}</style>
    </div>
  )
}
