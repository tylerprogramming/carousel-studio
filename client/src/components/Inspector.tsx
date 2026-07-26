import { useState } from 'react'
import { Slide, CarouselCaptions, CarouselConfig } from '../types'
import SlideEditor from './SlideEditor'
import CaptionEditor from './CaptionEditor'
import BgImageCard, { BgImageCardProps } from './BgImageCard'
import { cn } from '../lib/utils'

/**
 * One panel, four tabs.
 *
 * The editor and the background generator used to be two side-by-side columns,
 * which cost ~630px of fixed width and left both half empty. They are the same
 * job — changing the current slide — so they share a panel now and the canvas
 * gets the space back. Nothing was removed; every control still exists.
 *
 * Caption is the odd one out: it edits the whole carousel rather than the
 * current slide. It lives here anyway because this is the panel you already
 * have open while writing the carousel.
 */

type Tab = 'content' | 'style' | 'image' | 'caption'

interface Props extends Omit<BgImageCardProps, 'slide' | 'allSlides'> {
  slide: Slide
  allSlides: Slide[]
  onChange: (updated: Slide) => void
  captions: CarouselCaptions
  onCaptionsChange: (next: CarouselCaptions) => void
  carouselTitle: string
  platform: CarouselConfig['platform']
  /** Export folder name, so generated captions land next to the slides. */
  slug: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'style',   label: 'Style' },
  { id: 'image',   label: 'Image' },
  { id: 'caption', label: 'Caption' },
]

export default function Inspector({
  slide, allSlides, onChange,
  captions, onCaptionsChange, carouselTitle, platform, slug,
  ...bg
}: Props) {
  const [tab, setTab] = useState<Tab>('content')

  return (
    <div className="flex w-[360px] min-w-[320px] max-w-[400px] shrink-0 flex-col overflow-hidden border-l border-border bg-card">
      <div className="flex shrink-0 gap-1 border-b border-border p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 rounded-lg py-2 text-[11px] font-bold transition-all',
              tab === t.id
                ? 'bg-brand text-white shadow-soft'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'image' ? (
          <BgImageCard slide={slide} allSlides={allSlides} {...bg} />
        ) : tab === 'caption' ? (
          <CaptionEditor
            captions={captions} onChange={onCaptionsChange}
            title={carouselTitle} platform={platform} slides={allSlides} slug={slug}
          />
        ) : (
          <SlideEditor slide={slide} allSlides={allSlides} onChange={onChange} section={tab} />
        )}
      </div>
    </div>
  )
}
