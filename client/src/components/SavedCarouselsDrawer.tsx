import { useState, useEffect } from 'react'

interface CarouselMeta {
  id: string
  title: string
  slideCount: number
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

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 360, maxWidth: '92vw', height: '100%', background: '#fff',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.14)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#18181b' }}>Saved Carousels</div>
            <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 2 }}>{carousels.length} saved</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 4px' }}
          >×</button>
        </div>

        {/* New button */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <button
            onClick={() => { onNew(); onClose() }}
            style={{
              width: '100%', padding: '10px 16px', background: '#e07355', border: 'none',
              borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >+ New Carousel</button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {loading && (
            <div style={{ color: '#a1a1aa', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Loading...</div>
          )}
          {!loading && carousels.length === 0 && (
            <div style={{ color: '#a1a1aa', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>No saved carousels yet</div>
          )}
          {carousels.map((c) => {
            const isCurrent = c.id === currentId
            return (
              <div
                key={c.id}
                onClick={async () => {
                  const res = await fetch(`/api/carousels/${c.id}`)
                  const data = await res.json()
                  onLoad(data)
                  onClose()
                }}
                style={{
                  padding: '12px 14px', borderRadius: 11, marginBottom: 7, cursor: 'pointer',
                  background: isCurrent ? '#fff3f0' : '#f9f9f9',
                  border: isCurrent ? '1.5px solid #e07355' : '1.5px solid #f0f0f0',
                  display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = '#f4f4f5' }}
                onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = '#f9f9f9' }}
              >
                {/* Slide count badge */}
                <div style={{
                  width: 38, height: 38, borderRadius: 8, background: isCurrent ? '#e07355' : '#e4e4e7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: 12, fontWeight: 700, color: isCurrent ? '#fff' : '#71717a',
                }}>
                  {c.slideCount}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#18181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.title || 'Untitled'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#a1a1aa', marginTop: 2 }}>{formatDate(c.savedAt || c.updatedAt)}</div>
                </div>

                <button
                  onClick={(e) => handleDelete(c.id, e)}
                  disabled={deleting === c.id}
                  style={{
                    background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer',
                    fontSize: 16, padding: '4px 6px', borderRadius: 6, flexShrink: 0,
                    opacity: deleting === c.id ? 0.4 : 1,
                  }}
                  title="Delete"
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#d1d5db')}
                >🗑</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
