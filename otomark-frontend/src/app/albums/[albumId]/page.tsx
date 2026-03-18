'use client'

import { useState } from 'react'
import { useAlbum, useAddWant, useRemoveWant } from '@/lib/hooks'
import { useAuthStore } from '@/lib/store'
import { ReviewCard } from '@/components/ReviewCard'
import { MarkModal } from '@/components/MarkModal'
import { toast } from '@/lib/toast'
import styles from './page.module.css'

function formatDuration(sec: number | null) {
  if (!sec) return null
  const m = Math.floor(sec / 60)
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

export default function AlbumPage({ params }: { params: { albumId: string } }) {
  const albumId = Number(params.albumId)
  const { data: album, isLoading } = useAlbum(albumId)
  const { isLoggedIn } = useAuthStore()
  const addWant    = useAddWant()
  const removeWant = useRemoveWant()
  const [wantId, setWantId]     = useState<number | null>(null)
  const [isWanted, setIsWanted] = useState(false)
  const [markOpen, setMarkOpen] = useState(false)

  if (isLoading) return <div className={styles.center}>読み込み中...</div>
  if (!album) return <div className={styles.center}>アルバムが見つかりません</div>

  const tracks  = album.tracks  ?? []
  const reviews = album.reviews ?? []

  const handleWant = async () => {
    if (!isLoggedIn) {
      toast.info('ログインが必要です')
      return
    }
    if (isWanted && wantId !== null) {
      try {
        await removeWant.mutateAsync(wantId)
        setIsWanted(false)
        setWantId(null)
        toast.success('聴きたいリストから削除しました')
      } catch {
        toast.error('削除に失敗しました')
      }
    } else {
      try {
        const res = await addWant.mutateAsync({ album_id: albumId })
        const data = res.data as { id?: number }
        if (data?.id) setWantId(data.id)
        setIsWanted(true)
        toast.success('聴きたいリストに追加しました', { href: '/want' })
      } catch {
        toast.error('追加に失敗しました')
      }
    }
  }

  return (
    <div className={styles.page}>
      {/* ヘッダー */}
      <header className={styles.header}>
        <div className={styles.cover}>
          {album.cover_url
            ? <img src={album.cover_url} alt={album.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : <span className={styles.coverEmoji}>💿</span>}
        </div>
        <div className={styles.meta}>
          <div className={styles.metaLabel}>Album</div>
          <h1 className={styles.title}>{album.title}</h1>
          <div className={styles.artist}>{album.artist_name}</div>
          <div className={styles.subMeta}>
            {album.release_date && <span>{album.release_date.slice(0, 4)}</span>}
            {album.genres?.length > 0 && <span>{album.genres.join(' / ')}</span>}
          </div>
          <div className={styles.stats}>
            {album.avg_score && (
              <div className={styles.scoreBlock}>
                <span className={styles.scoreNum}>{Number(album.avg_score).toFixed(1)}</span>
                <span className={styles.stars}>{'★'.repeat(Math.round(album.avg_score))}</span>
              </div>
            )}
            <div className={styles.stat}>
              <span className={styles.statNum}>{album.marks_count}</span>
              <span className={styles.statLabel}>マーク</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{album.reviews_count}</span>
              <span className={styles.statLabel}>レビュー</span>
            </div>

            <button
              className={styles.markBtn}
              onClick={() => {
                if (!isLoggedIn) { toast.info('ログインが必要です'); return }
                setMarkOpen(true)
              }}
            >
              ＋ マーク
            </button>
            <button
              className={`${styles.wantBtn} ${isWanted ? styles.wantBtnActive : ''}`}
              onClick={handleWant}
              disabled={addWant.isPending || removeWant.isPending}
            >
              {isWanted ? '✓ 聴きたい登録済み' : '♡ 聴きたい'}
            </button>
          </div>
        </div>
      </header>

      {/* トラックリスト */}
      {tracks.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Tracklist</div>
          <h2 className={styles.sectionTitle}>収録曲</h2>
          <ol className={styles.trackList}>
            {tracks.map(track => (
              <li key={track.id} className={styles.trackItem}>
                <span className={styles.trackNum}>{track.track_number ?? '—'}</span>
                <span className={styles.trackTitle}>{track.title}</span>
                {track.duration && (
                  <span className={styles.trackDuration}>{formatDuration(track.duration)}</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <MarkModal
        open={markOpen}
        onClose={() => setMarkOpen(false)}
        initialAlbum={{ albumId, title: album.title, artist: album.artist_name ?? '', coverUrl: album.cover_url }}
      />

      {/* レビュー */}
      <section className={styles.section}>
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
    </div>
  )
}
