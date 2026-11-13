// lib/rateLimit.ts
// Fixed-window rate limiter (default 20 requests per minute per key, usually the client IP).
//
// NOTE: the default store is in-memory, so limits are per server process. On
// serverless hosting every instance (and every cold start) has its own counter,
// which makes this a speed bump rather than a hard limit. To enforce limits
// globally, implement `RateLimitStore` on a shared store (e.g. Upstash Redis:
// INCR key + EXPIRE key windowSec, both in one pipeline) and call
// `setRateLimitStore(new RedisStore(...))` at startup, then use `rateLimitAsync`
// in routes (remote stores are async). No dependency is needed until then.

// 20 requests a minute in production. Locally every request has the same "unknown" IP,
// so dev gets a much higher ceiling to avoid one shared bucket blocking testing.
export const RATE_LIMIT = process.env.NODE_ENV === "production" ? 20 : 300 // requests
export const WINDOW_MS = 60 * 1000 // 1 minute

export interface RateLimitStore {
  /**
   * Count one hit for `key` in the current window and return the hit count so far
   * (including this one). The window starts on the first hit and lasts `windowMs`.
   */
  hit(key: string, windowMs: number): number | Promise<number>
}

/** Default store: a Map in this process's memory. Resets on restart / per serverless instance. */
export class MemoryRateLimitStore implements RateLimitStore {
  private map = new Map<string, { count: number; start: number }>()

  hit(key: string, windowMs: number): number {
    const now = Date.now()
    const entry = this.map.get(key)
    if (!entry || now - entry.start > windowMs) {
      this.map.set(key, { count: 1, start: now })
      this.prune(now, windowMs)
      return 1
    }
    entry.count++
    return entry.count
  }

  // Keep memory bounded: drop expired windows once the map gets big.
  private prune(now: number, windowMs: number) {
    if (this.map.size < 10_000) return
    this.map.forEach((v, k) => {
      if (now - v.start > windowMs) this.map.delete(k)
    })
  }
}

const memoryStore = new MemoryRateLimitStore()
let store: RateLimitStore = memoryStore

/** Swap the backing store (e.g. a Redis/Upstash implementation). */
export function setRateLimitStore(next: RateLimitStore) {
  store = next
}

/**
 * Synchronous check used by existing routes: true if the request is allowed.
 * Always uses the in-memory store (a remote store can't answer synchronously).
 */
export function rateLimit(ip: string, limit = RATE_LIMIT, windowMs = WINDOW_MS): boolean {
  return memoryStore.hit(ip, windowMs) <= limit
}

/** Store-agnostic check: works with whatever store `setRateLimitStore` installed. */
export async function rateLimitAsync(ip: string, limit = RATE_LIMIT, windowMs = WINDOW_MS): Promise<boolean> {
  return (await store.hit(ip, windowMs)) <= limit
}
