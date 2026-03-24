import { Hono } from 'hono'

export const lastfmRouter = new Hono()

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/'
const API_KEY = process.env.LASTFM_API_KEY ?? ''

// サーバーサイドキャッシュ（TTL: 1時間）
const cache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_TTL = 60 * 60 * 1000

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null }
  return entry.data as T
}
function cacheSet(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL })
}

/**
 * GET /api/v1/lastfm/proxy?method=artist.getsimilar&artist=BTS&limit=6
 * Last.fm API へのサーバーサイドプロキシ（CORS 回避）
 */
lastfmRouter.get('/proxy', async (c) => {
  if (!API_KEY) return c.json({ error: 'LASTFM_API_KEY が設定されていません' }, 500)

  const params = new URLSearchParams(new URL(c.req.url).searchParams)
  params.set('api_key', API_KEY)
  params.set('format', 'json')

  const cacheKey = params.toString()
  const cached = cacheGet<unknown>(cacheKey)
  if (cached) return c.json(cached)

  try {
    const res = await fetch(`${LASTFM_BASE}?${params}`)
    if (!res.ok) return c.json({ error: `Last.fm error: ${res.status}` }, res.status as 500)
    const data = await res.json()
    cacheSet(cacheKey, data)
    return c.json(data)
  } catch (e) {
    console.error('[Last.fm proxy]', e)
    return c.json({ error: 'Last.fm fetch failed' }, 500)
  }
})
