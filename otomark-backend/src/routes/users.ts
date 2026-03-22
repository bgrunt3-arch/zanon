import { Hono } from 'hono'
import { db, queryOne, queryMany } from '../db/client.ts'
import { authRequired, authOptional } from '../middleware/auth.ts'

export const usersRouter = new Hono()

// ===== GET /users/:username - ユーザープロフィール =====
usersRouter.get('/:username', authOptional, async (c) => {
  const currentUser = c.get('user')
  const username = c.req.param('username')

  const user = await queryOne(
    `SELECT
       u.id, u.username, u.display_name, u.bio, u.avatar_url, u.created_at,
       COUNT(DISTINCT m.id)  AS marks_count,
       COUNT(DISTINCT f1.follower_id)  AS followers_count,
       COUNT(DISTINCT f2.following_id) AS following_count
     FROM users u
     LEFT JOIN marks   m  ON m.user_id = u.id
     LEFT JOIN follows f1 ON f1.following_id = u.id
     LEFT JOIN follows f2 ON f2.follower_id  = u.id
     WHERE u.username = $1
     GROUP BY u.id`,
    [username]
  )

  if (!user) return c.json({ error: 'ユーザーが見つかりません' }, 404)

  // ログイン中ならフォロー状態を付与
  let is_following = false
  if (currentUser) {
    const follow = await queryOne(
      'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
      [currentUser.userId, (user as any).id]
    )
    is_following = !!follow
  }

  return c.json({ ...user, is_following })
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

  await db.query(
    `INSERT INTO notifications (user_id, actor_id, type) VALUES ($1, $2, 'follow') ON CONFLICT DO NOTHING`,
    [target.id, userId]
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