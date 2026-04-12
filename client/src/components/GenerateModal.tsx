import { useState, useEffect } from 'react'
import { Slide, genId } from '../types'

interface Framework {
  id: string; name: string; emoji: string; description: string; slideCount: number; slides: any[]
}
interface Props {
  onClose: () => void
  onGenerated: (slides: Slide[], title: string) => void
  platform: 'instagram' | 'linkedin'
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
    const msgs = ['Thinking about your topic...','Writing headlines...','Crafting emphasis lines...','Adding body text...','Finishing up...']
    let idx = 0; setLoadingMsg(msgs[0])
    const iv = setInterval(() => { idx = (idx+1)%msgs.length; setLoadingMsg(msgs[idx]) }, 1800)
    try {
      const res  = await fetch('/api/ai-generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ topic:topic.trim(), frameworkId:selectedFw, platform, handle }) })
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

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, backdropFilter:'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background:'#fff', borderRadius: 20, width: 660, maxWidth:'95vw', maxHeight:'88vh',
        overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 24px 14px', borderBottom:'1px solid #f0f0f0', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>✨</span>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:'#18181b' }}>Generate with AI</div>
            <div style={{ fontSize:12.5, color:'#71717a', marginTop:2 }}>Topic → framework → full carousel in seconds</div>
          </div>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'#a1a1aa', cursor:'pointer', fontSize:22, lineHeight:1, padding:'0 4px' }}>×</button>
        </div>

        <div style={{ overflowY:'auto', padding:'20px 24px', flex:1 }}>
          {/* Topic */}
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#71717a', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7 }}>Topic / Prompt</label>
            <textarea
              value={topic} onChange={(e) => setTopic(e.target.value)} rows={3}
              placeholder={"e.g. 5 Claude Code features most people miss\ne.g. Why I quit my 9-5 to build AI tools"}
              style={{ width:'100%', background:'#f9f9f9', border:'1px solid #e4e4e7', borderRadius:10, padding:'11px 13px', color:'#18181b', fontSize:14, lineHeight:1.6, resize:'vertical', outline:'none', transition:'border-color 0.15s' }}
              onFocus={(e) => (e.target.style.borderColor='#e07355')} onBlur={(e) => (e.target.style.borderColor='#e4e4e7')}
              onKeyDown={(e) => { if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) handleGenerate() }}
            />
            <div style={{ fontSize:11, color:'#a1a1aa', marginTop:4 }}>Cmd+Enter to generate</div>
          </div>

          {/* Handle */}
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#71717a', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:7 }}>Your Handle</label>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle"
              style={{ width:180, background:'#f9f9f9', border:'1px solid #e4e4e7', borderRadius:9, padding:'8px 11px', color:'#18181b', fontSize:13, outline:'none', transition:'border-color 0.15s' }}
              onFocus={(e) => (e.target.style.borderColor='#e07355')} onBlur={(e) => (e.target.style.borderColor='#e4e4e7')}
            />
          </div>

          {/* Frameworks */}
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#71717a', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Framework</label>
            {frameworks.length === 0 ? (
              <div style={{ color:'#a1a1aa', fontSize:13 }}>Loading...</div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
                {frameworks.map((fw) => (
                  <button key={fw.id} onClick={() => setSelectedFw(fw.id)} style={{
                    background: selectedFw===fw.id ? '#fff3f0' : '#f9f9f9',
                    border: selectedFw===fw.id ? '2px solid #e07355' : '1.5px solid #e4e4e7',
                    borderRadius:12, padding:'13px 15px', textAlign:'left', cursor:'pointer', transition:'all 0.15s',
                  }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{fw.emoji}</div>
                    <div style={{ fontSize:13.5, fontWeight:700, color:'#18181b', marginBottom:3 }}>{fw.name}</div>
                    <div style={{ fontSize:11.5, color:'#71717a', lineHeight:1.4 }}>{fw.description}</div>
                    <div style={{ fontSize:11, color:'#e07355', marginTop:6, fontWeight:600 }}>{fw.slideCount} slides</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Structure preview */}
          {selected && (
            <div style={{ background:'#f9f9f9', border:'1px solid #f0f0f0', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#71717a', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Slide Structure</div>
              {selected.slides.map((s: any) => (
                <div key={s.slideNumber} style={{ display:'flex', gap:10, marginBottom:3, fontSize:12 }}>
                  <span style={{ color:'#e07355', fontWeight:700, minWidth:18 }}>{s.slideNumber}</span>
                  <span style={{ color:'#a1a1aa', textTransform:'capitalize', minWidth:58 }}>{s.type}</span>
                  <span style={{ color:'#71717a' }}>{s.purpose?.slice(0,68)}{s.purpose?.length > 68 ? '...' : ''}</span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:9, padding:'10px 13px', color:'#dc2626', fontSize:13, marginBottom:14 }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid #f0f0f0', display:'flex', alignItems:'center', gap:12 }}>
          {loading && (
            <div style={{ fontSize:13, color:'#71717a', display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ display:'inline-block', animation:'spin 1s linear infinite', fontSize:15 }}>⟳</span>
              {loadingMsg}
            </div>
          )}
          <div style={{ marginLeft:'auto', display:'flex', gap:9 }}>
            <button onClick={onClose} style={{ padding:'9px 18px', background:'#f9f9f9', border:'1px solid #e4e4e7', borderRadius:9, color:'#18181b', fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancel</button>
            <button onClick={handleGenerate} disabled={loading || !topic.trim()} style={{
              padding:'9px 24px', borderRadius:9, border:'none', fontSize:13, fontWeight:700,
              background: loading || !topic.trim() ? '#f4f4f5' : '#e07355',
              color: loading || !topic.trim() ? '#a1a1aa' : '#fff',
              cursor: loading || !topic.trim() ? 'default' : 'pointer', transition:'all 0.15s',
            }}>
              {loading ? 'Generating...' : '✨ Generate Carousel'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
