'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLikeReview, useSaveReview, useComments, useCreateComment, useDeleteComment } from '@/lib/hooks'
import { useAuthStore } from '@/lib/store'
import type { Review } from '@/lib/api'
import styles from './ReviewCard.module.css'

type Props = { review: Review }

export function ReviewCard({ review }: Props) {
  const { isLoggedIn, user: me } = useAuthStore()
  const likeMutation = useLikeReview()
  const saveMutation = useSaveReview()
  const [liked, setLiked] = useState(review.is_liked ?? false)
  const [saved, setSaved] = useState(review.is_saved ?? false)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')

  const { data: comments = [] } = useComments(review.id, showComments)
  const createComment = useCreateComment(review.id)
  const deleteComment = useDeleteComment(review.id)

  const handleLike = () => {
    if (!isLoggedIn) return
    setLiked(prev => !prev)
    likeMutation.mutate({ reviewId: review.id, liked })
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return
    await createComment.mutateAsync(commentText.trim())
    setCommentText('')
  }

  // マーク対象のタイトル表示
  const targetTitle  = review.album_title ?? review.track_title ?? review.artist_name ?? '不明'
  const targetArtist = review.artist_name ?? ''
  const targetEmoji  = review.album_id ? '💿' : review.track_id ? '🎵' : '🎤'

  return (
    <article className={styles.card}>
      {/* ユーザー情報 */}
      <header className={styles.header}>
        <Link href={`/users/${review.username}`} className={styles.avatarLink}>
          <div className={styles.avatar} style={{ background: avatarColor(review.username) }}>
            {review.display_name?.[0] ?? '?'}
          </div>
        </Link>
        <div>
          <Link href={`/users/${review.username}`} className={styles.usernameLink}>
            <span className={styles.username}>@{review.username}</span>
            <span className={styles.displayName}>{review.display_name}</span>
          </Link>
        </div>
        <time className={styles.time}>{formatDate(review.created_at)}</time>
      </header>

      {/* 作品情報 */}
      <div className={styles.albumRow}>
        <div className={styles.albumCover}>
          {review.album_cover
            ? <img src={review.album_cover} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : targetEmoji}
        </div>
        <div>
          <div className={styles.albumTitle}>{targetTitle}</div>
          {targetArtist && <div className={styles.albumArtist}>{targetArtist}</div>}
        </div>
        {review.score && (
          <div className={styles.score}>
            {'★'.repeat(review.score)}{'☆'.repeat(5 - review.score)}
          </div>
        )}
      </div>

      {/* レビュー本文 */}
      <p className={styles.body}>{review.body}</p>

      {/* アクション */}
      <footer className={styles.actions}>
        <button
          className={`${styles.actionBtn} ${liked ? styles.liked : ''}`}
          onClick={handleLike}
          disabled={likeMutation.isPending}
        >
          {liked ? '♥' : '♡'} {review.likes_count + (liked ? 1 : 0)}
        </button>
        <button
          className={`${styles.actionBtn} ${showComments ? styles.activeAction : ''}`}
          onClick={() => setShowComments(prev => !prev)}
        >
          💬 コメント{comments.length > 0 ? ` ${comments.length}` : ''}
        </button>
        <button
          className={`${styles.actionBtn} ${saved ? styles.savedAction : ''}`}
          onClick={() => {
            if (!isLoggedIn) return
            setSaved(prev => !prev)
            saveMutation.mutate({ reviewId: review.id, saved })
          }}
          disabled={saveMutation.isPending}
        >
          {saved ? '🔖 保存済み' : '🔖 保存'}
        </button>
      </footer>

      {/* コメントパネル */}
      {showComments && (
        <div className={styles.commentPanel}>
          {comments.length === 0 && !createComment.isPending && (
            <div className={styles.commentEmpty}>コメントはまだありません</div>
          )}
          {comments.map(c => (
            <div key={c.id} className={styles.commentItem}>
              <Link href={`/users/${c.username}`} className={styles.commentAvatar} style={{ background: avatarColor(c.username) }}>
                {c.display_name?.[0] ?? '?'}
              </Link>
              <div className={styles.commentBody}>
                <span className={styles.commentUser}>@{c.username}</span>
                <span className={styles.commentText}>{c.body}</span>
              </div>
              {me?.username === c.username && (
                <button
                  className={styles.commentDelete}
                  onClick={() => deleteComment.mutate(c.id)}
                  disabled={deleteComment.isPending}
                >✕</button>
              )}
            </div>
          ))}
          {isLoggedIn ? (
            <form className={styles.commentForm} onSubmit={handleCommentSubmit}>
              <input
                className={styles.commentInput}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="コメントを入力..."
                maxLength={500}
              />
              <button
                type="submit"
                className={styles.commentSubmit}
                disabled={!commentText.trim() || createComment.isPending}
              >
                {createComment.isPending ? '...' : '送信'}
              </button>
            </form>
          ) : (
            <div className={styles.commentEmpty}>
              <Link href="/login">ログイン</Link>してコメントする
            </div>
          )}
        </div>
      )}
    </article>
  )
}

// ユーザー名からアバターカラーを生成
function avatarColor(username: string | undefined) {
  const colors = ['#7c6fff','#ff6b6b','#11998e','#f5c842','#c0392b','#4776e6']
  if (!username) return colors[0]
  const idx = username.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length
  return colors[idx]
}

function formatDate(iso: string) {
  const d    = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)   return 'たった今'
  if (min < 60)  return `${min}分前`
  const h = Math.floor(min / 60)
  if (h < 24)    return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
}
