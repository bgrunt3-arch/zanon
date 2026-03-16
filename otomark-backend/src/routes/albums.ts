import { Hono } from 'hono'
import { queryOne, queryMany } from '../db/client.ts'

export const albumsRouter  = new Hono()
export const artistsRouter = new Hono()
export const rankingRouter = new Hono()

// =============================================
// アルバム
// =============================================

// GET /albums - 一覧（検索・ジャンルフィルタ）
albumsRouter.get('/', async (c) => {
  const q      = c.req.query('q')      ?? ''
  const genre  = c.req.query('genre')  ?? ''
  const page   = Number(c.req.query('page')  ?? 1)
  const limit  = Number(c.req.query('limit') ?? 20)
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[]    = []

  if (q) {
    params.push(`%${q}%`)
    conditions.push(`(a.title ILIKE $${params.length} OR ar.name ILIKE $${params.length})`)
  }
  if (genre) {
    params.push(genre)
    conditions.push(`$${params.length} = ANY(a.genres)`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit, offset)

  const albums = await queryMany(
    `SELECT
       a.id, a.title, a.cover_url, a.release_date, a.genres,
       ar.id AS artist_id, ar.name AS artist_name,
       ROUND(AVG(m.score)::numeric, 2) AS avg_score,
       COUNT(DISTINCT m.id) AS marks_count,
       COUNT(DISTINCT r.id) AS reviews_count
     FROM albums a
     JOIN artists ar ON ar.id = a.artist_id
     LEFT JOIN marks   m ON m.album_id = a.id AND m.score IS NOT NULL
     LEFT JOIN reviews r ON r.mark_id  = m.id
     ${where}
     GROUP BY a.id, ar.id
     ORDER BY marks_count DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  return c.json({ albums, page, limit })
})

// GET /albums/:albumId - アルバム詳細
albumsRouter.get('/:albumId', async (c) => {
  const albumId = Number(c.req.param('albumId'))

  const album = await queryOne(
    `SELECT
       a.*, ar.id AS artist_id, ar.name AS artist_name, ar.image_url AS artist_image,
       ROUND(AVG(m.score)::numeric, 2) AS avg_score,
       COUNT(DISTINCT m.id)  AS marks_count,
       COUNT(DISTINCT r.id)  AS reviews_count
     FROM albums a
     JOIN artists ar ON ar.id = a.artist_id
     LEFT JOIN marks   m ON m.album_id = a.id AND m.score IS NOT NULL
     LEFT JOIN reviews r ON r.mark_id  = m.id
     WHERE a.id = $1
     GROUP BY a.id, ar.id`,
    [albumId]
  )
  if (!album) return c.json({ error: 'アルバムが見つかりません' }, 404)

  // 収録曲
  const tracks = await queryMany(
    `SELECT id, title, duration, track_number FROM tracks
     WHERE album_id = $1 ORDER BY track_number`,
    [albumId]
  )

  // 最新レビュー5件
  const reviews = await queryMany(
    `SELECT r.id, r.body, r.likes_count, r.created_at, m.score,
            u.username, u.display_name, u.avatar_url
     FROM reviews r
     JOIN marks m ON m.id = r.mark_id
     JOIN users u ON u.id = r.user_id
     WHERE m.album_id = $1
     ORDER BY r.created_at DESC LIMIT 5`,
    [albumId]
  )

  return c.json({ ...album, tracks, reviews })
})

// =============================================
// アーティスト
// =============================================

// GET /artists - 検索
artistsRouter.get('/', async (c) => {
  const q      = c.req.query('q') ?? ''
  const limit  = Number(c.req.query('limit') ?? 20)
  const offset = (Number(c.req.query('page') ?? 1) - 1) * limit

  const artists = await queryMany(
    `SELECT
       ar.id, ar.name, ar.image_url, ar.genres, ar.country,
       COUNT(DISTINCT a.id)  AS albums_count,
       COUNT(DISTINCT m.id)  AS marks_count
     FROM artists ar
     LEFT JOIN albums a ON a.artist_id = ar.id
     LEFT JOIN marks  m ON m.artist_id = ar.id
     WHERE ar.name ILIKE $1
     GROUP BY ar.id
     ORDER BY marks_count DESC
     LIMIT $2 OFFSET $3`,
    [`%${q}%`, limit, offset]
  )

  return c.json({ artists })
})

// GET /artists/:artistId - アーティスト詳細
artistsRouter.get('/:artistId', async (c) => {
  const artistId = Number(c.req.param('artistId'))

  const artist = await queryOne(
    `SELECT ar.*,
       COUNT(DISTINCT a.id)  AS albums_count,
       COUNT(DISTINCT m.id)  AS marks_count,
       ROUND(AVG(mr.score)::numeric, 2) AS avg_score
     FROM artists ar
     LEFT JOIN albums  a  ON a.artist_id  = ar.id
     LEFT JOIN marks   mr ON mr.artist_id = ar.id AND mr.score IS NOT NULL
     LEFT JOIN marks   m  ON m.artist_id  = ar.id
     WHERE ar.id = $1
     GROUP BY ar.id`,
    [artistId]
  )
  if (!artist) return c.json({ error: 'アーティストが見つかりません' }, 404)

  const albums = await queryMany(
    `SELECT a.id, a.title, a.cover_url, a.release_date,
            ROUND(AVG(m.score)::numeric, 2) AS avg_score,
            COUNT(DISTINCT m.id) AS marks_count
     FROM albums a
     LEFT JOIN marks m ON m.album_id = a.id AND m.score IS NOT NULL
     WHERE a.artist_id = $1
     GROUP BY a.id
     ORDER BY a.release_date DESC`,
    [artistId]
  )

  return c.json({ ...artist, albums })
})

// =============================================
// ランキング
// =============================================

// GET /ranking/albums - アルバムランキング
rankingRouter.get('/albums', async (c) => {
  const genre  = c.req.query('genre')  ?? ''
  const period = c.req.query('period') ?? 'alltime' // week | month | alltime
  const limit  = Number(c.req.query('limit') ?? 20)

  const periodFilter =
    period === 'week'  ? `AND m.listened_at >= NOW() - INTERVAL '7 days'`  :
    period === 'month' ? `AND m.listened_at >= NOW() - INTERVAL '30 days'` : ''

  const genreFilter = genre ? `AND $2 = ANY(a.genres)` : ''
  const params: unknown[] = genre ? [limit, genre] : [limit]

  const albums = await queryMany(
    `SELECT
       a.id, a.title, a.cover_url, a.genres,
       ar.id AS artist_id, ar.name AS artist_name,
       ROUND(AVG(m.score)::numeric, 2) AS avg_score,
       COUNT(DISTINCT m.id) AS marks_count,
       COUNT(DISTINCT r.id) AS reviews_count
     FROM albums a
     JOIN artists ar ON ar.id = a.artist_id
     JOIN marks   m  ON m.album_id = a.id AND m.score IS NOT NULL ${periodFilter}
     LEFT JOIN reviews r ON r.mark_id = m.id
     WHERE 1=1 ${genreFilter}
     GROUP BY a.id, ar.id
     HAVING COUNT(DISTINCT m.id) >= 3
     ORDER BY avg_score DESC, marks_count DESC
     LIMIT $1`,
    params
  )

  return c.json({ albums, period, genre })
})

// GET /ranking/artists - アーティストランキング
rankingRouter.get('/artists', async (c) => {
  const limit = Number(c.req.query('limit') ?? 20)

  const artists = await queryMany(
    `SELECT
       ar.id, ar.name, ar.image_url, ar.genres,
       COUNT(DISTINCT m.id) AS marks_count
     FROM artists ar
     JOIN marks m ON m.artist_id = ar.id
     GROUP BY ar.id
     ORDER BY marks_count DESC
     LIMIT $1`,
    [limit]
  )

  return c.json({ artists })
})