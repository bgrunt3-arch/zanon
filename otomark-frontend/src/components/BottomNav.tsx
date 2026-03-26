'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from '../app/orbit.module.css'
import { useAlbumModalContext } from '@/contexts/AlbumModalContext'

const HomeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H15v-6h-6v6H4a1 1 0 0 1-1-1V10.5z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
)

const SearchIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

// Spotify の「マイライブラリ」アイコン: 重なった2枚のカード型
const LibraryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
    {/* 後ろのカード */}
    <rect x="4" y="5" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    {/* 前のカード（右にずらして重ねる） */}
    <rect x="10" y="5" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    {/* 内側の横線（ライブラリらしさ） */}
    <path d="M12.5 9h5M12.5 12h5M12.5 15h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)

const CreateIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

const NAV_ITEMS = [
  { href: '/',        label: 'ホーム',        Icon: HomeIcon    },
  { href: '/search',  label: '検索',          Icon: SearchIcon  },
  { href: '/library', label: 'ライブラリ', Icon: LibraryIcon },
  { href: '/create',  label: '作成する',       Icon: CreateIcon  },
]

export function BottomNav() {
  const pathname = usePathname()
  const hide = pathname === '/login' || pathname === '/callback' || pathname === '/onboarding'
  const { isOpen, closeModal } = useAlbumModalContext()

  return (
    <nav className={styles.bottomNav} aria-label="メインメニュー" style={hide ? { display: 'none' } : undefined}>
      <div className={styles.bottomNavDock}>
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.bottomNavLink} ${active ? styles.bottomNavLinkActive : ''}`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={isOpen ? closeModal : undefined}
            >
              <span className={styles.bottomNavIcon}><Icon /></span>
              <span className={styles.bottomNavLabel}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
