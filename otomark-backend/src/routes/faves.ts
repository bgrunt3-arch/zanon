import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { db, queryMany, queryOne } from '../db/client.ts'
import { authRequired } from '../middleware/auth.ts'

export const favesRouter = new Hono()

const faveSchema = z.object({
  artist_id: z.string().min(1).max(100),
  artist_name: z.string().min(1).max(255),
  artist_image_url: z.string().url().max(2000).nullable().optional(),
})

// GET /faves - ログインユーザーのお気に入りアーティスト一覧
favesRouter.get('/', authRequired, async (c) => {
  const { userId } = c.get('user')
  const faves = await queryMany(
    `SELECT artist_id, artist_name, artist_image_url, created_at
     FROM user_faves
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  )
  return c.json({ faves, limit: 5 })
})

// POST /faves - お気に入りアーティスト追加（最大5件）
favesRouter.post('/', authRequired, zValidator('json', faveSchema), async (c) => {
  const { userId } = c.get('user')
  const { artist_id, artist_name, artist_image_url } = c.req.valid('json')

  const countRow = await queryOne<{ total: string }>(
    'SELECT COUNT(*)::text AS total FROM user_faves WHERE user_id = $1',
    [userId]
  )
  if (Number(countRow?.total ?? '0') >= 5) {
    return c.json({ error: 'アーティストは最大5人まで保存できます' }, 400)
  }

  const inserted = await queryOne(
    `INSERT INTO user_faves (user_id, artist_id, artist_name, artist_image_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, artist_id) DO NOTHING
     RETURNING id, user_id, artist_id, artist_name, artist_image_url, created_at`,
    [userId, artist_id, artist_name, artist_image_url ?? null]
  )

  if (!inserted) {
    const existing = await queryOne(
      `SELECT id, user_id, artist_id, artist_name, artist_image_url, created_at
       FROM user_faves
       WHERE user_id = $1 AND artist_id = $2`,
      [userId, artist_id]
    )
    return c.json({ fave: existing, already_exists: true })
  }

  return c.json({ fave: inserted }, 201)
})

// DELETE /faves/:artistId - お気に入りアーティスト削除
favesRouter.delete('/:artistId', authRequired, async (c) => {
  const { userId } = c.get('user')
  const artistId = c.req.param('artistId')

  await db.query(
    'DELETE FROM user_faves WHERE user_id = $1 AND artist_id = $2',
    [userId, artistId]
  )

  return c.json({ success: true })
})

