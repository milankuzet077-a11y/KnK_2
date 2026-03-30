import type { PlacedItem, WallKey } from '../../types'

export type WorktopRun = {
  startMm: number
  endMm: number
}

const JOIN_TOLERANCE_MM = 1

export function wallOf(item: PlacedItem): WallKey {
  return item.wallKey ?? 'A'
}

export function isWorktopSupporting(item: PlacedItem): boolean {
  const supportRole = item.supportRole
  if (supportRole === 'base') return true
  if (supportRole === 'wall') return false

  const catId = String(item.catalogId ?? '').toLowerCase()
  const category = String(item.category ?? '').toLowerCase()
  return catId === 'base' || (catId === 'corner' && category === 'base')
}

export function isWorktopBlocking(item: PlacedItem): boolean {
  const supportRole = item.supportRole
  if (supportRole) return false

  const catId = String(item.catalogId ?? '').toLowerCase()
  const category = String(item.category ?? '').toLowerCase()
  return catId === 'tall' || category === 'tall'
}

export function computeWorktopRunsForWall(
  placedItems: PlacedItem[],
  wallKey: WallKey,
  options?: {
    support?: (item: PlacedItem) => boolean
    blocking?: (item: PlacedItem) => boolean
  },
): WorktopRun[] {
  const support = options?.support ?? isWorktopSupporting
  const blocking = options?.blocking ?? isWorktopBlocking
  const wallItems = (Array.isArray(placedItems) ? placedItems : [])
    .filter((item) => wallOf(item) === wallKey)
    .filter((item) => support(item) || blocking(item))
    .slice()
    .sort((a, b) => {
      const ax = Number(a.x) || 0
      const bx = Number(b.x) || 0
      if (ax !== bx) return ax - bx
      const aSupport = support(a) ? 1 : 0
      const bSupport = support(b) ? 1 : 0
      return aSupport - bSupport
    })

  const out: WorktopRun[] = []
  let active: WorktopRun | null = null

  for (const item of wallItems) {
    const x = Math.max(0, Number(item.x) || 0)
    const right = Math.max(x, x + (Number(item.width) || 0))

    if (blocking(item)) {
      if (active) {
        out.push(active)
        active = null
      }
      continue
    }

    if (!support(item) || right <= x) continue

    if (!active) {
      active = { startMm: x, endMm: right }
      continue
    }

    if (x <= active.endMm + JOIN_TOLERANCE_MM) {
      active.endMm = Math.max(active.endMm, right)
      continue
    }

    out.push(active)
    active = { startMm: x, endMm: right }
  }

  if (active) out.push(active)
  return out
}
