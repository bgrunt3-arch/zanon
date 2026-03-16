import { createMiddleware } from 'hono/factory'
import jwt from 'jsonwebtoken'
import type { Context } from 'hono'

export type JwtPayload = {
  userId: number
  username: string
}

// ===== JWTトークン生成 =====
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as string,
  }) as string
}

// ===== 認証必須ミドルウェア =====
export const authRequired = createMiddleware<{
  Variables: { user: JwtPayload }
}>(async (c, next) => {
  const token = extractToken(c)
  if (!token) {
    return c.json({ error: '認証が必要です' }, 401)
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'トークンが無効または期限切れです' }, 401)
  }
})

// ===== 任意認証ミドルウェア（ログイン不要だが、していれば情報を付与） =====
export const authOptional = createMiddleware<{
  Variables: { user: JwtPayload | null }
}>(async (c, next) => {
  const token = extractToken(c)
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
      c.set('user', payload)
    } catch {
      c.set('user', null)
    }
  } else {
    c.set('user', null)
  }
  await next()
})

function extractToken(c: Context): string | null {
  const auth = c.req.header('Authorization')
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7)
  }
  return null
}