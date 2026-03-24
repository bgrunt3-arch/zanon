'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './onboarding.module.css'
import { exchangeSpotifyTokenForAppJwt, saveUserFaves } from '@/lib/api'
import {
  clearAccessToken,
  clearForceMockFallback,
  fetchTopArtists,
  getAccessToken,
  getSelectedArtists,
  isMockMode,
  saveSelectedArtists,
  searchArtists,
  setForceMockFallback,
  type SpotifyArtist,
} from '@/lib/orbit'

export default function OnboardingPage() {
  const router = useRouter()
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([])
  const [topArtistsLoading, setTopArtistsLoading] = useState(true)
  const [selectedArtists, setSelectedArtists] = useState<SpotifyArtist[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SpotifyArtist[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      router.replace('/login')
      return
    }
    setSelectedArtists(getSelectedArtists())
  }, [router])

  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const token = getAccessToken()
    if (!token) return
    setTopArtistsLoading(true)
    setError('')
    fetchTopArtists(token)
      .then((artists) => setTopArtists(artists))
      .catch((e: unknown) => {
        setForceMockFallback()
        fetchTopArtists(token)
          .then((artists) => setTopArtists(artists))
          .catch(() => setTopArtists([]))
      })
      .finally(() => setTopArtistsLoading(false))
  }, [retryKey])

  useEffect(() => {
    const token = getAccessToken()
    if (!token || searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(() => {
      searchArtists(token, searchQuery)
        .then((results) => setSearchResults(results))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false))
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const addArtist = (artist: SpotifyArtist) => {
    if (selectedArtists.some((a) => a.id === artist.id)) return
    if (selectedArtists.length >= 5) return
    setSelectedArtists((prev) => [...prev, artist])
  }

  const removeArtist = (artistId: string) => {
    setSelectedArtists((prev) => prev.filter((a) => a.id !== artistId))
  }

  const completeOnboarding = async () => {
    if (selectedArtists.length !== 5) return
    const t = getAccessToken()
    if (!t) {
      router.push('/login')
      return
    }

    setSaving(true)
    setError('')

    try {
      const appJwt = await exchangeSpotifyTokenForAppJwt(t)
      await saveUserFaves(selectedArtists, appJwt)
      saveSelectedArtists(selectedArtists)
      router.push('/')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '推しアーティストの保存に失敗しました。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const relogin = () => {
    clearAccessToken()
    clearForceMockFallback()
    try {
      localStorage.removeItem('orbit.mockMode')
    } catch {
      /* ignore */
    }
    router.push('/login')
  }

  const retrySpotifyApi = () => {
    clearForceMockFallback()
    try {
      localStorage.removeItem('orbit.mockMode')
    } catch {
      /* ignore */
    }
    setRetryKey((k) => k + 1)
  }

  const isSelected = (id: string) => selectedArtists.some((a) => a.id === id)
  const canAdd = (id: string) => !isSelected(id) && selectedArtists.length < 5

  const [showMockExit, setShowMockExit] = useState(false)
  useEffect(() => {
    setShowMockExit(isMockMode())
  }, [retryKey])

  /** レンダー中に localStorage を読まない（SSR/プリレンダーで落ちないよう selectedArtists に同期） */
  const alreadyOnboarded = selectedArtists.length === 5

  return (
    <div className={styles.screen}>
      {alreadyOnboarded && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="閉じる"
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            right: 16,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.12)',
            border: 'none',
            borderRadius: '50%',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            zIndex: 50,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      )}
      <div className={styles.shell}>
        <div className={styles.scroll}>
          {/* ヒーロー */}
          <header className={styles.hero}>
            <h1 className={styles.heroTitle}>PICK YOUR 5</h1>
            <p className={styles.heroSub}>推し5人を選んで、あなただけのタイムラインを作ろう</p>
          </header>

          {/* 選択プログレス: 5スロット */}
          <section className={styles.progressSection}>
            <p className={styles.progressLabel}>選択中 {selectedArtists.length} / 5</p>
            <div className={styles.progressSlots}>
              {[0, 1, 2, 3, 4].map((i) => {
                const artist = selectedArtists[i]
                return (
                  <button
                    key={i}
                    type="button"
                    className={`${styles.progressSlot} ${artist ? styles.progressSlotFilled : ''} ${artist ? styles.progressSlotClickable : ''}`}
                    onClick={() => artist && removeArtist(artist.id)}
                    aria-label={artist ? `${artist.name} を外す` : `スロット ${i + 1}`}
                  >
                    {artist ? (
                      artist.images[0]?.url ? (
                        <img
                          src={artist.images[0].url}
                          alt={artist.name}
                          className={styles.progressSlotImg}
                        />
                      ) : (
                        <span className={styles.progressSlotFallback}>
                          {artist.name.slice(0, 2)}
                        </span>
                      )
                    ) : (
                      <span className={styles.progressSlotEmpty}>{i + 1}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {showMockExit && (
            <p className={styles.mockHint}>
              モックデータを表示中です。バックエンド（port 3002）が起動しているか確認し、「Spotify API を再試行」を押してください。
            </p>
          )}
          {error && <p className={styles.error}>{error}</p>}

          {/* 検索欄 */}
          <section>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="アーティストを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </section>

          {/* 検索結果 or TOP10 */}
          <section>
            {searchQuery.trim().length >= 2 ? (
              <>
                <h2 className={styles.sectionTitle}>検索結果</h2>
                {searchLoading ? (
                  <div className={styles.artistGrid}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={`skeleton-${i}`} className={styles.skeletonCard} />
                    ))}
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className={styles.emptyMessage}>該当するアーティストが見つかりませんでした</p>
                ) : (
                  <div className={styles.artistGrid}>
                    {searchResults.map((artist) => {
                      const selected = isSelected(artist.id)
                      const addable = canAdd(artist.id)
                      const hovered = hoveredId === artist.id && !selected && addable
                      return (
                        <article
                          key={artist.id}
                          className={`${styles.artistCard} ${selected ? styles.artistCardSelected : ''} ${hovered ? styles.artistCardHovered : ''} ${!addable && !selected ? styles.artistCardDisabled : ''}`}
                          onMouseEnter={() => setHoveredId(artist.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onClick={() => (selected ? removeArtist(artist.id) : addable && addArtist(artist))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              selected ? removeArtist(artist.id) : addable && addArtist(artist)
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          {artist.images[0]?.url ? (
                            <img src={artist.images[0].url} alt={artist.name} className={styles.artistCardImage} />
                          ) : (
                            <div className={styles.artistCardImageFallback}>{artist.name.slice(0, 2)}</div>
                          )}
                          {selected && <div className={styles.artistCardBadge}>✓</div>}
                          <div className={styles.artistCardOverlay}>
                            <p className={styles.artistCardName}>{artist.name}</p>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); selected ? removeArtist(artist.id) : addArtist(artist) }}
                              className={`${styles.artistCardAction} ${selected ? styles.artistCardActionSelected : addable ? styles.artistCardActionAdd : styles.artistCardActionDisabled}`}
                              disabled={!addable && !selected}
                            >
                              {selected ? '解除' : addable ? '追加' : '5人まで'}
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className={styles.sectionTitle}>あなたのTOP10</h2>
                {topArtistsLoading ? (
                  <div className={styles.artistGrid}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={`skeleton-${i}`} className={styles.skeletonCard} />
                    ))}
                  </div>
                ) : (
                  <div className={styles.artistGrid}>
                    {topArtists.map((artist) => {
                      const selected = isSelected(artist.id)
                      const addable = canAdd(artist.id)
                      const hovered = hoveredId === artist.id && !selected && addable
                      return (
                        <article
                          key={artist.id}
                          className={`${styles.artistCard} ${selected ? styles.artistCardSelected : ''} ${hovered ? styles.artistCardHovered : ''} ${!addable && !selected ? styles.artistCardDisabled : ''}`}
                          onMouseEnter={() => setHoveredId(artist.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onClick={() => (selected ? removeArtist(artist.id) : addable && addArtist(artist))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              selected ? removeArtist(artist.id) : addable && addArtist(artist)
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          {artist.images[0]?.url ? (
                            <img src={artist.images[0].url} alt={artist.name} className={styles.artistCardImage} />
                          ) : (
                            <div className={styles.artistCardImageFallback}>{artist.name.slice(0, 2)}</div>
                          )}
                          {selected && <div className={styles.artistCardBadge}>✓</div>}
                          <div className={styles.artistCardOverlay}>
                            <p className={styles.artistCardName}>{artist.name}</p>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); selected ? removeArtist(artist.id) : addArtist(artist) }}
                              className={`${styles.artistCardAction} ${selected ? styles.artistCardActionSelected : addable ? styles.artistCardActionAdd : styles.artistCardActionDisabled}`}
                              disabled={!addable && !selected}
                            >
                              {selected ? '解除' : addable ? '追加' : '5人まで'}
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}

                {!topArtistsLoading && topArtists.length === 0 && (
                  <p className={styles.emptyMessage}>
                    よく聴くアーティストのデータがありません。Spotifyで音楽を聴いてから再度お試しください。
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        {/* アクションバー */}
        <div className={styles.actions}>
          <div className={styles.actionButtons}>
            {showMockExit && (
              <button type="button" className={styles.ghostButton} onClick={retrySpotifyApi}>
                Spotify API を再試行
              </button>
            )}
            <button type="button" className={styles.ghostButton} onClick={relogin}>
              再ログイン
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={completeOnboarding}
              disabled={selectedArtists.length !== 5 || saving}
            >
              {saving ? '保存中...' : '5人でタイムラインを作る'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
