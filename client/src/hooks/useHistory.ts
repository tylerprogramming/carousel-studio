import { useCallback, useRef, useState } from 'react'

/**
 * Undo/redo state container.
 *
 * Typing into a text field shouldn't put one entry on the stack per keystroke,
 * so consecutive edits inside `COALESCE_MS` replace the top of the stack rather
 * than pushing a new entry. Pass `{ coalesce: false }` for discrete actions
 * (add/delete/reorder slide) that should always be their own undo step.
 */

const COALESCE_MS = 600
const LIMIT = 100

type Updater<T> = T | ((prev: T) => T)

function resolve<T>(next: Updater<T>, prev: T): T {
  return typeof next === 'function' ? (next as (p: T) => T)(prev) : next
}

export function useHistory<T>(initial: T) {
  const [past, setPast] = useState<T[]>([])
  const [present, setPresent] = useState<T>(initial)
  const [future, setFuture] = useState<T[]>([])
  const lastPush = useRef(0)

  const set = useCallback((next: Updater<T>, opts?: { coalesce?: boolean }) => {
    const coalesce = opts?.coalesce ?? true
    setPresent((prev) => {
      const value = resolve(next, prev)
      if (Object.is(value, prev)) return prev

      const now = Date.now()
      const merge = coalesce && now - lastPush.current < COALESCE_MS
      lastPush.current = now

      // Merging means the previous value never becomes its own undo step
      if (!merge) setPast((p) => [...p, prev].slice(-LIMIT))
      setFuture([])
      return value
    })
  }, [])

  /** Replace the value without touching history — for loading a saved carousel. */
  const reset = useCallback((value: T) => {
    setPast([])
    setFuture([])
    lastPush.current = 0
    setPresent(value)
  }, [])

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p
      const previous = p[p.length - 1]
      setPresent((cur) => {
        setFuture((f) => [cur, ...f].slice(0, LIMIT))
        return previous
      })
      lastPush.current = 0
      return p.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      const next = f[0]
      setPresent((cur) => {
        setPast((p) => [...p, cur].slice(-LIMIT))
        return next
      })
      lastPush.current = 0
      return f.slice(1)
    })
  }, [])

  return {
    state: present,
    set,
    reset,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
