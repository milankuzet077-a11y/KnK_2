import type { IncomingMessage, ServerResponse } from 'node:http'
import { signState } from './_token'
import { checkRateLimit } from './_rateLimit'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type JsonRecord = { [key: string]: JsonValue }
type OversizedPayload = { __too_large: true }
type JsonBody = JsonRecord | OversizedPayload

const MAX_BODY_BYTES = 200 * 1024

export default async function handler(req: IncomingMessage & { method?: string }, res: ServerResponse) {
  if (req.method !== 'POST') {
    return send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' })
  }

  const rateLimit = checkRateLimit(req, 'layout:init', 10, 60_000)
  if (!rateLimit.ok) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
    return send(res, 429, { ok: false, code: 'RATE_LIMITED', message: 'Too many requests' })
  }

  const body = await readJson(req)
  if ('__too_large' in body) {
    return send(res, 413, { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' })
  }

  const shape = parseShape(body.shape)
  const walls = parseWalls(body.walls)

  if (!shape || !walls) {
    return send(res, 400, { ok: false, code: 'INVALID_INPUT', message: 'Invalid input' })
  }

  const stateToken = signState({ shape, walls, placedItems: [] }, 60 * 60)
  return send(res, 200, { ok: true, stateToken })
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

function parseShape(value: JsonValue | undefined): 'straight' | 'parallel' | 'l-shape' | null {
  return value === 'straight' || value === 'parallel' || value === 'l-shape' ? value : null
}

function parseWalls(value: JsonValue | undefined): { A: number; B: number } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, JsonValue>
  const wallA = Number(record.A)
  const wallB = Number(record.B)
  if (!Number.isFinite(wallA) || !Number.isFinite(wallB) || wallA <= 0 || wallB <= 0) return null
  return { A: wallA, B: wallB }
}

function send(res: ServerResponse, status: number, json: JsonRecord) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(json))
}
