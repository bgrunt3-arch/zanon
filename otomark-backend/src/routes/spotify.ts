import { Hono } from 'hono'

export const spotifyRouter = new Hono()

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

// サーバーサイドメモリキャッシュ（シークレットモード・別ブラウザでも有効）
type CacheEntry = { body: Buffer; contentType: string; expiresAt: number }
const serverCache = new Map<string, CacheEntry>()

// パスごとのTTL（ミリ秒）
function getCacheTtl(path: string): number {
  if (path.includes('/me/')) return 60 * 60 * 1000          // 1時間: ユーザー情報・top tracks
  if (path.includes('/top/')) return 60 * 60 * 1000         // 1時間
  if (path.includes('/search')) return 30 * 60 * 1000       // 30分: 検索
  if (path.includes('/recommendations')) return 60 * 60 * 1000 // 1時間
  if (path.includes('/top-tracks')) return 60 * 60 * 1000   // 1時間: アーティストtop tracks
  if (path.includes('/albums')) return 24 * 60 * 60 * 1000  // 24時間: アルバム一覧
  if (path.includes('/tracks')) return 24 * 60 * 60 * 1000  // 24時間: アルバムトラック
  if (path.includes('/artists/')) return 24 * 60 * 60 * 1000 // 24時間: アーティスト情報
  return 60 * 60 * 1000 // デフォルト1時間
}

// 定期的に期限切れエントリを削除（メモリリーク防止）
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of serverCache) {
    if (now > entry.expiresAt) serverCache.delete(key)
  }
}, 10 * 60 * 1000) // 10分ごと

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

  // サーバーキャッシュチェック（ユーザー固有データ以外はキャッシュ可）
  const isMeEndpoint = normalized.startsWith('/me')
  if (!isMeEndpoint) {
    const cached = serverCache.get(normalized)
    if (cached && Date.now() < cached.expiresAt) {
      return new Response(cached.body.buffer as ArrayBuffer, {
        status: 200,
        headers: { 'Content-Type': cached.contentType, 'X-Cache': 'HIT' },
      })
    }
  }

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

  const arrayBuf = await spRes.arrayBuffer()
  const buf = Buffer.from(arrayBuf)

  // 成功レスポンスをサーバーキャッシュに保存
  if (spRes.ok && !isMeEndpoint) {
    const ttl = getCacheTtl(normalized)
    serverCache.set(normalized, { body: buf, contentType, expiresAt: Date.now() + ttl })
  }

  return new Response(arrayBuf, {
    status: spRes.status,
    headers: {
      'Content-Type': contentType,
      ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
    },
  })
})

