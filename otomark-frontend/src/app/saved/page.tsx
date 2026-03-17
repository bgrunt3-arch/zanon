'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { useSavedReviews } from '@/lib/hooks'
import { ReviewCard } from '@/components/ReviewCard'
import styles from './page.module.css'

export default function SavedPage() {
  const router = useRouter()
  const { isLoggedIn } = useAuthStore()
  const { data: reviews = [], isLoading } = useSavedReviews()

  useEffect(() => {
    if (!isLoggedIn) router.push('/login')
  }, [isLoggedIn, router])

  if (!isLoggedIn) return null

  return (
    <div className={styles.page}>
      <div className={styles.sectionLabel}>Bookmarks</div>
      <h1 className={styles.title}>保存済みレビュー</h1>

      {isLoading ? (
        <div className={styles.center}><div className="spinner" /></div>
      ) : reviews.length === 0 ? (
        <div className={styles.empty}>
          まだ保存したレビューがありません。<br />
          気になるレビューの 🔖 ボタンで保存できます。
        </div>
      ) : (
        <div className={styles.feed}>
          {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}
    </div>
  )
}
