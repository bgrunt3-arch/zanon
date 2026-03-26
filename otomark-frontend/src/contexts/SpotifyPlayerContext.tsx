'use client'

import { createContext, useContext } from 'react'
import { useSpotifyPlayer, type SpotifyPlayerState, type SpotifyPlayerControls } from '@/hooks/useSpotifyPlayer'

type SpotifyPlayerContextValue = SpotifyPlayerState & SpotifyPlayerControls

const SpotifyPlayerContext = createContext<SpotifyPlayerContextValue | null>(null)

const FORCE_FREE_MODE = true  // テスト用フラグ

export function SpotifyPlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useSpotifyPlayer()
  const value = FORCE_FREE_MODE ? { ...player, isPremium: false } : player
  return (
    <SpotifyPlayerContext.Provider value={value}>
      {children}
    </SpotifyPlayerContext.Provider>
  )
}

export function useSpotifyPlayerContext(): SpotifyPlayerContextValue {
  const ctx = useContext(SpotifyPlayerContext)
  if (!ctx) throw new Error('useSpotifyPlayerContext must be used inside SpotifyPlayerProvider')
  return ctx
}
