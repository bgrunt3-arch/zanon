import { Hono } from 'hono'

export const spotifyRouter = new Hono()

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

// GET /api/v1/spotify/proxy?path=/artists/{id}/albums?include_groups=album%2Csingle...
// - ブラウザから Spotify へ直接叩くと CORS で Retry-After ヘッダが読めないことがあるため、
//   バックエンドでプロキシして Retry-After を正確に返す。
spotifyRouter.get('/proxy', async (c) => {
  const auth = c.req.header('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    return c.json({ error: 'Spotify access token が必要です' }, 400)
  }
  const spotifyAccessToken = auth.slice('Bearer '.length)

  const targetPath = c.req.query('path') ?? ''
  if (!targetPath) {
    return c.json({ error: 'path が必要です' }, 400)
  }

  const normalized = targetPath.startsWith('/') ? targetPath : `/${targetPath}`
  const url = `${SPOTIFY_API_BASE}${normalized}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${spotifyAccessToken}`,
  }
  // 検索APIで日本語アーティスト名を返すため（SpotifyはAccept-Languageで名前の言語を切り替える）
  if (normalized.includes('/search')) {
    headers['Accept-Language'] = 'ja;q=1'
  }

  const spRes = await fetch(url, { headers })

  const retryAfter = spRes.headers.get('Retry-After') ?? null
  const contentType = spRes.headers.get('content-type') ?? 'application/json'

  // 429 のときだけ retryAfter をボディにも含める（ヘッダが欠落するケースの保険）
  if (spRes.status === 429) {
    const bodyText = await spRes.text().catch(() => '')
    const payload = { retryAfter, spotifyBody: bodyText }
    return c.json(payload, 429, {
      'Content-Type': 'application/json',
      ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
    })
  }

  const buf = Buffer.from(await spRes.arrayBuffer())
  return new Response(buf, {
    status: spRes.status,
    headers: {
      'Content-Type': contentType,
      ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
    },
  })
})

