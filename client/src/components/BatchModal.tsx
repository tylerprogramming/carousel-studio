import { useState, useEffect } from 'react'

const BLUE       = '#5B6CF2'
const BLUE_LIGHT = '#EEF0FD'
const BLUE_HOVER = '#4A59E0'
const TEXT       = '#1C1E2E'
const MUTED      = '#8890A4'
const BORDER     = '#E5EAF5'
const BG         = '#F0F4FF'
const WHITE      = '#FFFFFF'

interface Framework {
  id: string
  name: string
  description: string
  emoji: string
}

interface BatchResult {
  id: string
  title: string
  savedAt: string
  error?: string
}

interface BatchModalProps {
  onClose: () => void
  onDone: () => void
}

export default function BatchModal({ onClose, onDone }: BatchModalProps) {
  const [frameworks, setFrameworks]   = useState<Framework[]>([])
  const [frameworkId, setFrameworkId] = useState('')
  const [topicsText, setTopicsText]   = useState('')
  const [generating, setGenerating]   = useState(false)
  const [results, setResults]         = useState<BatchResult[] | null>(null)
  const [error, setError]             = useState('')

  useEffect(() => {
    fetch('/api/frameworks')
      .then((r) => r.json())
      .then((data: Framework[]) => {
        setFrameworks(data)
        if (data.length > 0) setFrameworkId(data[0].id)
      })
      .catch(() => {})
  }, [])

  const topics = topicsText.split('\n').map((t) => t.trim()).filter(Boolean)

  async function handleGenerate() {
    if (topics.length === 0) { setError('Enter at least one topic'); return }
    if (!frameworkId) { setError('Pick a framework'); return }
    setError(''); setGenerating(true); setResults(null)
    try {
      const items = topics.map((topic) => ({ topic, frameworkId, platform: 'instagram' }))
      const res   = await fetch('/api/bulk-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) })
      const data  = await res.json()
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
  const failed    = results?.filter((r) =>  r.error).length ?? 0

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,24,60,0.45)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: WHITE, borderRadius: 22, padding: '0', width: 520, maxWidth: '95vw', maxHeight: '88vh',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 30px 80px rgba(20,24,60,0.2), 0 0 0 1px rgba(91,108,242,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in"
      >
        {/* Header */}
        <div style={{ padding: '22px 26px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L11.5 7H17L12.5 10.5L14 15.5L10 12.5L6 15.5L7.5 10.5L3 7H8.5L10 2Z" stroke="#7C3AED" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>Batch Generate</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>Create multiple carousels at once</div>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 8, background: BG, border: `1px solid ${BORDER}`, color: MUTED, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Topics */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Topics — one per line
            </label>
            <textarea
              value={topicsText}
              onChange={(e) => setTopicsText(e.target.value)}
              placeholder={'5 Claude Code features beginners miss\nHow to use Claude Code for YouTube research\nBest AI tools for content creators in 2025'}
              rows={6}
              style={{
                width: '100%', background: BG, border: `1.5px solid ${BORDER}`, borderRadius: 11,
                color: TEXT, padding: '12px 14px', fontSize: 13, resize: 'vertical',
                outline: 'none', fontFamily: 'inherit', lineHeight: 1.6, transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = BLUE)}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
            />
            {topics.length > 0 && (
              <div style={{ fontSize: 12, color: BLUE, marginTop: 6, fontWeight: 600 }}>
                {topics.length} carousel{topics.length !== 1 ? 's' : ''} queued
              </div>
            )}
          </div>

          {/* Framework */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Framework
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {frameworks.map((fw) => (
                <button
                  key={fw.id}
                  onClick={() => setFrameworkId(fw.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    background: frameworkId === fw.id ? BLUE_LIGHT : '#FAFBFF',
                    border: `1.5px solid ${frameworkId === fw.id ? BLUE : BORDER}`,
                    borderRadius: 11, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{fw.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: TEXT }}>{fw.name}</div>
                    <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{fw.description}</div>
                  </div>
                  {frameworkId === fw.id && (
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4.2 7.2L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 10, padding: '11px 14px', color: '#DC2626', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Results */}
          {results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: succeeded > 0 ? '#16A34A' : MUTED }}>
                {succeeded} generated{failed > 0 ? `, ${failed} failed` : ''} — saved to your library
              </div>
              {results.map((r, i) => (
                <div
                  key={i}
                  style={{
                    background: r.error ? '#FFF1F2' : '#F0FDF4',
                    border: `1px solid ${r.error ? '#FECDD3' : '#BBF7D0'}`,
                    borderRadius: 10, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span style={{ fontSize: 14, color: r.error ? '#DC2626' : '#16A34A', fontWeight: 700 }}>{r.error ? '✗' : '✓'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>{r.title || topics[i]}</div>
                    {r.error && <div style={{ color: '#DC2626', fontSize: 11, marginTop: 2 }}>{r.error}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 26px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10, background: '#FAFBFF' }}>
          {!results ? (
            <>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: '10px 16px', background: BG, border: `1.5px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={handleGenerate}
                disabled={generating || topics.length === 0}
                style={{
                  flex: 2, padding: '10px 16px', border: 'none', borderRadius: 10,
                  background: generating || topics.length === 0 ? BORDER : '#7C3AED',
                  color: generating || topics.length === 0 ? MUTED : WHITE,
                  fontSize: 13, fontWeight: 700,
                  cursor: generating || topics.length === 0 ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: generating || topics.length === 0 ? 'none' : '0 2px 10px rgba(124,58,237,0.3)',
                }}
              >
                {generating
                  ? `Generating ${topics.length} carousel${topics.length !== 1 ? 's' : ''}…`
                  : `⚡ Generate ${topics.length > 0 ? topics.length : ''} Carousel${topics.length !== 1 ? 's' : ''}`}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setResults(null); setTopicsText('') }}
                style={{ flex: 1, padding: '10px 16px', background: BG, border: `1.5px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >Generate More</button>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: '10px 16px', background: BLUE, border: 'none', borderRadius: 10, color: WHITE, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 10px rgba(91,108,242,0.3)' }}
              >Open Library</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
