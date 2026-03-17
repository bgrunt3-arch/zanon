import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db, queryOne, queryMany, withTransaction } from '../db/client.ts'
import { authRequired, authOptional } from '../middleware/auth.ts'

export const reviewsRouter = new Hono()

// ===== GET /reviews - タイムライン（フォロー中 or 全体） =====
reviewsRouter.get('/', authOptional, async (c) => {
  const currentUser = c.get('user')
  const mode  = c.req.query('mode')  ?? 'all'  // 'all' | 'following'
  const page  = Number(c.req.query('page')  ?? 1)
  const limit = Number(c.req.query('limit') ?? 20)
  const offset = (page - 1) * limit

  let whereClause = ''
  let params: unknown[] = [limit, offset]

  if (mode === 'following' && currentUser) {
    whereClause = 'WHERE r.user_id IN (SELECT following_id FROM follows WHERE follower_id = $3)'
    params.push(currentUser.userId)
  }

  const reviews = await queryMany(
    `SELECT
       r.id, r.body, r.likes_count, r.created_at,
       -- 投稿者
       u.id AS user_id, u.username, u.display_name, u.avatar_url,
       -- マーク情報（アルバム or 曲 or アーティスト）
       m.score,
       a.id   AS album_id,   a.title  AS album_title,  a.cover_url AS album_cover,
       ar.id  AS artist_id,  ar.name  AS artist_name,
       t.id   AS track_id,   t.title  AS track_title
     FROM reviews r
     JOIN users  u  ON u.id  = r.user_id
     JOIN marks  m  ON m.id  = r.mark_id
     LEFT JOIN albums  a  ON a.id  = m.album_id
     LEFT JOIN artists ar ON ar.id = COALESCE(m.artist_id, a.artist_id)
     LEFT JOIN tracks  t  ON t.id  = m.track_id
     ${whereClause}
     ORDER BY r.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  )

  return c.json({ reviews, page, limit })
})

// ===== GET /reviews/:reviewId - レビュー詳細 =====
reviewsRouter.get('/:reviewId', async (c) => {
  const reviewId = Number(c.req.param('reviewId'))

  const review = await queryOne(
    `SELECT
       r.id, r.body, r.likes_count, r.created_at, r.updated_at,
       u.id AS user_id, u.username, u.display_name, u.avatar_url,
       m.score,
       a.id   AS album_id,   a.title AS album_title,  a.cover_url AS album_cover,
       ar.id  AS artist_id,  ar.name AS artist_name,
       t.id   AS track_id,   t.title AS track_title
     FROM reviews r
     JOIN users  u  ON u.id  = r.user_id
     JOIN marks  m  ON m.id  = r.mark_id
     LEFT JOIN albums  a  ON a.id  = m.album_id
     LEFT JOIN artists ar ON ar.id = COALESCE(m.artist_id, a.artist_id)
     LEFT JOIN tracks  t  ON t.id  = m.track_id
     WHERE r.id = $1`,
    [reviewId]
  )

  if (!review) return c.json({ error: 'レビューが見つかりません' }, 404)
  return c.json(review)
})

// ===== PUT /reviews/:reviewId - レビュー編集 =====
reviewsRouter.put(
  '/:reviewId',
  authRequired,
  zValidator('json', z.object({ body: z.string().min(1).max(2000) })),
  async (c) => {
    const { userId } = c.get('user')
    const reviewId   = Number(c.req.param('reviewId'))
    const { body }   = c.req.valid('json')

    const review = await queryOne<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM reviews WHERE id = $1', [reviewId]
    )
    if (!review) return c.json({ error: 'レビューが見つかりません' }, 404)
    if (review.user_id !== userId) return c.json({ error: '権限がありません' }, 403)

    await db.query('UPDATE reviews SET body = $1 WHERE id = $2', [body, reviewId])
    return c.json({ success: true })
  }
)

// ===== DELETE /reviews/:reviewId - レビュー削除 =====
reviewsRouter.delete('/:reviewId', authRequired, async (c) => {
  const { userId } = c.get('user')
  const reviewId   = Number(c.req.param('reviewId'))

  const review = await queryOne<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM reviews WHERE id = $1', [reviewId]
  )
  if (!review) return c.json({ error: 'レビューが見つかりません' }, 404)
  if (review.user_id !== userId) return c.json({ error: '権限がありません' }, 403)

  await db.query('DELETE FROM reviews WHERE id = $1', [reviewId])
  return c.json({ success: true })
})

// ===== POST /reviews/:reviewId/like - いいね =====
reviewsRouter.post('/:reviewId/like', authRequired, async (c) => {
  const { userId } = c.get('user')
  const reviewId   = Number(c.req.param('reviewId'))

  const review = await queryOne<{ id: number }>(
    'SELECT id FROM reviews WHERE id = $1', [reviewId]
  )
  if (!review) return c.json({ error: 'レビューが見つかりません' }, 404)

  await withTransaction(async (client) => {
    // すでにいいね済みなら何もしない
    await client.query(
      `INSERT INTO review_likes (user_id, review_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, reviewId]
    )
    // likes_count を更新
    await client.query(
      'UPDATE reviews SET likes_count = (SELECT COUNT(*) FROM review_likes WHERE review_id = $1) WHERE id = $1',
      [reviewId]
    )
  })

  const updated = await queryOne<{ likes_count: number }>(
    'SELECT likes_count FROM reviews WHERE id = $1', [reviewId]
  )
  return c.json({ likes_count: updated!.likes_count })
})

// ===== POST /reviews/:reviewId/save - 保存 =====
reviewsRouter.post('/:reviewId/save', authRequired, async (c) => {
  const { userId } = c.get('user')
  const reviewId   = Number(c.req.param('reviewId'))

  const review = await queryOne<{ id: number }>(
    'SELECT id FROM reviews WHERE id = $1', [reviewId]
  )
  if (!review) return c.json({ error: 'レビューが見つかりません' }, 404)

  await db.query(
    `INSERT INTO saved_reviews (user_id, review_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, reviewId]
  )
  return c.json({ saved: true })
})

// ===== DELETE /reviews/:reviewId/save - 保存解除 =====
reviewsRouter.delete('/:reviewId/save', authRequired, async (c) => {
  const { userId } = c.get('user')
  const reviewId   = Number(c.req.param('reviewId'))

  await db.query(
    'DELETE FROM saved_reviews WHERE user_id = $1 AND review_id = $2',
    [userId, reviewId]
  )
  return c.json({ saved: false })
})

// ===== GET /reviews/:reviewId/comments - コメント一覧 =====
reviewsRouter.get('/:reviewId/comments', async (c) => {
  const reviewId = Number(c.req.param('reviewId'))

  const comments = await queryMany(
    `SELECT c.id, c.body, c.created_at,
            u.id AS user_id, u.username, u.display_name, u.avatar_url
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.review_id = $1
     ORDER BY c.created_at ASC`,
    [reviewId]
  )
  return c.json({ comments })
})

// ===== POST /reviews/:reviewId/comments - コメント投稿 =====
reviewsRouter.post(
  '/:reviewId/comments',
  authRequired,
  zValidator('json', z.object({ body: z.string().min(1).max(500) })),
  async (c) => {
    const { userId } = c.get('user')
    const reviewId   = Number(c.req.param('reviewId'))
    const { body }   = c.req.valid('json')

    const review = await queryOne<{ id: number }>(
      'SELECT id FROM reviews WHERE id = $1', [reviewId]
    )
    if (!review) return c.json({ error: 'レビューが見つかりません' }, 404)

    const comment = await queryOne(
      `INSERT INTO comments (review_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, body, created_at`,
      [reviewId, userId, body]
    )
    return c.json(comment, 201)
  }
)

// ===== DELETE /reviews/:reviewId/comments/:commentId - コメント削除 =====
reviewsRouter.delete('/:reviewId/comments/:commentId', authRequired, async (c) => {
  const { userId }   = c.get('user')
  const commentId    = Number(c.req.param('commentId'))

  const comment = await queryOne<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM comments WHERE id = $1', [commentId]
  )
  if (!comment) return c.json({ error: 'コメントが見つかりません' }, 404)
  if (comment.user_id !== userId) return c.json({ error: '権限がありません' }, 403)

  await db.query('DELETE FROM comments WHERE id = $1', [commentId])
  return c.json({ success: true })
})

// ===== DELETE /reviews/:reviewId/like - いいね取り消し =====
reviewsRouter.delete('/:reviewId/like', authRequired, async (c) => {
  const { userId } = c.get('user')
  const reviewId   = Number(c.req.param('reviewId'))

  await withTransaction(async (client) => {
    await client.query(
      'DELETE FROM review_likes WHERE user_id = $1 AND review_id = $2',
      [userId, reviewId]
    )
    await client.query(
      'UPDATE reviews SET likes_count = (SELECT COUNT(*) FROM review_likes WHERE review_id = $1) WHERE id = $1',
      [reviewId]
    )
  })

  const updated = await queryOne<{ likes_count: number }>(
    'SELECT likes_count FROM reviews WHERE id = $1', [reviewId]
  )
  return c.json({ likes_count: updated!.likes_count })
})