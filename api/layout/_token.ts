import crypto from 'node:crypto'
import type { KitchenShape, PlacedItem } from '../../src/domain/types'
import type { Walls } from '../../src/domain/types'

const SECRET = (process.env.LAYOUT_TOKEN_SECRET || 'dev-layout-token-secret').trim()

export type LayoutStatePayload = {
  v: 1
  iat: number
  exp: number
  shape: KitchenShape
  walls: Pick<Walls, 'A' | 'B'>
  placedItems: PlacedItem[]
}

export function signState(payload: Omit<LayoutStatePayload, 'v' | 'iat' | 'exp'>, ttlSeconds = 60 * 60): string {
  const now = Math.floor(Date.now() / 1000)
  const full: LayoutStatePayload = {
    v: 1,
    iat: now,
    exp: now + ttlSeconds,
    ...payload,
  }
  const body = base64urlEncode(Buffer.from(JSON.stringify(full), 'utf8'))
  const sig = hmacSha256(body)
  return `${body}.${sig}`
}

export function verifyState(token: string): LayoutStatePayload {
  const [body, sig] = token.split('.')
  if (!body || !sig) throw new Error('Invalid token format')
  const expected = hmacSha256(body)
  if (!timingSafeEqual(sig, expected)) throw new Error('Invalid token signature')
  const json = base64urlDecode(body).toString('utf8')
  const payload = JSON.parse(json) as LayoutStatePayload
  if (payload.v !== 1) throw new Error('Unsupported token version')
  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('Token expired')
  return payload
}

function hmacSha256(data: string): string {
  return base64urlEncode(crypto.createHmac('sha256', SECRET).update(data).digest())
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64urlDecode(value: string): Buffer {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  const base64 = (value + pad).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64')
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}
