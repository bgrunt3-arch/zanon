import { Hono } from 'hono'
import { queryMany, db } from '../db/client.ts'
import { authRequired } from '../middleware/auth.ts'

export const notificationsRouter = new Hono()

// GET /notifications - 通知一覧
notificationsRouter.get('/', authRequired, async (c) => {
  const { userId } = c.get('user')
  const notifications = await queryMany(
    `SELECT n.id, n.type, n.is_read, n.created_at, n.review_id,
            u.username AS actor_username, u.display_name AS actor_display_name,
            r.body AS review_body
     FROM notifications n
     JOIN users u ON u.id = n.actor_id
     LEFT JOIN reviews r ON r.id = n.review_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT 30`,
    [userId]
  )
  const unread_count = notifications.filter((n: any) => !n.is_read).length
  return c.json({ notifications, unread_count })
})

// POST /notifications/read-all - 全既読
notificationsRouter.post('/read-all', authRequired, async (c) => {
  const { userId } = c.get('user')
  await db.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [userId])
  return c.json({ success: true })
})
