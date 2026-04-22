import { useState, useEffect } from 'react'
import { Slide } from '../types'
import SlidePreview from './SlidePreview'

const TIKTOK   = '#FE2C55'
const TIKTOK_D = '#c4002c'
const TEXT     = '#1C1E2E'
const MUTED    = '#8890A4'
const BORDER   = '#E5EAF5'
const BG       = '#F0F4FF'
const WHITE    = '#FFFFFF'
const GREEN    = '#16A34A'

type FlashStyle = 'statement' | 'video' | 'terminal'
type CardStatus = 'idle' | 'generating' | 'done' | 'error'

interface CarouselCard {
  carouselId: string
  carouselTitle: string
  coverSlide: Slide
  totalSlides: number
  // TT-specific (separate from carousel data)
  headline: string
  emphasisLine: string
  style: FlashStyle
  duration: number
  // generation result
  status: CardStatus
  videoUrl?: string
  error?: string
}

interface Props {
  onClose: () => void
}

function TikTokIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
    </svg>
  )
}

const THUMB = 80 / 1080

export default function FlashBatchModal({ onClose }: Props) {
  const [cards, setCards]       = useState<CarouselCard[]>([])
  const [loading, setLoading]   = useState(true)
  const [running, setRunning]   = useState(false)
  const [currentIdx, setCurrentIdx] = useState<number | null>(null)

  // Load all carousels on mount
  useEffect(() => {
    fetch('/api/carousels')
      .then((r) => r.json())
      .then((list: any[]) => Promise.all(
        list.map((item) =>
          fetch(`/api/carousels/${item.id}`).then((r) => r.json())
        )
      ))
      .then((carousels: any[]) => {
        const loaded: CarouselCard[] = carousels
          .filter((c) => c?.slides?.length > 0)
          .map((c) => {
            const cover: Slide = c.slides.find((s: Slide) => s.type === 'cover') ?? c.slides[0]
            const hasVideo = !!cover.backgroundVideo
            return {
              carouselId: c.id,
              carouselTitle: c.title,
              coverSlide: cover,
              totalSlides: c.slides.length,
              headline: cover.headline ?? '',
              emphasisLine: cover.emphasisLine ?? '',
              style: hasVideo ? 'video' : 'statement',
              duration: 5,
              status: 'idle',
            }
          })
        setCards(loaded)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function updateCard(idx: number, patch: Partial<CarouselCard>) {
    setCards((prev) => prev.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }

  async function generateOne(idx: number, card: CarouselCard) {
    setCurrentIdx(idx)
    updateCard(idx, { status: 'generating', error: undefined })
    try {
      const resp = await fetch('/api/flash-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carouselId: card.carouselId,
          carouselTitle: card.carouselTitle,
          slideNumber: card.coverSlide.slideNumber,
          style: card.style,
          duration: card.duration,
          headline: card.headline,
          emphasisLine: card.emphasisLine,
          bgColor: card.coverSlide.bgColor,
          textColor: card.coverSlide.textColor,
          accentColor: card.coverSlide.accentColor,
          backgroundVideo: card.coverSlide.backgroundVideo,
          backgroundImage: card.coverSlide.backgroundImage,
          overlayOpacity: card.coverSlide.overlayOpacity,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || data.error) {
        updateCard(idx, { status: 'error', error: data.error || 'Failed' })
      } else {
        updateCard(idx, { status: 'done', videoUrl: data.url + '?t=' + Date.now() })
      }
    } catch (err) {
      updateCard(idx, { status: 'error', error: String(err) })
    }
  }

  async function generateAll() {
    setRunning(true)
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].status === 'done') continue
      await generateOne(i, cards[i])
      // re-read cards[i] after update via closure trick
      await new Promise((r) => setTimeout(r, 100))
    }
    setRunning(false)
    setCurrentIdx(null)
  }

  const doneCount  = cards.filter((c) => c.status === 'done').length
  const totalCount = cards.length

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, backdropFilter: 'blur(4px)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        width: '92vw', maxWidth: 1100, height: '88vh',
        background: WHITE, borderRadius: 18,
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div style={{ width: 32, height: 32, background: TIKTOK, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE }}>
            <TikTokIcon size={17} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>Generate All Cover Flash Videos</div>
            <div style={{ fontSize: 11, color: MUTED }}>
              {loading ? 'Loading carousels…' : `${totalCount} carousels · edit text, then generate all at once`}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {doneCount > 0 && (
            <div style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>
              {doneCount}/{totalCount} done
            </div>
          )}
          <button
            onClick={generateAll}
            disabled={running || loading || totalCount === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', background: (running || loading) ? MUTED : TIKTOK,
              border: 'none', borderRadius: 10, color: WHITE,
              fontSize: 13, fontWeight: 800, cursor: (running || loading) ? 'default' : 'pointer',
              boxShadow: (running || loading) ? 'none' : '0 3px 12px rgba(254,44,85,0.38)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { if (!running && !loading) e.currentTarget.style.background = TIKTOK_D }}
            onMouseLeave={(e) => { if (!running && !loading) e.currentTarget.style.background = TIKTOK }}
          >
            {running
              ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: WHITE, borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Generating…</>
              : <><TikTokIcon size={14} /> Generate All</>
            }
          </button>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${BORDER}`, background: BG, color: MUTED, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: MUTED, fontSize: 14 }}>
              Loading carousels…
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {cards.map((card, idx) => (
                <CardRow
                  key={card.carouselId}
                  card={card}
                  isActive={currentIdx === idx}
                  onUpdate={(patch) => updateCard(idx, patch)}
                  onGenerate={() => generateOne(idx, cards[idx])}
                  running={running}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div style={{ padding: '10px 24px', borderTop: `1px solid ${BORDER}`, flexShrink: 0, background: BG }}>
          <div style={{ fontSize: 11, color: MUTED }}>
            Each video saves a JSON sidecar alongside the MP4 — ask Claude to edit any of them by name and regenerate.
          </div>
        </div>
      </div>
    </div>
  )
}

function CardRow({ card, isActive, onUpdate, onGenerate, running }: {
  card: CarouselCard
  isActive: boolean
  onUpdate: (p: Partial<CarouselCard>) => void
  onGenerate: () => void
  running: boolean
}) {
  const THUMB_H = Math.round((80 / 1080) * 1350)

  const statusColor = card.status === 'done' ? GREEN
    : card.status === 'error' ? '#DC2626'
    : card.status === 'generating' ? TIKTOK
    : MUTED

  const statusLabel = card.status === 'done' ? '✓ Done'
    : card.status === 'error' ? '✗ Error'
    : card.status === 'generating' ? 'Generating…'
    : 'Pending'

  return (
    <div style={{
      background: isActive ? '#fff8f8' : WHITE,
      border: `1.5px solid ${isActive ? TIKTOK : card.status === 'done' ? '#BBF7D0' : BORDER}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: isActive ? '0 0 0 3px rgba(254,44,85,0.12)' : 'none',
      transition: 'all 0.2s',
    }}>
      {/* Card header: thumbnail + title + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ width: 80, height: THUMB_H, borderRadius: 6, overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
          <SlidePreview slide={card.coverSlide} scale={THUMB} totalSlides={card.totalSlides} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {card.carouselTitle}
          </div>
          <div style={{ fontSize: 10, color: MUTED }}>{card.totalSlides} slides · cover</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: statusColor, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            {card.status === 'generating' && (
              <span style={{ width: 9, height: 9, border: '1.5px solid rgba(254,44,85,0.25)', borderTopColor: TIKTOK, borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
            )}
            {statusLabel}
          </div>
        </div>
        {card.status === 'done' && card.videoUrl && (
          <a href={card.videoUrl} download style={{
            padding: '5px 10px', borderRadius: 7, background: '#F0FDF4',
            border: '1.5px solid #BBF7D0', color: GREEN,
            fontSize: 11, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
          }}>⬇ MP4</a>
        )}
      </div>

      {/* Editable text + controls */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          value={card.headline}
          rows={2}
          placeholder="Headline for TikTok…"
          onChange={(e) => onUpdate({ headline: e.target.value })}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: BG, color: TEXT, fontSize: 13, fontWeight: 600, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = TIKTOK }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = BORDER }}
        />
        <textarea
          value={card.emphasisLine}
          rows={1}
          placeholder="Emphasis line…"
          onChange={(e) => onUpdate({ emphasisLine: e.target.value })}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${BORDER}`, background: BG, color: TEXT, fontSize: 13, fontWeight: 600, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = TIKTOK }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = BORDER }}
        />

        {/* Style + duration + individual generate */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['statement', 'video', 'terminal'] as FlashStyle[]).map((s) => {
            const disabled = s === 'video' && !card.coverSlide.backgroundVideo
            const active = card.style === s
            return (
              <button key={s} onClick={() => !disabled && onUpdate({ style: s })} disabled={disabled}
                style={{
                  padding: '5px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  border: `1.5px solid ${active ? TIKTOK : BORDER}`,
                  background: active ? '#fff0f3' : BG,
                  color: disabled ? '#ccc' : active ? TIKTOK : TEXT,
                  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
                }}>
                {s === 'statement' ? '📝' : s === 'video' ? '🎬' : '💻'}
              </button>
            )
          })}
          {[4, 5, 7].map((d) => (
            <button key={d} onClick={() => onUpdate({ duration: d })}
              style={{
                padding: '5px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                border: `1.5px solid ${card.duration === d ? '#5B6CF2' : BORDER}`,
                background: card.duration === d ? '#eef0fd' : BG,
                color: card.duration === d ? '#5B6CF2' : TEXT, cursor: 'pointer',
              }}>
              {d}s
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={onGenerate}
            disabled={running || card.status === 'generating'}
            style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 10, fontWeight: 700,
              background: (running || card.status === 'generating') ? MUTED : TIKTOK,
              border: 'none', color: WHITE, cursor: (running || card.status === 'generating') ? 'default' : 'pointer',
            }}>
            {card.status === 'done' ? '↺ Redo' : 'Generate'}
          </button>
        </div>

        {card.error && (
          <div style={{ padding: '6px 8px', background: '#fff1f2', borderRadius: 6, color: '#dc2626', fontSize: 10 }}>
            {card.error}
          </div>
        )}
      </div>
    </div>
  )
}
