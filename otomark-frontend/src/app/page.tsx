'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  clearForceMockFallback,
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
import { fetchArtistNews, type LastFmArtistInfo } from '@/lib/lastfm'
import { lockScroll } from '@/lib/scrollLock'
import { useSpotifyPlayerContext } from '@/contexts/SpotifyPlayerContext'
import { useAlbumModalContext } from '@/contexts/AlbumModalContext'
import { YouTubePlayer } from '@/components/YouTubePlayer'

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
  ep: 'EP',
  compilation: 'コンピレーション',
}

/** falseにするとSpotifyフィードのデータ取得を完全停止 */
const SPOTIFY_FEED_ENABLED = true

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
      {isActive && (
        <span className={s.filterIconName}>{artist.name}</span>
      )}
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { deviceId, isReady, play, pause, isPlaying, currentTrack, setQueue } = useSpotifyPlayerContext()
  const { openAlbumModal } = useAlbumModalContext()
  const [selectedArtists, setSelectedArtists] = useState<SpotifyArtist[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [viewerName, setViewerName] = useState<string>('you')
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [showReloginButton, setShowReloginButton] = useState<boolean>(true)
  const [activeArtistId, setActiveArtistId] = useState<string>('all')
  const [nowMs, setNowMs] = useState<number>(Date.now())
  const [retryTick, setRetryTick] = useState<number>(0)
  const [fallbackBanner, setFallbackBanner] = useState<boolean>(false)
  const [snsPosts, setSnsPosts] = useState<ArtistSnsPost[]>([])
  const [snsLoading, setSnsLoading] = useState<boolean>(true)
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null)
  const [trackFeedArtistId, setTrackFeedArtistId] = useState<string | null>(null)
  // Spotifyフィードは一時停止中
  const [activeFeedTab, setActiveFeedTab] = useState<'news' | 'spotify'>('spotify')
  const [popularTracksExpanded, setPopularTracksExpanded] = useState(false)
  const [discographyExpanded, setDiscographyExpanded] = useState(false)
  const [feedTabHidden, setFeedTabHidden] = useState(false)
  const [lastfmCache, setLastfmCache] = useState<Record<string, LastFmArtistInfo | null>>({})
  const [lastfmLoading, setLastfmLoading] = useState(false)
  const lastScrollY = useRef(0)
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>()
  const feedScrollRef = useRef<HTMLElement | null>(null)
  const savedScrollPos = useRef<Record<'news' | 'spotify', number>>({ news: 0, spotify: 0 })

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget
    const currentY = el.scrollTop
    const delta = currentY - lastScrollY.current
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 150

    if (atBottom || currentY < 50 || Math.abs(delta) < 15) {
      lastScrollY.current = currentY
      return
    }

    const hide = delta > 0
    setFeedTabHidden(hide)
    lastScrollY.current = currentY

    clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
      setFeedTabHidden(false)
    }, 800)
  }, [])
  const [visibleCount, setVisibleCount] = useState(10)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [topTracksByArtist, setTopTracksByArtist] = useState<Record<string, SpotifyTrack[]>>({})
  const [albumsByArtist, setAlbumsByArtist] = useState<Record<string, AlbumItem[]>>({})
  // Spotify API 上限: top-tracks 10曲/人 + アルバム50枚×50曲/枚
  const TARGET_TAGGED_COUNT = 500


  useEffect(() => {
    if (isForceMockFallback()) setFallbackBanner(true)
  }, [])

  // feedItems が更新されたらプレイヤーのキューを同期（推しの曲のみ再生されるように）
  useEffect(() => {
    if (feedItems.length === 0) return
    setQueue(feedItems.map((f) => f.spotifyUri))
  // setQueue は useCallback([]) で安定しているため依存配列に含めない
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedItems])

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
        setViewerImageUrl(me.images?.[0]?.url ?? null)

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
        }

        // 2) アルバム収録曲をラウンドロビンで全5人分取得（Spotify API 上限: 50枚×50曲）
        const albumsRaw: Array<Array<{ id: string; name?: string; release_date?: string | null; album_type?: string; images?: Array<{ url: string }> | null }>> = Array.from({ length: picks.length }, () => [])
        await Promise.all(picks.map(async (pick, i) => {
          try {
            const albums = await fetchArtistRecentAlbums(token, pick.id, 20, me.country)
            albumsRaw[i] = albums
            const items: AlbumItem[] = albums.map((al) => ({
              id: al.id,
              name: al.name ?? '',
              releaseDate: al.release_date ?? null,
              coverUrl: al.images?.[0]?.url ?? null,
              albumType: al.album_type ?? 'album',
            }))
            items.sort((a, b) => {
              const da = a.releaseDate ?? ''
              const db = b.releaseDate ?? ''
              return db.localeCompare(da)
            })
            albumsMap[pick.id] = items
          } catch {
            albumsRaw[i] = []
          }
        }))
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
    if (selectedArtists.length === 0) {
      setSnsLoading(false)
      return
    }
    let cancelled = false
    const cacheKey = `orbit.snsPosts.${selectedArtists.map((a) => a.id).sort().join(',')}`
    // キャッシュがあれば即表示
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        setSnsPosts(JSON.parse(cached))
        setSnsLoading(false)
      }
    } catch { /* ignore */ }
    // バックグラウンドで最新を取得して更新
    const load = async () => {
      const artistIds = selectedArtists.map((a) => a.id)
      const artistInfo = selectedArtists.map((a) => ({ id: a.id, name: a.name }))
      const posts = await fetchRecentSnsPosts(artistIds, SNS_POSTS_LIMIT_TOTAL, artistInfo)
      if (!cancelled) {
        setSnsPosts(posts)
        setSnsLoading(false)
        try { localStorage.setItem(cacheKey, JSON.stringify(posts)) } catch { /* ignore */ }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedArtists])

  // Last.fm アーティスト情報取得（アーティスト選択時・Spotifyタブ時）
  useEffect(() => {
    if (activeArtistId === 'all' || activeFeedTab !== 'spotify') return
    const artist = selectedArtists.find((a) => a.id === activeArtistId)
    if (!artist) return
    if (activeArtistId in lastfmCache) return   // キャッシュ済み
    let cancelled = false
    setLastfmLoading(true)
    fetchArtistNews(artist.name)
      .then((info) => {
        if (!cancelled) setLastfmCache((prev) => ({ ...prev, [activeArtistId]: info }))
      })
      .catch(() => {
        if (!cancelled) setLastfmCache((prev) => ({ ...prev, [activeArtistId]: null }))
      })
      .finally(() => { if (!cancelled) setLastfmLoading(false) })
    return () => { cancelled = true }
  }, [activeArtistId, activeFeedTab, selectedArtists])

  const filteredSnsPosts = useMemo(() => {
    if (activeArtistId === 'all') return snsPosts
    return snsPosts.filter((p) => p.artistId === activeArtistId)
  }, [snsPosts, activeArtistId])

  const visibleSnsPosts = useMemo(() => {
    return filteredSnsPosts.slice(0, visibleCount)
  }, [filteredSnsPosts, visibleCount])

  useEffect(() => {
    setVisibleCount(10)
  }, [activeArtistId])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 10)
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visibleSnsPosts.length])

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
            <span>Spotify API に接続できませんでした。モックデータで表示しています。</span>
            <button
              type="button"
              className={styles.homeFallbackBannerDismiss}
              onClick={() => {
                clearForceMockFallback()
                localStorage.removeItem('orbit.mockMode')
                setFallbackBanner(false)
                setRetryTick((v) => v + 1)
              }}
            >
              再接続
            </button>
          </div>
        )}

        <nav className={styles.homeTopBar} aria-label="ホーム">
          <div className={styles.homeBrand}>
            <h1 className={styles.homeTitle}>Orbit</h1>
          </div>
          <Link href="/mypage" className={styles.homeProfilePill} aria-label={`${viewerName}のマイページ`}>
            {viewerImageUrl ? (
              <img
                src={viewerImageUrl}
                alt={viewerName}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.515 17.308a.748.748 0 0 1-1.03.25c-2.819-1.723-6.365-2.112-10.542-1.157a.748.748 0 1 1-.333-1.459c4.571-1.045 8.492-.595 11.655 1.337a.748.748 0 0 1 .25 1.029zm1.472-3.276a.936.936 0 0 1-1.288.308c-3.226-1.983-8.143-2.557-11.958-1.399a.937.937 0 0 1-1.167-.623.936.936 0 0 1 .623-1.167c4.358-1.323 9.776-.681 13.482 1.594a.935.935 0 0 1 .308 1.287zm.126-3.41c-3.868-2.297-10.246-2.509-13.94-1.388a1.122 1.122 0 1 1-.651-2.149c4.239-1.285 11.284-1.037 15.739 1.607a1.122 1.122 0 1 1-1.148 1.93z"/>
              </svg>
            )}
          </Link>
        </nav>

        <section className={styles.homeArtistRail} aria-label="表示するアーティスト">
          <div className={`${styles.filterRowWrapper} ${styles.homeFilterStrip}`}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className={styles.filterRow}>
              <div className={styles.filterIconWrapper}>
                <button
                  type="button"
                  className={`${styles.filterIconButton} ${activeArtistId === 'all' ? styles.filterIconButtonActive : ''}`}
                  onClick={() => {
                    feedScrollRef.current?.scrollTo({ top: 0 })
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
                {activeArtistId === 'all' && (
                  <span className={styles.filterIconName}>ALL</span>
                )}
              </div>
              <SortableContext items={selectedArtists.map((a) => a.id)} strategy={horizontalListSortingStrategy}>
                {selectedArtists.map((artist) => (
                  <SortableArtistItem
                    key={artist.id}
                    artist={artist}
                    isActive={activeArtistId === artist.id}
                    onSelect={() => {
                      feedScrollRef.current?.scrollTo({ top: 0 })
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

        <div className={`${styles.feedTabOuter}${feedTabHidden ? ` ${styles.feedTabOuterHidden}` : ''}`}>
          <div className={styles.feedTabRow}>
            <button
              type="button"
              className={`${styles.feedTabButton} ${activeFeedTab === 'spotify' ? styles.feedTabButtonSpotify : ''}`}
              onClick={() => {
                savedScrollPos.current[activeFeedTab] = feedScrollRef.current?.scrollTop ?? 0
                setActiveFeedTab('spotify')
                requestAnimationFrame(() => {
                  feedScrollRef.current?.scrollTo({ top: savedScrollPos.current.spotify })
                })
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ display: 'block' }}>
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.515 17.308a.748.748 0 0 1-1.03.25c-2.819-1.723-6.365-2.112-10.542-1.157a.748.748 0 1 1-.333-1.459c4.571-1.045 8.492-.595 11.655 1.337a.748.748 0 0 1 .25 1.029zm1.472-3.276a.936.936 0 0 1-1.288.308c-3.226-1.983-8.143-2.557-11.958-1.399a.937.937 0 0 1-1.167-.623.936.936 0 0 1 .623-1.167c4.358-1.323 9.776-.681 13.482 1.594a.935.935 0 0 1 .308 1.287zm.126-3.41c-3.868-2.297-10.246-2.509-13.94-1.388a1.122 1.122 0 1 1-.651-2.149c4.239-1.285 11.284-1.037 15.739 1.607a1.122 1.122 0 1 1-1.148 1.93z"/>
              </svg>
            </button>
            <button
              type="button"
              className={`${styles.feedTabButton} ${activeFeedTab === 'news' ? styles.feedTabButtonYoutube : ''}`}
              onClick={() => {
                savedScrollPos.current[activeFeedTab] = feedScrollRef.current?.scrollTop ?? 0
                setActiveFeedTab('news')
                requestAnimationFrame(() => {
                  feedScrollRef.current?.scrollTo({ top: savedScrollPos.current.news })
                })
              }}
            >
              <svg width="20" height="14" viewBox="0 0 24 17" fill="currentColor" aria-hidden style={{ display: 'block' }}>
                <path d="M23.495 2.656a3.016 3.016 0 0 0-2.122-2.134C19.505 0 12 0 12 0S4.495 0 2.627.522A3.016 3.016 0 0 0 .505 2.656 31.638 31.638 0 0 0 0 8.5a31.638 31.638 0 0 0 .505 5.844 3.016 3.016 0 0 0 2.122 2.134C4.495 17 12 17 12 17s7.505 0 9.373-.522a3.016 3.016 0 0 0 2.122-2.134A31.638 31.638 0 0 0 24 8.5a31.638 31.638 0 0 0-.505-5.844zM9.546 12.057V4.943L15.818 8.5l-6.272 3.557z"/>
              </svg>
            </button>
          </div>
        </div>

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

        <section ref={feedScrollRef} className={`${styles.feedSection} ${styles.homeFeedScroll}`} data-nav-scroll onScroll={handleScroll} style={{ paddingBottom: 'calc(50px + env(safe-area-inset-bottom, 0px) + 4px + 68px)' }}>
            {(activeFeedTab === 'news' && snsLoading) || (activeFeedTab === 'spotify' && loading) ? (
            <div className={styles.emptyFeed} role="status" aria-live="polite">
              <div className={`${styles.emptyFeedOrb} ${styles.emptyFeedOrbLoading}`} aria-hidden>
                <span className={styles.emptyFeedRing} />
                <span className={styles.emptyFeedRing} />
                <span className={styles.emptyFeedDot} />
              </div>
              <h2 className={styles.emptyFeedTitle}>読み込み中...</h2>
              <p className={styles.emptyFeedText}>
                {activeFeedTab === 'news'
                  ? '最新の動画を取得しています。しばらくお待ちください。'
                  : 'Spotify からデータを取得しています。しばらくお待ちください。'}
              </p>
            </div>
            ) : activeFeedTab === 'news' ? (
            <>
            {visibleSnsPosts.length > 0 ? (
            <div className={styles.feed}>
              {visibleSnsPosts.map((post, i) => {
                const isYoutube = post.platform === 'youtube' && post.videoId
                if (isYoutube) {
                  return (
                    <div key={`${post.artistId}-${i}`} className={`${styles.post} ${styles.snsBlock} ${styles.youtubeCard}`}>
                      <div className={styles.postHeader}>
                        <div className={styles.snsAvatarFallback}>{post.artistName.slice(0, 2)}</div>
                        <div className={styles.snsHeader}>
                          <span className={styles.snsHandle}>{post.handle}</span>
                          <span className={styles.snsTime}>{post.postedAt}</span>
                          <span className={styles.snsPlatformBadge} data-platform="youtube">YouTube</span>
                        </div>
                      </div>
                      <p className={styles.snsContent}>{post.content}</p>
                      {expandedVideoId === post.videoId ? (
                        <div className={styles.youtubeEmbed}>
                          <button
                            type="button"
                            className={styles.youtubeCloseBtn}
                            onClick={() => setExpandedVideoId(null)}
                            aria-label="動画を閉じる"
                          >✕</button>
                          <YouTubePlayer videoId={post.videoId!} title={post.content} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.youtubeThumbnailBtn}
                          onClick={() => setExpandedVideoId(post.videoId!)}
                          aria-label={`${post.content}を再生`}
                        >
                          {post.avatarUrl && (
                            <img src={post.avatarUrl} alt="" className={styles.youtubeThumbnail} />
                          )}
                          <span className={styles.youtubePlayIcon} aria-hidden>
                            <svg viewBox="0 0 68 48" width="56" height="40">
                              <path d="M66.52 7.74C65.7 4.67 63.3 2.27 60.24 1.45 54.9 0 34 0 34 0S13.1 0 7.76 1.45C4.7 2.27 2.3 4.67 1.48 7.74 0 13.08 0 24 0 24s0 10.92 1.48 16.26c.82 3.07 3.22 5.47 6.28 6.29C13.1 48 34 48 34 48s20.9 0 26.24-1.45c3.06-.82 5.46-3.22 6.28-6.29C68 34.92 68 24 68 24s0-10.92-1.48-16.26z" fill="rgba(0,0,0,0.75)"/>
                              <path d="M45 24 27 14v20" fill="white"/>
                            </svg>
                          </span>
                        </button>
                      )}
                    </div>
                  )
                }

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
                          {post.platform === 'instagram' ? 'Instagram' : 'X'}
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
              {visibleCount < filteredSnsPosts.length && (
                <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
              )}
            </div>
          ) : (
            <div className={styles.emptyFeed} role="status">
              <div className={`${styles.emptyFeedOrb} ${snsLoading ? styles.emptyFeedOrbLoading : ''}`} aria-hidden>
                <span className={styles.emptyFeedRing} />
                <span className={styles.emptyFeedRing} />
                <span className={styles.emptyFeedDot} />
              </div>
              <h2 className={styles.emptyFeedTitle}>
                {snsLoading
                  ? '投稿を読み込み中...'
                  : activeArtistId === 'all'
                  ? 'タイムラインはまだ静かです'
                  : `${activeArtistName ?? 'このアーティスト'}の投稿はまだありません`}
              </h2>
              <p className={styles.emptyFeedText}>
                {snsLoading
                  ? '最新のSNS投稿を取得しています。しばらくお待ちください。'
                  : activeArtistId === 'all'
                  ? 'SNSの更新は準備中です。Spotify タブではリリースや人気曲を今すぐチェックできます。'
                  : 'フィルターを「すべて」にすると、ほかの推しの投稿もまとめて見られます。'}
              </p>
              {!snsLoading && (
                <div className={styles.emptyFeedActions}>
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
              )}
            </div>
          )
            }
            </>
            ) : activeFeedTab === 'spotify' ? (
            mergedTopTracks.length > 0 || mergedDiscography.length > 0 ? (
            <div className={styles.spotifyFeed}>
              {/* Last.fm アーティストカード（アーティスト選択時のみ） */}
              {activeArtistId !== 'all' && (() => {
                const info = lastfmCache[activeArtistId]
                if (!info && !lastfmLoading) return null
                const spotifyArtist = selectedArtists.find((a) => a.id === activeArtistId)
                const listeners = info ? Number(info.stats.listeners).toLocaleString('ja-JP') : null
                const playcount = info ? Number(info.stats.playcount).toLocaleString('ja-JP') : null
                const rawBio = info?.bio?.summary ?? ''
                const bio = rawBio
                  .replace(/<a[^>]*>.*?<\/a>/gi, '')
                  .replace(/<[^>]+>/g, '')
                  .replace(/\s+/g, ' ')
                  .trim()
                const tags = info?.tags?.tag?.slice(0, 4) ?? []
                // Spotify の画像を優先、なければ Last.fm にフォールバック
                const img =
                  spotifyArtist?.images?.[0]?.url ??
                  info?.image?.find((i) => i.size === 'extralarge' || i.size === 'large')?.['#text'] ??
                  null
                const displayName = info?.name ?? spotifyArtist?.name ?? ''
                return (
                  <div className={styles.lastfmCard}>
                    {lastfmLoading && !info ? (
                      <div className={styles.lastfmCardSkeleton}>
                        <div className={styles.skeletonBlock} style={{ width: 56, height: 56, borderRadius: 8, flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} style={{ width: '60%', height: 14 }} />
                          <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} style={{ width: '40%', height: 11 }} />
                          <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} style={{ width: '90%', height: 11 }} />
                        </div>
                      </div>
                    ) : info ? (
                      <>
                        <div className={styles.lastfmCardHeader}>
                          {img ? (
                            <img src={img} alt={displayName} className={styles.lastfmCardImg} />
                          ) : (
                            <div className={styles.lastfmCardImgFallback}>{displayName.slice(0, 2)}</div>
                          )}
                          <div className={styles.lastfmCardMeta}>
                            <p className={styles.lastfmCardName}>{displayName}</p>
                            <div className={styles.lastfmCardStats}>
                              {listeners && (
                                <span className={styles.lastfmCardStat}>
                                  <span className={styles.lastfmCardStatLabel}>リスナー</span>
                                  <span className={styles.lastfmCardStatValue}>{listeners}</span>
                                </span>
                              )}
                              {playcount && (
                                <span className={styles.lastfmCardStat}>
                                  <span className={styles.lastfmCardStatLabel}>再生数</span>
                                  <span className={styles.lastfmCardStatValue}>{playcount}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {tags.length > 0 && (
                          <div className={styles.lastfmCardTags}>
                            {tags.map((tag) => (
                              <span key={tag.name} className={styles.lastfmCardTag}>{tag.name}</span>
                            ))}
                          </div>
                        )}
                        {bio && (
                          <p className={styles.lastfmCardBio}>{bio.length > 200 ? bio.slice(0, 200) + '…' : bio}</p>
                        )}
                      </>
                    ) : null}
                  </div>
                )
              })()}

              {/* ディスコグラフィセクション */}
              <section className={artistStyles.section}>
                <div className={artistStyles.sectionHeader}>
                  <h2 className={artistStyles.sectionTitle}>ディスコグラフィ</h2>
                </div>
                <div className={styles.discographyList}>
                  {(discographyExpanded ? mergedDiscography : mergedDiscography.slice(0, 5)).map((album) => (
                    <div
                      key={album.id}
                      className={styles.discographyListItem}
                      style={{ cursor: 'pointer' }}
                      onClick={() => openAlbumModal(album.id)}
                    >
                      {album.coverUrl ? (
                        <img src={album.coverUrl} alt="" className={styles.discographyListCover} />
                      ) : (
                        <div className={styles.discographyListCoverFallback}>{album.name.slice(0, 2)}</div>
                      )}
                      <div className={styles.discographyListInfo}>
                        <div className={styles.discographyListTitle}>{album.name}</div>
                        <div className={styles.discographyListMeta}>
                          {[ALBUM_TYPE_LABELS[album.albumType] ?? album.albumType, album.releaseDate?.slice(0, 4)]
                            .filter(Boolean)
                            .join(' • ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {mergedDiscography.length > 5 && (
                  <button
                    type="button"
                    className={styles.discographySeeAll}
                    onClick={() => {
                      if (discographyExpanded) lockScroll()
                      setDiscographyExpanded((v) => !v)
                    }}
                  >
                    {discographyExpanded ? '表示を少なくする' : 'すべて見る'}
                  </button>
                )}
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
        {/* ナビバー分のスペーサー（Safari の overflow padding-bottom バグ回避） */}
        <div style={{ height: 'calc(50px + env(safe-area-inset-bottom, 0px) + 4px + 68px)', flexShrink: 0 }} aria-hidden />
        </section>
      </div>
    </div>
  )
}