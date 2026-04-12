import { useState, useEffect } from 'react'

const BLUE       = '#5B6CF2'
const BLUE_LIGHT = '#EEF0FD'
const BLUE_HOVER = '#4A59E0'
const TEXT       = '#1C1E2E'
const MUTED      = '#8890A4'
const BORDER     = '#E5EAF5'
const BG         = '#F0F4FF'
const WHITE      = '#FFFFFF'

interface CarouselMeta {
  id: string
  title: string
  slideCount: number
  savedAt: string
  updatedAt: string
  platform: string
}

interface Props {
  onClose: () => void
  onLoad: (data: any) => void
  onNew: () => void
  currentId: string | null
}

export default function SavedCarouselsDrawer({ onClose, onLoad, onNew, currentId }: Props) {
  const [carousels, setCarousels] = useState<CarouselMeta[]>([])
  const [loading, setLoading]     = useState(true)
  const [deleting, setDeleting]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/carousels')
      .then((r) => r.json())
      .then((d) => setCarousels(Array.isArray(d) ? d : []))
      .catch(() => setCarousels([]))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this carousel?')) return
    setDeleting(id)
    await fetch(`/api/carousels/${id}`, { method: 'DELETE' })
    setCarousels((prev) => prev.filter((c) => c.id !== id))
    setDeleting(null)
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  const platformIcon = (p: string) => p === 'linkedin' ? '💼' : '📸'

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,24,60,0.4)', zIndex: 1000, backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 380, maxWidth: '94vw', height: '100%', background: WHITE,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 48px rgba(20,24,60,0.18)',
      }} className="animate-slide-in">

        {/* Header */}
        <div style={{ padding: '22px 20px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: TEXT, letterSpacing: '-0.01em' }}>Library</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
              {loading ? 'Loading…' : `${carousels.length} saved carousel${carousels.length !== 1 ? 's' : ''}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, background: BG, border: `1px solid ${BORDER}`, color: MUTED, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>
        </div>

        {/* New button */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <button
            onClick={() => { onNew(); onClose() }}
            style={{
              width: '100%', padding: '11px 16px', background: BLUE, border: 'none',
              borderRadius: 12, color: WHITE, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(91,108,242,0.3)', transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = BLUE_HOVER)}
            onMouseLeave={(e) => (e.currentTarget.style.background = BLUE)}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            New Carousel
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && (
            <div style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Loading...</div>
          )}
          {!loading && carousels.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div style={{ color: TEXT, fontWeight: 600, fontSize: 14, marginBottom: 6 }}>No saved carousels yet</div>
              <div style={{ color: MUTED, fontSize: 12.5 }}>Generate your first one with AI</div>
            </div>
          )}
          {carousels.map((c) => {
            const isCurrent = c.id === currentId
            return (
              <div
                key={c.id}
                onClick={async () => {
                  const res  = await fetch(`/api/carousels/${c.id}`)
                  const data = await res.json()
                  onLoad(data)
                  onClose()
                }}
                style={{
                  padding: '12px 14px', borderRadius: 13, cursor: 'pointer',
                  background: isCurrent ? BLUE_LIGHT : '#FAFBFF',
                  border: `1.5px solid ${isCurrent ? BLUE : BORDER}`,
                  display: 'flex', alignItems: 'center', gap: 11,
                  transition: 'all 0.15s',
                  boxShadow: isCurrent ? `0 0 0 3px rgba(91,108,242,0.12)` : '0 1px 3px rgba(30,40,100,0.05)',
                }}
                onMouseEnter={(e) => { if (!isCurrent) { (e.currentTarget as HTMLElement).style.background = BG; (e.currentTarget as HTMLElement).style.borderColor = '#C7CFFB' } }}
                onMouseLeave={(e) => { if (!isCurrent) { (e.currentTarget as HTMLElement).style.background = '#FAFBFF'; (e.currentTarget as HTMLElement).style.borderColor = BORDER } }}
              >
                {/* Badge */}
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: isCurrent ? BLUE : BG,
                  border: `1.5px solid ${isCurrent ? BLUE : BORDER}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: 13, fontWeight: 700, color: isCurrent ? WHITE : TEXT,
                  transition: 'all 0.15s',
                }}>
                  {c.slideCount}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
                    {c.title || 'Untitled'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10 }}>{platformIcon(c.platform)}</span>
                    <span style={{ fontSize: 11.5, color: MUTED }}>{formatDate(c.savedAt || c.updatedAt)}</span>
                    {isCurrent && <span style={{ fontSize: 10, background: BLUE, color: WHITE, borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>Active</span>}
                  </div>
                </div>

                <button
                  onClick={(e) => handleDelete(c.id, e)}
                  disabled={deleting === c.id}
                  style={{
                    background: 'none', border: 'none', color: BORDER, cursor: 'pointer',
                    fontSize: 15, padding: '5px 7px', borderRadius: 7, flexShrink: 0,
                    opacity: deleting === c.id ? 0.4 : 1, transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center',
                  }}
                  title="Delete"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; (e.currentTarget as HTMLElement).style.background = '#FFF1F2' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = BORDER; (e.currentTarget as HTMLElement).style.background = 'none' }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 3.5H12M5 3.5V2.5C5 2 5.5 1.5 7 1.5C8.5 1.5 9 2 9 2.5V3.5M5.5 6V10.5M8.5 6V10.5M3 3.5L3.5 11.5C3.5 12 4 12.5 4.5 12.5H9.5C10 12.5 10.5 12 10.5 11.5L11 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
