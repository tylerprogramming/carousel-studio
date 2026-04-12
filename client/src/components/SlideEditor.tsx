import { Slide, SlideType, BG_COLORS, TEXT_COLORS, ACCENT_COLORS } from '../types'
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
  onBgImage?: (url: string, scope: 'single' | 'all', slideNumber?: number) => void
  onBgImageEach?: (updates: { slideNumber: number; url: string }[]) => void
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

// ── Main Editor ───────────────────────────────────────────────────────────────

const SLIDE_TYPES: { value: SlideType; label: string }[] = [
  { value: 'cover', label: 'Cover' },
  { value: 'content', label: 'Content' },
  { value: 'cta', label: 'CTA' },
]

export default function SlideEditor({ slide, onChange }: Props) {
  function set<K extends keyof Slide>(key: K, val: Slide[K]) {
    onChange({ ...slide, [key]: val })
  }

  return (
    <div
      className="flex overflow-hidden bg-card border-r border-border shrink-0"
      style={{ width: 340, minWidth: 300, maxWidth: 380 }}
    >
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
                    ? 'bg-primary text-primary-foreground border-primary'
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
                        ? 'bg-primary text-primary-foreground border-primary'
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
                      ? 'border-primary bg-primary/10 text-primary'
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
              <button
                key={c}
                onClick={() => set('footerColor', c)}
                style={{ background: c, width: 28, height: 28, borderRadius: 6, border: (slide.footerColor ?? '#FFFFFF').toLowerCase() === c.toLowerCase() ? '2.5px solid #5B6CF2' : '2px solid transparent', cursor: 'pointer', outline: '1px solid rgba(0,0,0,0.08)' }}
                title={c}
              />
            ))}
            <input type="color" value={slide.footerColor ?? '#FFFFFF'} onChange={(e) => set('footerColor', e.target.value)}
              title="Custom" className="w-7 h-7 rounded-md cursor-pointer border border-border p-0.5" />
            <span className="text-xs text-muted-foreground ml-1">Footer text</span>
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

      </div>
    </div>
  )
}
