'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './orbit.module.css'
import artistStyles from './artists/[artistId]/artist.module.css'
import {
  fetchMe,
  fetchArtistTopTracks,
  fetchArtistRecentAlbums,
  fetchAlbumTracks,
  buildFeedItems,
  toISODate,
  clearAccessToken,
  getAccessToken,
  getSelectedArtists,
  saveSelectedArtists,
  computeOrbitScore,
  setForceMockFallback,
  isForceMockFallback,
  type SpotifyArtist,
  type SpotifyTrack,
  type FeedItem,
} from '@/lib/orbit'
import { fetchRecentSnsPosts, SNS_POSTS_LIMIT_PER_ARTIST, SNS_POSTS_LIMIT_TOTAL, type ArtistSnsPost } from '@/lib/sns'

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

/** falseにするとSpotifyフィードのデータ取得を完全停止 */
const SPOTIFY_FEED_ENABLED = false

const ACTIVE_ARTIST_KEY = 'orbit.feed.activeArtistId'
const ALBUMS_RATE_LIMIT_UNTIL_KEY = 'orbit.spotify.albumsRateLimitedUntil'
const TRACKS_RATE_LIMIT_UNTIL_KEY = 'orbit.spotify.tracksRateLimitedUntil'
const LAST_RATE_LIMIT_UNTIL_KEY = 'orbit.spotify.lastRateLimitedUntil'
const LAST_RATE_LIMIT_RETRY_AFTER_SEC_KEY = 'orbit.spotify.lastRetryAfterSec'
const MOCK_ARTIST_GRADIENT_BY_NAME: Record<string, string> = {
  aespa: '#5B2E9D',
  NewJeans: '#2E6AA8',
  ILLIT: '#7D5BA6',
  'j-hope': '#7B4A2A',
  'りぶ': '#2F3A4A',
}

function isMockMode(): boolean {
  const byEnv = (process.env.NEXT_PUBLIC_MOCK_MODE ?? '').toLowerCase() === 'true'
  if (byEnv) return true
  try {
    return localStorage.getItem('orbit.mockMode') === '1'
  } catch {
    return false
  }
}

function isSpotifyRateLimited(key: string): boolean {
  const raw = sessionStorage.getItem(key)
  if (!raw) return false
  const n = Number(raw)
  return Number.isFinite(n) ? Date.now() < n : false
}

function getRateLimitedUntilMs(key: string): number {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function formatWaitDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'しばらく'
  const sec = Math.ceil(ms / 1000)
  if (sec <= 120) return '約1〜2分'
  const min = Math.ceil(sec / 60)
  if (min < 60) return `約${min}分`
  const hour = Math.ceil(min / 60)
  if (hour < 24) return `約${hour}時間`
  const day = Math.ceil(hour / 24)
  return `約${day}日`
}

function formatRetryTime(unixMs: number): string {
  if (!Number.isFinite(unixMs) || unixMs <= 0) return ''
  const d = new Date(unixMs)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}時${mm}分ごろ再試行`
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0')
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function getSpotifyRateLimitErrorMessage(nowMs: number): string {
  const storedUntilMs = getRateLimitedUntilMs(LAST_RATE_LIMIT_UNTIL_KEY)

  // Retry-After 秒を優先して表示する（untilMs が経過で期限切れでも正しい文言を出す）
  const rawSec = sessionStorage.getItem(LAST_RATE_LIMIT_RETRY_AFTER_SEC_KEY)
  const sec = rawSec ? Number(rawSec) : NaN
  if (Number.isFinite(sec) && sec > 0) {
    // retryAt は固定時刻で扱う。毎秒 now に sec を足すと残り時間が減らない。
    const retryAt = storedUntilMs > 0 ? storedUntilMs : nowMs + sec * 1000
    const retryTimeText = formatRetryTime(retryAt)
    const countdownText = formatCountdown(retryAt - nowMs)
    return `Spotify API の利用上限に達しました。${formatWaitDuration(sec * 1000)}待ってからページを再読み込みしてください。${retryTimeText ? `（${retryTimeText}）` : ''} 残り ${countdownText}`
  }

  const untilMs = Math.max(
    getRateLimitedUntilMs(ALBUMS_RATE_LIMIT_UNTIL_KEY),
    getRateLimitedUntilMs(TRACKS_RATE_LIMIT_UNTIL_KEY),
    storedUntilMs,
  )
  const waitMs = untilMs - nowMs
  const retryTimeText = formatRetryTime(untilMs)
  const countdownText = formatCountdown(waitMs)
  return `Spotify API の利用上限に達しました。${formatWaitDuration(waitMs)}待ってからページを再読み込みしてください。${retryTimeText ? `（${retryTimeText}）` : ''} 残り ${countdownText}`
}

function getHeroGradientColor(artists: SpotifyArtist[]): string {
  const leftMost = artists[0]
  if (!leftMost) return '#1e2f4f'
  return MOCK_ARTIST_GRADIENT_BY_NAME[leftMost.name] ?? '#1e2f4f'
}

function SortableArtistItem({
  artist,
  isActive,
  onSelect,
  styles: s,
}: {
  artist: SpotifyArtist
  isActive: boolean
  onSelect: () => void
  styles: Record<string, string>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: artist.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={s.filterIconWrapper}>
      <button
        type="button"
        className={`${s.filterIconButton} ${isActive ? s.filterIconButtonActive : ''} ${isDragging ? s.filterIconDragging : ''}`}
        onClick={onSelect}
        aria-label={artist.name}
        {...attributes}
        {...listeners}
      >
        {artist.images?.[0]?.url ? (
          <img src={artist.images[0].url} alt="" className={s.filterIcon} draggable={false} />
        ) : (
          <span className={s.filterIconFallback}>{artist.name.slice(0, 2)}</span>
        )}
      </button>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [selectedArtists, setSelectedArtists] = useState<SpotifyArtist[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [viewerName, setViewerName] = useState<string>('you')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [showReloginButton, setShowReloginButton] = useState<boolean>(true)
  const [activeArtistId, setActiveArtistId] = useState<string>('all')
  const [nowMs, setNowMs] = useState<number>(Date.now())
  const [retryTick, setRetryTick] = useState<number>(0)
  const [fallbackBanner, setFallbackBanner] = useState<boolean>(false)
  const [snsPosts, setSnsPosts] = useState<ArtistSnsPost[]>([])
  const [trackFeedArtistId, setTrackFeedArtistId] = useState<string | null>(null)
  // Spotifyフィードは一時停止中
  const [activeFeedTab] = useState<'news' | 'spotify'>('news')
  const [discographyTab, setDiscographyTab] = useState<'album' | 'single'>('album')
  const [popularTracksExpanded, setPopularTracksExpanded] = useState(false)
  const [topTracksByArtist, setTopTracksByArtist] = useState<Record<string, SpotifyTrack[]>>({})
  const [albumsByArtist, setAlbumsByArtist] = useState<Record<string, AlbumItem[]>>({})
  // Spotify API 上限: top-tracks 10曲/人 + アルバム50枚×50曲/枚
  const TARGET_TAGGED_COUNT = 500

  useEffect(() => {
    if (isForceMockFallback()) setFallbackBanner(true)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(ACTIVE_ARTIST_KEY)
    if (saved) {
      setActiveArtistId(saved)
      setTrackFeedArtistId(saved === 'all' ? null : saved)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(ACTIVE_ARTIST_KEY, activeArtistId)
  }, [activeArtistId])

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const relogin = () => {
    clearAccessToken()
    router.replace('/login')
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      setSelectedArtists((prev) => {
        const oldIndex = prev.findIndex((a) => a.id === active.id)
        const newIndex = prev.findIndex((a) => a.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return prev
        const next = arrayMove(prev, oldIndex, newIndex)
        saveSelectedArtists(next)
        return next
      })
    },
    [],
  )

  useEffect(() => {
    let autoRetryTimer: number | null = null

    const token = getAccessToken()
    if (!token) {
      setLoading(false)
      router.replace('/login')
      return
    }
    const picks = getSelectedArtists()
    if (picks.length !== 5) {
      setLoading(false)
      router.replace('/onboarding')
      return
    }
    setSelectedArtists(picks)

    // レート制限の待機中は Spotify API を一切呼ばない。
    // （fetchMe / top-tracks / albums / tracks の全てを停止）
    const waitUntilMs = Math.max(
      getRateLimitedUntilMs(ALBUMS_RATE_LIMIT_UNTIL_KEY),
      getRateLimitedUntilMs(TRACKS_RATE_LIMIT_UNTIL_KEY),
      getRateLimitedUntilMs(LAST_RATE_LIMIT_UNTIL_KEY),
    )
    if (!isMockMode() && waitUntilMs > Date.now()) {
      setLoading(false)
      setShowReloginButton(false)
      setError(getSpotifyRateLimitErrorMessage(Date.now()))
      const waitMs = Math.max(0, waitUntilMs - Date.now())
      autoRetryTimer = window.setTimeout(() => {
        setRetryTick((v) => v + 1)
      }, waitMs + 200)
      return () => {
        if (autoRetryTimer) window.clearTimeout(autoRetryTimer)
      }
    }

    if (!SPOTIFY_FEED_ENABLED) { setLoading(false); return }

    setLoading(true)
    setError('')
    setShowReloginButton(true)
    // このフェッチサイクル前に 429 フラグをクリアし、
    // 過去のリトライ結果が空フィード時の誤表示につながらないようにする
    try {
      sessionStorage.removeItem(ALBUMS_RATE_LIMIT_UNTIL_KEY)
      sessionStorage.removeItem(TRACKS_RATE_LIMIT_UNTIL_KEY)
      sessionStorage.removeItem(LAST_RATE_LIMIT_UNTIL_KEY)
      sessionStorage.removeItem(LAST_RATE_LIMIT_RETRY_AFTER_SEC_KEY)
    } catch {
      // ignore
    }

    let timedOut = false
    const timeoutId = window.setTimeout(() => {
      timedOut = true
      setError('フィードの読み込みに時間がかかっています。少し待ってから再度お試しください。')
      setShowReloginButton(false)
      setLoading(false)
    }, 120_000)

    let cancelled = false
    fetchMe(token)
      .then(async (me) => {
        if (cancelled) return
        // タイムアウト後に結果が返ってきた場合も、可能なら通常表示へ復帰する
        setError('')
        setViewerName(me.display_name ?? 'you')

        // 5人分の「人気曲(top-tracks)」と「最新リリース(直近アルバム→収録曲)」を順番に集める
        const tagged: Array<{
          track: SpotifyTrack
          sourcePickId: string | null
          fetchedAt: string | null
          // album,single 由来のメタ（albumTracks では track.album が無いことがあるため）
          albumName: string | null
          coverUrl: string | null
        }> = []
        const seenTrackIds = new Set<string>()
        const topTracksMap: Record<string, SpotifyTrack[]> = {}
        const albumsMap: Record<string, AlbumItem[]> = {}

        const staggerMs = 1500
        for (let i = 0; i < picks.length; i++) {
          const artist = picks[i]

          // 1) 人気曲（feedItems用 + ディスコグラフィタブ用）
          try {
            const top = await fetchArtistTopTracks(token, artist.id, me.country)
            const artistTopTracks = top.filter((t) => t.artists.some((a) => a.id === artist.id))
            topTracksMap[artist.id] = artistTopTracks
            for (const t of artistTopTracks) {
              if (seenTrackIds.has(t.id)) continue
              seenTrackIds.add(t.id)
              tagged.push({
                track: t,
                sourcePickId: artist.id,
                fetchedAt: null,
                albumName: t.album?.name ?? null,
                coverUrl: t.album?.images?.[0]?.url ?? null,
              })
            }
          } catch (e: any) {
            // 429 は握りつぶさずユーザーに待機メッセージを出す
            const message = e?.message ?? ''
            if (/利用上限|429/.test(message)) {
              cancelled = true
              window.clearTimeout(timeoutId)
              setError(getSpotifyRateLimitErrorMessage(nowMs))
              setShowReloginButton(false)
              setLoading(false)
              return
            }
            // それ以外のエラーはこの推しだけスキップして継続
          }

          if (i < picks.length - 1) {
            await new Promise((r) => setTimeout(r, staggerMs))
          }
        }

        // 2) アルバム収録曲をラウンドロビンで全5人分取得（Spotify API 上限: 50枚×50曲）
        const albumsRaw: Array<Array<{ id: string; name?: string; release_date?: string | null; album_type?: string; images?: Array<{ url: string }> | null }>> = []
        for (let i = 0; i < picks.length; i++) {
          try {
            const albums = await fetchArtistRecentAlbums(token, picks[i].id, 15, me.country)
            albumsRaw.push(albums)
            const items: AlbumItem[] = albums.map((al) => ({
              id: al.id,
              name: al.name ?? '',
              releaseDate: al.release_date ?? null,
              coverUrl: al.images?.[0]?.url ?? null,
              albumType: al.album_type ?? 'album',
            }))
            // 時系列順（新しい順）にソート
            items.sort((a, b) => {
              const da = a.releaseDate ?? ''
              const db = b.releaseDate ?? ''
              return db.localeCompare(da)
            })
            albumsMap[picks[i].id] = items
          } catch {
            albumsRaw.push([])
          }
          if (i < picks.length - 1) await new Promise((r) => setTimeout(r, 800))
        }
        const maxAlbumsPerArtist = 5
        const maxAlbums = Math.min(Math.max(...albumsRaw.map((a) => a.length), 0), maxAlbumsPerArtist)
        for (let ai = 0; ai < maxAlbums; ai++) {
          for (let i = 0; i < picks.length; i++) {
            const artist = picks[i]
            const album = albumsRaw[i]?.[ai]
            if (!album) continue
            try {
              const albumTracks = await fetchAlbumTracks(token, album.id, 15)
              for (const t of albumTracks) {
                if (seenTrackIds.has(t.id)) continue
                if (!t.artists.some((a) => a.id === artist.id)) continue
                seenTrackIds.add(t.id)
                tagged.push({
                  track: t,
                  sourcePickId: artist.id,
                  fetchedAt: toISODate(album.release_date),
                  albumName: album.name ?? t.album?.name ?? null,
                  coverUrl: album.images?.[0]?.url ?? t.album?.images?.[0]?.url ?? null,
                })
              }
            } catch {
              // スキップ
            }
            if (i < picks.length - 1) await new Promise((r) => setTimeout(r, 1200))
          }
        }

        if (cancelled) return
        const nextFeedItems = buildFeedItems(tagged, picks)
        if (nextFeedItems.length === 0 && (isSpotifyRateLimited(ALBUMS_RATE_LIMIT_UNTIL_KEY) || isSpotifyRateLimited(TRACKS_RATE_LIMIT_UNTIL_KEY))) {
          cancelled = true
          window.clearTimeout(timeoutId)
          setError(getSpotifyRateLimitErrorMessage(nowMs))
          setShowReloginButton(false)
          setLoading(false)
          return
        }
        setFeedItems(nextFeedItems)
        setTopTracksByArtist(topTracksMap)
        setAlbumsByArtist(albumsMap)
      })
      .catch((e: any) => {
        if (cancelled) return
        const message = e?.message ?? ''
        const isTokenExpired =
          /access token expired/i.test(message) ||
          message.includes('(me) 401') ||
          message.includes('status: 401') ||
          /status["']\s*:\s*401/i.test(message) ||
          /"status"\s*:\s*401/i.test(message)
        const isRateLimit = /429|利用上限/.test(message)

        if (isTokenExpired) {
          setError('')
          setLoading(false)
          setShowReloginButton(false)
          cancelled = true
          window.clearTimeout(timeoutId)
          relogin()
          return
        }

        if (timedOut) return

        if (!isRateLimit) {
          setForceMockFallback()
          setFallbackBanner(true)
          setError('')
          setRetryTick((v) => v + 1)
          return
        }

        setShowReloginButton(true)
        setError(message || 'Spotifyのフィード取得に失敗しました。再ログインを試してください。')
      })
      .finally(() => {
        if (cancelled) return
        window.clearTimeout(timeoutId)
        setLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [router, retryTick])

  useEffect(() => {
    if (!/Spotify API の利用上限に達しました。/.test(error)) return
    setError(getSpotifyRateLimitErrorMessage(nowMs))
  }, [nowMs, error])

  useEffect(() => {
    if (activeArtistId === 'all') return
    const exists = selectedArtists.some((artist) => artist.id === activeArtistId)
    if (!exists) {
      setActiveArtistId('all')
      setTrackFeedArtistId(null)
    }
  }, [activeArtistId, selectedArtists])

  useEffect(() => {
    if (selectedArtists.length === 0) return
    let cancelled = false
    const load = async () => {
      const artistIds = selectedArtists.map((a) => a.id)
      const artistInfo = selectedArtists.map((a) => ({ id: a.id, name: a.name }))
      const posts = await fetchRecentSnsPosts(artistIds, SNS_POSTS_LIMIT_TOTAL, artistInfo)
      if (!cancelled) setSnsPosts(posts)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedArtists])

  const visibleSnsPosts = useMemo(() => {
    if (activeArtistId === 'all') return snsPosts.slice(0, SNS_POSTS_LIMIT_TOTAL)
    return snsPosts.filter((p) => p.artistId === activeArtistId).slice(0, SNS_POSTS_LIMIT_PER_ARTIST)
  }, [snsPosts, activeArtistId])

  /** Spotifyタブで表示するアーティスト（フィルターで絞り込み） */
  const spotifyVisibleArtists = useMemo(() => {
    if (activeArtistId === 'all') return selectedArtists
    const a = selectedArtists.find((x) => x.id === activeArtistId)
    return a ? [a] : []
  }, [selectedArtists, activeArtistId])

  /** 全アーティストの人気曲をマージ（popularity順） */
  const mergedTopTracks = useMemo(() => {
    const items: Array<SpotifyTrack & { artistName: string }> = []
    for (const artist of spotifyVisibleArtists) {
      const tracks = topTracksByArtist[artist.id] ?? []
      for (const t of tracks) {
        items.push({ ...t, artistName: artist.name })
      }
    }
    items.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    return items
  }, [spotifyVisibleArtists, topTracksByArtist])

  /** 全アーティストのディスコグラフィを時系列（新しい順）にマージ */
  const mergedDiscography = useMemo(() => {
    const items: Array<AlbumItem & { artistName: string }> = []
    for (const artist of spotifyVisibleArtists) {
      const albums = albumsByArtist[artist.id] ?? []
      for (const album of albums) {
        items.push({ ...album, artistName: artist.name })
      }
    }
    items.sort((a, b) => {
      const da = a.releaseDate ?? ''
      const db = b.releaseDate ?? ''
      return db.localeCompare(da)
    })
    return items
  }, [spotifyVisibleArtists, albumsByArtist])

  /** ディスコグラフィタブでフィルタしたアルバム一覧 */
  const filteredDiscography = useMemo(() => {
    if (discographyTab === 'album') return mergedDiscography.filter((a) => a.albumType === 'album')
    if (discographyTab === 'single') return mergedDiscography.filter((a) => a.albumType === 'single')
    return mergedDiscography
  }, [mergedDiscography, discographyTab])

  /** 人気曲セクションを表示するか（Spotifyタブ内で人気曲あり） */
  const showPopularTracksSection = mergedTopTracks.length > 0

  const heroAccent = useMemo(() => getHeroGradientColor(selectedArtists), [selectedArtists])
  const activeArtistName = selectedArtists.find((a) => a.id === activeArtistId)?.name

  return (
    <div
      className={`${styles.screen} ${styles.homeScreen}`}
      style={{ '--orbit-hero': heroAccent } as React.CSSProperties}
    >
      <div className={styles.shell}>
        <header className={styles.homeHeader}>
        {fallbackBanner && (
          <div className={styles.homeFallbackBanner}>
            Spotify API に接続できませんでした。モックデータで表示しています。
          </div>
        )}

        <nav className={styles.homeTopBar} aria-label="ホーム">
          <div className={styles.homeBrand}>
            <h1 className={styles.homeTitle}>Orbit</h1>
          </div>
          <Link href="/mypage" className={styles.homeProfilePill} aria-label={`${viewerName}のマイページ`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
        </nav>

        <section className={styles.homeArtistRail} aria-label="表示するアーティスト">
          <div className={`${styles.filterRowWrapper} ${styles.homeFilterStrip}`}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className={styles.filterRow}>
              <button
                type="button"
                className={`${styles.filterIconButton} ${activeArtistId === 'all' ? styles.filterIconButtonActive : ''}`}
                onClick={() => {
                  setActiveArtistId('all')
                  setTrackFeedArtistId(null)
                }}
                aria-label="すべて"
              >
                <span className={styles.filterIconAll} aria-hidden>
                  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="2.8" />
                    <circle cx="12" cy="5.5" r="2" />
                    <circle cx="18.5" cy="12" r="2" />
                    <circle cx="12" cy="18.5" r="2" />
                    <circle cx="5.5" cy="12" r="2" />
                  </svg>
                </span>
              </button>
              <SortableContext items={selectedArtists.map((a) => a.id)} strategy={horizontalListSortingStrategy}>
                {selectedArtists.map((artist) => (
                  <SortableArtistItem
                    key={artist.id}
                    artist={artist}
                    isActive={activeArtistId === artist.id}
                    onSelect={() => {
                      setActiveArtistId(artist.id)
                      setTrackFeedArtistId(artist.id)
                    }}
                    styles={styles}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
          </div>
        </section>

        {/* Spotifyフィード一時停止中 — タブ非表示 */}

        {error && (
          <div className={styles.homeErrorCard}>
            <p className={styles.homeErrorText}>{error}</p>
            <div className={styles.homeErrorActions}>
              {/Spotify API の利用上限に達しました。/.test(error) && (
                <button
                  type="button"
                  className={styles.homeErrorButton}
                  onClick={() => {
                    ;[
                      ALBUMS_RATE_LIMIT_UNTIL_KEY,
                      TRACKS_RATE_LIMIT_UNTIL_KEY,
                      LAST_RATE_LIMIT_UNTIL_KEY,
                      LAST_RATE_LIMIT_RETRY_AFTER_SEC_KEY,
                    ].forEach((k) => sessionStorage.removeItem(k))
                    setForceMockFallback()
                    setFallbackBanner(true)
                    setError('')
                    setRetryTick((v) => v + 1)
                  }}
                >
                  モックで表示
                </button>
              )}
              {showReloginButton && (
                <button type="button" className={styles.homeErrorButton} onClick={relogin}>
                  再ログイン
                </button>
              )}
            </div>
          </div>
        )}

        </header>

        <section className={`${styles.feedSection} ${styles.homeFeedScroll}`} data-nav-scroll>
            {loading ? (
            <div className={styles.feed}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`skeleton-${i}`} className={`${styles.post} ${styles.skeletonPost}`}>
                  <div className={styles.postHeader}>
                    <div className={`${styles.snsAvatar} ${styles.skeletonBlock}`} style={{ borderRadius: '50%', flexShrink: 0 }} />
                    <div className={styles.skeletonTextGroup}>
                      <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} style={{ width: 120, height: 14, marginBottom: 6 }} />
                      <div className={`${styles.skeletonBlock} ${styles.skeletonTime}`} />
                    </div>
                  </div>
                  <div className={`${styles.skeletonBlock} ${styles.skeletonTitle}`} />
                  <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} style={{ width: '90%' }} />
                  <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} style={{ width: '70%' }} />
                </div>
              ))}
            </div>
            ) : activeFeedTab === 'news' ? (
            visibleSnsPosts.length > 0 ? (
            <div className={styles.feed}>
              {visibleSnsPosts.map((post, i) => {
                const PostContent = (
                  <>
                    <div className={styles.postHeader}>
                      {post.avatarUrl ? (
                        <img src={post.avatarUrl} alt="" className={styles.snsAvatar} />
                      ) : (
                        <div className={styles.snsAvatarFallback}>{post.artistName.slice(0, 2)}</div>
                      )}
                      <div className={styles.snsHeader}>
                        <span className={styles.snsHandle}>{post.handle}</span>
                        <span className={styles.snsTime}>{post.postedAt}</span>
                        <span className={styles.snsPlatformBadge} data-platform={post.platform ?? 'x'}>
                          {post.platform === 'instagram' ? 'Instagram' : post.platform === 'youtube' ? 'YouTube' : 'X'}
                        </span>
                      </div>
                    </div>
                    <p className={styles.snsContent}>{post.content}</p>
                  </>
                )
                return post.url ? (
                  <a
                    key={`${post.artistId}-${i}`}
                    href={post.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`${styles.post} ${styles.snsBlock}`}
                  >
                    {PostContent}
                  </a>
                ) : (
                  <div key={`${post.artistId}-${i}`} className={`${styles.post} ${styles.snsBlock}`}>
                    {PostContent}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={styles.emptyFeed} role="status">
              <div className={styles.emptyFeedOrb} aria-hidden>
                <span className={styles.emptyFeedRing} />
                <span className={styles.emptyFeedRing} />
                <span className={styles.emptyFeedDot} />
              </div>
              <h2 className={styles.emptyFeedTitle}>
                {activeArtistId === 'all'
                  ? 'タイムラインはまだ静かです'
                  : `${activeArtistName ?? 'このアーティスト'}の投稿はまだありません`}
              </h2>
              <p className={styles.emptyFeedText}>
                {activeArtistId === 'all'
                  ? 'SNSの更新は準備中です。Spotify タブではリリースや人気曲を今すぐチェックできます。'
                  : 'フィルターを「すべて」にすると、ほかの推しの投稿もまとめて見られます。'}
              </p>
              <div className={styles.emptyFeedActions}>
                {/* Spotifyフィード一時停止中 */}
                {activeArtistId !== 'all' && (
                  <button
                    type="button"
                    className={styles.emptyFeedGhost}
                    onClick={() => {
                      setActiveArtistId('all')
                      setTrackFeedArtistId(null)
                    }}
                  >
                    すべての推しを表示
                  </button>
                )}
                <Link href="/search" className={styles.emptyFeedLink}>
                  検索でアーティストを探す
                </Link>
              </div>
            </div>
          )
            ) : activeFeedTab === 'spotify' ? (
            mergedTopTracks.length > 0 || mergedDiscography.length > 0 ? (
            <div className={styles.spotifyFeed}>
              {/* 人気曲セクション（ディスコグラフィの上） */}
              {showPopularTracksSection && (
                <section className={artistStyles.section}>
                  <div className={artistStyles.sectionHeader}>
                    <h2 className={artistStyles.sectionTitle}>人気曲</h2>
                  </div>
                  <ol className={artistStyles.trackList}>
                    {mergedTopTracks
                      .slice(0, popularTracksExpanded ? 10 : 5)
                      .map((track, i) => (
                        <li key={track.id}>
                          <a
                            href={track.external_urls?.spotify ?? '#'}
                            target="_blank"
                            rel="noreferrer noopener"
                            className={`${artistStyles.trackRow} ${styles.spotifyTrackLink}`}
                          >
                            <span className={artistStyles.trackRank}>{i + 1}</span>
                            {track.album?.images?.[0]?.url ? (
                              <img src={track.album.images[0].url} alt="" className={artistStyles.trackThumb} />
                            ) : (
                              <div className={artistStyles.trackThumbFallback} />
                            )}
                            <div className={artistStyles.trackInfo}>
                              <span className={artistStyles.trackName}>{track.name}</span>
                            </div>
                            <span className={artistStyles.trackPopularity}>
                              {(track.popularity ?? 0).toLocaleString()}
                            </span>
                            <span className={artistStyles.trackDuration}>—</span>
                          </a>
                        </li>
                      ))}
                  </ol>
                  {mergedTopTracks.length > 5 && !popularTracksExpanded && (
                    <button
                      type="button"
                      className={styles.discographyShowMore}
                      onClick={() => setPopularTracksExpanded(true)}
                    >
                      もっと見る
                    </button>
                  )}
                  {popularTracksExpanded && (
                    <button
                      type="button"
                      className={styles.discographyShowMore}
                      onClick={() => setPopularTracksExpanded(false)}
                    >
                      表示を少なくする
                    </button>
                  )}
                </section>
              )}

              {/* ディスコグラフィセクション */}
              <section className={artistStyles.section}>
                <div className={artistStyles.sectionHeader}>
                  <h2 className={artistStyles.sectionTitle}>ディスコグラフィ</h2>
                </div>
                <div className={artistStyles.filterChips}>
                  <button
                    type="button"
                    className={`${artistStyles.filterChip} ${discographyTab === 'album' ? artistStyles.filterChipActive : ''}`}
                    onClick={() => setDiscographyTab('album')}
                  >
                    アルバム
                  </button>
                  <button
                    type="button"
                    className={`${artistStyles.filterChip} ${discographyTab === 'single' ? artistStyles.filterChipActive : ''}`}
                    onClick={() => setDiscographyTab('single')}
                  >
                    シングルとEP
                  </button>
                </div>
                <div className={artistStyles.discographyGrid}>
                  {filteredDiscography.map((album) => (
                    <a
                      key={album.id}
                      href={`https://open.spotify.com/album/${album.id}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={artistStyles.albumCard}
                    >
                      {album.coverUrl ? (
                        <img src={album.coverUrl} alt="" className={artistStyles.albumCover} />
                      ) : (
                        <div className={artistStyles.albumCoverFallback}>{album.name.slice(0, 2)}</div>
                      )}
                      <span className={artistStyles.albumTitle}>{album.name}</span>
                      <span className={artistStyles.albumMeta}>
                        {[album.releaseDate?.slice(0, 4), album.artistName, ALBUM_TYPE_LABELS[album.albumType] ?? album.albumType]
                          .filter(Boolean)
                          .join(' • ')}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className={styles.emptyFeed} role="status">
              <div className={styles.emptyFeedOrb} aria-hidden>
                <span className={styles.emptyFeedRing} />
                <span className={styles.emptyFeedRing} />
                <span className={styles.emptyFeedNote} />
              </div>
              <h2 className={styles.emptyFeedTitle}>
                {activeArtistId === 'all'
                  ? 'まだ音楽データがありません'
                  : `${activeArtistName ?? 'このアーティスト'}のデータを読み込めませんでした`}
              </h2>
              <p className={styles.emptyFeedText}>
                {activeArtistId === 'all'
                  ? '接続やレート制限の影響で表示できないことがあります。しばらくしてから再読み込みするか、News タブを確認してください。'
                  : '別のアーティストを選ぶか、すべて表示に切り替えてください。'}
              </p>
              <div className={styles.emptyFeedActions}>
                <button type="button" className={styles.emptyFeedPrimary}>
                  News に戻る
                </button>
                {activeArtistId !== 'all' && (
                  <button
                    type="button"
                    className={styles.emptyFeedGhost}
                    onClick={() => {
                      setActiveArtistId('all')
                      setTrackFeedArtistId(null)
                    }}
                  >
                    すべての推しを表示
                  </button>
                )}
              </div>
            </div>
          )
            ) : null}
        </section>
      </div>
    </div>
  )
}