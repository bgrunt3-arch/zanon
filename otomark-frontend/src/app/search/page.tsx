'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from '../orbit.module.css'
import {
  getAccessToken,
  getSelectedArtists,
  searchTracksFromArtists,
  buildFeedItems,
  type SpotifyArtist,
  type FeedItem,
} from '@/lib/orbit'

const SEARCH_DEBOUNCE_MS = 300

function SearchContent() {
  const router = useRouter()
  const [selectedArtists, setSelectedArtists] = useState<SpotifyArtist[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FeedItem[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      router.replace('/login')
      return
    }
    const picks = getSelectedArtists()
    setSelectedArtists(picks)
    if (picks.length !== 5) {
      router.replace('/onboarding')
      return
    }
  }, [router])

  useEffect(() => {
    const q = searchQuery.trim()
    if (!q || selectedArtists.length === 0) {
      setSearchResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const token = getAccessToken()
      if (!token || cancelled) return
      setSearching(true)
      try {
        const tracks = await searchTracksFromArtists(token, selectedArtists, q, 30)
        if (cancelled) return
        const pickIds = new Set(selectedArtists.map((a) => a.id))
        const tagged = tracks.map((t) => ({
          track: t,
          sourcePickId: t.artists.find((a) => pickIds.has(a.id))?.id ?? null,
          fetchedAt: null as string | null,
          albumName: t.album?.name ?? null,
          coverUrl: t.album?.images?.[0]?.url ?? null,
        }))
        setSearchResults(buildFeedItems(tagged, selectedArtists))
      } catch {
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery, selectedArtists])

  return (
    <div className={styles.screen} data-nav-scroll>
      <div className={styles.shell}>
        <h1 className={styles.title}>検索</h1>
        <p className={styles.meta} style={{ marginBottom: 16 }}>
          5人の推しの曲を検索
        </p>

        <input
          id="search-input"
          name="search"
          type="search"
          placeholder="5人の推しの曲を検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
          className={styles.spotifyNavSearch}
          style={{
            width: '100%',
            marginBottom: 24,
            border: 'none',
            color: '#fff',
            outline: 'none',
            fontSize: 16,
          }}
        />

        {searching ? (
          <div className={styles.feed}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-${i}`} className={`${styles.post} ${styles.skeletonPost}`}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className={`${styles.skeletonBlock}`} style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)', borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className={`${styles.skeletonBlock}`} style={{ height: 14, width: '80%', marginBottom: 8 }} />
                    <div className={`${styles.skeletonBlock}`} style={{ height: 12, width: '60%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery.trim() === '' ? (
          <p className={styles.meta} style={{ color: '#727272' }}>
            キーワードを入力して検索を開始してください。
          </p>
        ) : searchResults.length > 0 ? (
          <div className={styles.feed}>
            {searchResults.map((item) => (
              <a
                key={item.id}
                href={item.trackUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={styles.post}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt="" style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)', borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)', borderRadius: 8, background: '#2a2a2a', display: 'grid', placeItems: 'center', color: '#1db954', flexShrink: 0 }}>
                      ♪
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </p>
                    <p className={styles.meta} style={{ fontSize: 12 }}>
                      {item.body}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className={styles.meta} style={{ color: '#727272' }}>
            該当する曲が見つかりませんでした。
          </p>
        )}

        <div style={{ marginTop: 24 }}>
          <Link href="/onboarding" className={styles.ghostButton} style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>
            推しを変更
          </Link>
        </div>
      </div>
    </div>
  )
}

export default dynamic(() => Promise.resolve(SearchContent), { ssr: false })
