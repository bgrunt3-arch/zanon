'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from '../app/orbit.module.css'

const HomeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const SearchIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export function BottomNav() {
  const pathname = usePathname()
  const hide = pathname === '/login' || pathname === '/callback' || pathname === '/onboarding'

  return (
    <nav className={styles.bottomNav} aria-label="メインメニュー" style={hide ? { display: 'none' } : undefined}>
      <div className={styles.bottomNavDock}>
        <Link
          href="/"
          className={`${styles.bottomNavLink} ${pathname === '/' ? styles.bottomNavLinkActive : ''}`}
          aria-label="ホーム"
          aria-current={pathname === '/' ? 'page' : undefined}
        >
          <span className={styles.bottomNavIcon}>
            <HomeIcon />
          </span>
        </Link>
        <Link
          href="/search"
          className={`${styles.bottomNavLink} ${pathname === '/search' ? styles.bottomNavLinkActive : ''}`}
          aria-label="検索"
          aria-current={pathname === '/search' ? 'page' : undefined}
        >
          <span className={styles.bottomNavIcon}>
            <SearchIcon />
          </span>
        </Link>
        <Link
          href="/mypage"
          className={`${styles.bottomNavLink} ${pathname === '/mypage' ? styles.bottomNavLinkActive : ''}`}
          aria-label="マイページ"
          aria-current={pathname === '/mypage' ? 'page' : undefined}
        >
          <span className={styles.bottomNavIcon}>
            <UserIcon />
          </span>
        </Link>
      </div>
    </nav>
  )
}
