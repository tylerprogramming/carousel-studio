import { Slide } from '../types'
import SlidePreview from './SlidePreview'

const BLUE      = '#5B6CF2'
const BLUE_LIGHT = '#EEF0FD'
const TEXT      = '#1C1E2E'
const MUTED     = '#8890A4'
const BORDER    = '#E5EAF5'
const BG        = '#F0F4FF'

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
      width: 184, minWidth: 184, flexShrink: 0,
      background: '#FFFFFF',
      borderRight: `1px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '13px 14px 10px',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: MUTED,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Slides
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          background: BLUE_LIGHT, color: BLUE,
          borderRadius: 20, padding: '1px 7px',
        }}>
          {slides.length}
        </span>
      </div>

      {/* Thumbnails */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 10px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            onClick={() => onSelect(i)}
            style={{
              borderRadius: 9, overflow: 'hidden', cursor: 'pointer', position: 'relative',
              border: `2px solid ${i === activeIndex ? BLUE : BORDER}`,
              transition: 'border-color 0.15s, box-shadow 0.15s',
              width: THUMB_W, height: THUMB_H, flexShrink: 0,
              boxShadow: i === activeIndex
                ? `0 0 0 3px ${BLUE_LIGHT}, 0 2px 8px rgba(91,108,242,0.15)`
                : '0 1px 3px rgba(30,40,100,0.06)',
            }}
            onMouseEnter={(e) => { if (i !== activeIndex) (e.currentTarget as HTMLElement).style.borderColor = '#C7CFFB' }}
            onMouseLeave={(e) => { if (i !== activeIndex) (e.currentTarget as HTMLElement).style.borderColor = BORDER }}
          >
            <SlidePreview slide={slide} scale={scale} totalSlides={slides.length} />

            {/* Slide number badge */}
            <div style={{
              position: 'absolute', bottom: 4, right: 4,
              background: i === activeIndex ? BLUE : 'rgba(0,0,0,0.45)',
              color: '#fff', borderRadius: 5, padding: '1px 6px',
              fontSize: 9, fontWeight: 700, transition: 'background 0.15s',
            }}>
              {i + 1}
            </div>

            {/* Remove button */}
            {slides.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(i) }}
                className="thumb-remove"
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'rgba(220,38,38,0.85)', border: 'none', color: '#fff',
                  cursor: 'pointer', fontSize: 11, lineHeight: 1, opacity: 0,
                  transition: 'opacity 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            )}
          </div>
        ))}
      </div>

      {/* Add button */}
      <div style={{ padding: '10px', borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={onAdd}
          style={{
            width: '100%', padding: '8px 0',
            background: BG, border: `1.5px dashed ${BORDER}`,
            borderRadius: 9, color: MUTED,
            cursor: 'pointer', fontSize: 20, transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = BLUE
            ;(e.currentTarget as HTMLElement).style.color = BLUE
            ;(e.currentTarget as HTMLElement).style.background = BLUE_LIGHT
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = BORDER
            ;(e.currentTarget as HTMLElement).style.color = MUTED
            ;(e.currentTarget as HTMLElement).style.background = BG
          }}
        >+</button>
      </div>

      <style>{`.thumb-remove { opacity: 0 !important; } div:hover > .thumb-remove { opacity: 1 !important; }`}</style>
    </div>
  )
}
