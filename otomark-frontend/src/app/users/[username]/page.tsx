'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUser, useUserReviews, useUserMarks, useFollow, useMe, useDeleteMark } from '@/lib/hooks'
import { ReviewCard } from '@/components/ReviewCard'
import { ProfileEditModal } from '@/components/ProfileEditModal'
import styles from './page.module.css'

export default function UserPage({ params }: { params: { username: string } }) {
  const { username } = params
  const { data: me } = useMe()
  const { data: user, isLoading } = useUser(username)
  const { data: reviewsData } = useUserReviews(username)
  const { data: marksData } = useUserMarks(username)
  const followMutation = useFollow()
  const deleteMark = useDeleteMark()
  const [editModalOpen, setEditModalOpen] = useState(false)

  const reviews = reviewsData?.reviews ?? []
  const marks   = marksData?.marks ?? []
  const isOwnProfile = me?.username === username
  const isFollowing = user?.is_following ?? false

  if (isLoading) return <div className={styles.center}>読み込み中...</div>
  if (!user) return <div className={styles.center}>ユーザーが見つかりません</div>

  const handleFollow = () => {
    followMutation.mutate({ username, following: isFollowing })
  }

  return (
    <div className={styles.page}>
      <header className={styles.profileHeader}>
        <div className={styles.avatar}>
          {user.avatar_url
            ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : (user.display_name?.[0] ?? '?')}
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.nameRow}>
            <h1 className={styles.displayName}>{user.display_name}</h1>
            {isOwnProfile ? (
              <button
                className={styles.editBtn}
                onClick={() => setEditModalOpen(true)}
              >
                編集
              </button>
            ) : (
              <button
                className={`${styles.followBtn} ${isFollowing ? styles.following : ''}`}
                onClick={handleFollow}
                disabled={followMutation.isPending}
              >
                {followMutation.isPending ? '...' : isFollowing ? 'フォロー中' : 'フォロー'}
              </button>
            )}
          </div>
          <div className={styles.handle}>@{user.username}</div>
          {user.bio && <p className={styles.bio}>{user.bio}</p>}
          <div className={styles.stats}>
            <Link href={`/users/${username}#marks`} className={styles.stat}>
              <span className={styles.statNum}>{user.marks_count ?? 0}</span>
              <span className={styles.statLabel}>マーク</span>
            </Link>
            <Link href={`/users/${username}#reviews`} className={styles.stat}>
              <span className={styles.statNum}>{user.reviews_count ?? 0}</span>
              <span className={styles.statLabel}>レビュー</span>
            </Link>
            <Link href={`/users/${username}/following`} className={styles.stat}>
              <span className={styles.statNum}>{user.following_count ?? 0}</span>
              <span className={styles.statLabel}>フォロー中</span>
            </Link>
            <Link href={`/users/${username}/followers`} className={styles.stat}>
              <span className={styles.statNum}>{user.followers_count ?? 0}</span>
              <span className={styles.statLabel}>フォロワー</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 聴いた作品 */}
      <section id="marks" className={styles.section}>
        <div className={styles.sectionLabel}>Listened</div>
        <h2 className={styles.sectionTitle}>聴いた作品</h2>
        {marks.length === 0 ? (
          <div className={styles.empty}>まだ記録がありません</div>
        ) : (
          <div className={styles.marksGrid}>
            {marks.map(mark => (
              <div key={mark.id} className={styles.markItem}>
                <div className={styles.markCover}>
                  {mark.album_cover
                    ? <img src={mark.album_cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    : <span>{mark.album_id ? '💿' : mark.track_id ? '🎵' : '🎤'}</span>}
                  {mark.score && <div className={styles.markBadge}>{'★'.repeat(mark.score)}</div>}
                  {isOwnProfile && (
                    <button
                      className={styles.markDeleteBtn}
                      onClick={() => deleteMark.mutate(mark.id)}
                      aria-label="削除"
                    >✕</button>
                  )}
                </div>
                <div className={styles.markTitle}>{mark.album_title ?? mark.track_title ?? mark.artist_name}</div>
                <div className={styles.markArtist}>{mark.artist_name}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* レビュー */}
      <section id="reviews" className={styles.section}>
        <div className={styles.sectionLabel}>Reviews</div>
        <h2 className={styles.sectionTitle}>レビュー</h2>
        {reviews.length === 0 ? (
          <div className={styles.empty}>まだレビューがありません</div>
        ) : (
          <div className={styles.feed}>
            {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
          </div>
        )}
      </section>

      <ProfileEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        initialDisplayName={user.display_name}
        initialBio={user.bio ?? ''}
        initialAvatarUrl={user.avatar_url}
      />
    </div>
  )
}
