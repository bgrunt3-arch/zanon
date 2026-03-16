import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { db } from './client.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  console.log('🗄️  マイグレーション開始...')
  const sql = readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8')
  try {
    await db.query(sql)
    console.log('✅ マイグレーション完了')
  } catch (err) {
    console.error('❌ マイグレーション失敗:', err)
    process.exit(1)
  } finally {
    await db.end()
  }
}

migrate()