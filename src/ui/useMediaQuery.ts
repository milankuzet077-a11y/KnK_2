import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  const getSnapshot = () => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  }

  const subscribe = (onStoreChange: () => void) => {
    if (typeof window === 'undefined') return () => {}
    const mql = window.matchMedia(query)

    // odmah obavesti (pokriva edge slučajeve kod ulaska/izlaska)
    onStoreChange()

    const handler = () => onStoreChange()

    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    } else {
      // Safari fallback
      // @ts-ignore
      mql.addListener(handler)
      // @ts-ignore
      return () => mql.removeListener(handler)
    }
  }

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}