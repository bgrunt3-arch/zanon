'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { useMe, useUserMarks, useUserReviews } from '@/lib/hooks'
import { ReviewCard } from '@/components/ReviewCard'
import styles from './page.module.css'

export default function MyPage() {
  const router = useRouter()
  const { isLoggedIn, user: storeUser } = useAuthStore()

  useEffect(() => {
    if (!isLoggedIn) router.push('/login')
  }, [isLoggedIn, router])

  const { data: me }      = useMe()
  const username          = me?.username ?? storeUser?.username ?? ''
  const { data: marksData }   = useUserMarks(username)
  const { data: reviewsData } = useUserReviews(username)

  const marks   = marksData?.marks   ?? []
  const reviews = reviewsData?.reviews ?? []

  if (!isLoggedIn) return null

  return (
    <div className={styles.page}>
      {/* プロフィールヘッダー */}
      <header className={styles.profileHeader}>
        <div className={styles.avatar}>
          {me?.display_name?.[0] ?? '?'}
        </div>
        <div className={styles.profileInfo}>
          <h1 className={styles.displayName}>{me?.display_name ?? '...'}</h1>
          <div className={styles.handle}>@{me?.username ?? '...'}</div>
          {me?.bio && <p className={styles.bio}>{me.bio}</p>}
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{me?.marks_count ?? 0}</span>
              <span className={styles.statLabel}>マーク</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{me?.reviews_count ?? 0}</span>
              <span className={styles.statLabel}>レビュー</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{me?.following_count ?? 0}</span>
              <span className={styles.statLabel}>フォロー中</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{me?.followers_count ?? 0}</span>
              <span className={styles.statLabel}>フォロワー</span>
            </div>
          </div>
        </div>
      </header>

      {/* 聴いた作品 */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}>Listened</div>
        <h2 className={styles.sectionTitle}>聴いた作品</h2>

        {marks.length === 0 ? (
          <div className={styles.empty}>
            まだ記録がありません。「＋ マーク」ボタンで記録を始めよう！
          </div>
        ) : (
          <div className={styles.marksGrid}>
            {marks.map(mark => (
              <div key={mark.id} className={styles.markItem}>
                <div className={styles.markCover}>
                  {mark.album_cover
                    ? <img src={mark.album_cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    : <span>{mark.album_id ? '💿' : mark.track_id ? '🎵' : '🎤'}</span>}
                  {mark.score && (
                    <div className={styles.markBadge}>
                      {'★'.repeat(mark.score)}
                    </div>
                  )}
                </div>
                <div className={styles.markTitle}>
                  {mark.album_title ?? mark.track_title ?? mark.artist_name}
                </div>
                <div className={styles.markArtist}>{mark.artist_name}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 自分のレビュー */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}>My Reviews</div>
        <h2 className={styles.sectionTitle}>自分のレビュー</h2>

        {reviews.length === 0 ? (
          <div className={styles.empty}>まだレビューがありません。</div>
        ) : (
          <div className={styles.feed}>
            {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
          </div>
        )}
      </section>
    </div>
  )
}