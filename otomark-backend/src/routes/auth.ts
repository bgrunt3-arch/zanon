import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db, queryOne, queryMany } from '../db/client.ts'
import { signToken, authRequired } from '../middleware/auth.ts'

export const authRouter = new Hono()

// ===== バリデーションスキーマ =====
const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'ユーザー名は3文字以上')
    .max(30, 'ユーザー名は30文字以内')
    .regex(/^[a-zA-Z0-9_]+$/, '英数字とアンダースコアのみ使用できます'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上'),
  display_name: z.string().min(1).max(50),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

// ===== POST /auth/register =====
authRouter.post('/register', zValidator('json', registerSchema), async (c) => {
  const { username, email, password, display_name } = c.req.valid('json')

  // 重複チェック
  const existingUser = await queryOne<{ id: number }>(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  )
  if (existingUser) {
    return c.json({ error: 'このメールアドレスまたはユーザー名は既に使用されています' }, 409)
  }

  // パスワードハッシュ化
  const hashedPassword = await bcrypt.hash(password, 12)

  // ユーザー作成
  const user = await queryOne<{ id: number; username: string; email: string; display_name: string }>(
    `INSERT INTO users (username, email, password, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, display_name`,
    [username, email, hashedPassword, display_name]
  )

  const token = signToken({ userId: user!.id, username: user!.username })

  return c.json({
    token,
    user: { id: user!.id, username: user!.username, email: user!.email, display_name: user!.display_name },
  }, 201)
})

// ===== POST /auth/login =====
authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const user = await queryOne<{
    id: number; username: string; email: string
    password: string; display_name: string; avatar_url: string | null
  }>(
    'SELECT id, username, email, password, display_name, avatar_url FROM users WHERE email = $1',
    [email]
  )

  if (!user) {
    return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401)
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401)
  }

  const token = signToken({ userId: user.id, username: user.username })

  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
    },
  })
})

// ===== GET /auth/me - 自分のプロフィール取得 =====
authRouter.get('/me', authRequired, async (c) => {
  const { userId } = c.get('user')

  const user = await queryOne<{
    id: number; username: string; email: string
    display_name: string; bio: string | null; avatar_url: string | null
    marks_count: number; reviews_count: number
    followers_count: number; following_count: number
  }>(
    `SELECT
       u.id, u.username, u.email, u.display_name, u.bio, u.avatar_url,
       COUNT(DISTINCT m.id)  AS marks_count,
       COUNT(DISTINCT r.id)  AS reviews_count,
       COUNT(DISTINCT f1.follower_id)  AS followers_count,
       COUNT(DISTINCT f2.following_id) AS following_count
     FROM users u
     LEFT JOIN marks   m  ON m.user_id = u.id
     LEFT JOIN reviews r  ON r.user_id = u.id
     LEFT JOIN follows f1 ON f1.following_id = u.id
     LEFT JOIN follows f2 ON f2.follower_id  = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  )

  if (!user) return c.json({ error: 'ユーザーが見つかりません' }, 404)
  return c.json(user)
})

// ===== GET /auth/saved - 保存済みレビュー一覧 =====
authRouter.get('/saved', authRequired, async (c) => {
  const { userId } = c.get('user')

  const reviews = await queryMany(
    `SELECT r.id, r.body, r.likes_count, r.created_at,
            u.id AS user_id, u.username, u.display_name, u.avatar_url,
            m.score,
            a.id AS album_id, a.title AS album_title, a.cover_url AS album_cover,
            ar.id AS artist_id, ar.name AS artist_name,
            t.id AS track_id, t.title AS track_title,
            EXISTS(SELECT 1 FROM review_likes rl WHERE rl.review_id = r.id AND rl.user_id = $1) AS is_liked,
            true AS is_saved
     FROM saved_reviews sv
     JOIN reviews r ON r.id = sv.review_id
     JOIN users u ON u.id = r.user_id
     JOIN marks m ON m.id = r.mark_id
     LEFT JOIN albums a ON a.id = m.album_id
     LEFT JOIN artists ar ON ar.id = COALESCE(m.artist_id, a.artist_id)
     LEFT JOIN tracks t ON t.id = m.track_id
     WHERE sv.user_id = $1
     ORDER BY sv.created_at DESC`,
    [userId]
  )

  return c.json({ reviews })
})

// PUT /auth/profile - プロフィール編集
authRouter.put('/profile', authRequired, zValidator('json', z.object({
  display_name: z.string().min(1).max(50).optional(),
  bio: z.string().max(300).optional().nullable(),
  avatar_url: z.string().max(400000).optional().nullable(), // base64 or URL
})), async (c) => {
  const { userId } = c.get('user')
  const { display_name, bio, avatar_url } = c.req.valid('json')

  const sets: string[] = []
  const params: unknown[] = []
  if (display_name !== undefined) { params.push(display_name); sets.push(`display_name = $${params.length}`) }
  if (bio !== undefined) { params.push(bio); sets.push(`bio = $${params.length}`) }
  if (avatar_url !== undefined) { params.push(avatar_url); sets.push(`avatar_url = $${params.length}`) }
  if (sets.length === 0) return c.json({ error: '更新する項目がありません' }, 400)

  params.push(userId)
  const user = await queryOne(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id, username, display_name, bio, avatar_url`,
    params
  )
  return c.json(user)
})