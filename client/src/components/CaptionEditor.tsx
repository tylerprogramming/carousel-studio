import { useEffect, useState } from 'react'
import { CarouselCaptions, CarouselConfig, Slide } from '../types'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { cn } from '../lib/utils'
import { SparkleIcon } from './icons'

/**
 * The carousel's written copy, edited in place.
 *
 * Captions used to live in a modal that generated them and a captions.md that
 * only appeared after export, so what actually got posted was never part of the
 * carousel. This writes config.captions directly: it saves with the carousel,
 * loads back with it, and takes part in undo/redo like every other edit.
 */

/** Instagram and TikTok both truncate a caption at 2200 characters. */
const CAPTION_LIMIT  = 2200
const LINKEDIN_LIMIT = 3000

interface Props {
  captions: CarouselCaptions
  onChange: (next: CarouselCaptions) => void
  /** Everything /api/captions needs to write copy for this carousel. */
  title: string
  platform: CarouselConfig['platform']
  slides: Slide[]
  slug: string
}

function parseTags(raw: string) {
  return raw.split(/\s+/).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`))
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      disabled={!text}
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
      className={cn(
        'rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-all disabled:opacity-40',
        copied
          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
          : 'border-border bg-secondary text-muted-foreground enabled:hover:border-brand enabled:hover:text-brand',
      )}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function CaptionField({ label, hint, value, limit, onChange }: {
  label: string
  hint?: string
  value: string
  limit: number
  onChange: (v: string) => void
}) {
  const over = value.length > limit
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] font-semibold tabular-nums', over ? 'text-red-600' : 'text-muted-foreground')}>
            {value.length.toLocaleString()} / {limit.toLocaleString()}
          </span>
          <CopyButton text={value} />
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${label} caption…`}
        className={cn('min-h-[150px] text-[13px] leading-relaxed', over && 'border-red-300')}
      />
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default function CaptionEditor({ captions, onChange, title, platform, slides, slug }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Hashtags are stored as an array but typed as one line. Splitting on every
  // keystroke would eat the space you just pressed, so the field keeps its own
  // draft and only follows the stored tags when they change underneath it —
  // loading another carousel, or an undo.
  const joined = (captions.hashtags ?? []).join(' ')
  const [tagDraft, setTagDraft] = useState(joined)
  useEffect(() => {
    setTagDraft((d) => (parseTags(d).join(' ') === joined ? d : joined))
  }, [joined])

  function set<K extends keyof CarouselCaptions>(key: K, val: CarouselCaptions[K]) {
    onChange({ ...captions, [key]: val })
  }

  async function generate() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/captions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, platform, slides, slug, save: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      onChange({
        ...captions,
        instagram: data.instagram,
        linkedin:  data.linkedin,
        hashtags:  data.hashtags,
        // The endpoint writes no TikTok variant. These carousels ship the
        // Instagram copy there, so seed an empty field and never overwrite one
        // that has been edited.
        tiktok: captions.tiktok?.trim() ? captions.tiktok : data.instagram,
      })
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-card">
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <button
            onClick={generate}
            disabled={loading || slides.length === 0}
            className="flex w-full items-center justify-center gap-1.5 rounded-[9px] border-[1.5px] border-brand bg-brand-light px-3 py-2 text-xs font-bold text-brand transition-all hover:bg-brand hover:text-white disabled:opacity-50"
          >
            <SparkleIcon /> {loading ? 'Writing captions…' : 'Generate from slides'}
          </button>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Reads all {slides.length} slides, then fills Instagram, LinkedIn and hashtags and
            saves <code className="rounded bg-secondary px-1">{slug}/captions.md</code>.
          </p>
          {error && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-600">
              {error}
            </div>
          )}
        </div>

        <CaptionField
          label="Instagram"
          value={captions.instagram ?? ''}
          limit={CAPTION_LIMIT}
          onChange={(v) => set('instagram', v)}
        />

        <CaptionField
          label="TikTok"
          value={captions.tiktok ?? ''}
          limit={CAPTION_LIMIT}
          onChange={(v) => set('tiktok', v)}
        />

        <CaptionField
          label="LinkedIn"
          hint="No hashtags on LinkedIn."
          value={captions.linkedin ?? ''}
          limit={LINKEDIN_LIMIT}
          onChange={(v) => set('linkedin', v)}
        />

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label>Hashtags</Label>
            <CopyButton text={joined} />
          </div>
          <Textarea
            value={tagDraft}
            onChange={(e) => { setTagDraft(e.target.value); set('hashtags', parseTags(e.target.value)) }}
            onBlur={() => setTagDraft(parseTags(tagDraft).join(' '))}
            placeholder="#claudecode #aiautomation"
            className="min-h-[60px] text-[13px]"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Space separated. A missing # is added when you leave the field.
          </p>
        </div>

        <div className="mb-4">
          <Label className="mb-2 block">Gate Keyword</Label>
          <Input
            value={captions.gate ?? ''}
            onChange={(e) => set('gate', e.target.value)}
            placeholder="EDITOR"
            className="w-40 uppercase"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            The word people comment to get the link. Leave blank for an ungated post.
          </p>
        </div>

        {captions.updatedAt && (
          <p className="text-[10px] text-muted-foreground">
            Last edited {new Date(captions.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}
