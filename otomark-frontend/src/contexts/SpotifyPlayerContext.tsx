'use client'

import { createContext, useContext } from 'react'
import { useSpotifyPlayer, type SpotifyPlayerState, type SpotifyPlayerControls } from '@/hooks/useSpotifyPlayer'

type SpotifyPlayerContextValue = SpotifyPlayerState & SpotifyPlayerControls

const SpotifyPlayerContext = createContext<SpotifyPlayerContextValue | null>(null)

export function SpotifyPlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useSpotifyPlayer()
  const value = player
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
