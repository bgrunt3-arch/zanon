'use client'

import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { queryKeys } from '@/lib/hooks'
import { useAuthStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import styles from './ProfileEditModal.module.css'

type Props = {
  open: boolean
  onClose: () => void
  initialDisplayName?: string
  initialBio?: string
  initialAvatarUrl?: string | null
}

/** 画像ファイルを Canvas でリサイズして base64 data URL に変換 */
function resizeImage(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > height) {
        if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize }
      } else {
        if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = objectUrl
  })
}

export function ProfileEditModal({ open, onClose, initialDisplayName = '', initialBio = '', initialAvatarUrl }: Props) {
  const qc = useQueryClient()
  const { user, setUser } = useAuthStore()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [bio, setBio]                 = useState(initialBio)
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(initialAvatarUrl ?? null)
  const [avatarChanged, setAvatarChanged] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('画像ファイルを選択してください'); return }
    try {
      const resized = await resizeImage(file)
      setAvatarUrl(resized)
      setAvatarChanged(true)
      setError(null)
    } catch {
      setError('画像の処理に失敗しました')
    }
    // 同ファイルを再選択できるようリセット
    e.target.value = ''
  }

  const handleRemoveAvatar = () => {
    setAvatarUrl(null)
    setAvatarChanged(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const payload: { display_name: string; bio: string; avatar_url?: string | null } = {
        display_name: displayName.trim(),
        bio: bio.trim(),
      }
      if (avatarChanged) payload.avatar_url = avatarUrl

      const res = await authApi.updateProfile(payload)
      // Zustand ストアを最新データで更新（Nav のアバターに即時反映）
      if (user) setUser({ ...user, ...res.data })
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
          {/* アバター */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarPreview} onClick={handleAvatarClick} title="クリックして画像を変更">
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className={styles.avatarImg} />
                : <span className={styles.avatarInitial}>{displayName?.[0] ?? '?'}</span>
              }
              <div className={styles.avatarOverlay}>変更</div>
            </div>
            <div className={styles.avatarActions}>
              <button type="button" className={styles.avatarUploadBtn} onClick={handleAvatarClick}>
                画像をアップロード
              </button>
              {avatarUrl && (
                <button type="button" className={styles.avatarRemoveBtn} onClick={handleRemoveAvatar}>
                  削除
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

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
