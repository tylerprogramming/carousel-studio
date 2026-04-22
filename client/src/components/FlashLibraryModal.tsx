import { useEffect, useState } from 'react'

const TIKTOK   = '#FE2C55'
const TIKTOK_D = '#c4002c'
const TEXT     = '#1C1E2E'
const MUTED    = '#8890A4'
const BORDER   = '#E5EAF5'
const BG       = '#F0F4FF'
const WHITE    = '#FFFFFF'

interface FlashEntry {
  id: string
  carouselId: string
  carouselTitle: string
  headline: string
  emphasisLine: string
  subText: string
  style: string
  duration: number
  url: string
  mp4: string
  bgColor: string
  textColor: string
  accentColor: string
  backgroundVideo: string | null
  backgroundImage: string | null
  overlayOpacity: number
  generatedAt: string
}

interface Props {
  onClose: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: `1.5px solid ${BORDER}`, background: BG,
  color: TEXT, fontSize: 12, fontWeight: 600,
  outline: 'none', fontFamily: 'inherit', resize: 'vertical',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: MUTED,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  marginBottom: 4, display: 'block',
}

function VideoCard({
  entry,
  onRegenerated,
}: {
  entry: FlashEntry
  onRegenerated: (updated: FlashEntry) => void
}) {
  const [editing, setEditing]         = useState(false)
  const [headline, setHeadline]       = useState(entry.headline)
  const [emphasis, setEmphasis]       = useState(entry.emphasisLine)
  const [subText, setSubText]         = useState(entry.subText || '')
  const [ctaText, setCtaText]         = useState((entry as any).ctaText || '')
  const [regenerating, setRegenerating] = useState(false)
  const [videoUrl, setVideoUrl]       = useState(entry.url)
  const [error, setError]             = useState<string | null>(null)

  async function regenerate() {
    setRegenerating(true)
    setError(null)
    try {
      const resp = await fetch('/api/flash-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carouselId: entry.carouselId,
          carouselTitle: entry.carouselTitle,
          slideNumber: 1,
          style: entry.style,
          duration: entry.duration,
          headline,
          emphasisLine: emphasis,
          subText,
          ctaText,
          bgColor: entry.bgColor,
          textColor: entry.textColor,
          accentColor: entry.accentColor,
          backgroundVideo: entry.backgroundVideo,
          backgroundImage: entry.backgroundImage,
          overlayOpacity: entry.overlayOpacity,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || data.error) {
        setError(data.error || 'Failed')
      } else {
        const newUrl = data.url + '?t=' + Date.now()
        setVideoUrl(newUrl)
        setEditing(false)
        onRegenerated({ ...entry, headline, emphasisLine: emphasis, subText, url: newUrl })
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div style={{
      background: WHITE, borderRadius: 14, border: `1.5px solid ${editing ? TIKTOK : BORDER}`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      boxShadow: editing ? '0 6px 24px rgba(254,44,85,0.15)' : '0 2px 12px rgba(0,0,0,0.06)',
      transition: 'all 0.15s',
    }}>
      {/* Actual video */}
      <div style={{ width: '100%', aspectRatio: '9/16', background: '#111', flexShrink: 0, position: 'relative' }}>
        <video
          key={videoUrl}
          src={videoUrl}
          autoPlay loop muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {regenerating && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: WHITE, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ color: WHITE, fontSize: 11, fontWeight: 700 }}>Rendering…</span>
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          background: 'rgba(0,0,0,0.7)', color: WHITE,
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
        }}>
          {entry.duration}s
        </div>
      </div>

      {/* Title row */}
      <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
            {entry.carouselTitle}
          </div>
          {!editing && (
            <div style={{ fontSize: 11, fontWeight: 800, color: TEXT, lineHeight: 1.3 }}>
              {headline}
            </div>
          )}
        </div>
        <button
          onClick={() => { setEditing((e) => !e); setError(null) }}
          style={{
            padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, flexShrink: 0,
            border: `1.5px solid ${editing ? TIKTOK : BORDER}`,
            background: editing ? '#fff0f3' : BG,
            color: editing ? TIKTOK : MUTED, cursor: 'pointer',
          }}
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* Edit fields */}
      {editing && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={labelStyle}>Headline</label>
            <textarea rows={2} value={headline} onChange={(e) => setHeadline(e.target.value)} style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = TIKTOK }}
              onBlur={(e) => { e.currentTarget.style.borderColor = BORDER }}
            />
          </div>
          <div>
            <label style={labelStyle}>Emphasis</label>
            <textarea rows={2} value={emphasis} onChange={(e) => setEmphasis(e.target.value)} style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = TIKTOK }}
              onBlur={(e) => { e.currentTarget.style.borderColor = BORDER }}
            />
          </div>
          <div>
            <label style={labelStyle}>Body Text</label>
            <textarea rows={2} value={subText} onChange={(e) => setSubText(e.target.value)} style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = TIKTOK }}
              onBlur={(e) => { e.currentTarget.style.borderColor = BORDER }}
            />
          </div>
          <div>
            <label style={labelStyle}>CTA Button Text</label>
            <textarea rows={1} value={ctaText} onChange={(e) => setCtaText(e.target.value)} style={{ ...inputStyle, resize: 'none' }}
              placeholder='e.g. "💬 Comment GUIDE below"'
              onFocus={(e) => { e.currentTarget.style.borderColor = TIKTOK }}
              onBlur={(e) => { e.currentTarget.style.borderColor = BORDER }}
            />
          </div>
          {error && (
            <div style={{ padding: '6px 8px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6, color: '#dc2626', fontSize: 10 }}>
              {error}
            </div>
          )}
          <button onClick={regenerate} disabled={regenerating} style={{
            padding: '10px 0', background: regenerating ? MUTED : TIKTOK, border: 'none',
            borderRadius: 8, color: WHITE, fontSize: 12, fontWeight: 800,
            cursor: regenerating ? 'default' : 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={(e) => { if (!regenerating) e.currentTarget.style.background = TIKTOK_D }}
            onMouseLeave={(e) => { if (!regenerating) e.currentTarget.style.background = TIKTOK }}
          >
            {regenerating ? 'Rendering…' : 'Regenerate MP4'}
          </button>
        </div>
      )}

      {/* Download */}
      {!editing && (
        <div style={{ padding: '0 12px 12px' }}>
          <a href={videoUrl} download style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '8px 0', borderRadius: 8,
            background: '#fff0f3', border: `1.5px solid ${TIKTOK}`,
            color: TIKTOK, fontSize: 11, fontWeight: 800, textDecoration: 'none',
            transition: 'all 0.15s',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = TIKTOK; e.currentTarget.style.color = WHITE }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff0f3'; e.currentTarget.style.color = TIKTOK }}
          >
            ⬇ Download MP4
          </a>
        </div>
      )}
    </div>
  )
}

export default function FlashLibraryModal({ onClose }: Props) {
  const [entries, setEntries] = useState<FlashEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/flash-videos')
      .then((r) => r.json())
      .then((data) => { setEntries(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handleRegenerated(updated: FlashEntry) {
    setEntries((prev) => prev.map((e) => e.carouselId === updated.carouselId ? { ...e, ...updated } : e))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '32px 16px', overflowY: 'auto',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 1100, background: BG,
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', background: WHITE,
          borderBottom: `1.5px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: TEXT }}>Flash Video Library</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              {entries.length} videos · click Edit on any card to update text and regenerate
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${BORDER}`,
            background: WHITE, color: MUTED, fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Grid */}
        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: MUTED, fontSize: 14 }}>Loading videos...</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: MUTED, fontSize: 14 }}>
              No flash videos yet. Generate some from the TT panel.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 16,
            }}>
              {entries.map((entry) => (
                <VideoCard key={entry.id} entry={entry} onRegenerated={handleRegenerated} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
