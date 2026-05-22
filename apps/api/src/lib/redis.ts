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
