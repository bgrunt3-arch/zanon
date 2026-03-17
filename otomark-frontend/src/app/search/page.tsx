'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAlbums, useArtists } from '@/lib/hooks'
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
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('albums')

  const debouncedQuery = useDebounce(query, 500)

  const { data: albumsData, isLoading: albumsLoading } = useAlbums(
    debouncedQuery ? { q: debouncedQuery } : undefined
  )
  const { data: artistsData, isLoading: artistsLoading } = useArtists(
    debouncedQuery ? { q: debouncedQuery } : undefined
  )

  const albums = albumsData?.albums ?? []
  const artists = artistsData?.artists ?? []

  const isLoading = tab === 'albums' ? albumsLoading : artistsLoading
  const hasQuery = debouncedQuery.trim().length > 0

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
          {hasQuery && albumsData && (
            <span className={styles.tabCount}>{albums.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${tab === 'artists' ? styles.activeTab : ''}`}
          onClick={() => setTab('artists')}
        >
          🎤 アーティスト
          {hasQuery && artistsData && (
            <span className={styles.tabCount}>{artists.length}</span>
          )}
        </button>
      </div>

      {/* コンテンツ */}
      {!hasQuery ? (
        <div className={styles.empty}>キーワードを入力して検索してください</div>
      ) : isLoading ? (
        <div className={styles.center}><div className="spinner" /></div>
      ) : tab === 'albums' ? (
        albums.length === 0 ? (
          <div className={styles.empty}>「{debouncedQuery}」に一致するアルバムが見つかりません</div>
        ) : (
          <div className={styles.albumGrid}>
            {albums.map(album => (
              <Link key={album.id} href={`/albums/${album.id}`} className={styles.albumCard}>
                <div className={styles.albumCover}>
                  {album.cover_url
                    ? <img src={album.cover_url} alt={album.title} className={styles.coverImg} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    : <span className={styles.coverEmoji}>💿</span>}
                </div>
                <div className={styles.albumInfo}>
                  <div className={styles.albumTitle}>{album.title}</div>
                  <div className={styles.albumArtist}>{album.artist_name}</div>
                  {album.avg_score && (
                    <div className={styles.albumScore}>{Number(album.avg_score).toFixed(1)} ★</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        artists.length === 0 ? (
          <div className={styles.empty}>「{debouncedQuery}」に一致するアーティストが見つかりません</div>
        ) : (
          <div className={styles.artistList}>
            {artists.map(artist => (
              <Link key={artist.id} href={`/artists/${artist.id}`} className={styles.artistItem}>
                <div className={styles.artistAvatar}>
                  {artist.image_url
                    ? <img src={artist.image_url} alt={artist.name} className={styles.avatarImg} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    : <span className={styles.avatarEmoji}>🎤</span>}
                </div>
                <div className={styles.artistInfo}>
                  <div className={styles.artistName}>{artist.name}</div>
                  <div className={styles.artistMeta}>
                    {artist.country && <span>{artist.country}</span>}
                    {artist.genres?.length > 0 && (
                      <span className={styles.artistGenre}>{artist.genres[0]}</span>
                    )}
                  </div>
                </div>
                <span className={styles.arrow}>›</span>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  )
}
