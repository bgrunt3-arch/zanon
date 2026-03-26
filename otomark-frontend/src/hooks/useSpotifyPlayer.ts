'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getAccessToken, fetchMe, fetchTrackPreview, refreshAccessToken } from '@/lib/orbit'

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: typeof Spotify
  }
}

export type CurrentTrack = {
  name: string
  artistName: string
  coverUrl: string | null
  uri: string
}

export type RepeatMode = 'off' | 'track' | 'queue'

export type SpotifyPlayerState = {
  deviceId: string | null
  isReady: boolean
  isPremium: boolean
  isPlaying: boolean
  currentTrack: CurrentTrack | null
  position: number   // ms
  duration: number   // ms
  error: string | null
  isShuffle: boolean
  repeatMode: RepeatMode
}

export type SpotifyPlayerControls = {
  play: (spotifyUri: string) => Promise<void>
  pause: () => Promise<void>
  seek: (positionMs: number) => Promise<void>
  skipNext: () => Promise<void>
  skipPrev: () => Promise<void>
  setQueue: (uris: string[]) => void
  toggleShuffle: () => void
  toggleRepeat: () => void
}

export function useSpotifyPlayer(): SpotifyPlayerState & SpotifyPlayerControls {
  const playerRef = useRef<Spotify.Player | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const isPremiumRef = useRef(false)
  const [premiumChecked, setPremiumChecked] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isShuffle, setIsShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off')
  const isShuffleRef = useRef(false)
  const repeatModeRef = useRef<RepeatMode>('off')
  // 推しディスコグラフィのカスタムキュー
  const queueRef = useRef<string[]>([])
  const shuffledQueueRef = useRef<string[]>([])
  const queueIndexRef = useRef<number>(-1)

  useEffect(() => {
    const token = getAccessToken()
    if (!token) return
    fetchMe(token)
      .then((me) => {
        const premium = me.product === 'premium'
        setIsPremium(premium)
        isPremiumRef.current = premium
        setPremiumChecked(true)
      })
      .catch(() => { setPremiumChecked(true) })
  }, [])

  useEffect(() => {
    // Premiumアカウントのみ Spotify Web Playback SDK を初期化する
    if (!premiumChecked || !isPremium) return
    const token = getAccessToken()
    if (!token || token === 'mock-access-token') return

    const initPlayer = () => {
      const player = new window.Spotify.Player({
        name: 'Orbit Player',
        getOAuthToken: (cb) => {
          refreshAccessToken()
            .then((newToken) => cb(newToken ?? getAccessToken() ?? ''))
            .catch(() => cb(getAccessToken() ?? ''))
        },
        volume: 0.8,
        robustness: 'SW_SECURE_CRYPTO',
      } as Spotify.PlayerInit)

      player.addListener('ready', ({ device_id }) => {
        setDeviceId(device_id)
        deviceIdRef.current = device_id
        setIsReady(true)
        setError(null)
      })

      player.addListener('not_ready', () => {
        setDeviceId(null)
        setIsReady(false)
      })

      player.addListener('player_state_changed', (state) => {
        if (!state) return
        setIsPlaying(!state.paused)
        setPosition(state.position)
        setDuration(state.duration)
        const t = state.track_window.current_track
        setCurrentTrack({
          name: t.name,
          artistName: t.artists.map((a) => a.name).join(', '),
          coverUrl: t.album.images[0]?.url ?? null,
          uri: `spotify:track:${t.id}`,
        })
        // キュー内の現在位置を更新
        const uri = `spotify:track:${t.id}`
        const activeQ = isShuffleRef.current ? shuffledQueueRef.current : queueRef.current
        const idx = activeQ.indexOf(uri)
        if (idx !== -1) queueIndexRef.current = idx

        // トラック終了 → リピート・シャッフルを考慮して次の曲へ
        if (state.paused && state.position === 0 && state.track_window.previous_tracks.length > 0) {
          const q = activeQ
          const did = deviceIdRef.current
          const token = getAccessToken()
          if (!did || !token || q.length === 0) return

          const repeat = repeatModeRef.current
          if (repeat === 'track') {
            // 同じ曲をリピート
            const currentUri = q[queueIndexRef.current]
            if (currentUri) {
              fetch(`https://api.spotify.com/v1/me/player/play?device_id=${did}`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ uris: [currentUri], device_id: did }),
              })
            }
          } else if (queueIndexRef.current !== -1) {
            const isLast = queueIndexRef.current === q.length - 1
            if (isLast && repeat === 'off') return  // キュー末尾で停止
            const nextIdx = (queueIndexRef.current + 1) % q.length
            queueIndexRef.current = nextIdx
            fetch(`https://api.spotify.com/v1/me/player/play?device_id=${did}`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ uris: [q[nextIdx]], device_id: did }),
            })
          }
        }
      })

      player.addListener('initialization_error', ({ message }) => {
        setError(`初期化エラー: ${message}`)
      })

      player.addListener('authentication_error', ({ message }) => {
        setError(`認証エラー: ${message}`)
      })

      player.addListener('account_error', ({ message }) => {
        setError(`アカウントエラー（Premium必須）: ${message}`)
      })

      player.connect()
      playerRef.current = player
    }

    // コールバックを先に定義してからスクリプトを追加する
    window.onSpotifyWebPlaybackSDKReady = initPlayer

    if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      document.body.appendChild(script)
    } else if (window.Spotify) {
      // スクリプト既読み込み済みの場合は直接初期化
      initPlayer()
    }

    return () => {
      playerRef.current?.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premiumChecked, isPremium])

  const playUri = async (spotifyUri: string): Promise<void> => {
    if (!deviceId) return
    const token = getAccessToken()
    if (!token) return

    const isTrack = spotifyUri.startsWith('spotify:track:')
    // キュー内の位置を先に確定
    if (isTrack) {
      const idx = queueRef.current.indexOf(spotifyUri)
      if (idx !== -1) queueIndexRef.current = idx
    }

    const body = isTrack
      ? { uris: [spotifyUri], device_id: deviceId }
      : { context_uri: spotifyUri, device_id: deviceId }

    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setIsPlaying(true)
  }

  const playPreview = async (spotifyUri: string): Promise<void> => {
    const trackId = spotifyUri.startsWith('spotify:track:')
      ? spotifyUri.slice('spotify:track:'.length)
      : spotifyUri

    const info = await fetchTrackPreview(trackId)
    if (!info) return

    // 前の再生を停止
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    // MiniPlayer に反映
    setCurrentTrack({
      name: info.name,
      artistName: info.artistName,
      coverUrl: info.coverUrl,
      uri: spotifyUri.startsWith('spotify:track:') ? spotifyUri : `spotify:track:${spotifyUri}`,
    })

    if (!info.previewUrl) return

    const audio = new Audio(info.previewUrl)
    audioRef.current = audio
    audio.play().catch(() => {})
    setIsPlaying(true)

    audio.addEventListener('ended', () => {
      setIsPlaying(false)
    })
  }

  const play = async (spotifyUri: string): Promise<void> => {
    if (!isPremiumRef.current) {
      if (!spotifyUri) {
        // 非Premium: 一時停止からの再開
        if (audioRef.current) {
          audioRef.current.play().catch(() => {})
          setIsPlaying(true)
        }
        return
      }
      await playPreview(spotifyUri)
      return
    }

    // Premium: Spotify Web Playback SDK
    if (!spotifyUri) {
      await playerRef.current?.resume()
      setIsPlaying(true)
      return
    }
    await playUri(spotifyUri)
  }

  const pause = async (): Promise<void> => {
    if (!isPremiumRef.current) {
      audioRef.current?.pause()
      setIsPlaying(false)
      return
    }
    await playerRef.current?.pause()
    setIsPlaying(false)
  }

  const seek = async (positionMs: number): Promise<void> => {
    await playerRef.current?.seek(positionMs)
    setPosition(positionMs)
  }

  const activeQueue = () => isShuffleRef.current ? shuffledQueueRef.current : queueRef.current

  const skipNext = async (): Promise<void> => {
    const queue = activeQueue()
    if (queue.length === 0) {
      await playerRef.current?.nextTrack()
      return
    }
    if (repeatModeRef.current === 'track') {
      // トラックリピート中でも明示的にスキップしたら次へ
    }
    const next = (queueIndexRef.current + 1) % queue.length
    queueIndexRef.current = next
    await playUri(queue[next])
  }

  const skipPrev = async (): Promise<void> => {
    const queue = activeQueue()
    if (queue.length === 0) {
      await playerRef.current?.previousTrack()
      return
    }
    const prev = (queueIndexRef.current - 1 + queue.length) % queue.length
    queueIndexRef.current = prev
    await playUri(queue[prev])
  }

  const setQueue = useCallback((uris: string[]): void => {
    queueRef.current = uris
    // シャッフル中は並び替えキューも更新
    if (isShuffleRef.current) {
      shuffledQueueRef.current = [...uris].sort(() => Math.random() - 0.5)
    }
    // インデックスは現在再生中のトラックが含まれていれば維持する
    const currentUri = (isShuffleRef.current ? shuffledQueueRef.current : uris)[queueIndexRef.current]
    const newIdx = currentUri ? uris.indexOf(currentUri) : -1
    queueIndexRef.current = newIdx
  }, [])

  const toggleShuffle = useCallback((): void => {
    const next = !isShuffleRef.current
    isShuffleRef.current = next
    setIsShuffle(next)
    if (next) {
      // シャッフルON: 現在曲を先頭に、残りをランダム並び替え
      const q = queueRef.current
      const currentUri = q[queueIndexRef.current]
      const rest = q.filter((u) => u !== currentUri).sort(() => Math.random() - 0.5)
      shuffledQueueRef.current = currentUri ? [currentUri, ...rest] : [...rest]
      queueIndexRef.current = 0
    } else {
      // シャッフルOFF: 元のキューの現在曲位置に戻る
      const currentUri = shuffledQueueRef.current[queueIndexRef.current]
      const idx = currentUri ? queueRef.current.indexOf(currentUri) : -1
      queueIndexRef.current = idx
      shuffledQueueRef.current = []
    }
  }, [])

  const toggleRepeat = useCallback((): void => {
    const next: RepeatMode =
      repeatModeRef.current === 'off' ? 'queue'
      : repeatModeRef.current === 'queue' ? 'track'
      : 'off'
    repeatModeRef.current = next
    setRepeatMode(next)
  }, [])

  return { deviceId, isReady, isPremium, isPlaying, currentTrack, position, duration, error, isShuffle, repeatMode, play, pause, seek, skipNext, skipPrev, setQueue, toggleShuffle, toggleRepeat }
}
