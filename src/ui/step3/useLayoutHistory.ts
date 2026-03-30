import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KitchenShape, PlacedItem, Walls } from '../../domain/types'
import { clearLayoutStorage, makeLayoutKey, readLayoutFromStorage, wallsSignature, writeLayoutToStorage } from './storage'
import { clearStep3Snapshot, readStep3Snapshot } from './snapshot'

export const DEFAULT_MAX_HISTORY = 50
export const DEFAULT_STORAGE_WRITE_DEBOUNCE_MS = 350

type HistState = { stack: PlacedItem[][]; index: number }

type IdleCallbackHandle = number
type IdleDeadline = { didTimeout: boolean; timeRemaining: () => number }
type RequestIdleCallback = (cb: (deadline: IdleDeadline) => void, opts?: { timeout: number }) => IdleCallbackHandle
type CancelIdleCallback = (handle: IdleCallbackHandle) => void

type WindowWithIdleCallbacks = Window & {
  requestIdleCallback?: RequestIdleCallback
  cancelIdleCallback?: CancelIdleCallback
}

function itemsSignature(items: PlacedItem[]): string {
  let acc = ''
  for (const item of items) {
    acc += `${item.uniqueId}|${item.catalogId}|${item.elementId}|${Number(item.x) || 0}|${item.wallKey || ''}|${Number(item.mountingHeight) || 0};`
  }
  let h = 2166136261
  for (let i = 0; i < acc.length; i++) {
    h ^= acc.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

const idleWindow = window as WindowWithIdleCallbacks

const requestIdle: RequestIdleCallback =
  idleWindow.requestIdleCallback ??
  ((cb, opts) => window.setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), opts?.timeout ?? 1))

const cancelIdle: CancelIdleCallback =
  idleWindow.cancelIdleCallback ??
  ((handle) => window.clearTimeout(handle))

export function useLayoutHistory(
  shape: KitchenShape,
  walls: Walls,
  opts?: { maxHistory?: number; storageDebounceMs?: number }
) {
  const maxHistory = opts?.maxHistory ?? DEFAULT_MAX_HISTORY
  const storageDebounceMs = opts?.storageDebounceMs ?? DEFAULT_STORAGE_WRITE_DEBOUNCE_MS

  const [hist, setHist] = useState<HistState>(() => {
    const contextKey = `${shape}|${wallsSignature(walls)}`
    const restored = readStep3Snapshot(shape, walls)?.items ?? readLayoutFromStorage(shape, walls, contextKey)
    return { stack: [restored], index: 0 }
  })

  const contextKey = useMemo(() => `${shape}|${wallsSignature(walls)}`, [shape, walls])

  useEffect(() => {
    const restored = readStep3Snapshot(shape, walls)?.items ?? readLayoutFromStorage(shape, walls, contextKey)
    setHist({ stack: [restored], index: 0 })
  }, [contextKey, shape, walls])

  const placedItems = hist.stack[hist.index] || []

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage) return
      if (e.key !== makeLayoutKey(contextKey)) return

      const restored = readStep3Snapshot(shape, walls)?.items ?? readLayoutFromStorage(shape, walls, contextKey)
      setHist((prev) => {
        const current = prev.stack[prev.index] || []
        if (itemsSignature(current) === itemsSignature(restored)) return prev
        return { stack: [restored], index: 0 }
      })
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [contextKey, shape, walls])

  const pendingWriteTimerRef = useRef<number | null>(null)
  const pendingIdleHandleRef = useRef<number | null>(null)
  const lastPersistSigRef = useRef<string | null>(null)
  const storageDisabledRef = useRef(false)

  function flushPersist(nextItems?: PlacedItem[]) {
    const latest = nextItems ?? hist.stack[hist.index] ?? []
    const latestSig = itemsSignature(latest)
    if (lastPersistSigRef.current === latestSig || storageDisabledRef.current) return
    try {
      writeLayoutToStorage(shape, walls, latest, contextKey)
      lastPersistSigRef.current = latestSig
    } catch {
      storageDisabledRef.current = true
    }
  }

  useLayoutEffect(() => {
    if (pendingWriteTimerRef.current !== null) {
      window.clearTimeout(pendingWriteTimerRef.current)
      pendingWriteTimerRef.current = null
    }
    if (pendingIdleHandleRef.current !== null) {
      cancelIdle(pendingIdleHandleRef.current)
      pendingIdleHandleRef.current = null
    }

    flushPersist()
  }, [contextKey, hist.index, hist.stack, placedItems, shape, storageDebounceMs, walls])

  useEffect(() => {
    const flush = () => flushPersist()
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
  }, [contextKey, hist.index, hist.stack, shape, walls])

  const canUndo = hist.index > 0
  const canRedo = hist.index < hist.stack.length - 1

  function pushState(next: PlacedItem[]) {
    flushPersist(next)
    setHist((prev) => {
      const sliced = prev.stack.slice(0, prev.index + 1)
      sliced.push(next)
      let stack = sliced
      let index = sliced.length - 1
      if (stack.length > maxHistory) {
        const overflow = stack.length - maxHistory
        stack = stack.slice(overflow)
        index -= overflow
      }
      return { stack, index }
    })
  }

  function undo() {
    setHist((prev) => {
      const nextIndex = Math.max(0, prev.index - 1)
      const nextItems = prev.stack[nextIndex] || []
      flushPersist(nextItems)
      return { ...prev, index: nextIndex }
    })
  }

  function redo() {
    setHist((prev) => {
      const nextIndex = Math.min(prev.stack.length - 1, prev.index + 1)
      const nextItems = prev.stack[nextIndex] || []
      flushPersist(nextItems)
      return { ...prev, index: nextIndex }
    })
  }

  function reset() {
    clearLayoutStorage(contextKey)
    clearStep3Snapshot(shape, walls)
    flushPersist([])
    setHist({ stack: [[]], index: 0 })
  }

  return {
    placedItems,
    pushState,
    canUndo,
    canRedo,
    undo,
    redo,
    reset,
    contextKey,
    hist,
    setHist,
  }
}
