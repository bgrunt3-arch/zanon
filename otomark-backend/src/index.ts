import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import { authRouter }                          from './routes/auth.ts'
import { albumsRouter, artistsRouter, rankingRouter } from './routes/albums.ts'
import { usersRouter }                         from './routes/users.ts'
import { musicbrainzRouter }                   from './routes/musicbrainz.ts'
import { notificationsRouter }                 from './routes/notifications.ts'
import { paymentRouter }                        from './routes/payment.ts'
import { favesRouter }                          from './routes/faves.ts'
import { spotifyRouter }                        from './routes/spotify.ts'
import { youtubeRouter }                        from './routes/youtube.ts'

const app = new Hono()

// ===== グローバルミドルウェア =====
app.use('*', logger())
app.use('*', prettyJSON())
// CORS: localhost と 127.0.0.1 の両方を許可（ブラウザのアクセス方法で Origin が変わるため）
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:5173']
app.use('*', cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// ===== ルート =====
const api = app.basePath('/api/v1')

api.route('/auth',    authRouter)
api.route('/albums',  albumsRouter)
api.route('/artists', artistsRouter)
api.route('/ranking', rankingRouter)
api.route('/users',       usersRouter)
api.route('/musicbrainz', musicbrainzRouter)
api.route('/notifications', notificationsRouter)
api.route('/payment',      paymentRouter)
api.route('/faves',        favesRouter)
api.route('/spotify',     spotifyRouter)
api.route('/youtube',     youtubeRouter)

// ===== ヘルスチェック =====
app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.0' }))

// ===== 404ハンドラー =====
app.notFound((c) => c.json({ error: 'Not Found' }, 404))

// ===== エラーハンドラー =====
app.onError((err, c) => {
  console.error('[ERROR]', err)
  return c.json({ error: 'Internal Server Error' }, 500)
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