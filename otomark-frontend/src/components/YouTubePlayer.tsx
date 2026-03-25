'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
    _ytApiReady: boolean
    _ytApiCallbacks: Array<() => void>
  }
}

function loadYouTubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (window._ytApiReady) { resolve(); return }
    if (!window._ytApiCallbacks) window._ytApiCallbacks = []
    window._ytApiCallbacks.push(resolve)
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      window._ytApiReady = true
      prev?.()
      window._ytApiCallbacks?.forEach((cb) => cb())
      window._ytApiCallbacks = []
    }
  })
}

type Props = {
  videoId: string
  title?: string
}

export function YouTubePlayer({ videoId, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    let destroyed = false

    loadYouTubeApi().then(() => {
      if (destroyed || !containerRef.current) return
      const div = document.createElement('div')
      containerRef.current.appendChild(div)

      playerRef.current = new window.YT.Player(div, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onError: (e: YT.OnErrorEvent) => {
            // 101 / 150: 埋め込み再生が許可されていない
            if (e.data === 101 || e.data === 150) {
              setBlocked(true)
            }
          },
        },
      })
    })

    return () => {
      destroyed = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId])

  if (blocked) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: '24px 16px', background: '#1a1a1a', borderRadius: 8,
        color: '#aaa', fontSize: 13, textAlign: 'center',
      }}>
        <span>この動画はアプリ内で再生できません</span>
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#fff', background: '#FF0000', padding: '8px 16px',
            borderRadius: 4, textDecoration: 'none', fontWeight: 600, fontSize: 13,
          }}
        >
          YouTubeで開く
        </a>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .yt-player-wrap iframe {
          position: absolute !important;
          top: 0; left: 0;
          width: 100% !important;
          height: 100% !important;
          border: none;
        }
      `}</style>
      <div
        ref={containerRef}
        className="yt-player-wrap"
        style={{ position: 'absolute', inset: 0, background: '#000' }}
      />
    </>
  )
}
