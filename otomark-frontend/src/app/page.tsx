'use client'

import { useState } from 'react'
import { useTimeline, useAlbums } from '@/lib/hooks'
import { ReviewCard } from '@/components/ReviewCard'
import styles from './page.module.css'

export default function HomePage() {
  const [mode, setMode] = useState<'all' | 'following'>('all')
  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError,
  } = useTimeline(mode)

  const { data: albumsData } = useAlbums({ limit: 5 } as any)

  const reviews = data?.pages.flatMap(p => p.reviews) ?? []

  return (
    <div className={styles.page}>
      {/* 新着アルバム */}
      {albumsData && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionLabel}>New Releases</div>
              <h2 className={styles.sectionTitle}>新着アルバム</h2>
            </div>
          </div>
          <div className={styles.albumGrid}>
            {albumsData.albums.map(album => (
              <div key={album.id} className={styles.albumItem}>
                <div className={styles.albumCover}>
                  {album.cover_url
                    ? <img src={album.cover_url} alt={album.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement('span'), { textContent: '💿', className: styles.albumEmoji })) }} />
                    : <span className={styles.albumEmoji}>💿</span>}
                </div>
                <div className={styles.albumTitle}>{album.title}</div>
                <div className={styles.albumArtist}>{album.artist_name}</div>
                {album.avg_score && (
                  <div className={styles.albumRating}>
                    <span className={styles.stars}>
                      {'★'.repeat(Math.round(album.avg_score))}
                    </span>
                    <span className={styles.ratingNum}>{Number(album.avg_score).toFixed(1)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* タイムライン */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionLabel}>Timeline</div>
            <h2 className={styles.sectionTitle}>みんなのレビュー</h2>
          </div>
          {/* モード切替 */}
          <div className={styles.modeTabs}>
            <button
              className={`${styles.modeTab} ${mode === 'all' ? styles.modeTabActive : ''}`}
              onClick={() => setMode('all')}
            >すべて</button>
            <button
              className={`${styles.modeTab} ${mode === 'following' ? styles.modeTabActive : ''}`}
              onClick={() => setMode('following')}
            >フォロー中</button>
          </div>
        </div>

        {isLoading && (
          <div className={styles.center}><div className="spinner" /></div>
        )}

        {isError && (
          <div className={styles.error}>
            データの取得に失敗しました。バックエンドサーバーが起動しているか確認してください。
          </div>
        )}

        <div className={styles.feed}>
          {reviews.map(review => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>

        {/* 無限スクロール: もっと読む */}
        {hasNextPage && (
          <button
            className={styles.btnMore}
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? <span className="spinner" /> : 'もっと見る'}
          </button>
        )}
      </section>
    </div>
  )
}