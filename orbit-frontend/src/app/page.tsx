'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './orbit.module.css'
import {
  fetchMe,
  fetchArtistTopTracks,
  fetchArtistRecentAlbums,
  fetchAlbumTracks,
  clearAccessToken,
  getAccessToken,
  getSelectedArtists,
  type SpotifyArtist,
  type SpotifyTrack,
} from '@/lib/orbit'

type FeedItem = {
  id: string
  title: string
  body: string
  coverUrl: string | null
  trackUrl: string
  score: number
  fetchedAt: string
  overlapCount: number
  artistIds: string[]
  sourcePickId: string | null
}

type SortMode = 'recent' | 'overlap'
const SORT_MODE_KEY = 'orbit.feed.sortMode'
const ACTIVE_ARTIST_KEY = 'orbit.feed.activeArtistId'
const ALBUMS_RATE_LIMIT_UNTIL_KEY = 'orbit.spotify.albumsRateLimitedUntil'
const TRACKS_RATE_LIMIT_UNTIL_KEY = 'orbit.spotify.tracksRateLimitedUntil'
const LAST_RATE_LIMIT_UNTIL_KEY = 'orbit.spotify.lastRateLimitedUntil'
const LAST_RATE_LIMIT_RETRY_AFTER_SEC_KEY = 'orbit.spotify.lastRetryAfterSec'
const MOCK_SKELETON_DELAY_MS = 500

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

export default function HomePage() {
  const router = useRouter()
  const [selectedArtists, setSelectedArtists] = useState<SpotifyArtist[]>([])
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [viewerName, setViewerName] = useState<string>('you')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [showReloginButton, setShowReloginButton] = useState<boolean>(true)
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [activeArtistId, setActiveArtistId] = useState<string>('all')
  const [nowMs, setNowMs] = useState<number>(Date.now())
  const [retryTick, setRetryTick] = useState<number>(0)
  const [scrollY, setScrollY] = useState<number>(0)

  // feed 表示は buildFeedItems 側で先頭 30 件までなので、
  // それ以上収集するための API 呼び出しを抑制して 429 を起きにくくする。
  const TARGET_TAGGED_COUNT = 30

  useEffect(() => {
    const saved = localStorage.getItem(SORT_MODE_KEY)
    if (saved === 'recent' || saved === 'overlap') {
      setSortMode(saved)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(SORT_MODE_KEY, sortMode)
  }, [sortMode])

  useEffect(() => {
    const saved = localStorage.getItem(ACTIVE_ARTIST_KEY)
    if (saved) {
      setActiveArtistId(saved)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(ACTIVE_ARTIST_KEY, activeArtistId)
  }, [activeArtistId])

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY || 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const relogin = () => {
    clearAccessToken()
    router.replace('/login')
  }

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

    setLoading(true)
    setError('')
    setShowReloginButton(true)
    const mockMode = isMockMode()
    const cycleStartedAtMs = Date.now()
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
    }, 45_000)

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

        const staggerMs = 900
        for (let i = 0; i < picks.length; i++) {
          const artist = picks[i]

          // 1) 人気曲
          try {
            const top = await fetchArtistTopTracks(token, artist.id, me.country)
            for (const t of top) {
              if (seenTrackIds.has(t.id)) continue
              // 推しIDがトラッククレジットに含まれているものだけ
              if (!t.artists.some((a) => a.id === artist.id)) continue
              seenTrackIds.add(t.id)
              tagged.push({
                track: t,
                sourcePickId: artist.id,
                fetchedAt: null,
                albumName: t.album?.name ?? null,
                coverUrl: t.album?.images?.[0]?.url ?? null,
              })
              if (tagged.length >= TARGET_TAGGED_COUNT) break
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

          // 2) 最新リリース（最新っぽいアルバム/シングル→収録曲の一部）
          if (tagged.length < TARGET_TAGGED_COUNT) {
            try {
              // 429 を起きにくくするため、アルバム取得量を最小限にする
              const albums = await fetchArtistRecentAlbums(token, artist.id, 1, me.country)
              for (const album of albums.slice(0, 1)) {
                const albumTracks = await fetchAlbumTracks(token, album.id, 1)
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
                  if (tagged.length >= TARGET_TAGGED_COUNT) break
                }
                if (tagged.length >= TARGET_TAGGED_COUNT) break
              }
            } catch (e: any) {
              const message = e?.message ?? ''
              if (/利用上限|429/.test(message)) {
                // アルバム取得だけレート制限に当たった場合は、
                // 全体キャンセルせずにこの部分だけスキップして次へ進む
              }
              // スキップ
            }
          }

          if (i < picks.length - 1) {
            await new Promise((r) => setTimeout(r, staggerMs))
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
        if (mockMode) {
          const elapsedMs = Date.now() - cycleStartedAtMs
          if (elapsedMs < MOCK_SKELETON_DELAY_MS) {
            await new Promise((resolve) => setTimeout(resolve, MOCK_SKELETON_DELAY_MS - elapsedMs))
          }
          if (cancelled) return
        }
        setFeedItems(nextFeedItems)
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

        // タイムアウト中でも、token expired だけは必ずリログインへ遷移する
        if (isTokenExpired) {
          setError('')
          setLoading(false)
          setShowReloginButton(false)
          cancelled = true
          window.clearTimeout(timeoutId)
          relogin()
          return
        }

        // タイムアウト後はエラーを上書きしない（すでに汎用メッセージを表示している）
        if (timedOut) return
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

  const sortedFeedItems = useMemo(() => {
    const cloned = [...feedItems]
    if (sortMode === 'overlap') {
      return cloned.sort((a, b) => b.score - a.score)
    }
    return cloned.sort((a, b) => {
      const timeA = new Date(a.fetchedAt).getTime()
      const timeB = new Date(b.fetchedAt).getTime()
      return timeB - timeA
    })
  }, [feedItems, sortMode])

  const visibleFeedItems = useMemo(() => {
    if (activeArtistId === 'all') return sortedFeedItems
    return sortedFeedItems.filter((item) => item.artistIds.includes(activeArtistId))
  }, [sortedFeedItems, activeArtistId])

  const heroGradientColor = useMemo(() => getHeroGradientColor(selectedArtists), [selectedArtists])
  const stickyAlpha = useMemo(() => {
    // 0px -> 0.42, 220px 以降 -> 0.74 付近
    const t = Math.min(1, scrollY / 220)
    return 0.42 + 0.32 * t
  }, [scrollY])

  useEffect(() => {
    if (activeArtistId === 'all') return
    const exists = selectedArtists.some((artist) => artist.id === activeArtistId)
    if (!exists) {
      setActiveArtistId('all')
    }
  }, [activeArtistId, selectedArtists])

  return (
    <div className={styles.screen} style={{ ['--hero-gradient-color' as string]: heroGradientColor }}>
      <div className={styles.shell}>
        <div className={styles.stickyHeader} style={{ ['--sticky-alpha' as string]: String(stickyAlpha) }}>
          <h1 className={styles.title}>
            Quin<span className={styles.accent}>tet</span>
          </h1>
          <p className={styles.meta}>{viewerName} さん向けのリアルタイム・ミックス</p>
          <div className={styles.toolbar}>
            <span className={styles.toolbarLabel}>並び替え</span>
            <button
              type="button"
              className={`${styles.sortButton} ${sortMode === 'recent' ? styles.sortButtonActive : ''}`}
              onClick={() => setSortMode('recent')}
            >
              新着
            </button>
            <button
              type="button"
              className={`${styles.sortButton} ${sortMode === 'overlap' ? styles.sortButtonActive : ''}`}
              onClick={() => setSortMode('overlap')}
            >
              重なり重視
            </button>
          </div>

          <div className={styles.topRow}>
            {selectedArtists.map((artist) =>
              artist.images[0]?.url ? (
                <img key={artist.id} src={artist.images[0].url} alt={artist.name} className={styles.avatar} />
              ) : (
                <div key={artist.id} className={styles.avatarFallback}>
                  {artist.name.slice(0, 2)}
                </div>
              )
            )}
          </div>
          <div className={styles.filterRow}>
            <button
              type="button"
              className={`${styles.filterButton} ${activeArtistId === 'all' ? styles.filterButtonActive : ''}`}
              onClick={() => setActiveArtistId('all')}
            >
              すべて
            </button>
            {selectedArtists.map((artist) => (
              <button
                key={artist.id}
                type="button"
                className={`${styles.filterButton} ${activeArtistId === artist.id ? styles.filterButtonActive : ''}`}
                onClick={() => setActiveArtistId(artist.id)}
              >
                {artist.name}
              </button>
            ))}
          </div>
        </div>

        <section className={styles.feed}>
          {loading &&
            Array.from({ length: 3 }).map((_, index) => (
              <article key={`skeleton-${index}`} className={`${styles.post} ${styles.skeletonPost}`} aria-hidden="true">
                <div className={styles.postHeader}>
                  <div className={`${styles.postCover} ${styles.skeletonBlock}`} />
                  <div className={styles.skeletonTextGroup}>
                    <div className={`${styles.skeletonBlock} ${styles.skeletonTitle}`} />
                    <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} />
                  </div>
                </div>
                <div className={styles.postFooter}>
                  <div className={styles.footerMeta}>
                    <span className={`${styles.skeletonBlock} ${styles.skeletonChip}`} />
                    <span className={`${styles.skeletonBlock} ${styles.skeletonTime}`} />
                  </div>
                  <span className={`${styles.skeletonBlock} ${styles.skeletonLink}`} />
                </div>
              </article>
            ))}
        {error && (
          <article className={styles.post}>
            {error}
            <div className={styles.row}>
              {showReloginButton && (
                <button type="button" className={styles.ghostButton} onClick={relogin}>
                  再ログイン
                </button>
              )}
            </div>
          </article>
        )}
          {!loading &&
            !error &&
            visibleFeedItems.map((item) => (
              <article key={item.id} className={styles.post}>
                <div className={styles.postHeader}>
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt={item.title} className={styles.postCover} />
                  ) : (
                    <div className={styles.postCoverFallback}>♪</div>
                  )}
                  <div>
                    <h2 className={styles.postTitle}>{item.title}</h2>
                    <p className={styles.postBody}>{item.body}</p>
                  </div>
                </div>
                <div className={styles.postFooter}>
                  <div className={styles.footerMeta}>
                    <span className={styles.chip}>Orbit Score {item.score}</span>
                    <span className={styles.time}>{formatRelativeTime(item.fetchedAt)} 取得</span>
                  </div>
                  <a href={item.trackUrl} target="_blank" rel="noreferrer" className={styles.linkButton}>
                    Spotifyで開く
                  </a>
                </div>
              </article>
            ))}
          {!loading && !error && visibleFeedItems.length === 0 && (
            <article className={styles.post}>
              {activeArtistId === 'all'
                ? 'まだタイムラインに表示できるトラックがありません。'
                : 'この推しに関連する投稿はまだありません。'}
            </article>
          )}
        </section>
      </div>
    </div>
  )
}

function buildFeedItems(
  items: Array<{
    track: SpotifyTrack
    sourcePickId: string | null
    fetchedAt: string | null
    albumName: string | null
    coverUrl: string | null
  }>,
  picks: SpotifyArtist[],
): FeedItem[] {
  const pickIds = new Set(picks.map((artist) => artist.id))

  const ranked = items.slice(0, 30).map(({ track, sourcePickId, fetchedAt, albumName, coverUrl }) => {
    const trackArtistIds = new Set(track.artists.map((a) => a.id))
    // overlapCount は「トラッククレジットに含まれる推し」だけで数える（seed 由来の sourcePickId は含めない）
    const overlapCount = [...trackArtistIds].filter((id) => pickIds.has(id)).length

    const popularity = typeof track.popularity === 'number' && Number.isFinite(track.popularity) ? track.popularity : 0
    const score = Math.min(100, popularity + overlapCount * 12)
    return {
      track,
      sourcePickId,
      overlapCount,
      score,
      artistIds: [...trackArtistIds],
      fetchedAt,
      albumName,
      coverUrl,
    }
  })

  // 推し 5 人のうち「トラッククレジットに実際に含まれている」ものだけ表示する
  const related = ranked.filter((r) => r.overlapCount > 0)

  return related.map(({ track, overlapCount, score, artistIds, sourcePickId, fetchedAt, albumName, coverUrl }, index) => {
    const album = track.album
    const computedFetchedAt = fetchedAt ?? toISODate(album?.release_date) ?? new Date().toISOString()
    const artistNames = track.artists.map((artist) => artist.name).join(', ')
    const relation =
      overlapCount > 0
        ? `あなたの推し ${overlapCount} 人と重なるトラック。`
        : 'あなたの傾向に近いおすすめトラック。'

    return {
      // 重複するトラックが混じる可能性があるので index も含めて一意化
      id: `${track.id}-${index}`,
      title: `${track.name} - ${albumName ?? album?.name ?? track.name}`,
      body: `${artistNames} / ${relation}`,
      coverUrl: coverUrl ?? album?.images?.[0]?.url ?? null,
      trackUrl: track.external_urls?.spotify ?? '',
      score,
      overlapCount,
      artistIds,
      sourcePickId,
      fetchedAt: computedFetchedAt,
    }
  })
}

function toISODate(value?: string | null): string | null {
  if (!value) return null
  // Spotify: YYYY / YYYY-MM / YYYY-MM-DD
  if (/^\d{4}$/.test(value)) return new Date(`${value}-01-01T00:00:00.000Z`).toISOString()
  if (/^\d{4}-\d{2}$/.test(value)) return new Date(`${value}-01T00:00:00.000Z`).toISOString()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`).toISOString()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMin = Math.max(1, Math.floor(diffMs / (1000 * 60)))

  if (diffMin < 60) return `${diffMin}分前`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}時間前`

  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay}日前`
}