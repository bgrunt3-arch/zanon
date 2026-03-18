import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { queryOne, withTransaction } from '../db/client.ts'
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
