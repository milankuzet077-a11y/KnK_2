import type { CatalogItemLike } from '../shapes/common/catalogItemHelpers'
import { tryAddItemI } from '../shapes/I/addItemLogic'
import { tryAddItemL } from '../shapes/L/addItemLogic'
import { tryAddItemParallel } from '../shapes/Parallel/addItemLogic'
import type { KitchenShape, PlacedItem, Walls } from '../types'
import type { LayoutValidationResult, PlaceItemInput, PlaceItemResult, WallKey } from './types'

type LayoutInitResponse = { stateToken?: string }
type LayoutAddResponse = { ok?: boolean; item?: PlacedItem; message?: string; stateToken?: string }

type EnvShape = Extract<KitchenShape, 'straight' | 'parallel' | 'l-shape'>

type LayoutTokenGlobal = typeof globalThis & {
  __layoutTokenCache?: Map<string, string>
  crypto?: Crypto
}

function itemWallKey(item: PlacedItem): WallKey | 'A' {
  return item.wallKey ?? 'A'
}

function buildSessionKey(shape: KitchenShape, walls: Walls): string {
  return `layoutToken:${shape}:${Number(walls.A ?? 0)}:${Number(walls.B ?? 0)}:${Number(walls.C ?? 0)}`
}

function parseLayoutInitResponse(value: unknown): LayoutInitResponse {
  if (!value || typeof value !== 'object') return {}
  const input = value as Record<string, unknown>
  return typeof input.stateToken === 'string' ? { stateToken: input.stateToken } : {}
}

function parseLayoutAddResponse(value: unknown): LayoutAddResponse {
  if (!value || typeof value !== 'object') return {}
  const input = value as Record<string, unknown>
  return {
    ok: typeof input.ok === 'boolean' ? input.ok : undefined,
    item: input.item as PlacedItem | undefined,
    message: typeof input.message === 'string' ? input.message : undefined,
    stateToken: typeof input.stateToken === 'string' ? input.stateToken : undefined,
  }
}

export function validateLayout(shape: KitchenShape, walls: Walls, placedItems: PlacedItem[]): LayoutValidationResult {
  const validWalls: WallKey[] = shape === 'parallel' || shape === 'l-shape' ? ['A', 'B'] : ['A']
  for (const item of placedItems) {
    if (!validWalls.includes(itemWallKey(item))) {
      return { ok: false, message: `Element ${item.elementId} je na nevažećem zidu za izabrani oblik.` }
    }
    if (!Number.isFinite(item.width) || item.width <= 0 || !Number.isFinite(item.depth) || item.depth <= 0) {
      return { ok: false, message: `Element ${item.elementId} ima neispravne dimenzije.` }
    }
    if (!Number.isFinite(item.x) || item.x < 0) {
      return { ok: false, message: `Element ${item.elementId} ima neispravnu poziciju.` }
    }
  }
  return { ok: true }
}

export function removePlacedItem(placedItems: PlacedItem[], itemId: string): PlacedItem[] {
  return placedItems.filter((item) => item.uniqueId !== itemId)
}

export function tryPlaceItemStrict(input: PlaceItemInput): PlaceItemResult {
  const precheck = validateLayout(input.shape, input.walls, input.placedItems)
  if (!precheck.ok) return { ok: false, message: precheck.message }

  if (input.shape === 'l-shape') {
    const targetWall: 'A' | 'B' = input.targetWall === 'B' ? 'B' : 'A'
    const result = tryAddItemL({
      walls: input.walls,
      placedItems: input.placedItems,
      catalogItem: input.catalogItem,
      targetWall,
      uniqueId: input.uniqueId,
    })
    return result.ok ? { ok: true, item: result.item } : { ok: false, message: result.message }
  }

  if (input.shape === 'straight') {
    const wallItems = input.placedItems.filter((item) => itemWallKey(item) === 'A')
    const result = tryAddItemI({
      walls: input.walls,
      placedItems: wallItems,
      catalogItem: input.catalogItem,
      uniqueId: input.uniqueId,
    })
    return result.ok ? { ok: true, item: result.item } : { ok: false, message: result.message }
  }

  if (input.shape === 'parallel') {
    const targetWall: 'A' | 'B' = input.targetWall === 'B' ? 'B' : 'A'
    const result = tryAddItemParallel({
      walls: input.walls,
      placedItems: input.placedItems,
      catalogItem: input.catalogItem,
      targetWall,
      uniqueId: input.uniqueId,
    })
    return result.ok ? { ok: true, item: result.item } : { ok: false, message: result.message }
  }

  return { ok: false, message: 'Ovaj oblik još nije implementiran.' }
}

export async function validateAndPlaceAsync(input: PlaceItemInput): Promise<PlaceItemResult> {
  const baseUrl = getEnvString('VITE_LAYOUT_API_URL')
  if (!baseUrl) return tryPlaceItemStrict(input)

  try {
    const sessionKey = buildSessionKey(input.shape, input.walls)
    let token = getSessionToken(sessionKey)

    if (!token) {
      const initRes = await fetchWithTimeout(joinUrl(baseUrl, '/layout/init'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shape: input.shape, walls: input.walls }),
      })
      if (!initRes.ok) return tryPlaceItemStrict(input)
      const initData = parseLayoutInitResponse(await initRes.json())
      if (!initData.stateToken) return tryPlaceItemStrict(input)
      token = initData.stateToken
      setSessionToken(sessionKey, token)
    }

    const addPayload = {
      stateToken: token,
      targetWall: input.targetWall,
      uniqueId: input.uniqueId,
      clientRequestId: makeClientRequestId(),
      catalogItem: input.catalogItem,
    }

    const addRes = await fetchWithTimeout(
      joinUrl(baseUrl, '/layout/add'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addPayload),
      },
      5000,
      1,
    )
    if (!addRes.ok) return tryPlaceItemStrict(input)

    const data = parseLayoutAddResponse(await addRes.json())
    if (data.stateToken) setSessionToken(sessionKey, data.stateToken)
    if (data.ok && data.item) return { ok: true, item: data.item }
    if (data.ok === false) return { ok: false, message: data.message ?? 'Greška pri postavljanju.' }
    return tryPlaceItemStrict(input)
  } catch {
    return tryPlaceItemStrict(input)
  }
}

export function normalizeTargetWall(wall?: WallKey): 'A' | 'B' {
  return wall === 'B' ? 'B' : 'A'
}

function makeClientRequestId(): string {
  try {
    const runtime = globalThis as LayoutTokenGlobal
    if (typeof runtime.crypto?.randomUUID === 'function') return runtime.crypto.randomUUID()
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function getEnvString(key: string): string | undefined {
  const env = import.meta.env as Record<string, unknown>
  const value = env[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 5000, retries = 0): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
    const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined
    try {
      const response = await fetch(url, { ...init, signal: controller?.signal })
      if (timeout) clearTimeout(timeout)
      return response
    } catch (error) {
      if (timeout) clearTimeout(timeout)
      lastError = error
    }
  }
  throw lastError
}

function getSessionToken(key: string): string | undefined {
  const runtime = globalThis as LayoutTokenGlobal
  const fromMemory = runtime.__layoutTokenCache?.get(key)
  if (typeof fromMemory === 'string' && fromMemory) return fromMemory
  try {
    const fromStorage = globalThis.localStorage?.getItem(key)
    return typeof fromStorage === 'string' && fromStorage ? fromStorage : undefined
  } catch {
    return undefined
  }
}

function setSessionToken(key: string, token: string): void {
  const runtime = globalThis as LayoutTokenGlobal
  if (!runtime.__layoutTokenCache) runtime.__layoutTokenCache = new Map<string, string>()
  runtime.__layoutTokenCache.set(key, token)
  try {
    globalThis.localStorage?.setItem(key, token)
  } catch {}
}

export type { CatalogItemLike, EnvShape }
