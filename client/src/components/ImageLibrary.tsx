import { useState, useEffect } from 'react'
import { cn } from '../lib/utils'
import { Label } from './ui/label'

interface LibraryImage {
  filename: string
  url: string
  size: number
}

interface Props {
  onApply: (url: string) => void
  compact?: boolean
  refreshKey?: number
}

export default function ImageLibrary({ onApply, compact = false, refreshKey = 0 }: Props) {
  const [images, setImages]     = useState<LibraryImage[]>([])
  const [loading, setLoading]   = useState(false)
  const [hover, setHover]       = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [open, setOpen]         = useState(false)

  useEffect(() => {
    if (open) load()
  }, [open])

  // Auto-refresh when a new image is generated
  useEffect(() => {
    if (open && refreshKey > 0) load()
  }, [refreshKey])

  // Auto-open after first generation
  useEffect(() => {
    if (refreshKey > 0 && !open) {
      setOpen(true)
    }
  }, [refreshKey])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/images')
      const data = await res.json()
      setImages(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(filename: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(filename)
    await fetch(`/api/images/${filename}`, { method: 'DELETE' })
    setImages((prev) => prev.filter((img) => img.filename !== filename))
    setDeleting(null)
  }

  const cols = compact ? 2 : 3

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer',
          open
            ? 'bg-sky-50 border-sky-300 text-sky-700'
            : 'bg-secondary border-border text-muted-foreground hover:border-sky-300 hover:text-foreground'
        )}
      >
        <span>
          🗂 Image Library
          {images.length > 0 && !loading && (
            <span className={cn('ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]', open ? 'bg-sky-100 text-sky-600' : 'bg-muted text-muted-foreground')}>
              {images.length}
            </span>
          )}
        </span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2.5 animate-fade-in">
          {loading && (
            <div className="text-[11px] text-muted-foreground text-center py-4">
              Loading...
            </div>
          )}

          {!loading && images.length === 0 && (
            <div className="text-[11px] text-muted-foreground text-center py-5 px-2 bg-secondary rounded-lg border border-dashed border-border leading-relaxed">
              No images yet.<br />Generate one above.
            </div>
          )}

          {!loading && images.length > 0 && (
            <>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {images.map((img) => (
                  <div
                    key={img.filename}
                    onMouseEnter={() => setHover(img.filename)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onApply(img.url)}
                    title={img.filename}
                    className="relative rounded-lg overflow-hidden cursor-pointer ring-1 ring-border hover:ring-primary/50 transition-all duration-150"
                    style={{ aspectRatio: '4/5' }}
                  >
                    <img
                      src={img.url}
                      alt={img.filename}
                      className="w-full h-full object-cover block"
                    />

                    {hover === img.filename && (
                      <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); onApply(img.url) }}
                          className="px-3 py-1.5 rounded-md text-[11px] font-bold bg-primary text-primary-foreground cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          Apply
                        </button>
                        <button
                          onClick={(e) => handleDelete(img.filename, e)}
                          disabled={deleting === img.filename}
                          className={cn(
                            'px-2.5 py-1 rounded-md text-[10px] font-semibold bg-red-500/85 text-white cursor-pointer hover:bg-red-500 transition-colors',
                            deleting === img.filename && 'opacity-50 cursor-default'
                          )}
                        >
                          {deleting === img.filename ? '...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={load}
                className="mt-2 w-full py-1.5 text-[11px] font-semibold text-muted-foreground border border-border rounded-md hover:text-foreground hover:border-border/80 transition-colors cursor-pointer bg-secondary"
              >
                Refresh
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
