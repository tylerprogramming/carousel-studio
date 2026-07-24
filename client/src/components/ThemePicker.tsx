import { useEffect, useState } from 'react'
import { Slide } from '../types'
import { cn } from '../lib/utils'

/**
 * Saved colour themes.
 *
 * A theme is just the three colours a slide is built from. Built-ins cover the
 * palettes this channel already uses; custom ones are saved to localStorage so
 * they survive reloads without needing a server round trip.
 */

export interface Theme {
  id: string
  name: string
  bgColor: string
  textColor: string
  accentColor: string
  /** Some themes imply a layout, not just a palette. */
  variant?: 'default' | 'terminal'
  builtin?: boolean
}

const BUILTIN: Theme[] = [
  { id: 'cream',   name: 'Cream',   bgColor: '#F5F0EB', textColor: '#1B1B1B', accentColor: '#E07355', builtin: true },
  { id: 'forest',  name: 'Forest',  bgColor: '#1B4332', textColor: '#F5F0EB', accentColor: '#E07355', builtin: true },
  { id: 'midnight',name: 'Midnight',bgColor: '#1A1A2E', textColor: '#F5F0EB', accentColor: '#5BA4CF', builtin: true },
  { id: 'sand',    name: 'Sand',    bgColor: '#C9B99A', textColor: '#1B1B1B', accentColor: '#1B4332', builtin: true },
  { id: 'mono',    name: 'Mono',    bgColor: '#FFFFFF', textColor: '#1B1B1B', accentColor: '#1B1B1B', builtin: true },
  // Terminal is a layout as well as a palette — see SlideVariant in types.ts
  { id: 'terminal', name: 'Terminal', bgColor: '#12141A', textColor: '#EEECE8', accentColor: '#E07355', variant: 'terminal', builtin: true },
]

const STORAGE_KEY = 'carousel_studio_themes'

function loadCustom(): Theme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

interface Props {
  slide: Slide
  /** Apply to the current slide only, or to every slide in the carousel. */
  onApply: (theme: Theme, scope: 'slide' | 'all') => void
}

export default function ThemePicker({ slide, onApply }: Props) {
  const [custom, setCustom] = useState<Theme[]>(loadCustom)
  const [naming, setNaming] = useState(false)
  const [draftName, setDraftName] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
  }, [custom])

  const themes = [...BUILTIN, ...custom]

  function saveCurrent() {
    const name = draftName.trim()
    if (!name) return
    setCustom((c) => [
      ...c.filter((t) => t.name.toLowerCase() !== name.toLowerCase()),
      {
        id: `custom_${Date.now()}`,
        name,
        bgColor: slide.bgColor,
        textColor: slide.textColor,
        accentColor: slide.accentColor,
      },
    ])
    setDraftName('')
    setNaming(false)
  }

  const matches = (t: Theme) =>
    t.bgColor.toLowerCase() === slide.bgColor.toLowerCase() &&
    t.textColor.toLowerCase() === slide.textColor.toLowerCase() &&
    t.accentColor.toLowerCase() === slide.accentColor.toLowerCase()

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {themes.map((t) => (
          <div key={t.id} className="group relative">
            <button
              title={`${t.name} — click to apply, shift-click for all slides`}
              onClick={(e) => onApply(t, e.shiftKey ? 'all' : 'slide')}
              className={cn(
                'flex h-9 w-9 flex-col overflow-hidden rounded-lg border transition-all',
                matches(t) ? 'border-brand ring-2 ring-brand/30' : 'border-border hover:scale-105',
              )}
            >
              <span className="h-1/2 w-full" style={{ background: t.bgColor }} />
              <span className="flex h-1/2 w-full">
                <span className="h-full w-1/2" style={{ background: t.textColor }} />
                <span className="h-full w-1/2" style={{ background: t.accentColor }} />
              </span>
            </button>
            {!t.builtin && (
              <button
                title="Delete theme"
                onClick={() => setCustom((c) => c.filter((x) => x.id !== t.id))}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] leading-none text-white group-hover:flex"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {!naming && (
          <button
            title="Save current colours as a theme"
            onClick={() => setNaming(true)}
            className="h-9 w-9 rounded-lg border border-dashed border-border text-lg leading-none text-muted-foreground transition-all hover:border-brand hover:text-brand"
          >
            +
          </button>
        )}
      </div>

      {naming && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveCurrent()
              if (e.key === 'Escape') { setNaming(false); setDraftName('') }
            }}
            placeholder="Theme name"
            className="h-7 flex-1 rounded-md border border-border bg-secondary px-2 text-xs outline-none focus:border-brand"
          />
          <button
            onClick={saveCurrent}
            className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-hover"
          >
            Save
          </button>
          <button
            onClick={() => { setNaming(false); setDraftName('') }}
            className="text-[11px] text-muted-foreground underline"
          >
            Cancel
          </button>
        </div>
      )}

      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Click to apply · Shift-click for all slides
      </p>
    </div>
  )
}
