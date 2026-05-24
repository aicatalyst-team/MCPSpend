import { Redis } from 'ioredis'

// Single Redis connection shared across the app
// BullMQ creates its own connections internally
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required for BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
})

redis.on('error', (err) => {
  console.error('[Redis] connection error:', err.message)
})

// Cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  const val = await redis.get(key)
  if (!val) return null
  try { return JSON.parse(val) } catch { return null }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key)
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) await redis.del(...keys)
}

// Pub/sub for the live tool-call ticker. Worker publishes here after persisting
// tool calls; SSE endpoint subscribes per-org and forwards events to the user's
// browser. Channel key: `live:<orgId>`.
export async function publishLiveEvent(orgId: string, event: unknown): Promise<void> {
  try {
    await redis.publish(`live:${orgId}`, JSON.stringify(event))
  } catch (err) {
    // Pub/sub is best-effort — never break ingest on a Redis hiccup.
    console.error('[redis] live publish failed:', err)
  }
}

// Helper to create a dedicated subscriber connection. Publishing + subscribing
// CAN'T share a connection in node-redis / ioredis, so the SSE route opens
// its own subscriber when a client connects.
export function createSubscriber(): Redis {
  const sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  })
  sub.on('error', (err) => console.error('[Redis subscriber] error:', err.message))
  return sub
}
