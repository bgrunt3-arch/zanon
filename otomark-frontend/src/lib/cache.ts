const cache = new Map<string, { data: unknown; expiredAt: number }>()

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiredAt) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiredAt: Date.now() + ttlMs })
}
