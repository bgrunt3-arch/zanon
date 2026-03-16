'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { MarkModal } from './MarkModal'
import styles from './Nav.module.css'

export function Nav() {
  const pathname    = usePathname()
  const { isLoggedIn, user, logout } = useAuthStore()
  const [modalOpen, setModalOpen] = useState(false)

  const tabs = [
    { href: '/',         label: 'ホーム' },
    { href: '/ranking',  label: 'ランキング' },
    { href: '/mypage',   label: 'マイページ' },
  ]

  return (
    <>
      <nav className={styles.nav}>
        {/* ロゴ */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoDot} />
          Otomark
        </Link>

        {/* タブナビ */}
        <div className={styles.tabs}>
          {tabs.map(t => (
            <Link
              key={t.href}
              href={t.href}
              className={`${styles.tab} ${pathname === t.href ? styles.active : ''}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* 右側 */}
        <div className={styles.right}>
          {isLoggedIn ? (
            <>
              <button className={styles.btnPost} onClick={() => setModalOpen(true)}>
                ＋ マーク
              </button>
              <div className={styles.avatarMenu}>
                <div className={styles.avatar}>
                  {user?.display_name?.[0] ?? '?'}
                </div>
                <div className={styles.dropdown}>
                  <Link href="/mypage" className={styles.dropItem}>マイページ</Link>
                  <button className={styles.dropItem} onClick={logout}>ログアウト</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.btnOutline}>ログイン</Link>
              <Link href="/register" className={styles.btnPost}>新規登録</Link>
            </>
          )}
        </div>
      </nav>

      <MarkModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}