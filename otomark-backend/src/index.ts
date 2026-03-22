import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import { authRouter }                          from './routes/auth.ts'
import { marksRouter }                         from './routes/marks.ts'
import { reviewsRouter }                       from './routes/reviews.ts'
import { albumsRouter, artistsRouter, rankingRouter } from './routes/albums.ts'
import { usersRouter }                         from './routes/users.ts'
import { musicbrainzRouter }                   from './routes/musicbrainz.ts'
import { notificationsRouter }                 from './routes/notifications.ts'
import { paymentRouter }                        from './routes/payment.ts'

const app = new Hono()

// ===== グローバルミドルウェア =====
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// ===== ルート =====
const api = app.basePath('/api/v1')

api.route('/auth',    authRouter)
api.route('/marks',   marksRouter)
api.route('/reviews', reviewsRouter)
api.route('/albums',  albumsRouter)
api.route('/artists', artistsRouter)
api.route('/ranking', rankingRouter)
api.route('/users',       usersRouter)
api.route('/musicbrainz', musicbrainzRouter)
api.route('/notifications', notificationsRouter)
api.route('/payment',      paymentRouter)

// ===== ヘルスチェック =====
app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.0' }))

// ===== 404ハンドラー =====
app.notFound((c) => c.json({ error: 'ページが見つかりません' }, 404))

// ===== エラーハンドラー =====
app.onError((err, c) => {
  console.error('[ERROR]', err)
  return c.json({ error: 'サーバーエラーが発生しました' }, 500)
})

// ===== サーバー起動 =====
const port = Number(process.env.PORT ?? 3000)
const hostname = process.env.HOST ?? '0.0.0.0'
console.log(`
🎵 Otomark API サーバー起動
   URL  : http://localhost:${port}
   ENV  : ${process.env.NODE_ENV ?? 'development'}
`)

serve({ fetch: app.fetch, port, hostname })

export default app