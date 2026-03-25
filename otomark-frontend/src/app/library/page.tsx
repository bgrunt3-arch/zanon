'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../orbit.module.css'
import { getAccessToken, isMockMode, spotifyGet } from '@/lib/orbit'
import { useSpotifyPlayerContext } from '@/contexts/SpotifyPlayerContext'
import { useAlbumModalContext } from '@/contexts/AlbumModalContext'
import { getLocalPlaylists, type LocalPlaylist } from '@/lib/localPlaylist'

type TrackItem = {
  id: string
  name: string
  artists: string
  coverUrl: string | null
  spotifyUri: string
}

async function fetchRecentlyPlayed(token: string): Promise<TrackItem[]> {
  if (isMockMode() || token === 'mock-access-token') return []
  try {
    const res = await spotifyGet('/me/player/recently-played?limit=10', token)
    if (!res.ok) return []
    const data = await res.json() as { items: Array<{ track: { id: string; name: string; artists: Array<{ name: string }>; album: { images: Array<{ url: string }> } } }> }
    return data.items.map((item) => ({
      id: item.track.id + Math.random(),
      name: item.track.name,
      artists: item.track.artists.map((a) => a.name).join(', '),
      coverUrl: item.track.album.images?.[0]?.url ?? null,
      spotifyUri: `spotify:track:${item.track.id}`,
    }))
  } catch {
    return []
  }
}

async function fetchSavedTracks(token: string): Promise<TrackItem[]> {
  if (isMockMode() || token === 'mock-access-token') return []
  try {
    const res = await spotifyGet('/me/tracks?limit=10', token)
    if (!res.ok) return []
    const data = await res.json() as { items: Array<{ track: { id: string; name: string; artists: Array<{ name: string }>; album: { images: Array<{ url: string }> } } }> }
    return data.items.map((item) => ({
      id: item.track.id,
      name: item.track.name,
      artists: item.track.artists.map((a) => a.name).join(', '),
      coverUrl: item.track.album.images?.[0]?.url ?? null,
      spotifyUri: `spotify:track:${item.track.id}`,
    }))
  } catch {
    return []
  }
}

function TrackList({ items, onPlay }: { items: TrackItem[]; onPlay: (uri: string, allUris: string[]) => void }) {
  if (items.length === 0) {
    return <p className={styles.meta} style={{ color: '#727272', paddingBottom: 8 }}>データがありません</p>
  }
  const allUris = items.map((i) => i.spotifyUri)
  return (
    <div className={styles.discographyList}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={styles.discographyListItem}
          style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onClick={() => onPlay(item.spotifyUri, allUris)}
        >
          {item.coverUrl ? (
            <img src={item.coverUrl} alt="" className={styles.discographyListCover} style={{ width: 48, height: 48 }} />
          ) : (
            <div className={styles.discographyListCoverFallback} style={{ width: 48, height: 48, fontSize: 16 }}>♪</div>
          )}
          <div className={styles.discographyListInfo}>
            <p className={styles.discographyListTitle}>{item.name}</p>
            <p className={styles.discographyListMeta}>{item.artists}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function SkeletonList() {
  return (
    <div className={styles.discographyList}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={styles.discographyListItem} style={{ pointerEvents: 'none' }}>
          <div className={styles.skeletonBlock} style={{ width: 48, height: 48, borderRadius: 6, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.skeletonBlock} style={{ height: 14, width: '70%', marginBottom: 6 }} />
            <div className={styles.skeletonBlock} style={{ height: 12, width: '50%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function LocalPlaylistList({ playlists, onOpen }: { playlists: LocalPlaylist[]; onOpen: (p: LocalPlaylist) => void }) {
  if (playlists.length === 0) {
    return <p className={styles.meta} style={{ color: '#727272', paddingBottom: 8 }}>プレイリストがありません</p>
  }
  return (
    <div className={styles.discographyList}>
      {playlists.map((p) => (
        <button
          key={p.id}
          type="button"
          className={styles.discographyListItem}
          style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onClick={() => onOpen(p)}
        >
          {p.coverUrl ? (
            <img src={p.coverUrl} alt="" className={styles.discographyListCover} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div className={styles.discographyListCoverFallback} style={{ width: 48, height: 48, fontSize: 18 }}>♪</div>
          )}
          <div className={styles.discographyListInfo}>
            <p className={styles.discographyListTitle}>{p.name}</p>
            <p className={styles.discographyListMeta}>{p.tracks.length}曲</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function LibraryContent() {
  const router = useRouter()
  const { play, setQueue } = useSpotifyPlayerContext()
  const { openLocalPlaylistModal } = useAlbumModalContext()
  const [recentTracks, setRecentTracks] = useState<TrackItem[] | null>(null)
  const [savedTracks, setSavedTracks] = useState<TrackItem[] | null>(null)
  const [localPlaylists, setLocalPlaylists] = useState<LocalPlaylist[]>([])

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      router.replace('/login')
      return
    }
    fetchRecentlyPlayed(token).then(setRecentTracks)
    fetchSavedTracks(token).then(setSavedTracks)
    setLocalPlaylists(getLocalPlaylists())
  }, [router])

  useEffect(() => {
    const handler = () => setLocalPlaylists(getLocalPlaylists())
    window.addEventListener('playlist-updated', handler)
    return () => window.removeEventListener('playlist-updated', handler)
  }, [])

  const handlePlayTrack = useCallback(async (uri: string, allUris: string[]) => {
    setQueue(allUris)
    await play(uri)
  }, [play, setQueue])

  return (
    <div className={styles.screen} data-nav-scroll>
      <div className={styles.shell}>
        <div className={styles.sectionHeader} style={{ marginBottom: 24 }}>
          <h1 className={styles.spotifyNavTitle}>ライブラリ</h1>
        </div>

        <section style={{ marginBottom: 32 }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>最近再生した曲</h2>
          </div>
          {recentTracks === null ? <SkeletonList /> : <TrackList items={recentTracks} onPlay={handlePlayTrack} />}
        </section>

        <section style={{ marginBottom: 32 }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>保存済み曲</h2>
          </div>
          {savedTracks === null ? <SkeletonList /> : <TrackList items={savedTracks} onPlay={handlePlayTrack} />}
        </section>

        <section style={{ marginBottom: 32 }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>マイプレイリスト</h2>
          </div>
          <LocalPlaylistList playlists={localPlaylists} onOpen={openLocalPlaylistModal} />
        </section>
      </div>
    </div>
  )
}

export default dynamic(() => Promise.resolve(LibraryContent), { ssr: false })
