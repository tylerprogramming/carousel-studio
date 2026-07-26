import { useCallback, useMemo, useReducer, useRef } from 'react'

/**
 * Undo/redo state container.
 *
 * Typing into a text field shouldn't put one entry on the stack per keystroke,
 * so consecutive edits inside `COALESCE_MS` replace the top of the stack rather
 * than pushing a new entry. Pass `{ coalesce: false }` for discrete actions
 * (add/delete/reorder slide) that should always be their own undo step.
 *
 * This is a reducer rather than three `useState`s on purpose. The previous
 * version called `setPast` and `setFuture` from inside the `setPresent`
 * updater, which made that updater impure. React 19 double-invokes updaters in
 * StrictMode, so every discrete action pushed onto `past` twice and undo needed
 * two presses in development. A reducer keeps each transition a single pure
 * function, so double-invoking it is harmless.
 */

const COALESCE_MS = 600
const LIMIT = 100

type Updater<T> = T | ((prev: T) => T)

interface History<T> {
  past: T[]
  present: T
  future: T[]
}

type Action<T> =
  | { type: 'set'; value: T; merge: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: T }

function reducer<T>(state: History<T>, action: Action<T>): History<T> {
  switch (action.type) {
    case 'set': {
      if (Object.is(action.value, state.present)) return state
      return {
        // Merging means the previous value never becomes its own undo step
        past: action.merge ? state.past : [...state.past, state.present].slice(-LIMIT),
        present: action.value,
        future: [],
      }
    }
    case 'undo': {
      if (!state.past.length) return state
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future].slice(0, LIMIT),
      }
    }
    case 'redo': {
      if (!state.future.length) return state
      return {
        past: [...state.past, state.present].slice(-LIMIT),
        present: state.future[0],
        future: state.future.slice(1),
      }
    }
    case 'reset':
      return { past: [], present: action.value, future: [] }
  }
}

export function useHistory<T>(initial: T) {
  const [state, dispatch] = useReducer(reducer<T>, { past: [], present: initial, future: [] })
  const lastPush = useRef(0)
  // The reducer must stay pure, so the updater is resolved and the coalesce
  // window is read out here, before dispatching.
  const presentRef = useRef(state.present)
  presentRef.current = state.present

  const set = useCallback((next: Updater<T>, opts?: { coalesce?: boolean }) => {
    const value = typeof next === 'function'
      ? (next as (p: T) => T)(presentRef.current)
      : next
    if (Object.is(value, presentRef.current)) return

    const now = Date.now()
    const merge = (opts?.coalesce ?? true) && now - lastPush.current < COALESCE_MS
    lastPush.current = now
    dispatch({ type: 'set', value, merge })
  }, [])

  /** Replace the value without touching history — for loading a saved carousel. */
  const reset = useCallback((value: T) => {
    lastPush.current = 0
    dispatch({ type: 'reset', value })
  }, [])

  const undo = useCallback(() => {
    lastPush.current = 0
    dispatch({ type: 'undo' })
  }, [])

  const redo = useCallback(() => {
    lastPush.current = 0
    dispatch({ type: 'redo' })
  }, [])

  return useMemo(() => ({
    state: state.present,
    set,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }), [state, set, reset, undo, redo])
}
