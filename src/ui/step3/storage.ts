import type { KitchenShape, PlacedItem, Walls } from '../../domain/types'
import { canonicalizeWalls, normalizeWalls, parsePlacedItem, parseShape } from '../../domain/stateParsers'

type StoredLayoutV0 = {
  shape: KitchenShape
  walls: Walls
  items?: unknown[]
  placedItems?: unknown[]
}

type StoredLayoutV1 = {
  version: 1
  shape: KitchenShape
  walls: Walls
  items: unknown[]
}

type StoredLayout = StoredLayoutV0 | StoredLayoutV1

const STORAGE_KEYS = {
  layout: 'amk_layout',
} as const

export function makeLayoutKey(contextKey?: string): string {
  return contextKey ? `${STORAGE_KEYS.layout}::${contextKey}` : STORAGE_KEYS.layout
}

export function wallsSignature(w: Walls): string {
  const normalized = normalizeWalls(w, { A: 0, B: 0, C: 0, D: 0 }) ?? { A: 0, B: 0, C: 0, D: 0 }
  return `${normalized.A ?? 0}|${normalized.B ?? 0}|${normalized.C ?? 0}|${normalized.D ?? 0}`
}

function findCompatibleLayoutKey(shape: KitchenShape, walls: Walls): string | null {
  const wanted = wallsSignature(walls)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key !== STORAGE_KEYS.layout && !key.startsWith(`${STORAGE_KEYS.layout}::`)) continue

      const raw = localStorage.getItem(key)
      if (!raw) continue

      const parsed = readStoredLayout(raw)
      if (!parsed || parsed.shape !== shape) continue

      const canonicalWalls = canonicalizeWalls(shape, parsed.walls)
      if (!canonicalWalls || wallsSignature(canonicalWalls) !== wanted) continue

      return key
    }
  } catch {}
  return null
}

function readStoredLayout(raw: string): StoredLayout | null {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') return null

  const record = parsed as Record<string, unknown>
  const shape = parseShape(record.shape)
  const walls = normalizeWalls(record.walls)
  if (!shape || !walls) return null

  const items = Array.isArray(record.items) ? record.items : undefined
  const placedItems = Array.isArray(record.placedItems) ? record.placedItems : undefined
  const version = record.version === 1 ? 1 : undefined

  if (version === 1 && items) {
    return { version, shape, walls, items }
  }

  return { shape, walls, items, placedItems }
}

export function readLayoutFromStorage(shape: KitchenShape, walls: Walls, contextKey?: string): PlacedItem[] {
  try {
    const key = makeLayoutKey(contextKey)
    const matchedKey = localStorage.getItem(key) ? key : findCompatibleLayoutKey(shape, walls)
    const raw = (matchedKey ? localStorage.getItem(matchedKey) : null) ?? localStorage.getItem(STORAGE_KEYS.layout)
    if (!raw) return []

    const parsed = readStoredLayout(raw)
    if (!parsed) return []
    if (parseShape(parsed.shape) !== shape) return []
    const storedWalls = canonicalizeWalls(shape, parsed.walls)
    if (!storedWalls || wallsSignature(storedWalls) !== wallsSignature(walls)) return []

    const rawItems = parsed.items ?? ('placedItems' in parsed ? parsed.placedItems : undefined)
    if (!Array.isArray(rawItems)) return []

    const normalized: PlacedItem[] = []
    for (const item of rawItems) {
      const next = parsePlacedItem(item)
      if (next) normalized.push(next)
    }
    return normalized
  } catch {
    return []
  }
}

export function writeLayoutToStorage(shape: KitchenShape, walls: Walls, items: PlacedItem[], contextKey?: string) {
  try {
    const canonicalWalls = canonicalizeWalls(shape, walls) ?? walls
    const payloadV1: StoredLayoutV1 = { version: 1, shape, walls: canonicalWalls, items }
    const payload: StoredLayoutV0 & StoredLayoutV1 = { ...payloadV1, placedItems: items }
    localStorage.setItem(makeLayoutKey(contextKey), JSON.stringify(payload))
  } catch {}
}

export function clearLayoutStorage(contextKey?: string) {
  try {
    localStorage.removeItem(makeLayoutKey(contextKey))
    if (contextKey) localStorage.removeItem(STORAGE_KEYS.layout)
  } catch {}
}
