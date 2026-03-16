import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

// コネクションプール
export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,              // 最大接続数
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
})

// 接続確認
db.on('error', (err) => {
  console.error('PostgreSQL unexpected error:', err)
})

// ヘルパー: 単一行取得
export async function queryOne<T>(
  text: string,
  values?: unknown[]
): Promise<T | null> {
  const result = await db.query<T>(text, values)
  return result.rows[0] ?? null
}

// ヘルパー: 複数行取得
export async function queryMany<T>(
  text: string,
  values?: unknown[]
): Promise<T[]> {
  const result = await db.query<T>(text, values)
  return result.rows
}

// ヘルパー: トランザクション
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}