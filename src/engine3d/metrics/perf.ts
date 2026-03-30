export type ScenePerfSnapshot = {
  threeRequestedAt?: number
  threeMountedAt?: number
  initialSceneRenderedAt?: number
  step3EnteredAt?: number
  step3CanvasActivatedAt?: number
  qualityTier?: 'low' | 'medium' | 'high'
}

export type ScenePerfSummary = {
  requestedToMountedMs?: number
  mountedToFirstFrameMs?: number
  step3ToActivationMs?: number
  totalToFirstFrameMs?: number
  qualityTier?: 'low' | 'medium' | 'high'
}

declare global {
  interface Window {
    __amkPerf?: ScenePerfSnapshot
  }
}

export function markPerf(name: keyof ScenePerfSnapshot, value?: number | ScenePerfSnapshot['qualityTier']) {
  if (typeof window === 'undefined') return
  window.__amkPerf ??= {}
  if (typeof value !== 'undefined') {
    window.__amkPerf[name] = value as never
    return
  }
  window.__amkPerf[name] = performance.now() as never
}

export function readPerfSnapshot(): ScenePerfSnapshot | null {
  if (typeof window === 'undefined') return null
  return window.__amkPerf ?? null
}

export function readPerfSummary(): ScenePerfSummary | null {
  const snapshot = readPerfSnapshot()
  if (!snapshot) return null

  const requestedToMountedMs =
    typeof snapshot.threeRequestedAt === 'number' && typeof snapshot.threeMountedAt === 'number'
      ? snapshot.threeMountedAt - snapshot.threeRequestedAt
      : undefined

  const mountedToFirstFrameMs =
    typeof snapshot.threeMountedAt === 'number' && typeof snapshot.initialSceneRenderedAt === 'number'
      ? snapshot.initialSceneRenderedAt - snapshot.threeMountedAt
      : undefined

  const step3ToActivationMs =
    typeof snapshot.step3EnteredAt === 'number' && typeof snapshot.step3CanvasActivatedAt === 'number'
      ? snapshot.step3CanvasActivatedAt - snapshot.step3EnteredAt
      : undefined

  const totalToFirstFrameMs =
    typeof snapshot.threeRequestedAt === 'number' && typeof snapshot.initialSceneRenderedAt === 'number'
      ? snapshot.initialSceneRenderedAt - snapshot.threeRequestedAt
      : undefined

  return {
    requestedToMountedMs,
    mountedToFirstFrameMs,
    step3ToActivationMs,
    totalToFirstFrameMs,
    qualityTier: snapshot.qualityTier,
  }
}
