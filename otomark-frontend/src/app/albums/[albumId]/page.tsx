'use client'

import { useAlbum } from '@/lib/hooks'
import { ReviewCard } from '@/components/ReviewCard'
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

  if (isLoading) return <div className={styles.center}>読み込み中...</div>
  if (!album) return <div className={styles.center}>アルバムが見つかりません</div>

  const tracks  = album.tracks  ?? []
  const reviews = album.reviews ?? []

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
