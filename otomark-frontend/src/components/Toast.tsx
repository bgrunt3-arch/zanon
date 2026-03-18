'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { subscribeToast, type ToastEvent, type ToastType } from '@/lib/toast'
import styles from './Toast.module.css'

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
}

type ToastItem = ToastEvent & { leaving: boolean }

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    return subscribeToast((event) => {
      const item: ToastItem = { ...event, leaving: false }
      setToasts(prev => [...prev, item])

      // Auto-dismiss after 3 s
      setTimeout(() => {
        setToasts(prev =>
          prev.map(t => t.id === item.id ? { ...t, leaving: true } : t)
        )
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== item.id))
        }, 200)
      }, 3000)
    })
  }, [])

  const dismiss = (id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 200)
  }

  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[t.type]} ${t.leaving ? styles.leaving : ''}`}
        >
          <span className={styles.icon}>{ICONS[t.type]}</span>
          {t.href ? (
            <Link href={t.href} className={`${styles.message} ${styles.messageLink}`} onClick={() => dismiss(t.id)}>
              {t.message}
            </Link>
          ) : (
            <span className={styles.message}>{t.message}</span>
          )}
          <button className={styles.close} onClick={() => dismiss(t.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
