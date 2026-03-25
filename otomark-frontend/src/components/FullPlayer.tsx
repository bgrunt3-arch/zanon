'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import styles from './FullPlayer.module.css'
import { useSpotifyPlayerContext } from '@/contexts/SpotifyPlayerContext'
import { useLyrics, getCurrentLineIndex } from '@/hooks/useLyrics'
import { getLocalPlaylists, addTrackToPlaylist, type LocalPlaylist } from '@/lib/localPlaylist'

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  )
}

function SkipBackIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
  )
}

function SkipForwardIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 18l8.5-6L6 6v12zm8.5-6v6H17V6h-2.5v6z" />
    </svg>
  )
}

function ShuffleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zm4.76-.78l1.96 1.96H14v2h5v-5h-2v1.38l-2.27-2.27-1.38 1.38zM4 18.59l1.41 1.41 8.17-8.17-1.41-1.41L4 18.59zm14-1.2V14h-2v2.38l-5.17 5.17 1.41 1.41L18 17.39z" />
    </svg>
  )
}

function RepeatIcon({ mode }: { mode: 'off' | 'queue' | 'track' }) {
  if (mode === 'track') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
    </svg>
  )
}

type Props = {
  onClose: () => void
}

export function FullPlayer({ onClose }: Props) {
  const { isReady, isPlaying, currentTrack, position, duration, pause, play, seek, skipNext, skipPrev, isShuffle, repeatMode, toggleShuffle, toggleRepeat } = useSpotifyPlayerContext()
  const router = useRouter()
  const [dragY, setDragY] = useState(0)
  const [localPosition, setLocalPosition] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [localPlaylists, setLocalPlaylists] = useState<LocalPlaylist[]>([])
  const [showToast, setShowToast] = useState(false)
  const [showLyrics, setShowLyrics] = useState(false)

  const handleOpenAddSheet = useCallback(() => {
    setLocalPlaylists(getLocalPlaylists())
    setShowAddSheet(true)
  }, [])

  const handleAddToPlaylist = useCallback((playlistId: string) => {
    if (!currentTrack) return
    const trackId = currentTrack.uri.split(':')[2]
    addTrackToPlaylist(playlistId, {
      id: trackId,
      name: currentTrack.name,
      artistName: currentTrack.artistName,
      albumName: '',
      coverUrl: currentTrack.coverUrl,
      uri: currentTrack.uri,
      durationMs: duration,
    })
    setShowAddSheet(false)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }, [currentTrack, duration])
  const touchStartY = useRef<number | null>(null)
  const lyricsRef = useRef<HTMLDivElement | null>(null)
  const activeLineRef = useRef<HTMLParagraphElement | null>(null)

  const lyrics = useLyrics(
    currentTrack?.name ?? null,
    currentTrack?.artistName ?? null,
    duration,
  )
  const currentLineIndex = getCurrentLineIndex(lyrics.lines, localPosition)

  // Contextのpositionをローカルに同期（シーク中は上書きしない）
  useEffect(() => {
    if (!isSeeking) setLocalPosition(position)
  }, [position, isSeeking])

  // 再生中は1秒ごとにローカル位置を補間
  useEffect(() => {
    if (!isPlaying || isSeeking) return
    const id = setInterval(() => {
      setLocalPosition((prev) => Math.min(prev + 1000, duration))
    }, 1000)
    return () => clearInterval(id)
  }, [isPlaying, isSeeking, duration])

  // トラックが変わったら歌詞表示をリセット
  useEffect(() => {
    setShowLyrics(false)
  }, [currentTrack?.uri])

  // 歌詞の現在行を中央にスクロール
  useEffect(() => {
    if (!showLyrics || !activeLineRef.current || !lyricsRef.current) return
    activeLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [currentLineIndex, showLyrics])

  // スワイプダウンで閉じる
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) setDragY(delta)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    if (dragY > 80) {
      onClose()
    }
    setDragY(0)
    touchStartY.current = null
  }

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const handlePlayPause = async () => {
    if (isPlaying) {
      await pause()
    } else {
      await play('')
    }
  }

  const opacity = Math.max(0, 1 - dragY / 300)
  const translateY = dragY

  if (!currentTrack) return null

  return (
    <div
      className={styles.overlay}
      style={{
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--orbit-hero, #1db954) 40%, #000) 0%, #000 60%)',
        transform: `translateY(${translateY}px)`,
        opacity,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(.32,.72,0,1), opacity 0.3s ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="フルプレイヤー"
    >
      {/* ドラッグハンドル */}
      <div
        className={styles.dragHandle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.dragIndicator} />
      </div>

      {/* 閉じるボタン */}
      <button
        type="button"
        className={styles.closeBtn}
        onClick={onClose}
        aria-label="閉じる"
      >
        <CloseIcon />
      </button>

      {/* メインエリア（カバー ↔ 歌詞） */}
      <div className={styles.mainArea}>
        {showLyrics ? (
          <div
            ref={lyricsRef}
            className={styles.lyricsArea}
            onClick={() => setShowLyrics(false)}
            role="button"
            tabIndex={0}
            aria-label="カバーに戻る"
            onKeyDown={(e) => e.key === 'Enter' && setShowLyrics(false)}
          >
            <p className={styles.lyricsHint}>タップでカバーに戻る</p>
            {lyrics.loading && (
              <p className={styles.lyricsStatus}>読み込み中...</p>
            )}
            {!lyrics.loading && lyrics.instrumental && (
              <p className={styles.lyricsStatus}>インストゥルメンタル</p>
            )}
            {!lyrics.loading && !lyrics.instrumental && lyrics.lines.length > 0 && (
              lyrics.lines.map((line, i) => (
                <p
                  key={i}
                  ref={i === currentLineIndex ? activeLineRef : null}
                  className={`${styles.lyricsLine} ${i === currentLineIndex ? styles.lyricsLineActive : ''}`}
                >
                  {line.text}
                </p>
              ))
            )}
            {!lyrics.loading && !lyrics.instrumental && lyrics.lines.length === 0 && lyrics.plain && (
              <p className={styles.lyricsPlain}>{lyrics.plain}</p>
            )}
            {!lyrics.loading && !lyrics.instrumental && lyrics.lines.length === 0 && !lyrics.plain && (
              <p className={styles.lyricsStatus}>歌詞が見つかりません</p>
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              className={styles.coverWrap}
              onClick={() => setShowLyrics(true)}
              aria-label="歌詞を表示"
            >
              {currentTrack.coverUrl ? (
                <Image
                  src={currentTrack.coverUrl}
                  alt={currentTrack.name}
                  width={400}
                  height={400}
                  className={styles.cover}
                  unoptimized
                  priority
                />
              ) : (
                <div className={styles.coverFallback} />
              )}
            </button>
            <span className={styles.coverHint} aria-hidden>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4zm6 9a1 1 0 0 1 2 0 8 8 0 0 1-7 7.94V22h-2v-2.06A8 8 0 0 1 4 12a1 1 0 0 1 2 0 6 6 0 0 0 12 0z"/>
              </svg>
              歌詞
            </span>
          </>
        )}
      </div>

      {/* 曲名・アーティスト名 */}
      <div className={styles.trackInfo}>
        <div className={styles.trackInfoRow}>
          <div className={styles.trackInfoText}>
            <p className={styles.trackName}>{currentTrack.name}</p>
            <p className={styles.artistName}>{currentTrack.artistName}</p>
          </div>
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleOpenAddSheet}
            aria-label="プレイリストに追加"
          >＋</button>
        </div>
      </div>

      {/* シークバー */}
      <div className={styles.seekWrap}>
        <input
          type="range"
          className={styles.seekBar}
          min={0}
          max={duration || 1}
          value={localPosition}
          onChange={(e) => {
            setIsSeeking(true)
            setLocalPosition(Number(e.target.value))
          }}
          onMouseUp={(e) => {
            seek(Number((e.target as HTMLInputElement).value))
            setIsSeeking(false)
          }}
          onTouchEnd={(e) => {
            seek(Number((e.target as HTMLInputElement).value))
            setIsSeeking(false)
          }}
          style={{ '--pct': duration ? `${(localPosition / duration) * 100}%` : '0%' } as React.CSSProperties}
        />
        <div className={styles.seekTimes}>
          <span>{formatTime(localPosition)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* コントロール（shuffle - prev - play - next - repeat） */}
      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.modeBtn} ${isShuffle ? styles.modeBtnActive : ''}`}
          aria-label={isShuffle ? 'シャッフルOFF' : 'シャッフルON'}
          onClick={toggleShuffle}
        >
          <ShuffleIcon />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="前の曲"
          onClick={skipPrev}
          disabled={!isReady}
        >
          <SkipBackIcon />
        </button>
        <button
          type="button"
          className={styles.playBtn}
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
          onClick={skipNext}
          disabled={!isReady}
        >
          <SkipForwardIcon />
        </button>
        <button
          type="button"
          className={`${styles.modeBtn} ${repeatMode !== 'off' ? styles.modeBtnActive : ''}`}
          aria-label={repeatMode === 'off' ? 'リピートON' : repeatMode === 'queue' ? '1曲リピートに変更' : 'リピートOFF'}
          onClick={toggleRepeat}
        >
          <RepeatIcon mode={repeatMode} />
        </button>
      </div>


      {/* プレイリスト追加ボトムシート */}
      {showAddSheet && (
        <>
          <div onClick={() => setShowAddSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401, background: '#1a1a1a', borderRadius: '20px 20px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, margin: '12px auto 16px' }} />
            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, color: '#fff', margin: '0 0 12px', padding: '0 20px' }}>プレイリストに追加</p>
            {localPlaylists.length === 0 ? (
              <div style={{ padding: '16px 20px 8px', textAlign: 'center' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 16 }}>プレイリストがまだありません</p>
                <button
                  type="button"
                  onClick={() => { setShowAddSheet(false); onClose(); router.push('/create') }}
                  style={{ padding: '10px 24px', background: '#1db954', color: '#000', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 24, cursor: 'pointer' }}
                >プレイリストを作成する</button>
              </div>
            ) : (
              <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {localPlaylists.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleAddToPlaylist(p.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 20px', background: 'none', border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span>{p.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 400 }}>{p.tracks.length}曲</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 追加完了トースト */}
      {showToast && (
        <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', left: '50%', transform: 'translateX(-50%)', background: '#1db954', color: '#000', fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 24, zIndex: 500, whiteSpace: 'nowrap' }}>
          プレイリストに追加しました
        </div>
      )}
    </div>
  )
}
