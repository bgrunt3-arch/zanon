'use client'

import { useState } from 'react'
import { useRanking } from '@/lib/hooks'
import styles from './page.module.css'

const GENRES  = ['', 'J-POP', 'ロック', 'ヒップホップ', 'インディー', 'エレクトロ', 'ジャズ']
const PERIODS = [
  { value: 'week',    label: '今週' },
  { value: 'month',   label: '今月' },
  { value: 'alltime', label: '歴代' },
] as const

export default function RankingPage() {
  const [genre,  setGenre]  = useState('')
  const [period, setPeriod] = useState<'week' | 'month' | 'alltime'>('alltime')

  const { data, isLoading } = useRanking({ genre: genre || undefined, period })
  const albums = data?.albums ?? []

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.sectionLabel}>Charts</div>
        <h1 className={styles.title}>ランキング</h1>
      </div>

      {/* ジャンルフィルター */}
      <div className={styles.filters}>
        {GENRES.map(g => (
          <button
            key={g}
            className={`${styles.filterBtn} ${genre === g ? styles.active : ''}`}
            onClick={() => setGenre(g)}
          >
            {g || 'すべて'}
          </button>
        ))}
      </div>

      {/* 期間フィルター */}
      <div className={styles.filters}>
        {PERIODS.map(p => (
          <button
            key={p.value}
            className={`${styles.filterBtn} ${period === p.value ? styles.active : ''}`}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className={styles.center}><div className="spinner" /></div>
      ) : (
        <div className={styles.list}>
          {albums.map((album, i) => (
            <div key={album.id} className={styles.item}>
              <div className={`${styles.rank} ${i < 3 ? styles.topRank : ''}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </div>
              <div className={styles.cover}>💿</div>
              <div className={styles.info}>
                <div className={styles.itemTitle}>{album.title}</div>
                <div className={styles.itemArtist}>
                  {album.artist_name}
                  {album.genres?.[0] && (
                    <span className={styles.genre}>{album.genres[0]}</span>
                  )}
                </div>
              </div>
              <div className={styles.count}>{album.reviews_count}件</div>
              {album.avg_score && (
                <div className={styles.score}>{Number(album.avg_score).toFixed(1)}</div>
              )}
            </div>
          ))}

          {albums.length === 0 && !isLoading && (
            <div className={styles.empty}>
              該当するアルバムがまだありません
            </div>
          )}
        </div>
      )}
    </div>
  )
}