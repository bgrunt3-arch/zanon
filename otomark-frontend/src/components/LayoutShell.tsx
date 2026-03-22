'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BottomNav } from './BottomNav'

const SCROLL_THRESHOLD = 8

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [navHidden, setNavHidden] = useState(false)
  const lastScrollTop = useRef(0)
  const ticking = useRef(false)
  const scrollContainer = useRef<HTMLElement | null>(null)

  const findScrollContainer = useCallback(() => {
    const el = document.querySelector<HTMLElement>('[data-nav-scroll]')
    if (el && el !== scrollContainer.current) {
      scrollContainer.current?.removeEventListener('scroll', handleScroll)
      scrollContainer.current = el
      lastScrollTop.current = el.scrollTop
      el.addEventListener('scroll', handleScroll, { passive: true })
    }
    return el
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollContainer.current
    if (!el || ticking.current) return

    ticking.current = true
    requestAnimationFrame(() => {
      if (!el) {
        ticking.current = false
        return
      }
      const scrollTop = el.scrollTop
      const delta = scrollTop - lastScrollTop.current

      if (scrollTop < SCROLL_THRESHOLD) {
        setNavHidden(false)
      } else if (Math.abs(delta) > SCROLL_THRESHOLD) {
        setNavHidden(delta > 0)
      }
      lastScrollTop.current = scrollTop
      ticking.current = false
    })
  }, [])

  useEffect(() => {
    if (pathname === '/login' || pathname === '/callback' || pathname === '/onboarding') {
      scrollContainer.current?.removeEventListener('scroll', handleScroll)
      scrollContainer.current = null
      return
    }
    const timer = setTimeout(findScrollContainer, 100)
    return () => {
      clearTimeout(timer)
      scrollContainer.current?.removeEventListener('scroll', handleScroll)
      scrollContainer.current = null
    }
  }, [pathname, findScrollContainer, handleScroll])

  const hideNav = pathname === '/login' || pathname === '/callback' || pathname === '/onboarding'

  return (
    <div className={`mainWithNav${hideNav ? ' mainWithNavNoBottom' : ''}`}>
      <main>{children}</main>
      <div
        className={`bottomNavWrapper${hideNav ? ' navPageHidden' : ''}${!hideNav && navHidden ? ' hidden' : ''}`}
      >
        <BottomNav />
      </div>
    </div>
  )
}
