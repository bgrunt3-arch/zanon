'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import type { LocalPlaylist } from '@/lib/localPlaylist'

export type ModalTrack = {
  id: string
  name: string
  artists: string
}

export type PreloadedContent = {
  title: string
  coverUrl: string | null
  tracks: ModalTrack[]
}

type AlbumModalState = {
  isOpen: boolean
  contentId: string | null
  preloadedContent: PreloadedContent | null
  localPlaylistId: string | null
}

type AlbumModalControls = {
  openAlbumModal: (albumId: string) => void
  openLocalPlaylistModal: (playlist: LocalPlaylist) => void
  closeModal: () => void
}

type AlbumModalContextValue = AlbumModalState & AlbumModalControls

const AlbumModalContext = createContext<AlbumModalContextValue | null>(null)

export function AlbumModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlbumModalState>({
    isOpen: false,
    contentId: null,
    preloadedContent: null,
    localPlaylistId: null,
  })

  const openAlbumModal = useCallback((albumId: string) => {
    setState({ isOpen: true, contentId: albumId, preloadedContent: null, localPlaylistId: null })
  }, [])

  const openLocalPlaylistModal = useCallback((playlist: LocalPlaylist) => {
    setState({
      isOpen: true,
      contentId: null,
      localPlaylistId: playlist.id,
      preloadedContent: {
        title: playlist.name,
        coverUrl: playlist.coverUrl ?? null,
        tracks: playlist.tracks.map((t) => ({
          id: t.id,
          name: t.name,
          artists: t.artistName,
        })),
      },
    })
  }, [])

  const closeModal = useCallback(() => {
    setState({ isOpen: false, contentId: null, preloadedContent: null, localPlaylistId: null })
  }, [])

  return (
    <AlbumModalContext.Provider value={{ ...state, openAlbumModal, openLocalPlaylistModal, closeModal }}>
      {children}
    </AlbumModalContext.Provider>
  )
}

export function useAlbumModalContext(): AlbumModalContextValue {
  const ctx = useContext(AlbumModalContext)
  if (!ctx) throw new Error('useAlbumModalContext must be used inside AlbumModalProvider')
  return ctx
}
