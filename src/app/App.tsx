// src/app/App.tsx
import React, { Suspense, lazy, useEffect, useLayoutEffect, useState } from 'react'
import type { KitchenShape, Walls } from '../domain/types'
import { canonicalizeWalls, getDefaultWallsForShape, parseProgress, parseShape } from '../domain/stateParsers'
import { Step1ChooseShape } from '../ui/Step1ChooseShape'
import { Step2Walls } from '../ui/Step2Walls'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { clearAllStep3Snapshots } from '../ui/step3/snapshot'
import { clearPwaRuntimeData } from '../pwa/runtime'

type Step = 1 | 2 | 3

const Step3Configurator = lazy(() => import('../ui/Step3Configurator').then((m) => ({ default: m.Step3Configurator })))

const STORAGE_VERSION = '4'

const STORAGE_KEYS = {
  shape: 'amk_shape',
  walls: 'amk_walls',
  wallInputs: 'amk_wall_inputs',
  progress: 'amk_progress',
  version: 'amk_storage_version',
  snapshot: 'amk_app_snapshot',
} as const

type Progress = {
  hasShape: boolean
  hasWalls: boolean
}

type WallInputs = Record<string, string>

type AppSnapshot = {
  version: string
  shape: KitchenShape
  walls: Walls
  wallInputs: WallInputs
  progress: Progress
}


function mmToCmInput(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return String(value / 10)
}

function buildWallInputs(shape: KitchenShape, walls: Walls): WallInputs {
  const defaults = canonicalizeWalls(shape, walls) ?? getDefaultWallsForShape(shape)
  return {
    A: mmToCmInput(defaults.A),
    B: mmToCmInput(defaults.B),
    C: mmToCmInput(defaults.C),
    D: mmToCmInput(defaults.D),
  }
}

function parseStoredWallInputs(value: unknown, fallback: WallInputs): WallInputs {
  if (!value || typeof value !== 'object') return fallback
  const input = value as Record<string, unknown>
  const pick = (key: keyof WallInputs) => (typeof input[key] === 'string' ? input[key] : fallback[key])
  return {
    A: pick('A'),
    B: pick('B'),
    C: pick('C'),
    D: pick('D'),
  }
}

function readWallInputsFromStorage(shape: KitchenShape, walls: Walls): WallInputs {
  const fallback = buildWallInputs(shape, walls)
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.wallInputs)
    if (!raw) return fallback
    return parseStoredWallInputs(JSON.parse(raw), fallback)
  } catch {
    return fallback
  }
}


function readWallsFromStorage(shape: KitchenShape): Walls | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.walls)
    if (!raw) return null
    return canonicalizeWalls(shape, JSON.parse(raw))
  } catch {
    return null
  }
}

function readShapeFromStorage(): KitchenShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.shape)
    if (!raw) return null
    return parseShape(raw)
  } catch {
    return null
  }
}

function readStepFromUrl(): Step | null {
  try {
    const sp = new URLSearchParams(window.location.search)
    const raw = sp.get('step')
    const n = Number(raw)
    if (n === 1 || n === 2 || n === 3) return n
    return null
  } catch {
    return null
  }
}

function readProgressFromStorage(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.progress)
    if (!raw) return { hasShape: false, hasWalls: false }
    return parseProgress(JSON.parse(raw))
  } catch {
    return { hasShape: false, hasWalls: false }
  }
}

function readSnapshotFromStorage(): AppSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.snapshot)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as Record<string, unknown>
    const version = typeof record.version === 'string' ? record.version : null
    const shape = parseShape(record.shape)
    const walls = shape ? canonicalizeWalls(shape, record.walls) : null
    const progress = parseProgress(record.progress)
    if (!version || !shape || !walls) return null
    const wallInputs = parseStoredWallInputs(record.wallInputs, buildWallInputs(shape, walls))
    return { version, shape, walls, wallInputs, progress }
  } catch {
    return null
  }
}

function writeProgressToStorage(p: Progress) {
  try {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(p))
  } catch {}
}

function writeSnapshotToStorage(shape: KitchenShape, walls: Walls, wallInputs: WallInputs, progress: Progress) {
  try {
    const canonicalWalls = canonicalizeWalls(shape, walls) ?? getDefaultWallsForShape(shape)
    const payload: AppSnapshot = {
      version: STORAGE_VERSION,
      shape,
      walls: canonicalWalls,
      wallInputs: parseStoredWallInputs(wallInputs, buildWallInputs(shape, canonicalWalls)),
      progress,
    }
    localStorage.setItem(STORAGE_KEYS.snapshot, JSON.stringify(payload))
  } catch {}
}

function persistAppState(params: { shape: KitchenShape; walls: Walls; wallInputs?: WallInputs; progress: Progress }) {
  const { shape, walls, wallInputs, progress } = params
  const canonicalWalls = canonicalizeWalls(shape, walls) ?? getDefaultWallsForShape(shape)
  try {
    localStorage.setItem(STORAGE_KEYS.shape, String(shape))
    localStorage.setItem(STORAGE_KEYS.walls, JSON.stringify(canonicalWalls))
    localStorage.setItem(
      STORAGE_KEYS.wallInputs,
      JSON.stringify(parseStoredWallInputs(wallInputs, buildWallInputs(shape, canonicalWalls)))
    )
    writeProgressToStorage(progress)
    writeSnapshotToStorage(shape, canonicalWalls, parseStoredWallInputs(wallInputs, buildWallInputs(shape, canonicalWalls)), progress)
  } catch {}
}

function clearAllLayoutKeys() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k === 'amk_layout' || k.startsWith('amk_layout::')) {
        localStorage.removeItem(k)
      }
    }
  } catch {}
}

function clearAllStorage() {
  try {
    localStorage.removeItem(STORAGE_KEYS.shape)
    localStorage.removeItem(STORAGE_KEYS.walls)
    localStorage.removeItem(STORAGE_KEYS.wallInputs)
    localStorage.removeItem(STORAGE_KEYS.progress)
    localStorage.removeItem(STORAGE_KEYS.snapshot)
    localStorage.removeItem(STORAGE_KEYS.version)
    clearAllLayoutKeys()
    clearAllStep3Snapshots()
  } catch {}
}

function clearLayoutStorage() {
  try {
    clearAllLayoutKeys()
    clearAllStep3Snapshots()
  } catch {}
}

function ensureStorageVersion() {
  try {
    const current = localStorage.getItem(STORAGE_KEYS.version)
    if (current !== STORAGE_VERSION) {
      localStorage.setItem(STORAGE_KEYS.version, STORAGE_VERSION)
    }
  } catch {}
}

function updateViewportForStep(step: Step) {
  if (typeof document === 'undefined') return
  let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
  if (!viewport) {
    viewport = document.createElement('meta')
    viewport.name = 'viewport'
    document.head.appendChild(viewport)
  }

  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content'
  )
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
}

function readCssPxVar(name: string) {
  if (typeof window === 'undefined') return 0
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function syncViewportMetrics() {
  if (typeof window === 'undefined') return

  const docEl = document.documentElement
  const vv = window.visualViewport
  const height = Math.round(vv?.height ?? window.innerHeight)
  docEl.style.setProperty('--app-height', `${height}px`)

  const rawSafeTop = readCssPxVar('--safe-top-raw')
  const rawSafeRight = readCssPxVar('--safe-right-raw')
  const rawSafeBottom = readCssPxVar('--safe-bottom-raw')
  const rawSafeLeft = readCssPxVar('--safe-left-raw')

  const iosStandalone = isIosDevice() && isStandaloneDisplayMode()
  docEl.classList.toggle('ios-standalone', iosStandalone)

  let safeTop = rawSafeTop
  if (iosStandalone) {
    const vvOffsetTop = Math.max(0, Math.round(vv?.offsetTop ?? 0))
    const portraitFallback = window.innerHeight >= window.innerWidth ? 48 : 0
    safeTop = Math.max(rawSafeTop, vvOffsetTop, portraitFallback)
  }

  docEl.style.setProperty('--safe-top', `${safeTop}px`)
  docEl.style.setProperty('--safe-right', `${rawSafeRight}px`)
  docEl.style.setProperty('--safe-bottom', `${rawSafeBottom}px`)
  docEl.style.setProperty('--safe-left', `${rawSafeLeft}px`)
}

function isInsideSceneZoomRoot(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('[data-scene-zoom-root="true"]')
}

function computeInitialStep(urlStep: Step | null, p: Progress): Step {
  const maxValidStep: Step = p.hasWalls ? 3 : p.hasShape ? 2 : 1
  if (urlStep) return Math.min(urlStep, maxValidStep) as Step
  return maxValidStep
}

function readInitialAppState() {
  const snapshot = readSnapshotFromStorage()
  if (snapshot && snapshot.version === STORAGE_VERSION) {
    return {
      progress: snapshot.progress,
      shape: snapshot.progress.hasShape ? snapshot.shape : ('straight' as KitchenShape),
      walls: snapshot.progress.hasWalls ? snapshot.walls : getDefaultWallsForShape(snapshot.shape),
      wallInputs: snapshot.wallInputs,
    }
  }

  const progress = readProgressFromStorage()
  const shape = readShapeFromStorage() ?? 'straight'
  const walls = readWallsFromStorage(shape) ?? getDefaultWallsForShape(shape)
  const wallInputs = readWallInputsFromStorage(shape, walls)
  return { progress, shape, walls, wallInputs }
}

export function App() {
  const initialState = readInitialAppState()
  const [progress, setProgress] = useState<Progress>(() => initialState.progress)
  const [step, setStep] = useState<Step>(() => computeInitialStep(readStepFromUrl(), initialState.progress))
  const [shape, setShape] = useState<KitchenShape>(() => initialState.shape)
  const [walls, setWalls] = useState<Walls>(() => initialState.walls)
  const [wallInputs, setWallInputs] = useState<WallInputs>(() => initialState.wallInputs)


  useEffect(() => {
    syncViewportMetrics()

    const vv = window.visualViewport
    window.addEventListener('resize', syncViewportMetrics)
    window.addEventListener('orientationchange', syncViewportMetrics)
    vv?.addEventListener('resize', syncViewportMetrics)
    vv?.addEventListener('scroll', syncViewportMetrics)

    return () => {
      window.removeEventListener('resize', syncViewportMetrics)
      window.removeEventListener('orientationchange', syncViewportMetrics)
      vv?.removeEventListener('resize', syncViewportMetrics)
      vv?.removeEventListener('scroll', syncViewportMetrics)
    }
  }, [])

  useLayoutEffect(() => {
    ensureStorageVersion()
    persistAppState({ shape, walls, wallInputs, progress })
  }, [])

  useEffect(() => {
    updateViewportForStep(step)

    const preventGesture = (event: Event) => {
      if (step === 3 && isInsideSceneZoomRoot(event.target)) return
      event.preventDefault()
    }

    const preventTouchZoomOutsideScene = (event: TouchEvent) => {
      if (event.touches.length < 2) return
      if (step === 3 && isInsideSceneZoomRoot(event.target)) return
      event.preventDefault()
    }

    const preventCtrlWheelOutsideScene = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      if (step === 3 && isInsideSceneZoomRoot(event.target)) return
      event.preventDefault()
    }

    document.addEventListener('gesturestart', preventGesture as EventListener, { passive: false })
    document.addEventListener('gesturechange', preventGesture as EventListener, { passive: false })
    document.addEventListener('gestureend', preventGesture as EventListener, { passive: false })
    document.addEventListener('touchmove', preventTouchZoomOutsideScene, { passive: false })
    document.addEventListener('wheel', preventCtrlWheelOutsideScene, { passive: false })

    return () => {
      document.removeEventListener('gesturestart', preventGesture as EventListener)
      document.removeEventListener('gesturechange', preventGesture as EventListener)
      document.removeEventListener('gestureend', preventGesture as EventListener)
      document.removeEventListener('touchmove', preventTouchZoomOutsideScene)
      document.removeEventListener('wheel', preventCtrlWheelOutsideScene)
    }
  }, [step])

  useLayoutEffect(() => {
    persistAppState({ shape, walls, wallInputs, progress })
  }, [shape, walls, wallInputs, progress])

  useEffect(() => {
    const flush = () => persistAppState({ shape, walls, wallInputs, progress })
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [shape, walls, wallInputs, progress])

  useEffect(() => {
    const fromUrl = readStepFromUrl()
    const nextStep = computeInitialStep(fromUrl, progress)
    if (nextStep !== step) setStep(nextStep)
  }, [])







  if (step === 1) {
    return (
      <Step1ChooseShape
        onPick={(s) => {
          clearLayoutStorage()
          const nextProgress = { hasShape: true, hasWalls: false }
          const nextWalls = getDefaultWallsForShape(s)
          const nextWallInputs = buildWallInputs(s, nextWalls)
          persistAppState({ shape: s, walls: nextWalls, wallInputs: nextWallInputs, progress: nextProgress })
          setShape(s)
          setWalls(nextWalls)
          setWallInputs(nextWallInputs)
          setProgress(nextProgress)
          setStep(2)
        }}
      />
    )
  }

  if (step === 2) {
    return (
      <Step2Walls
        shape={shape}
        initial={walls}
        initialInputs={wallInputs}
        onBack={() => setStep(1)}
        onNext={(w, rawInputs) => {
          const nextProgress = { ...progress, hasWalls: true }
          const nextWalls = canonicalizeWalls(shape, w) ?? getDefaultWallsForShape(shape)
          const nextWallInputs = parseStoredWallInputs(rawInputs, buildWallInputs(shape, nextWalls))
          persistAppState({ shape, walls: nextWalls, wallInputs: nextWallInputs, progress: nextProgress })
          setWalls(nextWalls)
          setWallInputs(nextWallInputs)
          setProgress(nextProgress)
          setStep(3)
        }}
      />
    )
  }

  return (
    <ErrorBoundary
      onReset={() => {
        clearAllStorage()
      }}
    >
      <Suspense
        fallback={
          <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0b0f14', color: 'rgba(255,255,255,0.82)' }}>
            Učitavanje konfiguratora...
          </div>
        }
      >
        <Step3Configurator
          shape={shape}
          walls={walls}
          onBack={() => setStep(2)}
          onNext={() => {}}
          onResetAll={() => {
            void clearPwaRuntimeData()
            clearAllStorage()
            setProgress({ hasShape: false, hasWalls: false })
            setShape('straight')
            const resetWalls = getDefaultWallsForShape('straight')
            setWalls(resetWalls)
            setWallInputs(buildWallInputs('straight', resetWalls))
            setStep(1)
          }}
        />
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
