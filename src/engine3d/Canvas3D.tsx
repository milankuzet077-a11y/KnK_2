import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KitchenShape, Walls } from '../domain/types'
import type { RenderableItem } from './shared'
import { markPerf } from './metrics/perf'
import type { OptionsValues } from '../ui/options/types'
import type { Subcat } from '../ui/step3/types'
import type { SceneRuntime } from './sceneRuntime'

type Props = {
  shape: KitchenShape
  walls: Walls
  items?: RenderableItem[]
  optionsValues?: OptionsValues
  selected?: string | null
  onSelect?: (id: string | null) => void
  onRuntimeError?: () => void
  activeElementsSubcat?: Subcat
}

const FATAL_MESSAGE = '3D prikaz trenutno nije dostupan.'

const sceneRuntimeModulePromise = import('./sceneRuntime')
const renderItemsModulePromise = import('./renderItems')
const selectionModulePromise = import('./selection')

async function createRuntimeModule(params: Parameters<(typeof import('./sceneRuntime'))['createSceneRuntime']>[0]) {
  const mod = await sceneRuntimeModulePromise
  return mod.createSceneRuntime(params)
}

async function renderItemsModule(params: Parameters<(typeof import('./renderItems'))['renderSceneItems']>[0]) {
  const mod = await renderItemsModulePromise
  return mod.renderSceneItems(params)
}

async function syncSelectionModule(runtime: SceneRuntime, selected: string | null | undefined) {
  const mod = await selectionModulePromise
  mod.syncSelection(runtime, selected)
}

export function Canvas3D({ shape, walls, items = [], optionsValues, selected, onSelect, onRuntimeError, activeElementsSubcat }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<SceneRuntime | null>(null)
  const onSelectRef = useRef<Props['onSelect']>(onSelect)
  const onRuntimeErrorRef = useRef<Props['onRuntimeError']>(onRuntimeError)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const renderCleanupRef = useRef<(() => void) | null>(null)
  const latestItemsRef = useRef<RenderableItem[]>(items)
  const latestOptionsValuesRef = useRef<Props['optionsValues']>(optionsValues)
  const latestSelectedRef = useRef<Props['selected']>(selected)
  const latestActiveElementsSubcatRef = useRef<Props['activeElementsSubcat']>(activeElementsSubcat)
  const renderSequenceRef = useRef(0)
  const selectionSequenceRef = useRef(0)

  useEffect(() => {
    onSelectRef.current = onSelect
    onRuntimeErrorRef.current = onRuntimeError
  }, [onSelect, onRuntimeError])

  useEffect(() => {
    latestItemsRef.current = items
    latestOptionsValuesRef.current = optionsValues
    latestSelectedRef.current = selected
    latestActiveElementsSubcatRef.current = activeElementsSubcat
  }, [items, optionsValues, selected, activeElementsSubcat])

  const wallsKey = useMemo(() => {
    const wallA = Math.round(Number(walls.A || 0))
    const wallB = Math.round(Number(walls.B || 0))
    const wallC = Math.round(Number(walls.C || 0))
    return `${shape}|${wallA}|${wallB}|${wallC}`
  }, [shape, walls.A, walls.B, walls.C])

  const waitForHostReady = useCallback(async (host: HTMLDivElement) => {
    let stableFrames = 0
    let lastWidth = 0
    let lastHeight = 0

    for (let attempt = 0; attempt < 24; attempt += 1) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      const rect = host.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)

      if (width > 0 && height > 0) {
        if (width === lastWidth && height === lastHeight) {
          stableFrames += 1
        } else {
          stableFrames = 1
          lastWidth = width
          lastHeight = height
        }
        if (stableFrames >= 2) return true
      }
    }

    return false
  }, [])

  const renderCurrentScene = useCallback(async (runtime: SceneRuntime) => {
    const renderSequence = ++renderSequenceRef.current
    renderCleanupRef.current?.()
    const cleanup = await renderItemsModule({
      runtime,
      items: latestItemsRef.current,
      optionsValues: latestOptionsValuesRef.current,
      shape,
      walls,
      selectedId: latestSelectedRef.current,
      activeElementsSubcat: latestActiveElementsSubcatRef.current,
    })

    if (renderSequence !== renderSequenceRef.current) {
      cleanup?.()
      return
    }

    renderCleanupRef.current = cleanup
  }, [shape, walls])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let retryTimeoutId = 0
    let retryAttempts = 0

    const cleanupRuntime = () => {
      renderSequenceRef.current += 1
      renderCleanupRef.current?.()
      renderCleanupRef.current = null
      runtimeRef.current?.dispose()
      runtimeRef.current = null
    }

    const scheduleRetry = (delayMs: number) => {
      window.clearTimeout(retryTimeoutId)
      retryTimeoutId = window.setTimeout(() => {
        void initRuntime()
      }, delayMs)
    }

    const initRuntime = async () => {
      if (cancelled || runtimeRef.current) return

      setFatalError(null)
      const hostReady = await waitForHostReady(host)
      if (cancelled || runtimeRef.current) return
      if (!hostReady) {
        retryAttempts += 1
        if (retryAttempts >= 4) {
          setFatalError(FATAL_MESSAGE)
          onRuntimeErrorRef.current?.()
          return
        }
        scheduleRetry(200 * retryAttempts)
        return
      }

      cleanupRuntime()
      markPerf('threeMountedAt')
      const runtime = await createRuntimeModule({
        host,
        shape,
        walls,
        onSelect: (id) => onSelectRef.current?.(id),
        onRuntimeError: () => onRuntimeErrorRef.current?.(),
        setFatalError,
      })

      if (cancelled) {
        runtime?.dispose()
        return
      }

      if (runtime) {
        runtimeRef.current = runtime
        await renderCurrentScene(runtime)
        window.requestAnimationFrame(() => markPerf('initialSceneRenderedAt'))
        retryAttempts = 0
        return
      }

      retryAttempts += 1
      if (retryAttempts >= 4) {
        setFatalError(FATAL_MESSAGE)
        onRuntimeErrorRef.current?.()
        return
      }
      scheduleRetry(200 * retryAttempts)
    }

    const handleRecoverableChange = () => {
      if (runtimeRef.current || cancelled) return
      window.clearTimeout(retryTimeoutId)
      void initRuntime()
    }

    cleanupRuntime()
    void initRuntime()

    window.addEventListener('resize', handleRecoverableChange)
    window.addEventListener('orientationchange', handleRecoverableChange)
    document.addEventListener('visibilitychange', handleRecoverableChange)

    return () => {
      cancelled = true
      window.clearTimeout(retryTimeoutId)
      window.removeEventListener('resize', handleRecoverableChange)
      window.removeEventListener('orientationchange', handleRecoverableChange)
      document.removeEventListener('visibilitychange', handleRecoverableChange)
      cleanupRuntime()
    }
  }, [renderCurrentScene, shape, waitForHostReady, wallsKey, walls.A, walls.B, walls.C])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    void renderCurrentScene(runtime)
    return () => {
      renderSequenceRef.current += 1
      renderCleanupRef.current?.()
      renderCleanupRef.current = null
    }
  }, [items, optionsValues, renderCurrentScene, selected, activeElementsSubcat])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    const selectionSequence = ++selectionSequenceRef.current
    void syncSelectionModule(runtime, selected).then(() => {
      if (selectionSequence !== selectionSequenceRef.current) return
    })
  }, [items, selected])

  return (
    <>
      <div ref={hostRef} data-scene-zoom-root="true" style={{ position: 'absolute', inset: 0 }} />
      {fatalError ? (
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
          <div style={{ maxWidth: 360, lineHeight: 1.5 }}>{fatalError}</div>
        </div>
      ) : null}
    </>
  )
}
