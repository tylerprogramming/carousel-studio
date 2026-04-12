import { useState } from 'react'
import { Slide, SlideType, BG_COLORS, TEXT_COLORS, ACCENT_COLORS } from '../types'
import ImageLibrary from './ImageLibrary'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Separator } from './ui/separator'
import { cn } from '../lib/utils'

interface Props {
  slide: Slide
  allSlides: Slide[]
  onChange: (updated: Slide) => void
  onBgImage: (url: string, scope: 'single' | 'all', slideNumber?: number) => void
  onBgImageEach: (updates: { slideNumber: number; url: string }[]) => void
  twoCol?: boolean
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <Label className="mb-2 block">{title}</Label>
      {children}
    </div>
  )
}

function ColorSwatch({ color, active, onClick }: { color: { name: string; value: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      title={color.name}
      onClick={onClick}
      className={cn(
        'w-7 h-7 rounded-md transition-all duration-150 cursor-pointer',
        active ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105',
        (color.value === '#FFFFFF' || color.value === '#F5F0EB') && 'border border-border'
      )}
      style={{ background: color.value }}
    />
  )
}

// ── Image Generation Panel ────────────────────────────────────────────────────

type ImgScope = 'single' | 'all' | 'each'

function ImagePanel({ slide, allSlides, onBgImage, onBgImageEach, onSlideChange, onGenerated }: {
  slide: Slide
  allSlides: Slide[]
  onBgImage: (url: string, scope: 'single' | 'all', slideNumber?: number) => void
  onBgImageEach: (updates: { slideNumber: number; url: string }[]) => void
  onSlideChange: (updated: Slide) => void
  onGenerated?: () => void
}) {
  const [scope, setScope]           = useState<ImgScope>('single')
  const [prompt, setPrompt]         = useState('')
  const [useLikeness, setUseLikeness] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress]     = useState('')
  const [error, setError]           = useState('')

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    setProgress(scope === 'each' ? 'Starting batch...' : 'Generating image...')

    try {
      const prefix = `bg_${Date.now()}`
      const res = await fetch('/api/generate-bg-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          scope,
          slides: scope === 'each'
            ? allSlides.map((s) => ({ slideNumber: s.slideNumber, headline: s.headline, emphasisLine: s.emphasisLine }))
            : [],
          outputPrefix: prefix,
          useLikeness,
        }),
      })

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      const batch: { slideNumber: number; url: string }[] = []

      const finish = (err?: string) => {
        reader.cancel().catch(() => {})
        if (err) setError(err)
        setGenerating(false)
        setProgress('')
        onGenerated?.()
      }

      outer: while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        const text = dec.decode(value, { stream: true })
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'progress') {
              setProgress(evt.message)
            } else if (evt.type === 'error') {
              finish(evt.message || 'Generation failed')
              break outer
            } else if (evt.type === 'image') {
              if (scope === 'each') {
                batch.push({ slideNumber: evt.slideNumber, url: evt.url })
                setProgress(`Slide ${evt.slideNumber} done...`)
              } else {
                if (scope === 'all')    onBgImage(evt.url, 'all')
                if (scope === 'single') onBgImage(evt.url, 'single', slide.slideNumber)
              }
            } else if (evt.type === 'complete') {
              if (scope === 'each') onBgImageEach(batch)
              finish()
              break outer
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch (err) {
      setError(String(err))
      setGenerating(false)
      setProgress('')
    }
  }

  function autoFill() {
    const parts = [slide.headline, slide.emphasisLine].filter(Boolean)
    setPrompt(parts.length
      ? `Abstract background for: "${parts.join(' — ')}". Modern minimal, geometric shapes, no text.`
      : '')
  }

  const scopes: { value: ImgScope; label: string; desc: string }[] = [
    { value: 'single', label: 'This Slide', desc: 'One image for this slide only' },
    { value: 'all',    label: 'All Slides', desc: 'Same image on every slide' },
    { value: 'each',   label: 'Each Slide', desc: 'Unique image per slide (batch)' },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Scope */}
      <div>
        <Label className="mb-2 block">Generate For</Label>
        <div className="flex flex-col gap-1.5">
          {scopes.map((s) => (
            <button
              key={s.value}
              onClick={() => setScope(s.value)}
              title={s.desc}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all duration-150 cursor-pointer border',
                scope === s.value
                  ? 'border-primary bg-coral-light text-primary'
                  : 'border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label>{scope === 'each' ? 'Base Style' : 'Prompt'}</Label>
          {scope !== 'each' && (
            <button onClick={autoFill} className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer">
              Auto ↺
            </button>
          )}
        </div>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={scope === 'each' ? 'Optional base style...' : 'e.g. teal gradient, minimal geometric...'}
          className="text-xs min-h-[68px]"
          rows={3}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Progress */}
      {generating && progress && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block animate-spin-slow">⟳</span>
          {progress}
        </div>
      )}

      {/* Likeness toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={useLikeness}
          onChange={(e) => setUseLikeness(e.target.checked)}
          className="w-3.5 h-3.5 accent-[var(--primary)] cursor-pointer"
        />
        <span className="text-xs text-muted-foreground">Use my likeness</span>
      </label>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={generating || (scope !== 'each' && !prompt.trim())}
        variant={generating || (scope !== 'each' && !prompt.trim()) ? 'secondary' : 'default'}
        size="sm"
        className="w-full"
      >
        {generating
          ? 'Generating...'
          : scope === 'each'
          ? `Generate ${allSlides.length} Images`
          : 'Generate Background'}
      </Button>

      {/* Active image preview */}
      {slide.backgroundImage && (
        <div className="border-t border-border pt-3">
          <div className="relative rounded-lg overflow-hidden mb-2.5" style={{ aspectRatio: '4/5' }}>
            <img src={slide.backgroundImage} alt="bg" className="w-full h-full object-cover" />
            <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">
              Active
            </div>
          </div>
          {/* Opacity */}
          <div className="mb-2.5">
            <div className="text-[10px] text-muted-foreground mb-1.5 flex justify-between">
              <span>Overlay</span>
              <span className="font-semibold text-foreground">{Math.round((slide.overlayOpacity ?? 0.45) * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={slide.overlayOpacity ?? 0.45}
              onChange={(e) => onSlideChange({ ...slide, overlayOpacity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
          <div className="flex gap-1.5">
            {[{ label: 'Dark', val: '#000000' }, { label: 'Light', val: '#ffffff' }].map((o) => (
              <button
                key={o.val}
                onClick={() => onSlideChange({ ...slide, overlayColor: o.val })}
                className={cn(
                  'flex-1 py-1.5 text-[11px] font-semibold rounded-md border transition-all cursor-pointer',
                  (slide.overlayColor ?? '#000000') === o.val
                    ? 'border-primary bg-coral-light text-primary'
                    : 'border-border bg-secondary text-foreground hover:border-primary/40'
                )}
              >
                {o.label}
              </button>
            ))}
            <button
              onClick={() => onSlideChange({ ...slide, backgroundImage: undefined })}
              className="flex-1 py-1.5 text-[11px] font-semibold rounded-md border border-destructive/40 bg-destructive/5 text-destructive cursor-pointer hover:bg-destructive/10 transition-all"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Editor ──────────────────────────────────────────────────────────────

const SLIDE_TYPES: { value: SlideType; label: string }[] = [
  { value: 'cover', label: 'Cover' },
  { value: 'content', label: 'Content' },
  { value: 'cta', label: 'CTA' },
]

export default function SlideEditor({ slide, allSlides, onChange, onBgImage, onBgImageEach, twoCol = false }: Props) {
  const [imgOpen, setImgOpen]       = useState(false)
  const [libraryKey, setLibraryKey] = useState(0)

  function set<K extends keyof Slide>(key: K, val: Slide[K]) {
    onChange({ ...slide, [key]: val })
  }

  const panelStyle = twoCol
    ? { flex: '0 1 620px', minWidth: 500, maxWidth: 740 }
    : { flex: '0 1 420px', minWidth: 320, maxWidth: 520 }

  return (
    <div
      className="flex overflow-hidden bg-card border-r border-border shrink"
      style={panelStyle}
    >
      {/* ── Left: slide fields ── */}
      <div className="flex-1 overflow-y-auto p-4 min-w-0 scrollbar-thin">

        {/* Slide type */}
        <FieldSection title="Slide Type">
          <div className="flex gap-1.5">
            {SLIDE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => set('type', t.value)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer border',
                  slide.type === t.value
                    ? 'bg-primary text-primary-foreground border-primary shadow-soft'
                    : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </FieldSection>

        {/* Step number */}
        {slide.type === 'content' && (
          <FieldSection title="Step Number">
            <div className="flex items-center gap-3">
              <Input
                type="number" min={1} max={20}
                value={slide.stepNumber ?? ''}
                placeholder="None"
                className="w-20"
                onChange={(e) => {
                  const v = e.target.value
                  set('stepNumber', v === '' ? undefined : parseInt(v) || 1)
                }}
              />
              <span className="text-[11px] text-muted-foreground">Leave blank to hide</span>
            </div>
          </FieldSection>
        )}

        <FieldSection title={slide.type === 'cover' ? 'Main Headline' : slide.type === 'cta' ? 'CTA Headline' : 'Feature Name'}>
          <Textarea
            value={slide.headline}
            onChange={(e) => set('headline', e.target.value)}
            placeholder={slide.type === 'cover' ? 'Your big hook...' : slide.type === 'cta' ? 'Follow For More' : 'Feature name...'}
            rows={2}
            className="min-h-0"
          />
        </FieldSection>

        <FieldSection title="Emphasis Line">
          <Textarea
            value={slide.emphasisLine}
            onChange={(e) => set('emphasisLine', e.target.value)}
            placeholder="Bold accent text..."
            rows={2}
            className="min-h-0"
          />
        </FieldSection>

        <FieldSection title="Body Text">
          <Textarea
            value={slide.bodyText}
            onChange={(e) => set('bodyText', e.target.value)}
            placeholder="Supporting detail..."
            rows={3}
            className="min-h-0"
          />
        </FieldSection>

        {/* Text size */}
        <FieldSection title="Text Size">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[
                { label: 'XS', val: 0.7 },
                { label: 'S',  val: 0.85 },
                { label: 'M',  val: 1.0 },
                { label: 'L',  val: 1.2 },
                { label: 'XL', val: 1.4 },
              ].map((p) => {
                const current = slide.textScale ?? 1
                const active = Math.abs(current - p.val) < 0.05
                return (
                  <button
                    key={p.label}
                    onClick={() => set('textScale', p.val)}
                    className={cn(
                      'w-9 h-8 rounded-md text-xs font-semibold border transition-all duration-150 cursor-pointer',
                      active
                        ? 'bg-primary text-primary-foreground border-primary shadow-soft'
                        : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round((slide.textScale ?? 1) * 100)}%
            </span>
          </div>
          <div className="mt-2">
            <input
              type="range" min={0.5} max={1.6} step={0.05}
              value={slide.textScale ?? 1}
              onChange={(e) => set('textScale', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </FieldSection>

        <Separator className="my-4" />

        <FieldSection title="Background Colour">
          <div className="flex flex-wrap gap-1.5 items-center">
            {BG_COLORS.map((c) => (
              <ColorSwatch
                key={c.value}
                color={c}
                active={c.value.toLowerCase() === slide.bgColor.toLowerCase()}
                onClick={() => set('bgColor', c.value)}
              />
            ))}
            <input type="color" value={slide.bgColor} onChange={(e) => set('bgColor', e.target.value)}
              title="Custom" className="w-7 h-7 rounded-md cursor-pointer border border-border p-0.5" />
          </div>
        </FieldSection>

        <FieldSection title="Text Colour">
          <div className="flex flex-wrap gap-1.5 items-center">
            {TEXT_COLORS.map((c) => {
              const active = c.value.toLowerCase() === slide.textColor.toLowerCase()
              return (
                <button
                  key={c.value}
                  onClick={() => set('textColor', c.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold border transition-all duration-150 cursor-pointer',
                    active
                      ? 'border-primary bg-coral-light text-primary'
                      : 'border-border bg-secondary hover:border-primary/40'
                  )}
                  style={{ color: active ? undefined : c.value === '#FFFFFF' ? '#18181b' : c.value }}
                >
                  {c.name}
                </button>
              )
            })}
            <input type="color" value={slide.textColor} onChange={(e) => set('textColor', e.target.value)}
              title="Custom" className="w-7 h-7 rounded-md cursor-pointer border border-border p-0.5" />
          </div>
        </FieldSection>

        <FieldSection title="Accent Colour">
          <div className="flex flex-wrap gap-1.5 items-center">
            {ACCENT_COLORS.map((c) => (
              <ColorSwatch
                key={c.value}
                color={c}
                active={c.value.toLowerCase() === slide.accentColor.toLowerCase()}
                onClick={() => set('accentColor', c.value)}
              />
            ))}
            <input type="color" value={slide.accentColor} onChange={(e) => set('accentColor', e.target.value)}
              title="Custom" className="w-7 h-7 rounded-md cursor-pointer border border-border p-0.5" />
          </div>
        </FieldSection>

        <FieldSection title="Footer Color">
          <div className="flex items-center gap-2">
            {['#FFFFFF', '#1B1B1B', '#F5F0EB', slide.accentColor].map((c) => (
              <button key={c} onClick={() => set('footerColor', c)} style={{ background: c, width: 28, height: 28, borderRadius: 6, border: (slide.footerColor ?? '#FFFFFF').toLowerCase() === c.toLowerCase() ? '2px solid #e07355' : '2px solid transparent', cursor: 'pointer' }} title={c} />
            ))}
            <input type="color" value={slide.footerColor ?? '#FFFFFF'} onChange={(e) => set('footerColor', e.target.value)}
              title="Custom" className="w-7 h-7 rounded-md cursor-pointer border border-border p-0.5" />
            <span className="text-xs text-muted-foreground ml-1">Save for Later / Swipe text</span>
          </div>
        </FieldSection>

        <Separator className="my-4" />

        <FieldSection title="Apply to All Slides">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => onChange({ ...slide, _applyBgToAll: true } as any)}>
              Apply BG
            </Button>
            <Button variant="outline" size="sm" onClick={() => onChange({ ...slide, _applyColorsToAll: true } as any)}>
              Apply Colors
            </Button>
            <Button variant="outline" size="sm" onClick={() => onChange({ ...slide, _applyTextScaleToAll: true } as any)}>
              Apply Text Size
            </Button>
          </div>
        </FieldSection>

        {/* BG accordion — single-column only */}
        {!twoCol && (
          <>
            <Separator className="my-4" />
            <div className="mb-4">
              <button
                onClick={() => setImgOpen((o) => !o)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold border transition-all duration-150 cursor-pointer',
                  imgOpen
                    ? 'border-primary bg-coral-light text-primary'
                    : 'border-border bg-secondary text-foreground hover:border-primary/40'
                )}
              >
                <span>🖼 Background Image</span>
                <span className={cn('text-[10px]', slide.backgroundImage ? 'text-emerald-500' : 'text-muted-foreground')}>
                  {slide.backgroundImage ? '● Active' : imgOpen ? '▲' : '▼'}
                </span>
              </button>
              {imgOpen && (
                <div className="mt-3 animate-fade-in">
                  <ImagePanel
                    slide={slide}
                    allSlides={allSlides}
                    onBgImage={onBgImage}
                    onBgImageEach={onBgImageEach}
                    onSlideChange={onChange}
                    onGenerated={() => setLibraryKey((k) => k + 1)}
                  />
                  <div className="border-t border-border pt-3.5 mt-3.5">
                    <ImageLibrary compact={false} refreshKey={libraryKey} onApply={(url) => onChange({ ...slide, backgroundImage: url })} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Right: BG image panel (wide screens only) ── */}
      {twoCol && (
        <div className="w-52 shrink-0 border-l border-border overflow-y-auto p-4 bg-secondary/30 scrollbar-thin">
          <Label className="mb-3.5 block">🖼 Background Image</Label>
          <ImagePanel
            slide={slide}
            allSlides={allSlides}
            onBgImage={onBgImage}
            onBgImageEach={onBgImageEach}
            onSlideChange={onChange}
            onGenerated={() => setLibraryKey((k) => k + 1)}
          />
          <div className="border-t border-border pt-3.5 mt-3.5">
            <ImageLibrary compact={true} refreshKey={libraryKey} onApply={(url) => onChange({ ...slide, backgroundImage: url })} />
          </div>
        </div>
      )}
    </div>
  )
}
