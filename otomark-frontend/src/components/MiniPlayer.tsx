'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import styles from './MiniPlayer.module.css'
import { useSpotifyPlayerContext } from '@/contexts/SpotifyPlayerContext'
import { FullPlayer } from './FullPlayer'

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function SkipBackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
  )
}

function SkipForwardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 18l8.5-6L6 6v12zm8.5-6v6H17V6h-2.5v6z" />
    </svg>
  )
}

export function MiniPlayer() {
  const { isReady, isPlaying, currentTrack, position, duration, pause, play, skipNext, skipPrev } = useSpotifyPlayerContext()
  const [fullPlayerOpen, setFullPlayerOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setFullPlayerOpen(false)
  }, [pathname])

  if (!currentTrack) return null

  const progress = duration > 0 ? (position / duration) * 100 : 0

  const handlePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPlaying) {
      await pause()
    } else {
      await play('')
    }
  }

  return (
    <>
      {fullPlayerOpen && <FullPlayer onClose={() => setFullPlayerOpen(false)} />}
      <div
        className={styles.miniPlayer}
        style={fullPlayerOpen ? { display: 'none' } : undefined}
        onClick={() => setFullPlayerOpen(true)}
        role="button"
        tabIndex={0}
        aria-label="フルプレイヤーを開く"
        onKeyDown={(e) => e.key === 'Enter' && setFullPlayerOpen(true)}
      >
        <div className={styles.inner}>
          {/* アルバムアート */}
          <div className={styles.cover}>
            {currentTrack.coverUrl ? (
              <Image
                src={currentTrack.coverUrl}
                alt=""
                width={50}
                height={50}
                className={styles.coverImg}
                unoptimized
              />
            ) : (
              <div className={styles.coverFallback} />
            )}
          </div>

          {/* 曲名 • アーティスト名 */}
          <p className={styles.trackText}>
            {currentTrack.name}
            <span className={styles.separator}> • </span>
            {currentTrack.artistName}
          </p>

          {/* コントロール */}
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="前の曲"
              disabled={!isReady}
              onClick={async (e) => { e.stopPropagation(); await skipPrev() }}
            >
              <SkipBackIcon />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={isPlaying ? '一時停止' : '再生'}
              onClick={handlePlayPause}
              disabled={!isReady}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="次の曲"
              disabled={!isReady}
              onClick={async (e) => { e.stopPropagation(); await skipNext() }}
            >
              <SkipForwardIcon />
            </button>
          </div>
        </div>

        {/* 再生進捗バー */}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </>
  )
}
