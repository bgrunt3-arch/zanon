import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { queryOne, queryMany, withTransaction } from '../db/client.ts'
import { authRequired } from '../middleware/auth.ts'

export const musicbrainzRouter = new Hono()

const MB_BASE = 'https://musicbrainz.org/ws/2'
const MB_HEADERS = {
  'User-Agent': 'Otomark/1.0 (zanon-dev@example.com)',
  'Accept': 'application/json',
}

// MusicBrainzの部分日付 ("1998", "1998-05") をPostgreSQL DATE型に変換
function toFullDate(date: string | null | undefined): string | null {
  if (!date) return null
  if (/^\d{4}$/.test(date)) return `${date}-01-01`
  if (/^\d{4}-\d{2}$/.test(date)) return `${date}-01`
  return date
}

// インメモリキャッシュ（TTL 5分）
const cache = new Map<string, { data: unknown; expires: number }>()

// シリアルキュー: MusicBrainzへの同時リクエストを1本に制限し 1.1秒間隔を保証
const MB_INTERVAL = 1100 // MusicBrainzの推奨は1req/sec
let _mbChain: Promise<void> = Promise.resolve()
let _mbLastAt = 0

async function mbFetch(url: string): Promise<unknown> {
  // キャッシュヒット: ネットワーク不要
  const cached = cache.get(url)
  if (cached && cached.expires > Date.now()) return cached.data

  // キューに追加して順番に実行
  let resolve!: (v: unknown) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej })

  _mbChain = _mbChain.then(async () => {
    // 前回リクエストから最低 MB_INTERVAL ms 待機
    const wait = MB_INTERVAL - (Date.now() - _mbLastAt)
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    _mbLastAt = Date.now()

    // リトライループ（429 に対して最大3回、指数バックオフ）
    const maxAttempts = 3
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await fetch(url, { headers: MB_HEADERS })

        if (res.status === 429) {
          const backoff = 2000 * (attempt + 1) // 2s, 4s, 6s
          console.warn(`[MusicBrainz] 429 rate limit, backoff ${backoff}ms (attempt ${attempt + 1}/${maxAttempts})`)
          if (attempt < maxAttempts - 1) {
            await new Promise(r => setTimeout(r, backoff))
            _mbLastAt = Date.now()
            continue
          }
          reject(new Error('MusicBrainz rate limit exceeded'))
          return
        }

        if (!res.ok) {
          reject(new Error(`MusicBrainz API error: ${res.status}`))
          return
        }

        const data = await res.json()
        cache.set(url, { data, expires: Date.now() + 5 * 60 * 1000 })
        resolve(data)
        return
      } catch (e) {
        if (attempt === maxAttempts - 1) reject(e)
      }
    }
  }).catch(() => {}) // チェーンを止めない

  return promise
}

/** MusicBrainz アーティストのURL relationsからSNS URLを抽出 */
async function extractSnsUrlsFromMbid(mbid: string): Promise<{ urls: Record<string, string>; artistName?: string }> {
  const artistData = await mbFetch(
    `${MB_BASE}/artist/${mbid}?inc=url-rels&fmt=json`
  ) as { name?: string; relations?: Array<{ type?: string; url?: { resource?: string }; ended?: boolean }> }

  const urls: Record<string, string> = {}
  for (const rel of artistData?.relations ?? []) {
    if (rel.ended || !rel.url?.resource) continue
    const r = rel.url.resource
    if (rel.type === 'social network') {
      if (/twitter\.com|x\.com/i.test(r)) urls.x = r.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, 'https://x.com/')
      else if (/instagram\.com/i.test(r)) urls.instagram = r
      else if (/facebook\.com/i.test(r)) urls.facebook = r
    } else if (rel.type === 'youtube' && /youtube\.com|youtu\.be/i.test(r)) {
      urls.youtube = r
    }
  }

  return { urls, artistName: artistData?.name }
}

// MusicBrainz からアーティストの SNS URL を取得（内部関数）
async function fetchArtistSnsUrlsFromMb(spotifyId: string, artistName?: string): Promise<{ urls: Record<string, string>; artistName?: string }> {
  // 1. Spotify URL でMBID検索
  const spotifyUrl = `https://open.spotify.com/artist/${spotifyId}`
  const query = 'url:"' + spotifyUrl + '"'
  const urlData = await mbFetch(
    `${MB_BASE}/url?query=${encodeURIComponent(query)}&fmt=json`
  ) as { urls?: Array<{ 'relation-list'?: Array<{ relations?: Array<{ artist?: { id: string } }> }> }> }

  const mbidFromSpotify = urlData?.urls?.[0]?.['relation-list']?.[0]?.relations?.[0]?.artist?.id
  if (mbidFromSpotify) {
    return extractSnsUrlsFromMbid(mbidFromSpotify)
  }

  // 2. フォールバック: アーティスト名で検索
  if (!artistName) return { urls: {} }
  const nameQuery = `artist:"${artistName}"`
  const nameData = await mbFetch(
    `${MB_BASE}/artist?query=${encodeURIComponent(nameQuery)}&limit=3&fmt=json`
  ) as { artists?: Array<{ id: string; name: string; score?: number }> }

  const candidates = nameData?.artists ?? []
  // スコアが高くかつ名前が一致するものを選ぶ
  const match = candidates.find((a) => artistNameMatches(a.name, artistName))
  if (!match) return { urls: {} }

  return extractSnsUrlsFromMbid(match.id)
}

/** 名前を正規化して比較用に（大文字小文字・前後空白・連続空白を統一） */
function normalizeArtistName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFKC')
}

/** MusicBrainz のアーティスト名と期待名が一致するか（誤登録を弾く） */
function artistNameMatches(mbName: string | undefined, expectedName: string): boolean {
  if (!mbName) return false
  const a = normalizeArtistName(mbName)
  const b = normalizeArtistName(expectedName)
  if (a === b) return true
  // 片方がもう片方の先頭一致（例: "aespa" vs "aespa (에스파)"）
  if (a.startsWith(b) || b.startsWith(a)) return true
  return false
}

// ===== GET /musicbrainz/artist-sns-urls =====
musicbrainzRouter.get('/artist-sns-urls', async (c) => {
  const spotifyId = c.req.query('spotifyId')
  if (!spotifyId) return c.json({ error: 'spotifyId が必要です' }, 400)

  try {
    const result = await fetchArtistSnsUrlsFromMb(spotifyId)
    return c.json(result)
  } catch (e) {
    console.warn('[MusicBrainz] artist-sns-urls error:', e)
    return c.json({ urls: {} })
  }
})

// ===== POST /musicbrainz/artist-sns-urls-batch =====
// 複数アーティストの SNS URL を一括取得。名前一致するもののみ返す（誤登録を弾く）
musicbrainzRouter.post(
  '/artist-sns-urls-batch',
  zValidator(
    'json',
    z.object({
      artists: z.array(z.object({ id: z.string(), name: z.string() })).max(10),
    })
  ),
  async (c) => {
    const { artists } = c.req.valid('json')
    const results: Record<string, { urls: Record<string, string>; artistName?: string }> = {}

    for (const { id, name } of artists) {
      try {
        const r = await fetchArtistSnsUrlsFromMb(id, name)
        if (Object.keys(r.urls).length === 0) continue
        // Spotify URL直接ヒットの場合のみ名前検証（名前検索フォールバック時は既にマッチ済み）
        if (r.artistName && !artistNameMatches(r.artistName, name)) continue
        results[id] = r
      } catch {
        // スキップ
      }
    }

    return c.json({ artists: results })
  }
)

// ===== GET /musicbrainz/search =====
musicbrainzRouter.get(
  '/search',
  zValidator('query', z.object({
    q:    z.string().min(1),
    type: z.enum(['release-group', 'release', 'artist', 'recording']).default('release-group'),
    limit: z.coerce.number().min(1).max(25).default(10),
  })),
  async (c) => {
    const { q, type, limit } = c.req.valid('query')

    // release-group/release は日付ソートのため多めに取得してから絞り込む
    const fetchLimit = (type === 'release-group' || type === 'release')
      ? Math.min(limit * 5, 100)
      : limit
    const url = `${MB_BASE}/${type}?query=${encodeURIComponent(q)}&limit=${fetchLimit}&fmt=json`
    const data = await mbFetch(url) as any

    // レスポンスを統一フォーマットに整形
    let results: unknown[]

    if (type === 'release-group') {
      results = (data['release-groups'] ?? [])
        .map((rg: any) => ({
          mbid:        rg.id,
          title:       rg.title,
          artist:      rg['artist-credit']?.[0]?.artist?.name ?? '不明',
          date:        rg['first-release-date'] ?? null,
          primaryType: rg['primary-type'] ?? null,
          coverUrl:    `https://coverartarchive.org/release-group/${rg.id}/front-250`,
        }))
        .sort((a: any, b: any) => {
          if (!a.date) return 1
          if (!b.date) return -1
          return b.date.localeCompare(a.date)
        })
        .slice(0, limit)
    } else if (type === 'release') {
      results = (data.releases ?? [])
        .map((r: any) => ({
          mbid:       r.id,
          title:      r.title,
          artist:     r['artist-credit']?.[0]?.artist?.name ?? '不明',
          date:       r.date ?? null,
          coverUrl:   `https://coverartarchive.org/release/${r.id}/front-250`,
          trackCount: r['track-count'] ?? null,
        }))
        .sort((a: any, b: any) => {
          if (!a.date) return 1
          if (!b.date) return -1
          return b.date.localeCompare(a.date)
        })
        .slice(0, limit)
    } else if (type === 'artist') {
      results = (data.artists ?? []).map((a: any) => ({
        mbid:    a.id,
        name:    a.name,
        country: a.country ?? null,
        genres:  (a.tags ?? []).slice(0, 5).map((t: any) => t.name),
      }))
    } else {
      results = (data.recordings ?? []).map((r: any) => ({
        mbid:      r.id,
        title:     r.title,
        artist:    r['artist-credit']?.[0]?.artist?.name ?? '不明',
        duration:  r.length ? Math.round(r.length / 1000) : null,
        albumTitle: r.releases?.[0]?.title ?? null,
        albumMbid:  r.releases?.[0]?.id ?? null,
      }))
    }

    return c.json({ results })
  }
)

// ===== POST /musicbrainz/import =====
musicbrainzRouter.post(
  '/import',
  zValidator('json', z.object({
    type: z.enum(['release', 'artist', 'recording']),
    mbid: z.string().uuid(),
  })),
  async (c) => {
    const { type, mbid } = c.req.valid('json')

    if (type === 'release') {
      const data = await mbFetch(
        `${MB_BASE}/release/${mbid}?inc=artist-credits+recordings&fmt=json`
      ) as any

      const artistMbid = data['artist-credit']?.[0]?.artist?.id
      const artistName = data['artist-credit']?.[0]?.artist?.name ?? '不明'
      const releaseDate = toFullDate(data.date)
      // cover-art-archive.front が true の場合のみ URL を設定（ない場合 CAA が 404 を返すため）
      const coverUrl = data['cover-art-archive']?.front
        ? `https://coverartarchive.org/release/${mbid}/front-250`
        : null

      const result = await withTransaction(async (client) => {
        // Artist upsert
        const artist = await client.query<{ id: number }>(
          `INSERT INTO artists (name, musicbrainz_id)
           VALUES ($1, $2)
           ON CONFLICT (musicbrainz_id) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [artistName, artistMbid ?? null]
        )
        const artistId = artist.rows[0].id

        // Album upsert
        const album = await client.query<{ id: number }>(
          `INSERT INTO albums (title, artist_id, release_date, cover_url, musicbrainz_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (musicbrainz_id) DO UPDATE SET
             title = EXCLUDED.title,
             cover_url = EXCLUDED.cover_url
           RETURNING id`,
          [data.title, artistId, releaseDate, coverUrl, mbid]
        )
        const albumId = album.rows[0].id

        // Tracks upsert
        const media = data.media ?? []
        for (const medium of media) {
          for (const track of medium.tracks ?? []) {
            await client.query(
              `INSERT INTO tracks (title, artist_id, album_id, duration, track_number, musicbrainz_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (musicbrainz_id) DO NOTHING`,
              [
                track.title,
                artistId,
                albumId,
                track.length ? Math.round(track.length / 1000) : null,
                // vinyl等で "A1","B2" のような非数値トラック番号を安全に処理
                (() => { const n = parseInt(track.number ?? ''); return isNaN(n) ? null : n })(),
                track.id,
              ]
            )
          }
        }

        return { artistId, albumId }
      })

      return c.json(result, 201)

    } else if (type === 'artist') {
      const data = await mbFetch(`${MB_BASE}/artist/${mbid}?fmt=json`) as any

      const artist = await queryOne<{ id: number }>(
        `INSERT INTO artists (name, country, musicbrainz_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (musicbrainz_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [data.name, data.country ?? null, mbid]
      )

      return c.json({ artistId: artist!.id }, 201)

    } else {
      // recording
      const data = await mbFetch(
        `${MB_BASE}/recording/${mbid}?inc=artist-credits+releases&fmt=json`
      ) as any

      const artistMbid = data['artist-credit']?.[0]?.artist?.id
      const artistName = data['artist-credit']?.[0]?.artist?.name ?? '不明'
      const firstRelease = data.releases?.[0]

      const result = await withTransaction(async (client) => {
        // Artist upsert
        const artist = await client.query<{ id: number }>(
          `INSERT INTO artists (name, musicbrainz_id)
           VALUES ($1, $2)
           ON CONFLICT (musicbrainz_id) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [artistName, artistMbid ?? null]
        )
        const artistId = artist.rows[0].id

        // Album upsert (if exists)
        let albumId: number | null = null
        if (firstRelease) {
          const album = await client.query<{ id: number }>(
            `INSERT INTO albums (title, artist_id, musicbrainz_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (musicbrainz_id) DO UPDATE SET title = EXCLUDED.title
             RETURNING id`,
            [firstRelease.title, artistId, firstRelease.id]
          )
          albumId = album.rows[0].id
        }

        // Track upsert
        const track = await client.query<{ id: number }>(
          `INSERT INTO tracks (title, artist_id, album_id, duration, musicbrainz_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (musicbrainz_id) DO UPDATE SET title = EXCLUDED.title
           RETURNING id`,
          [data.title, artistId, albumId, data.length ? Math.round(data.length / 1000) : null, mbid]
        )

        return { artistId, albumId, trackId: track.rows[0].id }
      })

      return c.json(result, 201)
    }
  }
)

// ===== POST /musicbrainz/sync-artist/:artistId =====
// アーティストのディスコグラフィーをMusicBrainzから一括取得・インポート
musicbrainzRouter.post('/sync-artist/:artistId', authRequired, async (c) => {
  const artistId = Number(c.req.param('artistId'))

  const artist = await queryOne<{ id: number; musicbrainz_id: string | null }>(
    'SELECT id, musicbrainz_id FROM artists WHERE id = $1',
    [artistId]
  )
  if (!artist) return c.json({ error: 'アーティストが見つかりません' }, 404)
  if (!artist.musicbrainz_id) return c.json({ error: 'MusicBrainz IDが設定されていません' }, 400)

  // MusicBrainzからリリースグループを全件取得
  const data = await mbFetch(
    `${MB_BASE}/release-group?artist=${artist.musicbrainz_id}&limit=100&fmt=json`
  ) as any

  const releaseGroups: any[] = data['release-groups'] ?? []

  // 各リリースグループをアルバムとしてupsert
  for (const rg of releaseGroups) {
    await queryOne(
      `INSERT INTO albums (title, artist_id, release_date, cover_url, musicbrainz_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (musicbrainz_id) DO UPDATE SET
         title      = EXCLUDED.title,
         cover_url  = COALESCE(albums.cover_url, EXCLUDED.cover_url)
       RETURNING id`,
      [
        rg.title,
        artistId,
        toFullDate(rg['first-release-date']),
        `https://coverartarchive.org/release-group/${rg.id}/front-250`,
        rg.id,
      ]
    )
  }

  // 更新後のアルバム一覧を返す
  const albums = await queryMany(
    `SELECT a.id, a.title, a.cover_url, a.release_date,
            ROUND(AVG(m.score)::numeric, 2) AS avg_score,
            COUNT(DISTINCT m.id) AS marks_count
     FROM albums a
     LEFT JOIN marks m ON m.album_id = a.id AND m.score IS NOT NULL
     WHERE a.artist_id = $1
     GROUP BY a.id
     ORDER BY a.release_date DESC NULLS LAST`,
    [artistId]
  )

  return c.json({ albums, imported: releaseGroups.length })
})
