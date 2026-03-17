import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { queryOne, withTransaction } from '../db/client.ts'
import { authRequired } from '../middleware/auth.ts'

export const musicbrainzRouter = new Hono()

const MB_BASE = 'https://musicbrainz.org/ws/2'
const MB_HEADERS = {
  'User-Agent': 'Otomark/1.0 (contact@example.com)',
  'Accept': 'application/json',
}

// インメモリキャッシュ（TTL 5分）
const cache = new Map<string, { data: unknown; expires: number }>()

async function mbFetch(url: string): Promise<unknown> {
  const cached = cache.get(url)
  if (cached && cached.expires > Date.now()) return cached.data

  const res = await fetch(url, { headers: MB_HEADERS })
  if (!res.ok) throw new Error(`MusicBrainz API error: ${res.status}`)
  const data = await res.json()
  cache.set(url, { data, expires: Date.now() + 5 * 60 * 1000 })
  return data
}

// ===== GET /musicbrainz/search =====
musicbrainzRouter.get(
  '/search',
  zValidator('query', z.object({
    q:    z.string().min(1),
    type: z.enum(['release', 'artist', 'recording']).default('release'),
    limit: z.coerce.number().min(1).max(25).default(10),
  })),
  async (c) => {
    const { q, type, limit } = c.req.valid('query')

    const url = `${MB_BASE}/${type}?query=${encodeURIComponent(q)}&limit=${limit}&fmt=json`
    const data = await mbFetch(url) as any

    // レスポンスを統一フォーマットに整形
    let results: unknown[]

    if (type === 'release') {
      results = (data.releases ?? []).map((r: any) => ({
        mbid:       r.id,
        title:      r.title,
        artist:     r['artist-credit']?.[0]?.artist?.name ?? '不明',
        date:       r.date ?? null,
        coverUrl:   `https://coverartarchive.org/release/${r.id}/front-250`,
        trackCount: r['track-count'] ?? null,
      }))
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
  authRequired,
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
      const releaseDate = data.date ?? null
      const coverUrl = `https://coverartarchive.org/release/${mbid}/front-250`

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
                track.number ? parseInt(track.number) : null,
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
