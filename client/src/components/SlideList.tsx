import { useState } from 'react'
import { Slide } from '../types'
import SlidePreview, { slideAspect } from './SlidePreview'
import { CopyIcon, GripIcon } from './icons'
import { cn } from '../lib/utils'
import { Finding, sortFindings, worstLevel } from '../hooks/useSlideCheck'

interface Props {
  slides: Slide[]
  activeIndex: number
  onSelect: (i: number) => void
  onAdd: () => void
  onRemove: (i: number) => void
  onReorder: (from: number, to: number) => void
  onDuplicate: (i: number) => void
  /** Pre-export findings for a slide, marked on its thumbnail. */
  findingsFor?: (slide: Slide) => Finding[]
}

const THUMB_W = 148
// Height per slide, not a constant: a tall slide is 9:16 and a fixed 4:5 box
// cropped its bottom third, hiding the footer and half the terminal window.
const thumbH = (slide: Slide) => Math.round(THUMB_W * slideAspect(slide))

export default function SlideList({
  slides, activeIndex, onSelect, onAdd, onRemove, onReorder, onDuplicate, findingsFor,
}: Props) {
  // Drag-to-reorder. `dragIndex` is the slide being carried, `overIndex` the
  // drop target — kept separate so the placeholder can render before the drop.
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function handleDrop(to: number) {
    if (dragIndex !== null && dragIndex !== to) onReorder(dragIndex, to)
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="flex w-[184px] min-w-[184px] shrink-0 flex-col overflow-hidden border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3.5 pb-2.5 pt-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Slides
        </span>
        <span className="rounded-full bg-brand-light px-[7px] py-px text-[11px] font-semibold text-brand">
          {slides.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {slides.map((slide, i) => {
          const findings = findingsFor?.(slide) ?? []
          const level = worstLevel(findings)
          return (
            <div
              key={slide.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
              onDragOver={(e) => { e.preventDefault(); setOverIndex(i) }}
              onDrop={(e) => { e.preventDefault(); handleDrop(i) }}
              onClick={() => onSelect(i)}
              style={{ width: THUMB_W, height: thumbH(slide) }}
              className={cn(
                'group relative shrink-0 cursor-pointer overflow-hidden rounded-[9px] border-2 transition-all',
                i === activeIndex
                  ? 'border-brand shadow-[0_0_0_3px_var(--blue-light),0_2px_8px_var(--blue-dim)]'
                  : 'border-border shadow-card hover:border-brand/40',
                dragIndex === i && 'opacity-40',
                overIndex === i && dragIndex !== null && dragIndex !== i && 'border-brand border-dashed',
              )}
            >
              <SlidePreview slide={slide} scale={THUMB_W / 1080} totalSlides={slides.length} />

              {/* Drag handle — visible on hover so the thumbnail stays clean */}
              <div className="absolute left-1 top-1 flex h-[18px] w-[18px] cursor-grab items-center justify-center rounded bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing">
                <GripIcon />
              </div>

              <div
                className={cn(
                  'absolute bottom-1 right-1 rounded px-1.5 py-px text-[9px] font-bold text-white transition-colors',
                  i === activeIndex ? 'bg-brand' : 'bg-black/45',
                )}
              >
                {i + 1}
              </div>

              {/* Bottom left, clear of the number badge and of the hover
                  controls. The white ring keeps it visible on a slide of any
                  colour. Hovering names the findings; the Inspector lists them. */}
              {level && (
                <div
                  title={sortFindings(findings).map((f) => f.message).join('\n\n')}
                  className={cn(
                    'absolute bottom-[5px] left-[5px] h-[10px] w-[10px] rounded-full ring-2 ring-white/85',
                    level === 'error' ? 'bg-destructive' : 'bg-amber-500',
                  )}
                />
              )}

              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  title="Duplicate slide"
                  onClick={(e) => { e.stopPropagation(); onDuplicate(i) }}
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-none bg-black/55 text-white hover:bg-black/75"
                >
                  <CopyIcon size={10} />
                </button>
                {slides.length > 1 && (
                  <button
                    title="Delete slide"
                    onClick={(e) => { e.stopPropagation(); onRemove(i) }}
                    className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-none bg-destructive/85 text-[11px] leading-none text-white hover:bg-destructive"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-border p-2.5">
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center rounded-[9px] border-[1.5px] border-dashed border-border bg-secondary py-2 text-xl text-muted-foreground transition-all hover:border-brand hover:bg-brand-light hover:text-brand"
        >
          +
        </button>
      </div>
    </div>
  )
}
