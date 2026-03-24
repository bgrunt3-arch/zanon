'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './AlbumModal.module.css'
import { useAlbumModalContext } from '@/contexts/AlbumModalContext'
import { useSpotifyPlayerContext } from '@/contexts/SpotifyPlayerContext'
import { getAccessToken, spotifyGet } from '@/lib/orbit'
import {
  getLocalPlaylists,
  addTrackToPlaylist,
  updatePlaylistCover,
  removeTrackFromPlaylist,
  renameLocalPlaylist,
  reorderPlaylistTracks,
  deleteLocalPlaylist,
  compressImageFile,
  type LocalPlaylist,
  type LocalTrack,
} from '@/lib/localPlaylist'

type Track = {
  id: string
  name: string
  artists: string
}

type ModalContent = {
  title: string
  coverUrl: string | null
  tracks: Track[]
}

async function fetchAlbumContent(token: string, albumId: string): Promise<ModalContent> {
  const res = await spotifyGet(`/albums/${albumId}`, token)
  if (!res.ok) throw new Error('album fetch failed')
  const data = await res.json() as {
    name: string
    images: Array<{ url: string }>
    tracks: { items: Array<{ id: string; name: string; artists: Array<{ name: string }> }> }
  }
  return {
    title: data.name,
    coverUrl: data.images?.[0]?.url ?? null,
    tracks: data.tracks.items.map((t) => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map((a) => a.name).join(', '),
    })),
  }
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  )
}

function DragHandleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <circle cx="7" cy="5" r="1.5" />
      <circle cx="13" cy="5" r="1.5" />
      <circle cx="7" cy="10" r="1.5" />
      <circle cx="13" cy="10" r="1.5" />
      <circle cx="7" cy="15" r="1.5" />
      <circle cx="13" cy="15" r="1.5" />
    </svg>
  )
}

function SortableTrackItem({ track, onDelete }: { track: Track; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
  }
  return (
    <div ref={setNodeRef} style={style} className={styles.trackItem}>
      <button type="button" className={styles.dragHandleBtn} {...attributes} {...listeners} aria-label="並び替え">
        <DragHandleIcon />
      </button>
      <div className={styles.trackInfo} style={{ flex: 1, minWidth: 0, padding: '10px 8px' }}>
        <p className={styles.trackName}>{track.name}</p>
        <p className={styles.trackArtists}>{track.artists}</p>
      </div>
      <button type="button" className={styles.deleteTrackBtn} onClick={onDelete} aria-label={`${track.name}を削除`}>
        ✕
      </button>
    </div>
  )
}

export function AlbumModal() {
  const router = useRouter()
  const { isOpen, contentId, preloadedContent, localPlaylistId, closeModal } = useAlbumModalContext()
  const { play, setQueue } = useSpotifyPlayerContext()
  const [fetchedContent, setFetchedContent] = useState<ModalContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // ドラッグ（モーダル全体）
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartY = useRef<number | null>(null)

  // プレイリスト追加ボトムシート
  const [addTarget, setAddTarget] = useState<Track | null>(null)
  const [localPlaylists, setLocalPlaylists] = useState<LocalPlaylist[]>([])

  // カバー画像（ローカルプレイリスト用）
  const [localCoverUrl, setLocalCoverUrl] = useState<string | null | undefined>(undefined)
  const coverFileRef = useRef<HTMLInputElement>(null)

  // 編集モード
  const [isEditMode, setIsEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editTracks, setEditTracks] = useState<Track[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  // モーダルが開くたびにリセット
  useEffect(() => {
    if (isOpen) {
      setLocalCoverUrl(undefined)
      setIsEditMode(false)
      setShowDeleteConfirm(false)
    }
  }, [isOpen, localPlaylistId])

  // ローカルプレイリスト編集状態の初期化
  const content = preloadedContent ?? fetchedContent
  useEffect(() => {
    if (localPlaylistId && content) {
      setEditName(content.title)
      setEditTracks([...content.tracks])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPlaylistId, isOpen])

  const handleCoverChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !localPlaylistId) return
    try {
      const dataUrl = await compressImageFile(file)
      updatePlaylistCover(localPlaylistId, dataUrl)
      setLocalCoverUrl(dataUrl)
      window.dispatchEvent(new Event('playlist-updated'))
    } catch {
      // ignore
    }
    e.target.value = ''
  }, [localPlaylistId])

  // トースト
  const [toastKey, setToastKey] = useState(0)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    if (!isOpen || preloadedContent) {
      setFetchedContent(null)
      return
    }
    if (!contentId) return
    const token = getAccessToken()
    if (!token) return

    setFetchedContent(null)
    setError(false)
    setLoading(true)

    fetchAlbumContent(token, contentId)
      .then(setFetchedContent)
      .catch((e) => { console.log('fetch error:', e); setError(true) })
      .finally(() => setLoading(false))
  }, [isOpen, contentId, preloadedContent])

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
    if (dragY > 80) closeModal()
    setDragY(0)
    touchStartY.current = null
  }

  const handleTrackPlay = useCallback(async (trackId: string) => {
    if (!content) return
    const uris = content.tracks.map((t) => `spotify:track:${t.id}`)
    setQueue(uris)
    await play(`spotify:track:${trackId}`)
  }, [content, play, setQueue])

  const openAddSheet = useCallback((track: Track) => {
    setLocalPlaylists(getLocalPlaylists())
    setAddTarget(track)
  }, [])

  const handleAddToPlaylist = useCallback((playlistId: string) => {
    if (!addTarget || !content) return
    const localTrack: LocalTrack = {
      id: addTarget.id,
      name: addTarget.name,
      artistName: addTarget.artists,
      albumName: content.title,
      coverUrl: content.coverUrl,
      uri: `spotify:track:${addTarget.id}`,
      durationMs: 0,
    }
    addTrackToPlaylist(playlistId, localTrack)
    setAddTarget(null)
    setShowToast(true)
    setToastKey((k) => k + 1)
    setTimeout(() => setShowToast(false), 2000)
  }, [addTarget, content])

  // 編集モード: 名前変更
  const handleEditNameBlur = useCallback(() => {
    if (!localPlaylistId || !editName.trim()) return
    renameLocalPlaylist(localPlaylistId, editName.trim())
    window.dispatchEvent(new Event('playlist-updated'))
  }, [localPlaylistId, editName])

  // 編集モード: 曲削除
  const handleDeleteTrack = useCallback((trackId: string) => {
    if (!localPlaylistId) return
    removeTrackFromPlaylist(localPlaylistId, trackId)
    setEditTracks((prev) => prev.filter((t) => t.id !== trackId))
    window.dispatchEvent(new Event('playlist-updated'))
  }, [localPlaylistId])

  // 編集モード: 曲順変更
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setEditTracks((prev) => {
      const oldIndex = prev.findIndex((t) => t.id === active.id)
      const newIndex = prev.findIndex((t) => t.id === over.id)
      const next = arrayMove(prev, oldIndex, newIndex)
      if (localPlaylistId) {
        reorderPlaylistTracks(localPlaylistId, next.map((t) => t.id))
        window.dispatchEvent(new Event('playlist-updated'))
      }
      return next
    })
  }, [localPlaylistId])

  // 編集モード: プレイリスト削除
  const handleDeletePlaylist = useCallback(() => {
    if (!localPlaylistId) return
    deleteLocalPlaylist(localPlaylistId)
    window.dispatchEvent(new Event('playlist-updated'))
    closeModal()
  }, [localPlaylistId, closeModal])

  if (!isOpen) return null

  const opacity = Math.max(0, 1 - dragY / 300)

  return (
    <div
      className={styles.overlay}
      style={{
        transform: `translateY(${dragY}px)`,
        opacity,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(.32,.72,0,1), opacity 0.3s ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="詳細"
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
      <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="閉じる">
        <CloseIcon />
      </button>

      {/* ヘッダー（カバー＋タイトル） */}
      {content && (() => {
        const displayCover = localCoverUrl !== undefined ? localCoverUrl : content.coverUrl
        return (
          <div className={styles.header}>
            {localPlaylistId && isEditMode ? (
              <button
                type="button"
                className={styles.coverEditBtn}
                onClick={() => coverFileRef.current?.click()}
                aria-label="カバー画像を変更"
              >
                {displayCover ? (
                  <Image src={displayCover} alt="" width={72} height={72} className={styles.cover} unoptimized />
                ) : (
                  <div className={styles.coverFallback}>♪</div>
                )}
                <span className={styles.coverEditOverlay}>編集</span>
              </button>
            ) : (
              displayCover ? (
                <Image src={displayCover} alt="" width={72} height={72} className={styles.cover} unoptimized />
              ) : (
                <div className={styles.coverFallback}>♪</div>
              )
            )}
            <div className={styles.headerInfo}>
              {isEditMode && localPlaylistId ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleEditNameBlur}
                  className={styles.titleInput}
                  placeholder="プレイリスト名"
                  autoCapitalize="none"
                />
              ) : (
                <p className={styles.title}>{content.title}</p>
              )}
              <div className={styles.subtitleRow}>
                <p className={styles.subtitle}>
                  {preloadedContent ? 'プレイリスト' : 'アルバム'} · {(isEditMode ? editTracks : content.tracks).length}曲
                </p>
                {localPlaylistId && (
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => setIsEditMode((v) => !v)}
                    aria-label={isEditMode ? '完了' : '編集'}
                  >
                    {isEditMode ? <span className={styles.editBtnLabel}>完了</span> : <PencilIcon />}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* カバー変更用 file input */}
      {localPlaylistId && (
        <input
          ref={coverFileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleCoverChange}
        />
      )}

      <div className={styles.divider} />

      {loading && <p className={styles.status}>読み込み中...</p>}
      {error && <p className={styles.status}>読み込みに失敗しました</p>}

      {content && (
        <div className={styles.trackList}>
          {/* 通常モード: 空のプレイリスト */}
          {!isEditMode && content.tracks.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 20px' }}>
              <p className={styles.status} style={{ margin: 0 }}>曲がまだありません</p>
              {localPlaylistId && (
                <button
                  type="button"
                  onClick={() => { closeModal(); router.push(`/search?playlistId=${localPlaylistId}`) }}
                  style={{
                    padding: '10px 24px',
                    background: '#1db954',
                    color: '#000',
                    fontWeight: 700,
                    fontSize: 14,
                    border: 'none',
                    borderRadius: 24,
                    cursor: 'pointer',
                  }}
                >
                  ＋ 曲を追加する
                </button>
              )}
            </div>
          )}

          {/* 編集モード: ドラッグ並び替え */}
          {isEditMode && localPlaylistId && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={editTracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {editTracks.map((track) => (
                  <SortableTrackItem
                    key={track.id}
                    track={track}
                    onDelete={() => handleDeleteTrack(track.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {/* 通常モード: トラックリスト */}
          {!isEditMode && content.tracks.map((track, i) => (
            <div key={track.id} className={styles.trackItem}>
              <div
                className={styles.trackPlayArea}
                role="button"
                tabIndex={0}
                onClick={() => handleTrackPlay(track.id)}
                onKeyDown={(e) => e.key === 'Enter' && handleTrackPlay(track.id)}
              >
                <span className={styles.trackNum}>{i + 1}</span>
                <div className={styles.trackInfo}>
                  <p className={styles.trackName}>{track.name}</p>
                  <p className={styles.trackArtists}>{track.artists}</p>
                </div>
              </div>
              <button
                type="button"
                className={styles.addBtn}
                onClick={() => openAddSheet(track)}
                aria-label={`${track.name}をプレイリストに追加`}
              >
                ＋
              </button>
            </div>
          ))}

          {/* 編集モード: プレイリスト削除ボタン */}
          {isEditMode && localPlaylistId && (
            <div style={{ padding: '32px 20px 24px' }}>
              <button
                type="button"
                className={styles.deletePlaylistBtn}
                onClick={() => setShowDeleteConfirm(true)}
              >
                プレイリストを削除
              </button>
            </div>
          )}
        </div>
      )}

      {/* トースト */}
      {showToast && (
        <div key={toastKey} className={styles.toast}>追加しました</div>
      )}

      {/* ボトムシートスクリム（プレイリスト追加） */}
      {addTarget && (
        <div className={styles.sheetScrim} onClick={() => setAddTarget(null)} />
      )}

      {/* ボトムシート（プレイリスト追加） */}
      {addTarget && (
        <div className={styles.sheet} role="dialog" aria-label="プレイリストに追加">
          <div className={styles.sheetHandle}>
            <div className={styles.sheetIndicator} />
          </div>
          <p className={styles.sheetTitle}>プレイリストに追加</p>

          {localPlaylists.length === 0 ? (
            <div className={styles.sheetEmpty}>
              <p className={styles.sheetEmptyText}>プレイリストがまだありません</p>
              <button
                type="button"
                className={styles.sheetCreateBtn}
                onClick={() => { setAddTarget(null); closeModal(); router.push('/create') }}
              >
                プレイリストを作成する
              </button>
            </div>
          ) : (
            <div className={styles.sheetList}>
              {localPlaylists.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.sheetItem}
                  onClick={() => handleAddToPlaylist(p.id)}
                >
                  <div style={{ minWidth: 0 }}>
                    <p className={styles.sheetItemName}>{p.name}</p>
                    <p className={styles.sheetItemCount}>{p.tracks.length}曲</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div
          className={styles.confirmScrim}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className={styles.confirmDialog}
            role="dialog"
            aria-label="プレイリストを削除"
            onClick={(e) => e.stopPropagation()}
          >
            <p className={styles.confirmTitle}>プレイリストを削除</p>
            <p className={styles.confirmBody}>
              このプレイリストを削除しますか？この操作は元に戻せません。
            </p>
            <button
              type="button"
              className={styles.deletePlaylistBtn}
              onClick={handleDeletePlaylist}
            >
              削除する
            </button>
            <button
              type="button"
              className={styles.sheetCancelBtn}
              onClick={() => setShowDeleteConfirm(false)}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
