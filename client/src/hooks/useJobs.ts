import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Background job tracking.
 *
 * Jobs live on the server, so generation no longer blocks the editor: start one,
 * keep working, switch slides, even reload the page. This hook polls while
 * anything is running and hands finished results to the caller exactly once.
 */

export interface JobResult {
  slideNumber?: number
  url: string
  filename: string
}

export interface Job {
  id: string
  kind: 'bg-image'
  label: string
  carouselId?: string
  scope: 'single' | 'all' | 'each'
  model?: string
  status: 'running' | 'done' | 'error' | 'cancelled'
  total: number
  done: number
  results: JobResult[]
  errors: string[]
  createdAt: number
  finishedAt?: number
}

const POLL_MS = 1500

export function useJobs(carouselId: string, carouselTitle: string, onComplete: (job: Job) => void) {
  const [jobs, setJobs] = useState<Job[]>([])
  const handled = useRef<Set<string>>(new Set())
  // Keep the latest callback without making the polling effect depend on it
  const cb = useRef(onComplete)
  useEffect(() => { cb.current = onComplete }, [onComplete])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs?carouselId=${encodeURIComponent(carouselId)}`)
      if (!res.ok) return
      const list: Job[] = await res.json()
      setJobs(list)
      for (const j of list) {
        if (j.status === 'done' && !handled.current.has(j.id)) {
          handled.current.add(j.id)
          cb.current(j)
        }
      }
    } catch { /* server restarting, try again next tick */ }
  }, [carouselId])

  // Poll only while something is running; one immediate check on mount so a
  // job started before a page reload is picked back up.
  const active = jobs.some((j) => j.status === 'running')
  useEffect(() => {
    refresh()
    if (!active) return
    const t = setInterval(refresh, POLL_MS)
    return () => clearInterval(t)
  }, [refresh, active])

  const start = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/jobs/generate-bg', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, carouselId, carouselTitle }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not start generation')
    await refresh()
    return data.jobId as string
  }, [carouselId, carouselTitle, refresh])

  const cancel = useCallback(async (id: string) => {
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' }).catch(() => {})
    refresh()
  }, [refresh])

  const running = useMemo(() => jobs.filter((j) => j.status === 'running'), [jobs])

  return { jobs, running, start, cancel, refresh }
}
