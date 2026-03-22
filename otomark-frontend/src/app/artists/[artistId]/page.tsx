'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './artist.module.css'
import {
  fetchArtist,
  fetchArtistTopTracks,
  fetchArtistRecentAlbums,
  fetchRelatedArtists,
  getAccessToken,
  clearAccessToken,
  type SpotifyArtist,
  type SpotifyTrack,
} from '@/lib/orbit'

type AlbumItem = {
  id: string
  name: string
  releaseDate: string | null
  coverUrl: string | null
  albumType: string
}

const ALBUM_TYPE_LABELS: Record<string, string> = {
  album: 'アルバム',
  single: 'シングル',
  compilation: 'コンピレーション',
}

export default function ArtistPage() {
  const params = useParams()
  const router = useRouter()
  const artistId = typeof params.artistId === 'string' ? params.artistId : ''
  const [artist, setArtist] = useState<SpotifyArtist | null>(null)
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([])
  const [albums, setAlbums] = useState<AlbumItem[]>([])
  const [relatedArtists, setRelatedArtists] = useState<SpotifyArtist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [discographyFilter, setDiscographyFilter] = useState<'all' | 'album' | 'single' | 'compilation'>('all')

  useEffect(() => {
    if (!artistId) {
      setLoading(false)
      return
    }
    const token = getAccessToken()
    if (!token) {
      router.replace('/login')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    Promise.all([
      fetchArtist(token, artistId),
      fetchArtistTopTracks(token, artistId),
      fetchArtistRecentAlbums(token, artistId, 50),
      fetchRelatedArtists(token, artistId),
    ])
      .then(([a, tracks, rawAlbums, related]) => {
        if (cancelled) return
        setArtist(a ?? null)
        setTopTracks(tracks ?? [])
        setRelatedArtists(related ?? [])
        const items: AlbumItem[] = (rawAlbums ?? []).map((al: any) => ({
          id: al.id,
          name: al.name ?? '',
          releaseDate: al.release_date ?? null,
          coverUrl: al.images?.[0]?.url ?? null,
          albumType: al.album_type ?? 'album',
        }))
        setAlbums(items)
      })
      .catch((e: any) => {
        if (cancelled) return
        const msg = e?.message ?? '読み込みに失敗しました'
        if (/401|認証/.test(msg)) {
          clearAccessToken()
          router.replace('/login')
          return
        }
        setError(msg)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [artistId, router])

  const filteredAlbums = discographyFilter === 'all'
    ? albums
    : albums.filter((a) => a.albumType === discographyFilter)

  const formatFollowers = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}万`
    return String(n)
  }

  if (!artistId) {
    return (
      <div className={styles.screen}>
        <div className={styles.shell}>
          <p className={styles.error}>アーティストIDが指定されていません。</p>
          <Link href="/" className={styles.backLink}>ホームに戻る</Link>
        </div>
      </div>
    )
  }

  if (loading && !artist) {
    return (
      <div className={styles.screen}>
        <div className={styles.shell}>
          <div className={styles.artistHeader}>
            <div className={`${styles.artistAvatar} ${styles.skeleton}`} />
            <div className={styles.artistHeaderText}>
              <div className={`${styles.skeleton}`} style={{ width: 200, height: 36, marginBottom: 8 }} />
              <div className={`${styles.skeleton}`} style={{ width: 150, height: 18 }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !artist) {
    return (
      <div className={styles.screen}>
        <div className={styles.shell}>
          <p className={styles.error}>{error}</p>
          <Link href="/" className={styles.backLink}>ホームに戻る</Link>
        </div>
      </div>
    )
  }

  if (!artist) {
    return (
      <div className={styles.screen}>
        <div className={styles.shell}>
          <p className={styles.error}>アーティストが見つかりませんでした。</p>
          <Link href="/" className={styles.backLink}>ホームに戻る</Link>
        </div>
      </div>
    )
  }

  const followersCount = artist.followers?.total ?? 0

  return (
    <div className={styles.screen} data-nav-scroll>
      <div className={styles.shell}>
        <Link href="/" className={styles.backLink}>← 戻る</Link>

        {/* 1. Artist Header */}
        <header className={styles.artistHeader}>
          {artist.images?.[0]?.url ? (
            <img src={artist.images[0].url} alt="" className={styles.artistAvatar} />
          ) : (
            <div className={styles.artistAvatarFallback}>{artist.name.slice(0, 2)}</div>
          )}
          <div className={styles.artistHeaderText}>
            <h1 className={styles.artistName}>{artist.name}</h1>
            <p className={styles.monthlyListeners}>
              {formatFollowers(followersCount)}人の月間リスナー
            </p>
          </div>
        </header>

        {/* 2. Control Bar */}
        <div className={styles.controlBar}>
          <a
            href={`https://open.spotify.com/artist/${artist.id}`}
            target="_blank"
            rel="noreferrer"
            className={styles.playButton}
            aria-label="Spotifyで再生"
          >
            <span className={styles.playIcon} />
          </a>
          <button type="button" className={styles.shuffleButton} aria-label="シャッフル">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04-4.04 4.04L10.59 4 14.5 4zM14.5 20l-2.04-2.04 4.04-4.04L19.41 20 14.5 20z" />
            </svg>
          </button>
          <button type="button" className={styles.followButton}>フォロー中</button>
          <button type="button" className={styles.moreButton} aria-label="その他">⋯</button>
        </div>

        {/* 3. Popular Tracks (人気曲) */}
        {topTracks.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>人気曲</h2>
              <a href={`https://open.spotify.com/artist/${artist.id}`} target="_blank" rel="noreferrer" className={styles.seeAll}>
                もっと見る
              </a>
            </div>
            <ol className={styles.trackList}>
              {topTracks.slice(0, 5).map((track, i) => (
                <li key={track.id} className={styles.trackRow}>
                  <span className={styles.trackRank}>{i + 1}</span>
                  {track.album?.images?.[0]?.url ? (
                    <img src={track.album.images[0].url} alt="" className={styles.trackThumb} />
                  ) : (
                    <div className={styles.trackThumbFallback} />
                  )}
                  <div className={styles.trackInfo}>
                    <span className={styles.trackName}>{track.name}</span>
                  </div>
                  <span className={styles.trackPopularity}>
                    {(track.popularity ?? 0).toLocaleString()}
                  </span>
                  <span className={styles.trackDuration}>—</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 4. Discography (ディスコグラフィ) */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>ディスコグラフィ</h2>
            <a href={`https://open.spotify.com/artist/${artist.id}/discography`} target="_blank" rel="noreferrer" className={styles.seeAll}>
              すべて表示
            </a>
          </div>
          <div className={styles.filterChips}>
            <button
              type="button"
              className={`${styles.filterChip} ${discographyFilter === 'all' ? styles.filterChipActive : ''}`}
              onClick={() => setDiscographyFilter('all')}
            >
              人気の曲
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${discographyFilter === 'album' ? styles.filterChipActive : ''}`}
              onClick={() => setDiscographyFilter('album')}
            >
              アルバム
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${discographyFilter === 'single' ? styles.filterChipActive : ''}`}
              onClick={() => setDiscographyFilter('single')}
            >
              シングルとEP
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${discographyFilter === 'compilation' ? styles.filterChipActive : ''}`}
              onClick={() => setDiscographyFilter('compilation')}
            >
              コンピレーション
            </button>
          </div>
          <div className={styles.discographyGrid}>
            {filteredAlbums.map((album) => (
              <a
                key={album.id}
                href={`https://open.spotify.com/album/${album.id}`}
                target="_blank"
                rel="noreferrer"
                className={styles.albumCard}
              >
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt="" className={styles.albumCover} />
                ) : (
                  <div className={styles.albumCoverFallback}>{album.name.slice(0, 2)}</div>
                )}
                <span className={styles.albumTitle}>{album.name}</span>
                <span className={styles.albumMeta}>
                  {album.releaseDate ? album.releaseDate.slice(0, 4) : ''}
                  {album.releaseDate && ' • '}
                  {ALBUM_TYPE_LABELS[album.albumType] ?? album.albumType}
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* 5. Related Artists (ファンの間で人気) */}
        {relatedArtists.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>ファンの間で人気</h2>
              <span className={styles.seeAll}>すべて表示</span>
            </div>
            <div className={styles.relatedGrid}>
              {relatedArtists.slice(0, 6).map((a) => (
                <a
                  key={a.id}
                  href={`/artists/${a.id}`}
                  className={styles.relatedCard}
                >
                  {a.images?.[0]?.url ? (
                    <img src={a.images[0].url} alt="" className={styles.relatedAvatar} />
                  ) : (
                    <div className={styles.relatedAvatarFallback}>{a.name.slice(0, 2)}</div>
                  )}
                  <span className={styles.relatedName}>{a.name}</span>
                  <span className={styles.relatedLabel}>アーティスト</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
