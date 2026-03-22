'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import styles from '../orbit.module.css'

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Search page error:', error)
  }, [error])

  return (
    <div className={styles.screen}>
      <div className={styles.shell}>
        <h1 className={styles.title}>検索</h1>
        <p className={styles.meta} style={{ marginBottom: 16, color: '#ff8c8c' }}>
          ページの読み込み中にエラーが発生しました。
        </p>
        <button type="button" className={styles.button} onClick={reset}>
          再試行
        </button>
        <div style={{ marginTop: 16 }}>
          <Link href="/" className={styles.ghostButton} style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
