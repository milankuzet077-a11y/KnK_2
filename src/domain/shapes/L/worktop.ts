import type { PlacedItem, WallKey } from '../../types'
import { getCornerWorktopMetaByElementId } from '../../catalog/cornerWorktop'
import { makeWorktopVirtualItem } from '../shared/worktopVirtual'
import { isWorktopBlocking, type WorktopRun } from '../shared/worktopRuns'

const JOIN_TOLERANCE_MM = 1
const L_OTHER_WALL_START_MM = 600

type SpanKind = 'support' | 'block'
type WallSpan = { startMm: number; endMm: number; kind: SpanKind }

function isBase(item: PlacedItem): boolean {
  const supportRole = item.supportRole
  if (supportRole === 'base') return true
  if (supportRole === 'wall') return false
  return String(item.catalogId ?? '').toLowerCase() === 'base'
}

function isLowerCorner(item: PlacedItem): boolean {
  const supportRole = item.supportRole
  if (supportRole === 'base' && String(item.supportSourceCatalogId ?? '').toLowerCase() === 'corner') return true

  const catId = String(item.catalogId ?? '').toLowerCase()
  const category = String(item.category ?? '').toLowerCase()
  return catId === 'corner' && category === 'base'
}

function cornerArmLengthsMm(corner: PlacedItem): { armA: number; armB: number; extraCoverMm: number } {
  if (corner.worktopMeta) {
    return {
      armA: corner.worktopMeta.armAmm,
      armB: corner.worktopMeta.armBmm,
      extraCoverMm: corner.worktopMeta.extraCoverMm,
    }
  }

  const fromCatalog = getCornerWorktopMetaByElementId(String(corner.elementId ?? ''))
  if (fromCatalog) {
    return { armA: fromCatalog.armAmm, armB: fromCatalog.armBmm, extraCoverMm: fromCatalog.extraCoverMm }
  }

  const width = Number(corner.width ?? 0) || 0
  const depth = Number(corner.depth ?? 0) || 0
  const handed = String(corner.cornerHandedness ?? '').toLowerCase()
  const armA = handed === 'right' ? depth || width : width || depth
  const armB = handed === 'right' ? width || depth : depth || width
  return { armA, armB, extraCoverMm: Math.max(0, Math.min(armA, armB) - 600) }
}

function makeItemsFromRuns(wallKey: WallKey, runs: WorktopRun[]) {
  return runs
    .map((run) => {
      const start = Math.max(0, Math.round(run.startMm))
      const len = Math.max(0, Math.round(run.endMm - run.startMm))
      return len > 0 ? makeWorktopVirtualItem({ wallKey, xMm: start, lengthMm: len }) : null
    })
    .filter((item): item is ReturnType<typeof makeWorktopVirtualItem> => item !== null)
}

function projectLWallSpan(item: PlacedItem, wallKey: WallKey): { startMm: number; endMm: number } {
  const x = Number(item.x ?? 0) || 0
  const width = Number(item.width ?? 0) || 0

  if (wallKey === 'A') {
    const endMm = Math.max(0, x)
    const startMm = Math.max(0, endMm - width)
    return { startMm, endMm }
  }

  const startMm = Math.max(0, x)
  const endMm = Math.max(startMm, startMm + width)
  return { startMm, endMm }
}

function buildWallSpans(items: PlacedItem[], wallKey: WallKey): WallSpan[] {
  return (Array.isArray(items) ? items : [])
    .filter((item) => (item.wallKey ?? 'A') === wallKey)
    .filter((item) => isBase(item) || isWorktopBlocking(item))
    .map((item) => {
      const span = projectLWallSpan(item, wallKey)
      return {
        ...span,
        kind: isWorktopBlocking(item) ? 'block' as const : 'support' as const,
      }
    })
    .filter((span) => span.endMm > span.startMm)
}

function computeRunsFromSpans(spans: WallSpan[]): WorktopRun[] {
  const sorted = [...spans].sort((a, b) => {
    if (a.startMm !== b.startMm) return a.startMm - b.startMm
    if (a.kind !== b.kind) return a.kind === 'block' ? -1 : 1
    return a.endMm - b.endMm
  })

  const out: WorktopRun[] = []
  let active: WorktopRun | null = null

  for (const span of sorted) {
    if (span.kind === 'block') {
      if (!active) continue
      const clippedEnd = Math.min(active.endMm, span.startMm)
      if (clippedEnd > active.startMm) out.push({ startMm: active.startMm, endMm: clippedEnd })
      active = null
      continue
    }

    if (!active) {
      active = { startMm: span.startMm, endMm: span.endMm }
      continue
    }

    if (span.startMm <= active.endMm + JOIN_TOLERANCE_MM) {
      active.endMm = Math.max(active.endMm, span.endMm)
      continue
    }

    out.push(active)
    active = { startMm: span.startMm, endMm: span.endMm }
  }

  if (active) out.push(active)
  return out
}

function computeWallRuns(items: PlacedItem[], wallKey: WallKey, virtualSupports: Array<{ startMm: number; endMm: number }> = []): WorktopRun[] {
  const spans: WallSpan[] = [
    ...buildWallSpans(items, wallKey),
    ...virtualSupports
      .filter((span) => span.endMm > span.startMm)
      .map((span) => ({ ...span, kind: 'support' as const })),
  ]
  return computeRunsFromSpans(spans)
}

export function computeWorktopItemsL(placedItems: PlacedItem[]) {
  const items = Array.isArray(placedItems) ? placedItems : []
  const corner = items.find(isLowerCorner)

  if (!corner) {
    return [
      ...makeItemsFromRuns('A', computeWallRuns(items, 'A')),
      ...makeItemsFromRuns('B', computeWallRuns(items, 'B')),
    ]
  }

  const isRightCorner = String(corner.cornerHandedness ?? '').toLowerCase() === 'right'
  const { armA, armB, extraCoverMm } = cornerArmLengthsMm(corner)
  const cornerStartMm = Math.max(0, Number(corner.x ?? 0) || 0)
  const itemsWithoutCorner = items.filter((item) => item.uniqueId !== corner.uniqueId)

  const cornerWall: WallKey = isRightCorner ? 'B' : 'A'
  const otherWall: WallKey = cornerWall === 'A' ? 'B' : 'A'
  const cornerArmMm = cornerWall === 'A' ? armA : armB
  const otherArmMm = otherWall === 'A' ? armA : armB

  const otherWallHasBase = itemsWithoutCorner.some((item) => ((item.wallKey ?? 'A') === otherWall) && isBase(item))

  const cornerWallRuns = computeWallRuns(itemsWithoutCorner, cornerWall, [
    { startMm: cornerStartMm, endMm: cornerStartMm + cornerArmMm + extraCoverMm },
  ])

  const otherWallRuns = otherWallHasBase
    ? computeWallRuns(itemsWithoutCorner, otherWall, [
        {
          startMm: L_OTHER_WALL_START_MM,
          endMm: Math.max(otherArmMm, L_OTHER_WALL_START_MM) + extraCoverMm,
        },
      ])
    : []

  return [
    ...makeItemsFromRuns(cornerWall, cornerWallRuns),
    ...makeItemsFromRuns(otherWall, otherWallRuns),
  ]
}
