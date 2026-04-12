import { useState, useEffect } from 'react'
import { Slide, genId } from '../types'

const BLUE       = '#5B6CF2'
const BLUE_LIGHT = '#EEF0FD'
const BLUE_HOVER = '#4A59E0'
const TEXT       = '#1C1E2E'
const MUTED      = '#8890A4'
const BORDER     = '#E5EAF5'
const BG         = '#F0F4FF'

interface Framework {
  id: string; name: string; emoji: string; description: string; slideCount: number; slides: any[]
}
interface Props {
  onClose: () => void
  onGenerated: (slides: Slide[], title: string) => void
  platform: 'instagram' | 'linkedin' | 'tiktok'
}

export default function GenerateModal({ onClose, onGenerated, platform }: Props) {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [selectedFw, setSelectedFw] = useState('educational')
  const [topic, setTopic]           = useState('')
  const [handle, setHandle]         = useState('@tylerreed')
  const [loading, setLoading]       = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError]           = useState('')

  useEffect(() => {
    fetch('/api/frameworks').then((r) => r.json()).then((d) => setFrameworks(Array.isArray(d) ? d : [])).catch(() => setError('Could not load frameworks'))
  }, [])

  async function handleGenerate() {
    if (!topic.trim()) { setError('Enter a topic first'); return }
    setLoading(true); setError('')
    const msgs = ['Thinking about your topic...', 'Writing headlines...', 'Crafting emphasis lines...', 'Adding body text...', 'Finishing up...']
    let idx = 0; setLoadingMsg(msgs[0])
    const iv = setInterval(() => { idx = (idx + 1) % msgs.length; setLoadingMsg(msgs[idx]) }, 1800)
    try {
      const res  = await fetch('/api/ai-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: topic.trim(), frameworkId: selectedFw, platform, handle }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onGenerated(data.slides.map((s: any) => ({ ...s, id: genId() })), data.title)
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      clearInterval(iv); setLoading(false)
    }
  }

  const selected = frameworks.find((f) => f.id === selectedFw)

  const fieldLabel = (text: string) => (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>{text}</label>
  )

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,24,60,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 22, width: 680, maxWidth: '95vw', maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 80px rgba(20,24,60,0.22), 0 0 0 1px rgba(91,108,242,0.12)',
      }} className="animate-fade-in">

        {/* Header */}
        <div style={{ padding: '22px 26px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: BLUE_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L12 7.5L18 10L12 12.5L10 18L8 12.5L2 10L8 7.5L10 2Z" stroke={BLUE} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em' }}>Generate with AI</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>Topic + framework → full carousel in seconds</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 8, background: BG, border: `1px solid ${BORDER}`, color: MUTED, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '22px 26px', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Topic */}
          <div>
            {fieldLabel('Topic / Prompt')}
            <textarea
              value={topic} onChange={(e) => setTopic(e.target.value)} rows={3}
              placeholder={"e.g. 5 Claude Code features most people miss\ne.g. Why I quit my 9-5 to build AI tools"}
              style={{
                width: '100%', background: BG, border: `1.5px solid ${BORDER}`, borderRadius: 11,
                padding: '12px 14px', color: TEXT, fontSize: 14, lineHeight: 1.6,
                resize: 'vertical', outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = BLUE)}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
            />
            <div style={{ fontSize: 11, color: MUTED, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600, color: MUTED }}>⌘</kbd>
              <kbd style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 600, color: MUTED }}>Enter</kbd>
              <span>to generate</span>
            </div>
          </div>

          {/* Handle */}
          <div>
            {fieldLabel('Your Handle')}
            <input
              value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle"
              style={{
                width: 200, background: BG, border: `1.5px solid ${BORDER}`, borderRadius: 10,
                padding: '9px 12px', color: TEXT, fontSize: 13, outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = BLUE)}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
            />
          </div>

          {/* Frameworks */}
          <div>
            {fieldLabel('Framework')}
            {frameworks.length === 0 ? (
              <div style={{ color: MUTED, fontSize: 13 }}>Loading frameworks...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {frameworks.map((fw) => (
                  <button
                    key={fw.id}
                    onClick={() => setSelectedFw(fw.id)}
                    style={{
                      background: selectedFw === fw.id ? BLUE_LIGHT : '#FAFBFF',
                      border: selectedFw === fw.id ? `2px solid ${BLUE}` : `1.5px solid ${BORDER}`,
                      borderRadius: 13, padding: '14px 16px', textAlign: 'left',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{fw.emoji}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: TEXT, marginBottom: 3 }}>{fw.name}</div>
                    <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.4 }}>{fw.description}</div>
                    <div style={{ fontSize: 11, color: BLUE, marginTop: 7, fontWeight: 600 }}>{fw.slideCount} slides</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Slide structure preview */}
          {selected && (
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 11, padding: '13px 15px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 9 }}>Slide Structure</div>
              {selected.slides.map((s: any) => (
                <div key={s.slideNumber} style={{ display: 'flex', gap: 10, marginBottom: 4, fontSize: 12.5 }}>
                  <span style={{ color: BLUE, fontWeight: 700, minWidth: 20, fontSize: 11 }}>{s.slideNumber}</span>
                  <span style={{ color: MUTED, textTransform: 'capitalize', minWidth: 60, fontSize: 11 }}>{s.type}</span>
                  <span style={{ color: TEXT, opacity: 0.7, fontSize: 11 }}>{s.purpose?.slice(0, 70)}{s.purpose?.length > 70 ? '…' : ''}</span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 10, padding: '11px 14px', color: '#DC2626', fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 26px', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12, background: '#FAFBFF' }}>
          {loading && (
            <div style={{ fontSize: 13, color: MUTED, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 15 }}>⟳</span>
              {loadingMsg}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{ padding: '9px 20px', background: BG, border: `1.5px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >Cancel</button>
            <button
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              style={{
                padding: '9px 26px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                background: loading || !topic.trim() ? BORDER : BLUE,
                color: loading || !topic.trim() ? MUTED : '#fff',
                cursor: loading || !topic.trim() ? 'default' : 'pointer',
                transition: 'all 0.15s',
                boxShadow: loading || !topic.trim() ? 'none' : '0 2px 10px rgba(91,108,242,0.35)',
              }}
              onMouseEnter={(e) => { if (!loading && topic.trim()) e.currentTarget.style.background = BLUE_HOVER }}
              onMouseLeave={(e) => { if (!loading && topic.trim()) e.currentTarget.style.background = BLUE }}
            >
              {loading ? 'Generating…' : '✨ Generate Carousel'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
