import { Hono } from 'hono'
import { XMLParser } from 'fast-xml-parser'

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

/**
 * /@handle 形式の URL からチャンネルページを取得し、埋め込み channelId を抽出
 * YouTube Data API を使わずにチャンネル ID を解決する
 */
async function resolveHandleToChannelId(handle: string): Promise<string | null> {
  const cacheKey = `handle:${handle}`
  const cached = cacheGet<string>(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OrbitBot/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()

    // "channelId":"UCxxx..." パターンを探す
    const m = html.match(/"channelId"\s*:\s*"(UC[\w-]{22})"/)
    if (m) {
      cacheSet(cacheKey, m[1])
      return m[1]
    }
    // <link rel="canonical" href="https://www.youtube.com/channel/UCxxx">
    const m2 = html.match(/youtube\.com\/channel\/(UC[\w-]{22})/)
    if (m2) {
      cacheSet(cacheKey, m2[1])
      return m2[1]
    }
  } catch {
    return null
  }
  return null
}

/**
 * チャンネル URL から RSS フィード用の channel_id / user を解決
 * API クォータを消費しない
 */
async function resolveChannelForRss(
  channelUrl: string,
): Promise<{ type: 'channel_id' | 'user'; value: string } | null> {
  const cacheKey = `rss_channel:${channelUrl}`
  const cached = cacheGet<{ type: 'channel_id' | 'user'; value: string }>(cacheKey)
  if (cached) return cached

  try {
    const u = new URL(channelUrl)
    const path = u.pathname

    // /channel/UCxxx
    const channelMatch = path.match(/\/channel\/(UC[\w-]{22})/)
    if (channelMatch) {
      const result = { type: 'channel_id' as const, value: channelMatch[1] }
      cacheSet(cacheKey, result)
      return result
    }

    // /@handle → スクレイピングで channel_id を取得
    const handleMatch = path.match(/\/@([\w.-]+)/)
    if (handleMatch) {
      const channelId = await resolveHandleToChannelId(handleMatch[1])
      if (channelId) {
        const result = { type: 'channel_id' as const, value: channelId }
        cacheSet(cacheKey, result)
        return result
      }
      return null
    }

    // /user/name または /c/name
    const userMatch = path.match(/\/(?:c|user)\/([\w.-]+)/)
    if (userMatch) {
      const result = { type: 'user' as const, value: userMatch[1] }
      cacheSet(cacheKey, result)
      return result
    }
  } catch {
    return null
  }
  return null
}

/**
 * GET /api/v1/youtube/rss?channelUrl=https://youtube.com/@...&maxResults=10
 * YouTube RSS フィード経由で最新動画を取得（API クォータ不使用）
 */
youtubeRouter.get('/rss', async (c) => {
  const channelUrl = c.req.query('channelUrl')
  if (!channelUrl) return c.json({ error: 'channelUrl が必要です' }, 400)

  const maxResults = Math.min(Number(c.req.query('maxResults') ?? '15'), 50)
  const cacheKey = `rss:${channelUrl}:${maxResults}`
  const cached = cacheGet<YoutubeVideo[]>(cacheKey)
  if (cached) return c.json({ videos: cached, cached: true })

  const channel = await resolveChannelForRss(channelUrl)
  if (!channel) return c.json({ error: 'チャンネルを解決できませんでした', videos: [] }, 200)

  const rssParam = channel.type === 'channel_id'
    ? `channel_id=${channel.value}`
    : `user=${encodeURIComponent(channel.value)}`
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?${rssParam}`

  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OrbitBot/1.0)' },
    })
    if (!res.ok) return c.json({ error: `RSS 取得失敗: ${res.status}`, videos: [] }, 200)

    const xml = await res.text()
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
    const feed = parser.parse(xml)

    const entries: unknown[] = Array.isArray(feed?.feed?.entry)
      ? feed.feed.entry
      : feed?.feed?.entry ? [feed.feed.entry] : []

    const channelTitle: string = feed?.feed?.author?.name ?? feed?.feed?.title ?? ''

    const videos: YoutubeVideo[] = entries.slice(0, maxResults).map((entry: any) => {
      const videoId: string = entry['yt:videoId'] ?? ''
      const thumbnail: string =
        entry['media:group']?.['media:thumbnail']?.['@_url'] ?? null
      return {
        videoId,
        title: entry.title ?? '',
        description: entry['media:group']?.['media:description'] ?? '',
        publishedAt: entry.published ?? '',
        thumbnailUrl: thumbnail,
        channelTitle,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      }
    })

    cacheSet(cacheKey, videos)
    return c.json({ videos })
  } catch (e) {
    console.error('[YouTube RSS] error:', e)
    return c.json({ error: 'RSS パース失敗', videos: [] }, 200)
  }
})

type AuddTrackResult = {
  title: string
  artist: string
  spotifyUrl: string | null
  spotifyTrackId: string | null
  coverUrl: string | null
}

/**
 * GET /api/v1/youtube/music?videoId=xxx
 * AudD API で YouTube 動画の楽曲を音声指紋認識する
 */
youtubeRouter.get('/music', async (c) => {
  const videoId = c.req.query('videoId')
  if (!videoId) return c.json({ track: null }, 400)

  const cacheKey = `music:${videoId}`
  if (cache.has(cacheKey)) {
    const cached = cacheGet<AuddTrackResult>(cacheKey)
    return c.json({ track: cached })
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
  const apiToken = process.env.AUDD_API_TOKEN ?? ''
  const auddUrl = `https://api.audd.io/?url=${encodeURIComponent(youtubeUrl)}&return=spotify${apiToken ? `&api_token=${apiToken}` : ''}`

  try {
    const res = await fetch(auddUrl)
    if (!res.ok) {
      cacheSet(cacheKey, null)
      return c.json({ track: null })
    }
    const data = (await res.json()) as {
      status: string
      result?: {
        title?: string
        artist?: string
        spotify?: {
          id?: string
          external_urls?: { spotify?: string }
          album?: { images?: Array<{ url: string }> }
        }
      }
    }

    if (data.status !== 'success' || !data.result) {
      cacheSet(cacheKey, null)
      return c.json({ track: null })
    }

    const track: AuddTrackResult = {
      title: data.result.title ?? '',
      artist: data.result.artist ?? '',
      spotifyUrl: data.result.spotify?.external_urls?.spotify ?? null,
      spotifyTrackId: data.result.spotify?.id ?? null,
      coverUrl: data.result.spotify?.album?.images?.[0]?.url ?? null,
    }

    cacheSet(cacheKey, track)
    return c.json({ track })
  } catch {
    cacheSet(cacheKey, null)
    return c.json({ track: null })
  }
})

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

  const maxResults = Math.min(Number(c.req.query('maxResults') ?? '5'), 50)

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
