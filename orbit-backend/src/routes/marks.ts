import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db, queryOne, queryMany, withTransaction } from '../db/client.ts'
import { authRequired } from '../middleware/auth.ts'

export const marksRouter = new Hono()

// ===== バリデーションスキーマ =====
const markSchema = z.object({
  album_id:  z.number().int().positive().optional(),
  track_id:  z.number().int().positive().optional(),
  artist_id: z.number().int().positive().optional(),
  score:     z.number().int().min(1).max(5).optional(),
  review:    z.string().max(2000).optional(),
  listened_at: z.string().datetime().optional(),
}).refine(
  (d) => [d.album_id, d.track_id, d.artist_id].filter(Boolean).length === 1,
  { message: 'album_id / track_id / artist_id のいずれか1つを指定してください' }
)

// ===== POST /marks - マーク作成（レビューも同時に投稿可） =====
marksRouter.post('/', authRequired, zValidator('json', markSchema), async (c) => {
  const { userId } = c.get('user')
  const { album_id, track_id, artist_id, score, review, listened_at } = c.req.valid('json')

  const result = await withTransaction(async (client) => {
    // マーク作成（既にあれば score を更新）
    const mark = await client.query<{ id: number }>(
      `INSERT INTO marks (user_id, album_id, track_id, artist_id, score, listened_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, album_id) DO UPDATE SET score = EXCLUDED.score, listened_at = NOW()
       RETURNING id`,
      [userId, album_id ?? null, track_id ?? null, artist_id ?? null, score ?? null, listened_at ?? new Date()]
    )
    const markId = mark.rows[0].id

    // レビューがあれば保存（あれば更新）
    let reviewRow = null
    if (review && review.trim()) {
      const r = await client.query<{ id: number }>(
        `INSERT INTO reviews (user_id, mark_id, body)
         VALUES ($1, $2, $3)
         ON CONFLICT (mark_id) DO UPDATE SET body = EXCLUDED.body, updated_at = NOW()
         RETURNING id`,
        [userId, markId, review.trim()]
      )
      reviewRow = r.rows[0]
    }

    return { markId, reviewId: reviewRow?.id ?? null }
  })

  return c.json({ success: true, ...result }, 201)
})

// PUT /marks/:markId - マーク更新（スコア変更）
marksRouter.put('/:markId', authRequired, zValidator('json', z.object({
  score: z.number().int().min(1).max(5).nullable(),
})), async (c) => {
  const { userId } = c.get('user')
  const markId = Number(c.req.param('markId'))
  const { score } = c.req.valid('json')

  const mark = await queryOne<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM marks WHERE id = $1', [markId]
  )
  if (!mark) return c.json({ error: 'マークが見つかりません' }, 404)
  if (mark.user_id !== userId) return c.json({ error: '権限がありません' }, 403)

  await db.query('UPDATE marks SET score = $1 WHERE id = $2', [score, markId])
  return c.json({ success: true })
})

// ===== DELETE /marks/:markId - マーク削除 =====
marksRouter.delete('/:markId', authRequired, async (c) => {
  const { userId } = c.get('user')
  const markId = Number(c.req.param('markId'))

  const mark = await queryOne<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM marks WHERE id = $1',
    [markId]
  )
  if (!mark) return c.json({ error: 'マークが見つかりません' }, 404)
  if (mark.user_id !== userId) return c.json({ error: '権限がありません' }, 403)

  await db.query('DELETE FROM marks WHERE id = $1', [markId])
  return c.json({ success: true })
})

// ===== GET /marks/user/:username - ユーザーのマーク一覧 =====
marksRouter.get('/user/:username', async (c) => {
  const username = c.req.param('username')
  const page  = Number(c.req.query('page')  ?? 1)
  const limit = Number(c.req.query('limit') ?? 20)
  const offset = (page - 1) * limit

  // ユーザー存在確認
  const user = await queryOne<{ id: number }>(
    'SELECT id FROM users WHERE username = $1', [username]
  )
  if (!user) return c.json({ error: 'ユーザーが見つかりません' }, 404)

  const marks = await queryMany(
    `SELECT
       m.id, m.score, m.listened_at,
       -- アルバム情報
       a.id   AS album_id,   a.title  AS album_title,  a.cover_url AS album_cover,
       -- アーティスト（アルバム経由 or 直接）
       ar.id  AS artist_id,  ar.name  AS artist_name,
       -- 曲情報
       t.id   AS track_id,   t.title  AS track_title,
       -- レビュー
       r.id   AS review_id,  r.body   AS review_body,  r.likes_count
     FROM marks m
     LEFT JOIN albums  a  ON a.id  = m.album_id
     LEFT JOIN artists ar ON ar.id = COALESCE(m.artist_id, a.artist_id)
     LEFT JOIN tracks  t  ON t.id  = m.track_id
     LEFT JOIN reviews r  ON r.mark_id = m.id
     WHERE m.user_id = $1
     ORDER BY m.listened_at DESC
     LIMIT $2 OFFSET $3`,
    [user.id, limit, offset]
  )

  return c.json({ marks, page, limit })
})

// GET /marks/want - 聴きたいリスト
marksRouter.get('/want', authRequired, async (c) => {
  const { userId } = c.get('user')
  const items = await queryMany(
    `SELECT w.id, w.created_at,
            a.id AS album_id, a.title AS album_title, a.cover_url AS album_cover,
            ar.id AS artist_id, ar.name AS artist_name,
            t.id AS track_id, t.title AS track_title
     FROM want_list w
     LEFT JOIN albums a ON a.id = w.album_id
     LEFT JOIN artists ar ON ar.id = COALESCE(w.artist_id, a.artist_id)
     LEFT JOIN tracks t ON t.id = w.track_id
     WHERE w.user_id = $1
     ORDER BY w.created_at DESC`,
    [userId]
  )
  return c.json({ items })
})

// POST /marks/want - 聴きたいリストに追加
marksRouter.post('/want', authRequired, zValidator('json', z.object({
  album_id: z.number().int().optional(),
  track_id: z.number().int().optional(),
  artist_id: z.number().int().optional(),
})), async (c) => {
  const { userId } = c.get('user')
  const { album_id, track_id, artist_id } = c.req.valid('json')
  if (!album_id && !track_id && !artist_id) return c.json({ error: 'いずれかのIDが必要です' }, 400)

  await db.query(
    `INSERT INTO want_list (user_id, album_id, track_id, artist_id)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [userId, album_id ?? null, track_id ?? null, artist_id ?? null]
  )
  return c.json({ success: true })
})

// DELETE /marks/want/:id - 聴きたいリストから削除
marksRouter.delete('/want/:id', authRequired, async (c) => {
  const { userId } = c.get('user')
  const id = Number(c.req.param('id'))
  await db.query('DELETE FROM want_list WHERE id = $1 AND user_id = $2', [id, userId])
  return c.json({ success: true })
})