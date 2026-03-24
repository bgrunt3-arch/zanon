import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { db, queryOne } from '../db/client.ts'
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

// ===== POST /auth/spotify - Spotify access token -> app JWT交換 =====
// 本番バックエンドは faves 保存に app JWT が必要なため、
// Spotify 認証後の access token からユーザーを作成/復元して JWT を返します。
authRouter.post('/spotify', async (c) => {
  const auth = c.req.header('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    return c.json({ error: 'Spotify access token が必要です' }, 400)
  }
  const spotifyAccessToken = auth.slice('Bearer '.length)

  const spRes = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      Authorization: `Bearer ${spotifyAccessToken}`,
    },
  })

  if (!spRes.ok) {
    return c.json({ error: 'Spotify access token が無効です' }, 401)
  }

  const me = await spRes.json() as {
    id: string
    display_name?: string | null
    images?: Array<{ url: string }>
  }

  const spotifyUserId = me.id
  // `users.username` は VARCHAR(30) なので、Spotify id をそのまま入れると桁超過し得る。
  // 衝突しにくい短いユーザー名に正規化する。
  const idHash = createHash('sha256').update(spotifyUserId).digest('hex').slice(0, 16)
  const email = `spotify_${idHash}@spotify.local`
  const usernameBase = `sp_${idHash}`
  const displayName = (me.display_name ?? usernameBase).slice(0, 50)
  const avatarUrl = me.images?.[0]?.url ?? null

  // ユーザーは Spotify id から決定的なメールアドレスで一意化する
  let user = await queryOne<{
    id: number
    username: string
    email: string
    display_name: string
    avatar_url: string | null
  }>('SELECT id, username, email, display_name, avatar_url FROM users WHERE email = $1', [email])

  if (!user) {
    const randomPassword = randomBytes(16).toString('hex')
    const hashedPassword = await bcrypt.hash(randomPassword, 12)

    user = await queryOne(
      `INSERT INTO users (username, email, password, display_name, bio, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, display_name, avatar_url`,
      [usernameBase, email, hashedPassword, displayName, null, avatarUrl]
    )
  }

  if (!user) {
    return c.json({ error: 'ユーザー作成に失敗しました' }, 500)
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
    marks_count: number
    followers_count: number; following_count: number
  }>(
    `SELECT
       u.id, u.username, u.email, u.display_name, u.bio, u.avatar_url,
       COUNT(DISTINCT m.id)  AS marks_count,
       COUNT(DISTINCT f1.follower_id)  AS followers_count,
       COUNT(DISTINCT f2.following_id) AS following_count
     FROM users u
     LEFT JOIN marks   m  ON m.user_id = u.id
     LEFT JOIN follows f1 ON f1.following_id = u.id
     LEFT JOIN follows f2 ON f2.follower_id  = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId]
  )

  if (!user) return c.json({ error: 'ユーザーが見つかりません' }, 404)
  return c.json(user)
})

// ===== DELETE /auth/account - アカウント削除 =====
authRouter.delete('/account', authRequired, async (c) => {
  const { userId } = c.get('user')
  await db.query('DELETE FROM users WHERE id = $1', [userId])
  return c.json({ message: 'アカウントを削除しました' })
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