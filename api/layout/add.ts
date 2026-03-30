import type { IncomingMessage, ServerResponse } from 'node:http'
import { verifyState, signState } from './_token'
import { tryPlaceItemStrict } from '../../src/domain/placement/placementService'
import { checkRateLimit } from './_rateLimit'
import type { CatalogItemLike } from '../../src/domain/shapes/common/catalogItemHelpers'
import type { PlaceItemInput } from '../../src/domain/placement/types'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type JsonRecord = { [key: string]: JsonValue }
type OversizedPayload = { __too_large: true }
type JsonBody = JsonRecord | OversizedPayload

const MAX_BODY_BYTES = 200 * 1024

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  if (req.method !== 'POST') {
    return send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' })
  }

  const rateLimit = checkRateLimit(req, 'layout:add', 60, 60_000)
  if (!rateLimit.ok) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
    return send(res, 429, { ok: false, code: 'RATE_LIMITED', message: 'Too many requests' })
  }

  const body = await readJson(req)
  if ('__too_large' in body) {
    return send(res, 413, { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' })
  }

  const token = typeof body.stateToken === 'string' ? body.stateToken : ''
  if (!token) return send(res, 400, { ok: false, code: 'TOKEN_MISSING', message: 'Missing stateToken' })

  let state
  try {
    state = verifyState(token)
  } catch {
    return send(res, 401, { ok: false, code: 'TOKEN_INVALID', message: 'Invalid session' })
  }

  const catalogItem = parseCatalogItem(body.catalogItem)
  const uniqueId = typeof body.uniqueId === 'string' ? body.uniqueId : ''
  const targetWall = body.targetWall === 'B' ? 'B' : 'A'
  const clientRequestId = typeof body.clientRequestId === 'string' ? body.clientRequestId.trim() : ''

  if (!catalogItem || !uniqueId) {
    return send(res, 400, { ok: false, code: 'INVALID_INPUT', message: 'Invalid input' })
  }
  if (clientRequestId && clientRequestId.length > 80) {
    return send(res, 400, { ok: false, code: 'INVALID_INPUT', message: 'Invalid clientRequestId' })
  }

  const input: PlaceItemInput = {
    shape: state.shape,
    walls: state.walls,
    placedItems: Array.isArray(state.placedItems) ? state.placedItems : [],
    catalogItem,
    uniqueId,
    targetWall,
  }

  const result = tryPlaceItemStrict(input)
  if (!result.ok) {
    return send(res, 200, { ok: false, code: 'RULE_VIOLATION', message: result.message ?? 'Greška pri postavljanju.', stateToken: token, clientRequestId })
  }

  const nextPlacedItems = [...input.placedItems, result.item]
  const nextToken = signState({ shape: input.shape, walls: input.walls, placedItems: nextPlacedItems }, 60 * 60)
  return send(res, 200, { ok: true, item: result.item, stateToken: nextToken, clientRequestId })
}

async function readJson(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    total += buffer.length
    if (total > MAX_BODY_BYTES) return { __too_large: true }
    chunks.push(buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return raw ? ((JSON.parse(raw) as JsonRecord) ?? {}) : {}
  } catch {
    return {}
  }
}

function parseCatalogItem(value: JsonValue | undefined): CatalogItemLike | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const record = value as Record<string, JsonValue>
  const id = typeof record.id === 'string' ? record.id : null
  const type = isCatalogType(record.type) ? record.type : null
  const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : null
  const glb = typeof record.glb === 'string' && record.glb.trim() ? record.glb.trim() : null

  const dimsRecord = record.dims && typeof record.dims === 'object' && !Array.isArray(record.dims)
    ? (record.dims as Record<string, JsonValue>)
    : null

  const width = Number(dimsRecord?.w ?? record.width)
  const depth = Number(dimsRecord?.d ?? record.depth)
  const heightRaw = dimsRecord?.h
  const height = heightRaw == null ? undefined : Number(heightRaw)
  const mountingHeight = record.mountingHeight == null ? undefined : Number(record.mountingHeight)
  const price = record.price == null ? undefined : Number(record.price)
  const promoPrice = record.promoPrice == null ? undefined : Number(record.promoPrice)
  const category = typeof record.category === 'string' ? record.category : undefined
  const tip = typeof record.tip === 'string' ? record.tip : undefined
  const sku = typeof record.sku === 'string' ? record.sku : undefined
  const thumbnail = typeof record.thumbnail === 'string' ? record.thumbnail : undefined
  const cornerHandedness = record.cornerHandedness === 'left' || record.cornerHandedness === 'right' ? record.cornerHandedness : undefined
  const tags = Array.isArray(record.tags) && record.tags.every(tag => typeof tag === 'string')
    ? (record.tags as string[])
    : undefined

  if (!id || !type || !name || !glb) return null
  if (!Number.isFinite(width) || !Number.isFinite(depth)) return null
  if (height !== undefined && !Number.isFinite(height)) return null
  if (mountingHeight !== undefined && !Number.isFinite(mountingHeight)) return null
  if (price !== undefined && !Number.isFinite(price)) return null
  if (promoPrice !== undefined && !Number.isFinite(promoPrice)) return null

  return {
    id,
    sku,
    name,
    type,
    dims: {
      w: width,
      d: depth,
      h: height !== undefined ? height : 0,
    },
    width,
    depth,
    mountingHeight,
    price,
    promoPrice,
    category,
    cornerHandedness,
    tip,
    glb,
    thumbnail,
    tags,
  }
}

function isCatalogType(value: JsonValue | undefined): value is CatalogItemLike['type'] {
  return value === 'base' || value === 'wall' || value === 'tall' || value === 'corner' || value === 'accessories'
}

function send(res: ServerResponse, status: number, json: JsonRecord) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(json))
}
