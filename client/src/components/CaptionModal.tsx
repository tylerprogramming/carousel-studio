import { useState } from 'react'
import { CarouselConfig } from '../types'
import { cn } from '../lib/utils'
import { SparkleIcon } from './icons'

interface Props {
  config: CarouselConfig
  slug: string
  onClose: () => void
}

type Captions = { instagram: string; hashtags: string[]; linkedin: string; savedTo?: string | null }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
      className={cn(
        'rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-all',
        copied
          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
          : 'border-border bg-secondary text-muted-foreground hover:border-brand hover:text-brand',
      )}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function CaptionModal({ config, slug, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captions, setCaptions] = useState<Captions | null>(null)
  const [save, setSave] = useState(true)

  async function generate() {
    setLoading(true); setError(''); setCaptions(null)
    try {
      const res = await fetch('/api/captions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: config.title, platform: config.platform, slides: config.slides, slug, save }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setCaptions(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const igFull = captions ? `${captions.instagram}\n\n${captions.hashtags.join(' ')}` : ''

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="animate-fade-in flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-card shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Captions</h2>
            <p className="text-xs text-muted-foreground">
              Instagram and LinkedIn copy for “{config.title}”
            </p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!captions && !loading && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                Reads all {config.slides.length} slides and writes a caption for each platform.
                Instagram gets 5 hashtags, LinkedIn gets none.
              </p>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
                Also save to <code className="rounded bg-secondary px-1">{slug}/captions.md</code>
              </label>
              <button
                onClick={generate}
                className="flex items-center gap-2 rounded-[10px] bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-hover"
              >
                <SparkleIcon /> Generate captions
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
              <div className="animate-spin-slow h-6 w-6 rounded-full border-2 border-border border-t-brand" />
              Writing captions…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-600">
              {error}
            </div>
          )}

          {captions && (
            <div className="flex flex-col gap-5">
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.07em] text-muted-foreground">Instagram</h3>
                  <CopyButton text={igFull} />
                </div>
                <div className="whitespace-pre-wrap rounded-lg border border-border bg-secondary p-3 text-[13px] leading-relaxed text-foreground">
                  {captions.instagram}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {captions.hashtags.map((h) => (
                    <span key={h} className="rounded-md bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand">
                      {h}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.07em] text-muted-foreground">LinkedIn</h3>
                  <CopyButton text={captions.linkedin} />
                </div>
                <div className="whitespace-pre-wrap rounded-lg border border-border bg-secondary p-3 text-[13px] leading-relaxed text-foreground">
                  {captions.linkedin}
                </div>
              </section>

              {captions.savedTo && (
                <p className="text-[11px] text-muted-foreground">
                  Saved to <code className="rounded bg-secondary px-1">{captions.savedTo}</code>
                </p>
              )}

              <button
                onClick={generate}
                className="self-start rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-brand hover:text-brand"
              >
                Regenerate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
