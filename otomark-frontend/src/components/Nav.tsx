'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { useNotifications, useReadAllNotifications } from '@/lib/hooks'
import { MarkModal } from './MarkModal'
import styles from './Nav.module.css'

function NotificationBell() {
  const { isLoggedIn } = useAuthStore()
  const [open, setOpen] = useState(false)
  const { data } = useNotifications(isLoggedIn)
  const readAll  = useReadAllNotifications()

  const notifications = data?.notifications ?? []
  const unreadCount   = data?.unread_count ?? 0

  if (!isLoggedIn) return null

  const handleReadAll = () => {
    readAll.mutate()
  }

  const notifLabel = (n: { type: string; actor_display_name: string; review_body: string | null }) => {
    if (n.type === 'like')    return `${n.actor_display_name} があなたのレビューにいいねしました`
    if (n.type === 'comment') return `${n.actor_display_name} があなたのレビューにコメントしました`
    if (n.type === 'follow')  return `${n.actor_display_name} があなたをフォローしました`
    return `${n.actor_display_name} からの通知`
  }

  return (
    <div className={styles.bellWrap}>
      <button
        className={styles.bellBtn}
        onClick={() => setOpen(prev => !prev)}
        aria-label={`通知 ${unreadCount > 0 ? `(${unreadCount}件未読)` : ''}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.notifDropdown}>
          <div className={styles.notifHeader}>
            <span className={styles.notifTitle}>通知</span>
            {unreadCount > 0 && (
              <button
                className={styles.readAllBtn}
                onClick={handleReadAll}
                disabled={readAll.isPending}
              >
                すべて既読
              </button>
            )}
          </div>
          <div className={styles.notifList}>
            {notifications.length === 0 ? (
              <div className={styles.notifEmpty}>通知はありません</div>
            ) : (
              notifications.slice(0, 20).map(n => (
                <div
                  key={n.id}
                  className={`${styles.notifItem} ${!n.is_read ? styles.notifUnread : ''}`}
                >
                  <div className={styles.notifText}>{notifLabel(n)}</div>
                  {n.review_body && (
                    <div className={styles.notifSub}>
                      {n.review_body.slice(0, 60)}{n.review_body.length > 60 ? '...' : ''}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SupportButton() {
  const [loading, setLoading] = useState(false)

  const handleSupport = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/payment/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      className={styles.btnSupport}
      onClick={handleSupport}
      disabled={loading}
    >
      {loading ? '...' : '☕ 500円でサポート'}
    </button>
  )
}

export function Nav() {
  const pathname    = usePathname()
  const { isLoggedIn, user, logout } = useAuthStore()
  const [modalOpen, setModalOpen] = useState(false)

  const tabs = [
    { href: '/',        label: 'ホーム' },
    { href: '/ranking', label: 'ランキング' },
    { href: '/search',  label: '検索' },
  ]

  return (
    <>
      <nav className={styles.nav}>
        {/* ロゴ */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoDot} />
          ZanoN
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
          <SupportButton />
          {isLoggedIn ? (
            <>
              <NotificationBell />
              <button className={styles.btnPost} onClick={() => setModalOpen(true)}>
                ＋ マーク
              </button>
              <div className={styles.avatarMenu}>
                <div className={styles.avatar}>
                  {user?.display_name?.[0] ?? '?'}
                </div>
                <div className={styles.dropdown}>
                  <Link href="/mypage" className={styles.dropItem}>マイページ</Link>
                  <Link href="/saved" className={styles.dropItem}>保存済み</Link>
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
