import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'

/*
 * Putanja: src/engine3d/Canvas3DLazy.tsx
 *
 * Ovde se pre 3D prikaza unapred pripremaju modeli i teksture.
 * To ne menja direktno boju ili senku, ali menja koliko brzo i kojim kvalitetom
 * će se završni izgled pojaviti na ekranu.
 */
import type { KitchenShape, PlacedItem, Walls } from '../domain/types'
import type { WorktopVirtualItem } from '../domain/shapes/shared/worktopVirtual'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import type { OptionsValues } from '../ui/options/types'
import type { Subcat } from '../ui/step3/types'
import { markPerf } from './metrics/perf'
import { detectQualityProfile } from './quality'

const Canvas3D = lazy(() => {
  markPerf('threeRequestedAt')
  return import('./Canvas3D').then((m) => ({ default: m.Canvas3D }))
})

type RenderableItem = PlacedItem | WorktopVirtualItem

type Props = {
  shape: KitchenShape
  walls: Walls
  items?: RenderableItem[]
  optionsValues?: OptionsValues
  selected?: string | null
  onSelect?: (id: string | null) => void
  activeElementsSubcat?: Subcat
  areFrontsVisible?: boolean
}

function Canvas3DFallback({ message }: { message?: string }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.82)',
        background: '#0b0f14',
      }}
    >
      <div style={{ maxWidth: 360, lineHeight: 1.5, position: 'relative', zIndex: 1 }}>
        {message ?? '3D prikaz trenutno nije dostupan, ali možete nastaviti konfiguraciju.'}
      </div>
    </div>
  )
}

export function Canvas3DLazy(props: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isActivated, setIsActivated] = useState(true)
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden))
  const quality = useMemo(() => detectQualityProfile(), [])

  useEffect(() => {
    markPerf('qualityTier', quality.tier)
    markPerf('step3CanvasActivatedAt')
  }, [quality])


  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibility = () => setIsDocumentVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        setIsVisible(entry.isIntersecting && entry.intersectionRatio > 0.15)
      },
      { threshold: [0.15, 0.35, 0.6] },
    )

    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isActivated || !isVisible) return

    let cancelled = false
    const prime = async () => {
      const [{ getFrontTextureConfig, getWorktopTextureConfig }, { primeTextureSet }, { preloadSceneAssetsForItems }] = await Promise.all([
        import('./materials/catalog'),
        import('./materials/textureService'),
        import('./modelLoader'),
      ])
      if (cancelled) return

      const uniqueFrontDecor = Array.from(
        new Set(
          (props.items ?? [])
            .map((item) => ('decor' in item ? item.decor : null))
            .filter((value): value is string => Boolean(value)),
        ),
      )

      // Ovde unapred zagrevamo teksture i modele da bi prvi ulazak u 3D bio mirniji.
      const jobs: Promise<unknown>[] = []
      const worktopTexture = getWorktopTextureConfig(props.optionsValues?.worktop)
      if (worktopTexture) jobs.push(primeTextureSet(worktopTexture, quality.worktopTextureMode, quality.textureAnisotropy))
      uniqueFrontDecor.forEach((decor) => {
        const config = getFrontTextureConfig(decor)
        if (config) jobs.push(primeTextureSet(config, quality.frontTextureMode, quality.textureAnisotropy))
      })
      const prefetchItems = (props.items ?? []).filter((item) => String(item.catalogId || '') !== '__virtual__').slice(0, quality.modelPrefetchLimit)
      jobs.push(preloadSceneAssetsForItems(prefetchItems))
      await Promise.allSettled(jobs)
    }

    void prime()
    return () => {
      cancelled = true
    }
  }, [isActivated, isVisible, props.items, props.optionsValues?.worktop, quality])

  const shouldRun = isActivated && isVisible && isDocumentVisible

  return (
    <div ref={rootRef} style={{ position: 'absolute', inset: 0 }}>
      <ErrorBoundary fallback={() => <Canvas3DFallback />}>
        <Suspense fallback={<Canvas3DFallback message="Učitavanje 3D prikaza..." />}>
          <Canvas3D {...props} shouldRun={shouldRun} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
