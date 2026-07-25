import { Slide, SlideType, BG_COLORS, TEXT_COLORS, ACCENT_COLORS } from '../types'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Separator } from './ui/separator'
import ThemePicker from './ThemePicker'
import { cn } from '../lib/utils'

interface Props {
  slide: Slide
  allSlides: Slide[]
  onChange: (updated: Slide) => void
  /** Which group of controls to render. The Inspector shows one tab at a time. */
  section?: 'content' | 'style' | 'image'
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

function ColorSwatch({ color, active, onClick }: { color: { name: string; value: string }; active: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      title={`${color.name} — shift-click to apply to every slide`}
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

/** One label + swatch strip + custom picker. Replaces five copies of the same markup. */
function ColorRow({ label, swatches, value, onPick, onReset }: {
  label: string
  swatches: { name: string; value: string }[]
  value: string
  onPick: (e: React.MouseEvent, v: string) => void
  onReset?: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[74px] shrink-0 text-[11px] font-semibold text-muted-foreground">{label}</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {swatches.map((c, i) => (
          <button
            key={`${c.value}-${i}`}
            title={`${c.name} — shift-click for every slide`}
            onClick={(e) => onPick(e, c.value)}
            className={cn(
              'h-6 w-6 rounded-md border transition-all',
              c.value.toLowerCase() === (value || '').toLowerCase()
                ? 'border-brand ring-2 ring-brand/30'
                : 'border-border hover:scale-105',
            )}
            style={{ background: c.value }}
          />
        ))}
        <input
          type="color" value={value || '#888888'}
          onChange={(e) => onPick({ shiftKey: false } as any, e.target.value)}
          title="Custom"
          className="h-6 w-6 cursor-pointer rounded-md border border-border p-0.5"
        />
        {onReset && (
          <button onClick={onReset} className="text-[10px] text-muted-foreground underline hover:text-foreground">
            reset
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Editor ───────────────────────────────────────────────────────────────

const SLIDE_TYPES: { value: SlideType; label: string }[] = [
  { value: 'cover', label: 'Cover' },
  { value: 'content', label: 'Content' },
  { value: 'cta', label: 'CTA' },
]

export default function SlideEditor({ slide, onChange, section = 'content' }: Props) {
  function set<K extends keyof Slide>(key: K, val: Slide[K]) {
    onChange({ ...slide, [key]: val })
  }

  /**
   * Shift-aware setter. Plain click edits this slide; shift-click pushes the
   * same key to every slide in the carousel. `extraKeys` lets one control
   * propagate a group, e.g. the theme swatches send all three colours.
   */
  function setMaybeAll<K extends keyof Slide>(
    e: { shiftKey: boolean },
    key: K,
    val: Slide[K],
    extraKeys: (keyof Slide)[] = [],
  ) {
    const next = { ...slide, [key]: val }
    onChange(e.shiftKey ? ({ ...next, _applyKeysToAll: [key, ...extraKeys] } as any) : next)
  }

  return (
    <div className="flex h-full overflow-hidden bg-card">
      <div className="flex-1 overflow-y-auto p-4 min-w-0 scrollbar-thin">

        {section === 'content' && (<>
        {/* Slide type */}
        <FieldSection title="Slide Type">
          <div className="flex gap-1.5">
            {SLIDE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={(e) => setMaybeAll(e, 'type', t.value)}
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
                    onClick={(e) => setMaybeAll(e, 'textScale', p.val)}
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

        </>)}

        {section === 'style' && (<>
        <Separator className="my-4" />

        <FieldSection title="Theme">
          <ThemePicker
            slide={slide}
            onApply={(t, scope) => {
              const colors = {
                bgColor: t.bgColor, textColor: t.textColor, accentColor: t.accentColor,
                variant: t.variant ?? 'default',
              }
              onChange(
                scope === 'all'
                  ? ({ ...slide, ...colors, _applyKeysToAll: ['bgColor', 'textColor', 'accentColor', 'variant'] } as any)
                  : { ...slide, ...colors },
              )
            }}
          />
        </FieldSection>

        {/* One compact block instead of five identical stacked rows. Theme sets
            the first three in a click; these are the overrides. */}
        <details className="mb-4 rounded-lg border border-border bg-secondary/40 p-3" open={false}>
          <summary className="cursor-pointer select-none text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
            Fine-tune colours
          </summary>

          <div className="mt-3 space-y-3">
            <ColorRow label="Background" swatches={BG_COLORS} value={slide.bgColor}
              onPick={(e, v) => setMaybeAll(e, 'bgColor', v)} />
            <ColorRow label="Text" swatches={TEXT_COLORS} value={slide.textColor}
              onPick={(e, v) => setMaybeAll(e, 'textColor', v)} />
            <ColorRow label="Accent" swatches={ACCENT_COLORS} value={slide.accentColor}
              onPick={(e, v) => setMaybeAll(e, 'accentColor', v)} />
            <ColorRow label="Footer"
              swatches={[{ name: 'White', value: '#FFFFFF' }, { name: 'Dark', value: '#1B1B1B' },
                         { name: 'Cream', value: '#F5F0EB' }, { name: 'Accent', value: slide.accentColor }]}
              value={slide.footerColor ?? '#FFFFFF'}
              onPick={(e, v) => setMaybeAll(e, 'footerColor', v)} />
            <ColorRow label="Body text"
              swatches={[{ name: 'Dark', value: '#1B1B1B' }, { name: 'Grey', value: '#888888' },
                         { name: 'Cream', value: '#F5F0EB' }, { name: 'White', value: '#FFFFFF' }]}
              value={slide.bodyTextColor ?? ''}
              onPick={(e, v) => setMaybeAll(e, 'bodyTextColor', v)}
              onReset={() => set('bodyTextColor', undefined)} />
          </div>
        </details>

        <FieldSection title="Apply to All Slides">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm"
              onClick={() => onChange({ ...slide, _applyKeysToAll: ['bgColor', 'textColor', 'accentColor', 'variant'] } as any)}>
              All colours
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => onChange({ ...slide, _applyKeysToAll: ['textScale'] } as any)}>
              Text size
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => onChange({ ...slide, _applyKeysToAll: ['footerColor', 'bodyTextColor'] } as any)}>
              Footer + body
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Or shift-click any swatch, text size, or slide type above to push just that one to every slide.
          </p>
        </FieldSection>

        </>)}

        {section === 'image' && (<>
        {/* ── Unified Image section ──────────────────────────── */}
        {(() => {
          const hasBg = !!(slide.backgroundImage || slide.backgroundVideo)
          const hasInset = !!slide.insetImageUrl
          const imageMode: 'none' | 'full' | 'box-top' | 'box-bottom' =
            hasBg ? 'full' :
            hasInset ? ((slide.insetPosition ?? 'bottom') === 'top' ? 'box-top' : 'box-bottom') :
            'none'

          const currentUrl = slide.backgroundImage || slide.backgroundVideo || slide.insetImageUrl || ''

          function applyMode(mode: typeof imageMode, url?: string) {
            const u = (url ?? currentUrl) || undefined
            const isVid = u?.endsWith('.mp4') || u?.endsWith('.webm')
            if (mode === 'none') {
              onChange({ ...slide, backgroundImage: undefined, backgroundVideo: undefined, insetImageUrl: undefined })
            } else if (mode === 'full') {
              onChange({ ...slide,
                backgroundImage: isVid ? undefined : u,
                backgroundVideo: isVid ? u : undefined,
                insetImageUrl: undefined,
              })
            } else {
              const pos = mode === 'box-top' ? 'top' : 'bottom'
              onChange({ ...slide,
                insetImageUrl: u, insetPosition: pos,
                backgroundImage: undefined, backgroundVideo: undefined,
              })
            }
          }

          const MODES = [
            { key: 'none', label: 'None' },
            { key: 'full', label: 'Full BG' },
            { key: 'box-top', label: 'Box Top' },
            { key: 'box-bottom', label: 'Box Bottom' },
          ] as const

          return (
            <FieldSection title="Image">
              {/* Mode selector */}
              <div className="grid grid-cols-4 gap-1 mb-3">
                {MODES.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => applyMode(m.key)}
                    className={cn(
                      'py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 cursor-pointer border',
                      imageMode === m.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {imageMode !== 'none' && (
                <div className="space-y-3">
                  {/* URL input */}
                  <Input
                    value={currentUrl}
                    onChange={(e) => applyMode(imageMode, e.target.value || undefined)}
                    placeholder="/files/image.png or /files/clip.mp4"
                    className="text-xs"
                  />

                  {/* Full BG controls */}
                  {imageMode === 'full' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Overlay</span>
                        <input type="range" min={0} max={1} step={0.05}
                          value={slide.overlayOpacity ?? 0.45}
                          onChange={(e) => set('overlayOpacity', parseFloat(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-xs tabular-nums text-muted-foreground w-8">{Math.round((slide.overlayOpacity ?? 0.45) * 100)}%</span>
                        <input type="color"
                          value={slide.overlayColor === '#ffffff' ? '#ffffff' : '#000000'}
                          onChange={(e) => set('overlayColor', e.target.value)}
                          className="w-7 h-7 rounded-md cursor-pointer border border-border p-0.5"
                          title="Overlay colour"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">Pan left / right</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{slide.bgPanX ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">◀</span>
                          <input type="range" min={-100} max={100} step={2}
                            value={slide.bgPanX ?? 0}
                            onChange={(e) => set('bgPanX', parseInt(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-[10px] text-muted-foreground">▶</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">Pan up / down</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{slide.bgPanY ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">▲</span>
                          <input type="range" min={-100} max={100} step={2}
                            value={slide.bgPanY ?? 0}
                            onChange={(e) => set('bgPanY', parseInt(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-[10px] text-muted-foreground">▼</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Box controls */}
                  {(imageMode === 'box-top' || imageMode === 'box-bottom') && (
                    <>
                      {/* Height */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">Box Height</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{slide.insetHeightPct ?? 38}%</span>
                        </div>
                        <input type="range" min={15} max={60} step={1}
                          value={slide.insetHeightPct ?? 38}
                          onChange={(e) => set('insetHeightPct', parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      {/* Horizontal padding */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">Left / Right gap</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{slide.insetPadding ?? 0}px</span>
                        </div>
                        <input type="range" min={0} max={120} step={4}
                          value={slide.insetPadding ?? 0}
                          onChange={(e) => set('insetPadding', parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      {/* Vertical offset */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">Edge gap</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{slide.insetVerticalOffset ?? 0}px</span>
                        </div>
                        <input type="range" min={0} max={80} step={4}
                          value={slide.insetVerticalOffset ?? 0}
                          onChange={(e) => set('insetVerticalOffset', parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>

                      {/* Zoom + Pan */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-muted-foreground">Zoom</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs tabular-nums text-muted-foreground">{(slide.insetZoom ?? 1).toFixed(1)}×</span>
                            {((slide.insetZoom ?? 1) !== 1 || (slide.insetPanX ?? 0) !== 0 || (slide.insetPanY ?? 0) !== 0) && (
                              <button onClick={() => onChange({ ...slide, insetZoom: 1, insetPanX: 0, insetPanY: 0 })} className="text-[10px] text-muted-foreground underline cursor-pointer hover:text-foreground">reset</button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Wide</span>
                          <input type="range" min={0.5} max={5} step={0.05}
                            value={slide.insetZoom ?? 1}
                            onChange={(e) => set('insetZoom', parseFloat(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-[10px] text-muted-foreground">Close</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-muted-foreground">Pan left / right</span>
                              <span className="text-xs tabular-nums text-muted-foreground">{slide.insetPanX ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">◀</span>
                              <input type="range" min={-100} max={100} step={2}
                                value={slide.insetPanX ?? 0}
                                onChange={(e) => set('insetPanX', parseInt(e.target.value))}
                                className="flex-1"
                              />
                              <span className="text-[10px] text-muted-foreground">▶</span>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-muted-foreground">Pan up / down</span>
                              <span className="text-xs tabular-nums text-muted-foreground">{slide.insetPanY ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">▲</span>
                              <input type="range" min={-100} max={100} step={2}
                                value={slide.insetPanY ?? 0}
                                onChange={(e) => set('insetPanY', parseInt(e.target.value))}
                                className="flex-1"
                              />
                              <span className="text-[10px] text-muted-foreground">▼</span>
                            </div>
                          </div>
                      </div>

                      {/* Border */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Border</span>
                          <input type="color"
                            value={slide.insetBorderColor ?? '#FFFFFF'}
                            onChange={(e) => set('insetBorderColor', e.target.value)}
                            className="w-7 h-7 rounded-md cursor-pointer border border-border p-0.5"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={0} max={12}
                            value={slide.insetBorderWidth ?? 4}
                            onChange={(e) => set('insetBorderWidth', parseInt(e.target.value) || 0)}
                            className="w-14 h-7 rounded-md border border-border bg-secondary text-xs text-center"
                          />
                          <span className="text-xs text-muted-foreground">px</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </FieldSection>
          )
        })()}

        <Separator className="my-4" />

        </>)}
      </div>
    </div>
  )
}
