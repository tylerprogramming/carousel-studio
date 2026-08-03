import { useEffect, useState } from 'react'
import { Settings, saveSettings, useSettings } from '../hooks/useSettings'
import { useHealth } from '../hooks/useHealth'
import { cn } from '../lib/utils'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'

/**
 * settings.json, with a screen.
 *
 * There was no settings UI at all. `saveSettings` existed in the hook and
 * nothing called it, so every setting — the handle printed on every slide, the
 * export directory, the typefaces — meant editing JSON by hand and restarting.
 * Custom fonts shipped in 2.2.0 and were unreachable for exactly this reason:
 * the feature worked and there was no way to turn it on.
 *
 * Only the settings that change something you can see are here. `pythonPath`,
 * `likenessPath` and the video ones stay in the file: they are set once, if
 * ever, and a screen full of fields nobody touches makes the ones that matter
 * harder to find. What this does show is what the machine can actually do,
 * because that is the question people open settings to answer.
 *
 * Nothing needs a restart. The renderer reads settings per request and saving
 * clears the server's cache, so a font change lands on the next render.
 */

interface FontFile {
  file: string
  url: string
  vendored: boolean
  selectedAs: 'body' | 'mono' | null
}

interface Props { onClose: () => void }

export default function SettingsModal({ onClose }: Props) {
  const { settings } = useSettings()
  const health = useHealth()
  const [draft, setDraft] = useState<Settings>(settings)
  const [fonts, setFonts] = useState<FontFile[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setDraft(settings), [settings])
  useEffect(() => {
    fetch('/api/fonts').then((r) => r.json()).then(setFonts).catch(() => setFonts([]))
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setDraft((d) => ({ ...d, [k]: v })); setSaved(false)
  }

  async function save() {
    setSaving(true); setError('')
    try {
      await saveSettings(draft)
      setSaved(true)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  /** A font row. Empty `file` means "use the vendored default". */
  const FontChoice = ({ role, value }: { role: 'fontPath' | 'monoFontPath'; value: string }) => (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => set(role, '')}
        className={cn('rounded border px-2 py-1 text-[11px] transition',
          !value ? 'border-primary bg-primary/10 font-medium' : 'border-input hover:bg-muted')}>
        Default
      </button>
      {fonts.map((f) => (
        <button key={f.file} onClick={() => set(role, f.file)}
          title={f.file}
          className={cn('rounded border px-2 py-1 text-[11px] transition',
            value === f.file ? 'border-primary bg-primary/10 font-medium' : 'border-input hover:bg-muted')}>
          {f.file.replace(/\.(ttf|otf|ttc|woff2)$/i, '')}
        </button>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background p-5 shadow-xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">Close</button>
        </div>

        <Label className="mb-1 block">Handle</Label>
        <Input value={draft.handle ?? ''} onChange={(e) => set('handle', e.target.value)}
               placeholder="@yourhandle" />
        <p className="mb-4 mt-1 text-[10px] text-muted-foreground">
          Printed on every slide and shown in the phone previews.
        </p>

        <Label className="mb-1 block">Body typeface</Label>
        <FontChoice role="fontPath" value={draft.fontPath ?? ''} />
        <p className="mb-3 mt-1 text-[10px] text-muted-foreground">
          Drop a <code>.ttf</code> in <code>fonts/</code> and it appears here. The browser is
          served the same file the renderer draws with, so the preview keeps up.
        </p>

        <Label className="mb-1 block">Monospace typeface</Label>
        <FontChoice role="monoFontPath" value={draft.monoFontPath ?? ''} />
        <p className="mb-4 mt-1 text-[10px] text-muted-foreground">
          Used by the terminal variant. Default searches Menlo, Monaco, then the
          vendored JetBrains Mono.
        </p>

        <Label className="mb-1 block">Brand voice</Label>
        <Textarea value={draft.brandVoice ?? ''} onChange={(e) => set('brandVoice', e.target.value)}
                  rows={2} placeholder="Blunt and practical. No hype. Short sentences." />
        <p className="mb-4 mt-1 text-[10px] text-muted-foreground">
          Appended to the caption prompt. Only affects generated copy.
        </p>

        <Label className="mb-1 block">Export folder</Label>
        <Input value={draft.exportDir ?? ''} onChange={(e) => set('exportDir', e.target.value)}
               placeholder="./exports" />
        <p className="mb-5 mt-1 text-[10px] text-muted-foreground">
          Where finished carousels are written. <code>~</code> works. Point it at a content
          repo to export straight into it.
        </p>

        <button onClick={save} disabled={saving}
          className="w-full rounded bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50">
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
        {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
        {saved && (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            No restart needed — the next render picks this up.
          </p>
        )}

        {/* Read-only, because it is diagnosis rather than configuration. This is
            the question people open settings to answer when an export fails. */}
        {health && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">This machine</p>
            <dl className="space-y-1 text-[11px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Renders slides</dt>
                <dd className={health.capabilities.render ? 'text-green-700' : 'text-red-600'}>
                  {health.capabilities.render ? 'yes' : 'no — Pillow not found'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Renders video</dt>
                <dd className={health.capabilities.video ? 'text-green-700' : 'text-amber-700'}>
                  {health.capabilities.video ? 'yes' : 'no — ffmpeg not found'}
                </dd>
              </div>
              {health.python && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Python</dt>
                  <dd className="truncate font-mono text-[10px] text-muted-foreground" title={health.python.bin}>
                    {health.python.version} · Pillow {health.python.pillow}
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Set with <code>pythonPath</code> in settings.json if you have more than one Python.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
