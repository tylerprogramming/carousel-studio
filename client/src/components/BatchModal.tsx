import { useState, useEffect } from 'react'

interface Framework {
  id: string
  name: string
  description: string
}

interface BatchResult {
  id: string
  title: string
  savedAt: string
  error?: string
}

interface BatchModalProps {
  onClose: () => void
  onDone: () => void  // called after generation so drawer can refresh
}

export default function BatchModal({ onClose, onDone }: BatchModalProps) {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [frameworkId, setFrameworkId] = useState('')
  const [topicsText, setTopicsText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<BatchResult[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/frameworks')
      .then((r) => r.json())
      .then((data: Framework[]) => {
        setFrameworks(data)
        if (data.length > 0) setFrameworkId(data[0].id)
      })
      .catch(() => {})
  }, [])

  const topics = topicsText
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)

  async function handleGenerate() {
    if (topics.length === 0) { setError('Enter at least one topic'); return }
    if (!frameworkId) { setError('Pick a framework'); return }
    setError('')
    setGenerating(true)
    setResults(null)
    try {
      const items = topics.map((topic) => ({ topic, frameworkId, platform: 'instagram' }))
      const res = await fetch('/api/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Generation failed'); return }
      setResults(data.results)
      onDone()
    } catch (err) {
      setError(String(err))
    } finally {
      setGenerating(false)
    }
  }

  const succeeded = results?.filter((r) => !r.error).length ?? 0
  const failed    = results?.filter((r) => r.error).length ?? 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: '#18181b', border: '1px solid #3f3f46', borderRadius: 14,
        padding: 28, width: 480, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 18,
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fafafa', fontWeight: 700, fontSize: 16 }}>Batch Generate</div>
            <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>Create multiple carousels at once</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Topics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#a1a1aa', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}>
            TOPICS — one per line
          </label>
          <textarea
            value={topicsText}
            onChange={(e) => setTopicsText(e.target.value)}
            placeholder={'5 Claude Code features beginners miss\nHow to use Claude Code for YouTube research\nBest AI tools for content creators in 2025'}
            rows={6}
            style={{
              background: '#09090b', border: '1px solid #3f3f46', borderRadius: 8,
              color: '#fafafa', padding: '10px 12px', fontSize: 13, resize: 'vertical',
              outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
            }}
          />
          {topics.length > 0 && (
            <div style={{ color: '#71717a', fontSize: 11 }}>{topics.length} carousel{topics.length !== 1 ? 's' : ''} queued</div>
          )}
        </div>

        {/* Framework */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#a1a1aa', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}>FRAMEWORK</label>
          <select
            value={frameworkId}
            onChange={(e) => setFrameworkId(e.target.value)}
            style={{
              background: '#09090b', border: '1px solid #3f3f46', borderRadius: 8,
              color: '#fafafa', padding: '8px 12px', fontSize: 13, outline: 'none',
            }}
          >
            {frameworks.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          {frameworkId && frameworks.find((f) => f.id === frameworkId) && (
            <div style={{ color: '#52525b', fontSize: 11 }}>{frameworks.find((f) => f.id === frameworkId)?.description}</div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 12px', color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: '#a1a1aa', fontSize: 12, fontWeight: 600 }}>
              {succeeded} generated{failed > 0 ? `, ${failed} failed` : ''} — saved to your library
            </div>
            {results.map((r, i) => (
              <div key={i} style={{
                background: r.error ? '#450a0a' : '#052e16',
                border: `1px solid ${r.error ? '#7f1d1d' : '#166534'}`,
                borderRadius: 8, padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>{r.error ? '✗' : '✓'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fafafa', fontSize: 13, fontWeight: 600 }}>{r.title || topics[i]}</div>
                  {r.error && <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 2 }}>{r.error}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {!results ? (
            <>
              <button onClick={onClose} style={{
                flex: 1, padding: '9px 16px', background: 'transparent', border: '1px solid #3f3f46',
                borderRadius: 8, color: '#a1a1aa', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Cancel
              </button>
              <button onClick={handleGenerate} disabled={generating || topics.length === 0} style={{
                flex: 2, padding: '9px 16px',
                background: generating ? '#3f3f46' : '#e07355',
                border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: generating || topics.length === 0 ? 'default' : 'pointer',
              }}>
                {generating
                  ? `Generating ${topics.length} carousel${topics.length !== 1 ? 's' : ''}…`
                  : `Generate ${topics.length > 0 ? topics.length : ''} Carousel${topics.length !== 1 ? 's' : ''}`}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setResults(null); setTopicsText('') }} style={{
                flex: 1, padding: '9px 16px', background: 'transparent', border: '1px solid #3f3f46',
                borderRadius: 8, color: '#a1a1aa', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Generate More
              </button>
              <button onClick={onClose} style={{
                flex: 1, padding: '9px 16px', background: '#e07355', border: 'none',
                borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Open Library
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
