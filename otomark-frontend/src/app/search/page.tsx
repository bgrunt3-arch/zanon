'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMBSearchReleases, useMBSearchArtists, useMBImport } from '@/lib/hooks'
import styles from './page.module.css'

type Tab = 'albums' | 'artists'

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('albums')
  const [importingMbid, setImportingMbid] = useState<string | null>(null)

  const debouncedQuery = useDebounce(query, 500)

  const { data: releases, isLoading: releasesLoading, isError: releasesError, refetch: refetchReleases } = useMBSearchReleases(debouncedQuery)
  const { data: artists, isLoading: artistsLoading, isError: artistsError, refetch: refetchArtists } = useMBSearchArtists(debouncedQuery)
  const mbImport = useMBImport()

  const isLoading = tab === 'albums' ? releasesLoading : artistsLoading
  const isError = tab === 'albums' ? releasesError : artistsError
  const refetch = tab === 'albums' ? refetchReleases : refetchArtists
  const hasQuery = debouncedQuery.trim().length > 0

  const handleAlbumClick = async (mbid: string) => {
    setImportingMbid(mbid)
    try {
      const result = await mbImport.mutateAsync({ type: 'release', mbid })
      if (result.albumId) router.push(`/albums/${result.albumId}`)
    } finally {
      setImportingMbid(null)
    }
  }

  const handleArtistClick = async (mbid: string) => {
    setImportingMbid(mbid)
    try {
      const result = await mbImport.mutateAsync({ type: 'artist', mbid })
      if (result.artistId) router.push(`/artists/${result.artistId}`)
    } finally {
      setImportingMbid(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.sectionLabel}>Search</div>
        <h1 className={styles.title}>検索</h1>
      </div>

      {/* 検索バー */}
      <div className={styles.searchBar}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.searchInput}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="アルバム名・アーティスト名を入力..."
          autoFocus
        />
        {query && (
          <button className={styles.clearBtn} onClick={() => setQuery('')}>✕</button>
        )}
      </div>

      {/* タブ */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'albums' ? styles.activeTab : ''}`}
          onClick={() => setTab('albums')}
        >
          💿 アルバム
          {hasQuery && releases && (
            <span className={styles.tabCount}>{releases.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${tab === 'artists' ? styles.activeTab : ''}`}
          onClick={() => setTab('artists')}
        >
          🎤 アーティスト
          {hasQuery && artists && (
            <span className={styles.tabCount}>{artists.length}</span>
          )}
        </button>
      </div>

      {/* コンテンツ */}
      {!hasQuery ? (
        <div className={styles.empty}>キーワードを入力して検索してください</div>
      ) : isLoading ? (
        <div className={styles.center}><div className="spinner" /></div>
      ) : isError ? (
        <div className={styles.empty}>
          検索に失敗しました。
          <button onClick={() => refetch()} style={{ marginLeft: '8px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            もう一度試す
          </button>
        </div>
      ) : tab === 'albums' ? (
        !releases || releases.length === 0 ? (
          <div className={styles.empty}>「{debouncedQuery}」に一致するアルバムが見つかりません</div>
        ) : (
          <div className={styles.albumGrid}>
            {releases.map(r => (
              <button
                key={r.mbid}
                className={styles.albumCard}
                onClick={() => handleAlbumClick(r.mbid)}
                disabled={importingMbid !== null}
                style={{ textAlign: 'left', background: 'none', border: 'none', cursor: importingMbid ? 'wait' : 'pointer', width: '100%' }}
              >
                <div className={styles.albumCover}>
                  <img
                    src={r.coverUrl}
                    alt={r.title}
                    className={styles.coverImg}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {importingMbid === r.mbid && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: '8px' }}>
                      <div className="spinner" />
                    </div>
                  )}
                </div>
                <div className={styles.albumInfo}>
                  <div className={styles.albumTitle}>{r.title}</div>
                  <div className={styles.albumArtist}>{r.artist}</div>
                  {r.date && <div className={styles.albumScore}>{r.date.slice(0, 4)}</div>}
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        !artists || artists.length === 0 ? (
          <div className={styles.empty}>「{debouncedQuery}」に一致するアーティストが見つかりません</div>
        ) : (
          <div className={styles.artistList}>
            {artists.map(a => (
              <button
                key={a.mbid}
                className={styles.artistItem}
                onClick={() => handleArtistClick(a.mbid)}
                disabled={importingMbid !== null}
                style={{ textAlign: 'left', background: 'none', border: 'none', cursor: importingMbid ? 'wait' : 'pointer', width: '100%' }}
              >
                <div className={styles.artistAvatar}>
                  <span className={styles.avatarEmoji}>🎤</span>
                </div>
                <div className={styles.artistInfo}>
                  <div className={styles.artistName}>{a.name}</div>
                  <div className={styles.artistMeta}>
                    {a.country && <span>{a.country}</span>}
                    {a.genres?.length > 0 && (
                      <span className={styles.artistGenre}>{a.genres[0]}</span>
                    )}
                  </div>
                </div>
                <span className={styles.arrow}>›</span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
