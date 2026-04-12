import { useState, useLayoutEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )
  useLayoutEffect(() => {
    const media = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [query])
  return matches
}

export function useIsMobile() { return useMediaQuery('(max-width: 767px)') }
export function useIsTablet()  { return useMediaQuery('(min-width: 768px) and (max-width: 1023px)') }
export function useIsWide()    { return useMediaQuery('(min-width: 1300px)') }
