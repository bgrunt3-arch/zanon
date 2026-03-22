'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { authApi } from '@/lib/api'
import styles from './page.module.css'

const NOTIF_KEY = 'orbit-notif-settings'

type NotifSettings = {
  likes: boolean
  follows: boolean
  new_reviews: boolean
}

function loadNotifSettings(): NotifSettings {
  if (typeof window === 'undefined') return { likes: true, follows: true, new_reviews: true }
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    return raw ? JSON.parse(raw) : { likes: true, follows: true, new_reviews: true }
  } catch {
    return { likes: true, follows: true, new_reviews: true }
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const { isLoggedIn, logout } = useAuthStore()
  const [notif, setNotif] = useState<NotifSettings>({ likes: true, follows: true, new_reviews: true })
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) { router.replace('/login'); return }
    setNotif(loadNotifSettings())
  }, [isLoggedIn, router])

  const toggleNotif = (key: keyof NotifSettings) => {
    const next = { ...notif, [key]: !notif[key] }
    setNotif(next)
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next))
  }

  const handleLogout = () => {
    logout()
    router.replace('/login')
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await authApi.deleteAccount()
      logout()
      router.replace('/')
    } catch {
      setDeleting(false)
    }
  }

  if (!isLoggedIn) return null

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>設定</h1>

      {/* 通知設定 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>通知設定</h2>
        <div className={styles.card}>
          {([
            { key: 'likes',       label: 'いいね通知',         desc: '自分のレビューにいいねされたとき' },
            { key: 'follows',     label: 'フォロー通知',       desc: '新しいフォロワーが増えたとき' },
            { key: 'new_reviews', label: '新着レビュー通知',   desc: 'フォロー中のユーザーが投稿したとき' },
          ] as { key: keyof NotifSettings; label: string; desc: string }[]).map(({ key, label, desc }) => (
            <div key={key} className={styles.row}>
              <div>
                <div className={styles.rowLabel}>{label}</div>
                <div className={styles.rowDesc}>{desc}</div>
              </div>
              <button
                className={`${styles.toggle} ${notif[key] ? styles.toggleOn : ''}`}
                onClick={() => toggleNotif(key)}
                aria-checked={notif[key]}
                role="switch"
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* アカウント */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>アカウント</h2>
        <div className={styles.card}>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>ログアウト</div>
              <div className={styles.rowDesc}>このデバイスからログアウトします</div>
            </div>
            <button className={styles.btnLogout} onClick={handleLogout}>
              ログアウト
            </button>
          </div>
        </div>
      </section>

      {/* 危険ゾーン */}
      <section className={styles.section}>
        <h2 className={`${styles.sectionTitle} ${styles.danger}`}>危険ゾーン</h2>
        <div className={`${styles.card} ${styles.dangerCard}`}>
          <div className={styles.row}>
            <div>
              <div className={styles.rowLabel}>アカウントを削除</div>
              <div className={styles.rowDesc}>すべてのデータが完全に削除されます。この操作は取り消せません。</div>
            </div>
            <button className={styles.btnDelete} onClick={() => setDeleteConfirm(true)}>
              削除
            </button>
          </div>
        </div>
      </section>

      {/* 削除確認ダイアログ */}
      {deleteConfirm && (
        <div className={styles.overlay} onClick={() => setDeleteConfirm(false)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <h3 className={styles.dialogTitle}>本当に削除しますか？</h3>
            <p className={styles.dialogDesc}>
              アカウントと、マーク・レビューを含むすべてのデータが完全に削除されます。<br />
              この操作は取り消せません。
            </p>
            <div className={styles.dialogActions}>
              <button className={styles.btnCancel} onClick={() => setDeleteConfirm(false)}>
                キャンセル
              </button>
              <button className={styles.btnDeleteConfirm} onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
