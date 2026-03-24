'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { BottomNav } from './BottomNav'
import { MiniPlayer } from './MiniPlayer'
import { AlbumModal } from './AlbumModal'
import { SpotifyPlayerProvider } from '@/contexts/SpotifyPlayerContext'
import { AlbumModalProvider } from '@/contexts/AlbumModalContext'

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideNav = pathname === '/login' || pathname === '/callback' || pathname === '/onboarding'
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <SpotifyPlayerProvider>
      <AlbumModalProvider>
        <div className={`mainWithNav${hideNav ? ' mainWithNavNoBottom' : ''}`}>
          <main>{children}</main>
          {!hideNav && <MiniPlayer />}
        </div>
        {mounted && createPortal(
          <div className={`bottomNavWrapper${hideNav ? ' navPageHidden' : ''}`}>
            <BottomNav />
          </div>,
          document.body,
        )}
        <AlbumModal />
      </AlbumModalProvider>
    </SpotifyPlayerProvider>
  )
}
