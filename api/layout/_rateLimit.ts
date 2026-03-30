import type { IncomingMessage } from 'node:http'

type Bucket = { count: number; resetAt: number }

type SocketWithRemoteAddress = IncomingMessage['socket'] & { remoteAddress?: string }

const buckets = new Map<string, Bucket>()

export function checkRateLimit(
  req: IncomingMessage,
  keyPrefix: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now()
  const ip = getClientIp(req)
  const key = `${keyPrefix}:${ip}`

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    gc(now)
    return { ok: true }
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }

  bucket.count += 1
  return { ok: true }
}

function getClientIp(req: IncomingMessage): string {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return (req.socket as SocketWithRemoteAddress).remoteAddress || 'unknown'
}

function gc(now: number) {
  if (buckets.size <= 5000) return
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key)
  }
  while (buckets.size > 5000) {
    const firstKey = buckets.keys().next().value as string | undefined
    if (!firstKey) break
    buckets.delete(firstKey)
  }
}
