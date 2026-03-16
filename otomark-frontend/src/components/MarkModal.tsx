'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateMark } from '@/lib/hooks'
import { useAuthStore } from '@/lib/store'
import styles from './MarkModal.module.css'

type Props = { open: boolean; onClose: () => void }

type TargetType = 'album' | 'track' | 'artist'

export function MarkModal({ open, onClose }: Props) {
  const router     = useRouter()
  const { isLoggedIn } = useAuthStore()
  const createMark = useCreateMark()

  const [type,   setType]   = useState<TargetType>('album')
  const [title,  setTitle]  = useState('')
  const [artist, setArtist] = useState('')
  const [score,  setScore]  = useState(0)
  const [review, setReview] = useState('')
  const [hovered, setHovered] = useState(0)

  if (!open) return null

  const handleSubmit = async () => {
    if (!isLoggedIn) { router.push('/login'); return }
    if (!title.trim()) return

    // NOTE: 実際にはアルバムIDをDB検索して取得する
    // ここでは artist_id=1 を仮置き（MusicBrainz連携後に置き換え）
    try {
      await createMark.mutateAsync({
        album_id: type === 'album'  ? 1    : undefined,
        track_id: type === 'track'  ? 1    : undefined,
        artist_id: type === 'artist' ? 1   : undefined,
        score:  score > 0 ? score : undefined,
        review: review.trim() || undefined,
      })
      // リセット
      setTitle(''); setArtist(''); setScore(0); setReview('')
      onClose()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.title}>🎵 作品をマーク</div>

        {/* 種類 */}
        <div className={styles.group}>
          <label className={styles.label}>種類</label>
          <div className={styles.typeRow}>
            {(['album', 'track', 'artist'] as TargetType[]).map(t => (
              <button
                key={t}
                className={`${styles.typeBtn} ${type === t ? styles.typeBtnActive : ''}`}
                onClick={() => setType(t)}
              >
                {{ album: 'アルバム', track: '曲', artist: 'アーティスト' }[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 作品名 */}
        <div className={styles.group}>
          <label className={styles.label}>作品名</label>
          <input
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="例：宇宙 日本 世田谷"
          />
        </div>

        {/* アーティスト */}
        {type !== 'artist' && (
          <div className={styles.group}>
            <label className={styles.label}>アーティスト名</label>
            <input
              className={styles.input}
              value={artist}
              onChange={e => setArtist(e.target.value)}
              placeholder="例：フィッシュマンズ"
            />
          </div>
        )}

        {/* 評価 */}
        <div className={styles.group}>
          <label className={styles.label}>評価</label>
          <div className={styles.stars}>
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                className={`${styles.star} ${n <= (hovered || score) ? styles.starLit : ''}`}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setScore(n === score ? 0 : n)}
              >★</button>
            ))}
            {score > 0 && <span className={styles.scoreLabel}>{score}.0</span>}
          </div>
        </div>

        {/* レビュー */}
        <div className={styles.group}>
          <label className={styles.label}>レビュー（任意）</label>
          <textarea
            className={styles.textarea}
            value={review}
            onChange={e => setReview(e.target.value)}
            placeholder="この作品への感想を書こう..."
            rows={4}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onClose}>キャンセル</button>
          <button
            className={styles.btnSubmit}
            onClick={handleSubmit}
            disabled={!title.trim() || createMark.isPending}
          >
            {createMark.isPending ? <span className="spinner" /> : 'マークする'}
          </button>
        </div>
      </div>
    </div>
  )
}