import type { KitchenShape, PlacedItem, WallKey, Walls } from './types'

export const VALID_SHAPES = ['straight', 'parallel', 'l-shape'] as const

export type Progress = {
  hasShape: boolean
  hasWalls: boolean
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function parseShape(value: unknown): KitchenShape | null {
  return typeof value === 'string' && (VALID_SHAPES as readonly string[]).includes(value)
    ? (value as KitchenShape)
    : null
}


export function getDefaultWallsForShape(shape: KitchenShape): Walls {
  if (shape === 'straight') return { A: 3600, B: 0, C: 0, D: 0 }
  return { A: 3600, B: 2400, C: 0, D: 0 }
}

export function canonicalizeWalls(shape: KitchenShape, value: unknown): Walls | null {
  const base = normalizeWalls(value, getDefaultWallsForShape(shape))
  if (!base) return null

  if (shape === 'straight') {
    return { A: base.A ?? 0, B: 0, C: 0, D: 0 }
  }

  return {
    A: base.A ?? 0,
    B: base.B ?? 0,
    C: 0,
    D: 0,
  }
}

export function normalizeWalls(value: unknown, fallback: Walls = { A: 3600, B: 2400, C: 2400 }): Walls | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  return {
    A: safeNumber(input.A) ?? fallback.A,
    B: safeNumber(input.B) ?? fallback.B,
    C: safeNumber(input.C) ?? fallback.C,
    D: safeNumber(input.D) ?? fallback.D,
  }
}

export function parseProgress(value: unknown): Progress {
  if (!value || typeof value !== 'object') return { hasShape: false, hasWalls: false }
  const input = value as Record<string, unknown>
  return {
    hasShape: Boolean(input.hasShape),
    hasWalls: Boolean(input.hasWalls),
  }
}

function isWallKey(value: unknown): value is WallKey {
  return value === 'A' || value === 'B' || value === 'C'
}

export function parsePlacedItem(value: unknown): PlacedItem | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const uniqueId = typeof item.uniqueId === 'string' ? item.uniqueId : null
  const catalogId = typeof item.catalogId === 'string' ? item.catalogId : null
  const elementId = typeof item.elementId === 'string' ? item.elementId : null
  const width = safeNumber(item.width)
  const depth = safeNumber(item.depth)
  const x = safeNumber(item.x)

  if (!uniqueId || !catalogId || !elementId || width === null || depth === null || x === null) {
    return null
  }

  const mountingHeight = safeNumber(item.mountingHeight)
  const price = safeNumber(item.price)
  const category = typeof item.category === 'string' ? item.category : undefined
  const wallKey = isWallKey(item.wallKey) ? item.wallKey : undefined
  const cornerHandedness = item.cornerHandedness === 'left' || item.cornerHandedness === 'right'
    ? item.cornerHandedness
    : undefined
  const decor = typeof item.decor === 'string' ? item.decor : undefined
  const supportRole = item.supportRole === 'base' || item.supportRole === 'wall' ? item.supportRole : undefined
  const supportSourceCatalogId = typeof item.supportSourceCatalogId === 'string' ? item.supportSourceCatalogId : undefined
  return {
    uniqueId,
    catalogId,
    elementId,
    width,
    depth,
    x,
    wallKey,
    mountingHeight: mountingHeight ?? undefined,
    price: price ?? undefined,
    category,
    cornerHandedness,
    decor,
    supportRole,
    supportSourceCatalogId,
    worktopMeta: (() => {
      if (!item.worktopMeta || typeof item.worktopMeta !== 'object') return undefined
      const meta = item.worktopMeta as Record<string, unknown>
      const armAmm = safeNumber(meta.armAmm)
      const armBmm = safeNumber(meta.armBmm)
      const extraCoverMm = safeNumber(meta.extraCoverMm)
      if (armAmm === null || armBmm === null || extraCoverMm === null) return undefined
      return { armAmm, armBmm, extraCoverMm }
    })(),
  }
}
