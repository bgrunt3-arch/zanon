import { Hono } from 'hono'
import { db, queryOne, queryMany, withTransaction } from '../db/client.ts'
import { authRequired } from '../middleware/auth.ts'

export const usersRouter = new Hono()

// ===== GET /users/:username - ユーザープロフィール =====
usersRouter.get('/:username', async (c) => {
  const username = c.req.param('username')

  const user = await queryOne(
    `SELECT
       u.id, u.username, u.display_name, u.bio, u.avatar_url, u.created_at,
       COUNT(DISTINCT m.id)  AS marks_count,
       COUNT(DISTINCT r.id)  AS reviews_count,
       COUNT(DISTINCT f1.follower_id)  AS followers_count,
       COUNT(DISTINCT f2.following_id) AS following_count
     FROM users u
     LEFT JOIN marks   m  ON m.user_id = u.id
     LEFT JOIN reviews r  ON r.user_id = u.id
     LEFT JOIN follows f1 ON f1.following_id = u.id
     LEFT JOIN follows f2 ON f2.follower_id  = u.id
     WHERE u.username = $1
     GROUP BY u.id`,
    [username]
  )

  if (!user) return c.json({ error: 'ユーザーが見つかりません' }, 404)
  return c.json(user)
})

// ===== GET /users/:username/reviews - ユーザーのレビュー一覧 =====
usersRouter.get('/:username/reviews', async (c) => {
  const username = c.req.param('username')
  const limit    = Number(c.req.query('limit') ?? 20)
  const offset   = (Number(c.req.query('page') ?? 1) - 1) * limit

  const user = await queryOne<{ id: number }>(
    'SELECT id FROM users WHERE username = $1', [username]
  )
  if (!user) return c.json({ error: 'ユーザーが見つかりません' }, 404)

  const reviews = await queryMany(
    `SELECT
       r.id, r.body, r.likes_count, r.created_at, m.score,
       a.id  AS album_id,  a.title  AS album_title,  a.cover_url,
       ar.id AS artist_id, ar.name  AS artist_name,
       t.id  AS track_id,  t.title  AS track_title
     FROM reviews r
     JOIN marks  m  ON m.id = r.mark_id
     LEFT JOIN albums  a  ON a.id  = m.album_id
     LEFT JOIN artists ar ON ar.id = COALESCE(m.artist_id, a.artist_id)
     LEFT JOIN tracks  t  ON t.id  = m.track_id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [user.id, limit, offset]
  )

  return c.json({ reviews })
})

// ===== POST /users/:username/follow - フォロー =====
usersRouter.post('/:username/follow', authRequired, async (c) => {
  const { userId } = c.get('user')
  const username   = c.req.param('username')

  const target = await queryOne<{ id: number }>(
    'SELECT id FROM users WHERE username = $1', [username]
  )
  if (!target) return c.json({ error: 'ユーザーが見つかりません' }, 404)
  if (target.id === userId) return c.json({ error: '自分自身はフォローできません' }, 400)

  await db.query(
    `INSERT INTO follows (follower_id, following_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, target.id]
  )

  return c.json({ success: true, following: true })
})

// ===== DELETE /users/:username/follow - フォロー解除 =====
usersRouter.delete('/:username/follow', authRequired, async (c) => {
  const { userId } = c.get('user')
  const username   = c.req.param('username')

  const target = await queryOne<{ id: number }>(
    'SELECT id FROM users WHERE username = $1', [username]
  )
  if (!target) return c.json({ error: 'ユーザーが見つかりません' }, 404)

  await db.query(
    'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
    [userId, target.id]
  )

  return c.json({ success: true, following: false })
})

// ===== GET /users/:username/followers - フォロワー一覧 =====
usersRouter.get('/:username/followers', async (c) => {
  const username = c.req.param('username')
  const user = await queryOne<{ id: number }>(
    'SELECT id FROM users WHERE username = $1', [username]
  )
  if (!user) return c.json({ error: 'ユーザーが見つかりません' }, 404)

  const followers = await queryMany(
    `SELECT u.id, u.username, u.display_name, u.avatar_url
     FROM follows f
     JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = $1
     ORDER BY f.created_at DESC`,
    [user.id]
  )
  return c.json({ followers })
})

// ===== GET /users/:username/following - フォロー中一覧 =====
usersRouter.get('/:username/following', async (c) => {
  const username = c.req.param('username')
  const user = await queryOne<{ id: number }>(
    'SELECT id FROM users WHERE username = $1', [username]
  )
  if (!user) return c.json({ error: 'ユーザーが見つかりません' }, 404)

  const following = await queryMany(
    `SELECT u.id, u.username, u.display_name, u.avatar_url
     FROM follows f
     JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = $1
     ORDER BY f.created_at DESC`,
    [user.id]
  )
  return c.json({ following })
})