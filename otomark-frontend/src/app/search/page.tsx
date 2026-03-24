'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from '../orbit.module.css'
import {
  getAccessToken,
  getSelectedArtists,
  searchAllTracks,
  searchAllTracksAggregated,
  searchArtists,
  searchArtistsAggregated,
  SPOTIFY_SEARCH_MAX_OFFSET,
  type SpotifyArtist,
  type SpotifyTrack,
} from '@/lib/orbit'
import {
  getLocalPlaylists,
  addTrackToPlaylist,
  type LocalPlaylist,
  type LocalTrack,
} from '@/lib/localPlaylist'

const SEARCH_DEBOUNCE_MS = 300

type SearchResult = {
  trackId: string
  trackName: string
  artists: string
  albumName: string
  coverUrl: string | null
  spotifyUri: string
  trackUrl: string
}

function mapTracksToSearchResults(tracks: SpotifyTrack[]): SearchResult[] {
  return tracks.map((t) => ({
    trackId: t.id,
    trackName: t.name,
    artists: t.artists.map((a) => a.name).join(', '),
    albumName: t.album?.name ?? '',
    coverUrl: t.album?.images?.[0]?.url ?? null,
    spotifyUri: `spotify:track:${t.id}`,
    trackUrl: t.external_urls?.spotify ?? '',
  }))
}

function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const targetPlaylistId = searchParams.get('playlistId')

  const [selectedArtists, setSelectedArtists] = useState<SpotifyArtist[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTab, setSearchTab] = useState<'tracks' | 'artists'>('tracks')

  const [trackResults, setTrackResults] = useState<SearchResult[]>([])
  const [artistResults, setArtistResults] = useState<SpotifyArtist[]>([])
  const [searching, setSearching] = useState(false)
  const [tracksHasMore, setTracksHasMore] = useState(false)
  const [artistsHasMore, setArtistsHasMore] = useState(false)
  const [nextTrackOffset, setNextTrackOffset] = useState(0)
  const [nextArtistOffset, setNextArtistOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState<'tracks' | 'artists' | null>(null)

  const [addedIds, setAddedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    const pid = new URLSearchParams(window.location.search).get('playlistId')
    if (!pid) return new Set()
    const pl = getLocalPlaylists().find((p) => p.id === pid)
    return new Set(pl?.tracks.map((t) => t.id) ?? [])
  })

  const [addTarget, setAddTarget] = useState<SearchResult | null>(null)
  const [localPlaylists, setLocalPlaylists] = useState<LocalPlaylist[]>([])

  const [toastVisible, setToastVisible] = useState(false)
  const [toastKey, setToastKey] = useState(0)

  useEffect(() => {
    const token = getAccessToken()
    if (!token) { router.replace('/login'); return }
    const picks = getSelectedArtists()
    setSelectedArtists(picks)
    if (picks.length !== 5) { router.replace('/onboarding'); return }
  }, [router])

  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) {
      setTrackResults([])
      setArtistResults([])
      setTracksHasMore(false)
      setArtistsHasMore(false)
      setSearching(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const token = getAccessToken()
      if (!token || cancelled) return
      setSearching(true)
      try {
        const [tracksAgg, artistsAgg] = await Promise.all([
          searchAllTracksAggregated(token, q),
          searchArtistsAggregated(token, q),
        ])
        if (cancelled) return
        setTrackResults(mapTracksToSearchResults(tracksAgg.items))
        setArtistResults(artistsAgg.items)
        setTracksHasMore(tracksAgg.hasMore)
        setNextTrackOffset(tracksAgg.nextOffset)
        setArtistsHasMore(artistsAgg.hasMore)
        setNextArtistOffset(artistsAgg.nextOffset)
      } catch {
        if (!cancelled) {
          setTrackResults([])
          setArtistResults([])
          setTracksHasMore(false)
          setArtistsHasMore(false)
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [searchQuery])

  const buildLocalTrack = useCallback((r: SearchResult): LocalTrack => ({
    id: r.trackId,
    name: r.trackName,
    artistName: r.artists,
    albumName: r.albumName,
    coverUrl: r.coverUrl,
    uri: r.spotifyUri,
    durationMs: 0,
  }), [])

  const showToast = useCallback(() => {
    setToastVisible(true)
    setToastKey((k) => k + 1)
    setTimeout(() => setToastVisible(false), 2000)
  }, [])

  const loadMoreTracks = useCallback(async () => {
    const q = searchQuery.trim()
    const token = getAccessToken()
    if (!token || !q || loadingMore || !tracksHasMore) return
    setLoadingMore('tracks')
    try {
      const from = nextTrackOffset
      const batch = await searchAllTracks(token, q, from)
      setTrackResults((prev) => {
        const seen = new Set(prev.map((r) => r.trackId))
        const add = mapTracksToSearchResults(batch).filter((r) => !seen.has(r.trackId))
        return [...prev, ...add]
      })
      const next = from + batch.length
      setNextTrackOffset(next)
      setTracksHasMore(batch.length > 0 && next <= SPOTIFY_SEARCH_MAX_OFFSET)
    } catch {
      setTracksHasMore(false)
    } finally {
      setLoadingMore(null)
    }
  }, [searchQuery, loadingMore, tracksHasMore, nextTrackOffset])

  const loadMoreArtists = useCallback(async () => {
    const q = searchQuery.trim()
    const token = getAccessToken()
    if (!token || !q || loadingMore || !artistsHasMore) return
    setLoadingMore('artists')
    try {
      const from = nextArtistOffset
      const batch = await searchArtists(token, q, from)
      setArtistResults((prev) => {
        const seen = new Set(prev.map((a) => a.id))
        const add = batch.filter((a) => !seen.has(a.id))
        return [...prev, ...add]
      })
      const next = from + batch.length
      setNextArtistOffset(next)
      setArtistsHasMore(batch.length > 0 && next <= SPOTIFY_SEARCH_MAX_OFFSET)
    } catch {
      setArtistsHasMore(false)
    } finally {
      setLoadingMore(null)
    }
  }, [searchQuery, loadingMore, artistsHasMore, nextArtistOffset])

  const handleDirectAdd = useCallback((r: SearchResult) => {
    if (!targetPlaylistId) return
    addTrackToPlaylist(targetPlaylistId, buildLocalTrack(r))
    setAddedIds((prev) => new Set(prev).add(r.trackId))
    showToast()
  }, [targetPlaylistId, buildLocalTrack, showToast])

  const handleOpenSheet = useCallback((r: SearchResult) => {
    setLocalPlaylists(getLocalPlaylists())
    setAddTarget(r)
  }, [])

  const handleAddToPlaylist = useCallback((playlistId: string) => {
    if (!addTarget) return
    addTrackToPlaylist(playlistId, buildLocalTrack(addTarget))
    setAddTarget(null)
    showToast()
  }, [addTarget, buildLocalTrack, showToast])

  const targetPlaylistName = targetPlaylistId
    ? getLocalPlaylists().find((p) => p.id === targetPlaylistId)?.name
    : null

  const loadMoreButtonStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    marginTop: 12,
    padding: '12px 16px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  }

  const hPad = 'max(var(--spacing-lg), env(safe-area-inset-left, 0px))'
  const resultsPb = targetPlaylistId
    ? '16px'
    : 'calc(clamp(60px, 16vw, 80px) + env(safe-area-inset-bottom, 0px) + 80px)'

  return (
    <div
      className={styles.screen}
      data-nav-scroll
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* ヘッダー: タイトル・検索バー・タブ */}
      <div style={{
        flexShrink: 0,
        padding: `var(--spacing-xl) ${hPad} 0`,
        paddingRight: 'max(var(--spacing-lg), env(safe-area-inset-right, 0px))',
      }}>
        <h1 className={styles.title}>検索</h1>

        {/* プレイリスト追加モード: 上部検索バー＋バナー */}
        {targetPlaylistId && (
          <>
            <div
              className={styles.spotifyNavSearch}
              style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%', marginBottom: 12 }}
            >
              <input
                id="search-input"
                name="search"
                type="text"
                placeholder="曲名・アーティスト名を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: 16 }}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} aria-label="クリア"
                  style={{ flexShrink: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                    <path d="M9 1L5 5M5 5L1 9M5 5L9 9M5 5L1 1" stroke="rgba(0,0,0,0.9)" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(29,185,84,0.12)', border: '1px solid rgba(29,185,84,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ fontSize: 13, color: '#1db954', fontWeight: 600, margin: 0 }}>
                「{targetPlaylistName ?? 'プレイリスト'}」に追加中
              </p>
              <button type="button" onClick={() => router.back()}
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                戻る
              </button>
            </div>
          </>
        )}

        {/* 検索タブ（プレイリスト追加モード以外） */}
        {!targetPlaylistId && searchQuery.trim() && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setSearchTab('tracks')}
              style={{
                padding: '6px 16px',
                borderRadius: 999,
                border: '1px solid',
                borderColor: searchTab === 'tracks' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)',
                background: searchTab === 'tracks' ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: searchTab === 'tracks' ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              曲
            </button>
            <button
              type="button"
              onClick={() => setSearchTab('artists')}
              style={{
                padding: '6px 16px',
                borderRadius: 999,
                border: '1px solid',
                borderColor: searchTab === 'artists' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)',
                background: searchTab === 'artists' ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: searchTab === 'artists' ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              アーティスト
            </button>
          </div>
        )}
      </div>

      {/* 検索結果（スクロール可能エリア） */}
      <div
        data-nav-scroll
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch' as never,
          padding: `8px ${hPad} ${resultsPb}`,
          paddingRight: 'max(var(--spacing-lg), env(safe-area-inset-right, 0px))',
        }}
      >
        {searching ? (
          <div className={styles.searchResultsList}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`skeleton-${i}`} className={`${styles.post} ${styles.skeletonPost}`}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className={styles.skeletonBlock} style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)', borderRadius: searchTab === 'artists' ? '50%' : 8, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className={styles.skeletonBlock} style={{ height: 14, width: '80%', marginBottom: 8 }} />
                    <div className={styles.skeletonBlock} style={{ height: 12, width: '60%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery.trim() === '' ? (
          <p className={styles.meta} style={{ color: '#727272' }}>キーワードを入力して検索を開始してください。</p>
        ) : searchTab === 'artists' && !targetPlaylistId ? (
          artistResults.length > 0 ? (
            <>
              <div className={styles.searchResultsList}>
                {artistResults.map((artist) => (
                  <div key={artist.id} className={styles.post}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', cursor: 'pointer' }}
                    onClick={() => router.push(`/artists/${artist.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && router.push(`/artists/${artist.id}`)}
                  >
                    {artist.images?.[0]?.url ? (
                      <img src={artist.images[0].url} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#2a2a2a', display: 'grid', placeItems: 'center', color: '#1db954', flexShrink: 0, fontSize: 18, fontWeight: 700 }}>
                        {artist.name.slice(0, 2)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff', margin: 0 }}>
                        {artist.name}
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '3px 0 0' }}>
                        {artist.followers?.total ? `${artist.followers.total.toLocaleString()} フォロワー` : 'アーティスト'}
                      </p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)" aria-hidden>
                      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                    </svg>
                  </div>
                ))}
              </div>
              {artistsHasMore && (
                <button
                  type="button"
                  onClick={loadMoreArtists}
                  disabled={loadingMore !== null}
                  style={{
                    ...loadMoreButtonStyle,
                    opacity: loadingMore === 'artists' ? 0.65 : 1,
                  }}
                >
                  {loadingMore === 'artists' ? '読み込み中…' : 'さらに読み込む'}
                </button>
              )}
            </>
          ) : (
            <p className={styles.meta} style={{ color: '#727272' }}>該当するアーティストが見つかりませんでした。</p>
          )
        ) : trackResults.length > 0 ? (
          <>
            <div className={styles.searchResultsList}>
              {trackResults.map((item) => (
                <div key={item.trackId} className={styles.post} style={{ display: 'flex', alignItems: 'center', gap: 0, padding: 0 }}>
                  <a href={item.trackUrl} target="_blank" rel="noreferrer noopener"
                    style={{ display: 'flex', flex: 1, minWidth: 0, gap: 12, alignItems: 'flex-start', padding: '12px 8px 12px 12px', textDecoration: 'none', color: 'inherit' }}>
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt="" style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)', borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)', borderRadius: 8, background: '#2a2a2a', display: 'grid', placeItems: 'center', color: '#1db954', flexShrink: 0 }}>♪</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.trackName}</p>
                      <p className={styles.meta} style={{ fontSize: 12 }}>{item.artists}</p>
                    </div>
                  </a>
                  {targetPlaylistId ? (
                    addedIds.has(item.trackId) ? (
                      <span style={{ flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 4, color: '#1db954', fontSize: 20 }}>✓</span>
                    ) : (
                      <button type="button" onClick={() => handleDirectAdd(item)} aria-label="プレイリストに追加"
                        style={{ flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', marginRight: 4 }}>
                        ＋
                      </button>
                    )
                  ) : (
                    <button type="button" onClick={() => handleOpenSheet(item)} aria-label="プレイリストに追加"
                      style={{ flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', marginRight: 4 }}>
                      ＋
                    </button>
                  )}
                </div>
              ))}
            </div>
            {tracksHasMore && (
              <button
                type="button"
                onClick={loadMoreTracks}
                disabled={loadingMore !== null}
                style={{
                  ...loadMoreButtonStyle,
                  opacity: loadingMore === 'tracks' ? 0.65 : 1,
                }}
              >
                {loadingMore === 'tracks' ? '読み込み中…' : 'さらに読み込む'}
              </button>
            )}
          </>
        ) : (
          <p className={styles.meta} style={{ color: '#727272' }}>該当する曲が見つかりませんでした。</p>
        )}
      </div>

      {/* 下部固定エリア（通常モードのみ） */}
      {!targetPlaylistId && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(clamp(60px, 16vw, 80px) + env(safe-area-inset-bottom, 0px) + 24px)',
          left: 0, right: 0,
          background: '#121212',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          zIndex: 100,
        }}>
          <div style={{ padding: '8px 16px 10px' }}>
            <div className={styles.spotifyNavSearch} style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
              <input
                id="search-input"
                name="search"
                type="text"
                placeholder="曲名・アーティスト名を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: 16 }}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} aria-label="クリア"
                  style={{ flexShrink: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                    <path d="M9 1L5 5M5 5L1 9M5 5L9 9M5 5L1 1" stroke="rgba(0,0,0,0.9)" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* トースト */}
      {toastVisible && (
        <div key={toastKey} style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30,215,96,0.95)', color: '#000',
          fontSize: 13, fontWeight: 700, padding: '8px 20px',
          borderRadius: 24, whiteSpace: 'nowrap', zIndex: 300,
          pointerEvents: 'none', animation: 'fadeInOut 2s ease forwards',
        }}>
          追加しました
        </div>
      )}

      {/* ボトムシートスクリム */}
      {addTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 210 }}
          onClick={() => setAddTarget(null)} />
      )}

      {/* ボトムシート */}
      {addTarget && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 211,
          background: '#1e1e1e', borderRadius: '16px 16px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
          maxHeight: '60vh', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 20px 12px', flexShrink: 0 }}>
            プレイリストに追加
          </p>
          {localPlaylists.length === 0 ? (
            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', margin: 0 }}>プレイリストがまだありません</p>
              <button type="button" onClick={() => { setAddTarget(null); router.push('/create') }}
                style={{ padding: '10px 24px', background: '#1db954', color: '#000', fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 24, cursor: 'pointer' }}>
                プレイリストを作成する
              </button>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {localPlaylists.map((p) => (
                <button key={p.id} type="button" onClick={() => handleAddToPlaylist(p.id)}
                  style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '14px 20px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{p.tracks.length}曲</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default dynamic(() => Promise.resolve(SearchContent), { ssr: false })
