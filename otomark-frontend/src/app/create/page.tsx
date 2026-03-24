'use client'

import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../orbit.module.css'
import { saveLocalPlaylist, compressImageFile } from '@/lib/localPlaylist'

function CreateContent() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await compressImageFile(file)
      setCoverUrl(dataUrl)
    } catch {
      // ignore
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const id = crypto.randomUUID()
    saveLocalPlaylist({
      id,
      name: trimmed,
      description: description.trim(),
      coverUrl,
      createdAt: new Date().toISOString(),
      tracks: [],
    })

    router.push(`/search?playlistId=${id}`)
  }

  return (
    <div className={styles.screen} data-nav-scroll>
      <div className={styles.shell}>
        <div className={styles.sectionHeader} style={{ marginBottom: 24 }}>
          <h1 className={styles.spotifyNavTitle}>作成する</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* カバー画像 */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 120, height: 120, borderRadius: 10,
                background: coverUrl ? 'transparent' : '#2a2a2a',
                border: '2px dashed rgba(255,255,255,0.2)',
                cursor: 'pointer', overflow: 'hidden', padding: 0, position: 'relative', flexShrink: 0,
              }}
            >
              {coverUrl ? (
                <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 32, color: 'rgba(255,255,255,0.3)' }}>🎵</span>
              )}
              <span style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: coverUrl ? 'rgba(0,0,0,0.4)' : 'transparent',
                color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                opacity: coverUrl ? 0 : 1,
                transition: 'opacity 0.15s',
              }}
                className="cover-label"
              >
                {coverUrl ? '変更' : '画像を選択'}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleCoverChange}
            />
          </div>

          {/* プレイリスト名 */}
          <div>
            <label htmlFor="playlist-name" className={styles.meta} style={{ display: 'block', marginBottom: 8 }}>
              プレイリスト名 <span style={{ color: '#ff8c8c' }}>*</span>
            </label>
            <input
              id="playlist-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="プレイリスト名を入力"
              maxLength={100}
              required
              className={styles.spotifyNavSearch}
              style={{ width: '100%', color: '#fff', border: 'none', outline: 'none', fontSize: 16 }}
            />
          </div>

          {/* 説明文 */}
          <div>
            <label htmlFor="playlist-desc" className={styles.meta} style={{ display: 'block', marginBottom: 8 }}>
              説明文（任意）
            </label>
            <textarea
              id="playlist-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="プレイリストの説明を入力"
              maxLength={300}
              rows={3}
              className={styles.spotifyNavSearch}
              style={{
                width: '100%',
                color: '#fff',
                border: 'none',
                outline: 'none',
                fontSize: 15,
                resize: 'none',
                borderRadius: 12,
                lineHeight: 1.6,
              }}
            />
          </div>

          {/* 公開/非公開トグル */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className={styles.meta} style={{ marginBottom: 0 }}>公開</span>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              onClick={() => setIsPublic((v) => !v)}
              style={{
                width: 52,
                height: 30,
                borderRadius: 15,
                border: 'none',
                background: isPublic ? '#1db954' : '#3a3a3a',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: isPublic ? 25 : 3,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              />
            </button>
          </div>

          {/* 送信ボタン */}
          <button
            type="submit"
            className={styles.button}
            disabled={!name.trim()}
            style={{
              width: '100%',
              opacity: !name.trim() ? 0.5 : 1,
              cursor: !name.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            作成する
          </button>
        </form>
      </div>
    </div>
  )
}

export default dynamic(() => Promise.resolve(CreateContent), { ssr: false })
