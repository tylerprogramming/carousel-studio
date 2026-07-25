import { Job } from '../hooks/useJobs'
import { cn } from '../lib/utils'

/**
 * Running jobs, shown as a compact strip so generation is visible from anywhere
 * in the app rather than only inside the panel that started it.
 */
export default function JobStrip({ jobs, onCancel }: { jobs: Job[]; onCancel: (id: string) => void }) {
  if (!jobs.length) return null

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-brand-light px-4 py-2">
      {jobs.map((j) => {
        const pct = j.total ? Math.round((j.done / j.total) * 100) : 0
        return (
          <div key={j.id} className="flex items-center gap-2 rounded-lg border border-brand/25 bg-card px-2.5 py-1">
            <span className="animate-spin-slow h-3 w-3 rounded-full border-2 border-border border-t-brand" />
            <span className="max-w-[220px] truncate text-[11px] font-semibold text-foreground" title={j.label}>
              {j.label}
            </span>
            {j.total > 1 && (
              <span className="text-[11px] tabular-nums text-muted-foreground">{j.done}/{j.total}</span>
            )}
            <div className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
              <div className={cn('h-full rounded-full bg-brand transition-all')} style={{ width: `${pct}%` }} />
            </div>
            <button
              onClick={() => onCancel(j.id)}
              title="Cancel"
              className="text-sm leading-none text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          </div>
        )
      })}
      <span className="text-[11px] text-muted-foreground">Keep working — this runs in the background.</span>
    </div>
  )
}
