import { Hono } from 'hono'

export const youtubeRouter = new Hono()

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3'
const API_KEY = process.env.YOUTUBE_API_KEY ?? ''

// サーバーサイドキャッシュ（TTL: 30分）
const cache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_TTL = 30 * 60 * 1000

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null }
  return entry.data as T
}
function cacheSet(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL })
}

/** YouTube チャンネルURLからチャンネルIDを解決 */
async function resolveChannelId(channelUrl: string): Promise<string | null> {
  const cacheKey = `channelId:${channelUrl}`
  const cached = cacheGet<string>(cacheKey)
  if (cached) return cached

  try {
    const u = new URL(channelUrl)
    const path = u.pathname

    // /channel/UC... 形式 → そのまま使う
    const channelMatch = path.match(/\/channel\/(UC[\w-]+)/)
    if (channelMatch) {
      cacheSet(cacheKey, channelMatch[1])
      return channelMatch[1]
    }

    // /@handle 形式 → API で解決
    const handleMatch = path.match(/\/@([\w.-]+)/)
    if (handleMatch) {
      const handle = handleMatch[1]
      const res = await fetch(
        `${YT_API_BASE}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${API_KEY}`
      )
      if (!res.ok) return null
      const data = (await res.json()) as { items?: Array<{ id: string }> }
      const id = data.items?.[0]?.id ?? null
      if (id) cacheSet(cacheKey, id)
      return id
    }

    // /c/name または /user/name 形式 → forUsername で解決
    const userMatch = path.match(/\/(?:c|user)\/([\w.-]+)/)
    if (userMatch) {
      const res = await fetch(
        `${YT_API_BASE}/channels?part=id&forUsername=${encodeURIComponent(userMatch[1])}&key=${API_KEY}`
      )
      if (!res.ok) return null
      const data = (await res.json()) as { items?: Array<{ id: string }> }
      const id = data.items?.[0]?.id ?? null
      if (id) cacheSet(cacheKey, id)
      return id
    }
  } catch {
    return null
  }
  return null
}

export type YoutubeVideo = {
  videoId: string
  title: string
  description: string
  publishedAt: string
  thumbnailUrl: string | null
  channelTitle: string
  videoUrl: string
}

/**
 * GET /api/v1/youtube/videos?channelUrl=https://youtube.com/@...&maxResults=5
 * チャンネルの最新動画を取得する
 */
youtubeRouter.get('/videos', async (c) => {
  if (!API_KEY) return c.json({ error: 'YouTube API key が設定されていません' }, 500)

  const channelUrl = c.req.query('channelUrl')
  if (!channelUrl) return c.json({ error: 'channelUrl が必要です' }, 400)

  const maxResults = Math.min(Number(c.req.query('maxResults') ?? '5'), 10)

  const cacheKey = `videos:${channelUrl}:${maxResults}`
  const cached = cacheGet<YoutubeVideo[]>(cacheKey)
  if (cached) return c.json({ videos: cached, cached: true })

  const channelId = await resolveChannelId(channelUrl)
  if (!channelId) return c.json({ error: 'チャンネルIDを解決できませんでした', videos: [] }, 200)

  const searchRes = await fetch(
    `${YT_API_BASE}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${API_KEY}`
  )
  if (!searchRes.ok) {
    const body = await searchRes.text()
    console.error('[YouTube] search error:', searchRes.status, body)
    return c.json({ error: 'YouTube API エラー', videos: [] }, 200)
  }

  const data = (await searchRes.json()) as {
    items?: Array<{
      id: { videoId: string }
      snippet: {
        title: string
        description: string
        publishedAt: string
        channelTitle: string
        thumbnails?: { medium?: { url: string }; default?: { url: string } }
      }
    }>
  }

  const videos: YoutubeVideo[] = (data.items ?? []).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null,
    channelTitle: item.snippet.channelTitle,
    videoUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }))

  cacheSet(cacheKey, videos)
  return c.json({ videos })
})
