'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { queryKeys } from '@/lib/hooks'
import { toast } from '@/lib/toast'
import styles from './ProfileEditModal.module.css'

type Props = {
  open: boolean
  onClose: () => void
  initialDisplayName?: string
  initialBio?: string
}

export function ProfileEditModal({ open, onClose, initialDisplayName = '', initialBio = '' }: Props) {
  const qc = useQueryClient()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [bio, setBio]                 = useState(initialBio)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return
    setLoading(true)
    setError(null)
    try {
      await authApi.updateProfile({ display_name: displayName.trim(), bio: bio.trim() })
      await qc.invalidateQueries({ queryKey: queryKeys.me() })
      toast.success('プロフィールを更新しました')
      onClose()
    } catch {
      setError('更新に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>プロフィール編集</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="display-name">表示名</label>
            <input
              id="display-name"
              className={styles.input}
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={50}
              placeholder="表示名を入力"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="bio">自己紹介</label>
            <textarea
              id="bio"
              className={styles.textarea}
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={4}
              maxLength={300}
              placeholder="自己紹介を入力（任意）"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              キャンセル
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !displayName.trim()}
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
