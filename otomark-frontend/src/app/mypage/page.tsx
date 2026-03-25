'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from '../orbit.module.css'
import {
  clearAccessToken,
  fetchMe,
  getAccessToken,
  getSelectedArtists,
  type SpotifyArtist,
  type SpotifyMe,
} from '@/lib/orbit'

export default function MyPage() {
  const router = useRouter()
  const [me, setMe] = useState<SpotifyMe | null>(null)
  const [picks, setPicks] = useState<SpotifyArtist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      setLoading(false)
      router.replace('/login')
      return
    }

    const selected = getSelectedArtists()
    setPicks(selected)
    if (selected.length !== 5) {
      setLoading(false)
      router.replace('/onboarding')
      return
    }

    setLoading(true)
    setError('')

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return
      setError('読み込みに時間がかかっています。少し待ってから再度お試しください。')
      setLoading(false)
    }, 15_000)

    fetchMe(token)
      .then((data) => {
        if (cancelled) return
        setMe(data)
      })
      .catch((e: any) => {
        if (cancelled) return
        const message = e?.message ?? ''
        const isTokenExpired =
          /access token expired/i.test(message) ||
          message.includes('(me) 401') ||
          message.includes('status: 401') ||
          /status["']\s*:\s*401/i.test(message) ||
          /"status"\s*:\s*401/i.test(message)

        if (isTokenExpired) {
          setError('')
          setLoading(false)
          cancelled = true
          window.clearTimeout(timeoutId)
          relogin()
          return
        }
        setError(e?.message ?? 'Spotifyユーザー情報の取得に失敗しました。再ログインしてください。')
      })
      .finally(() => {
        if (cancelled) return
        window.clearTimeout(timeoutId)
        setLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [router])

  const relogin = () => {
    clearAccessToken()
    router.push('/login')
  }

  const goReplace = () => {
    router.push('/onboarding')
  }

  return (
    <div className={styles.screen} data-nav-scroll>
      <div className={styles.shell}>
        <h1 className={styles.title}>マイページ</h1>

        <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {loading ? (
              <>
                <div className={styles.skeletonBlock} style={{ width: 'var(--avatar-md)', height: 'var(--avatar-md)', borderRadius: '50%', flexShrink: 0 }} />
                <div>
                  <div className={`${styles.skeletonBlock}`} style={{ width: 80, height: 12, marginBottom: 8 }} />
                  <div className={`${styles.skeletonBlock}`} style={{ width: 120, height: 20 }} />
                </div>
              </>
            ) : (
              <>
                {me?.images?.[0]?.url ? (
                  <img src={me.images[0].url} alt={me.display_name || 'ユーザー'} className={styles.avatar} />
                ) : (
                  <div className={styles.avatarFallback}>
                    {(me?.display_name || 'ユーザー').slice(0, 2)}
                  </div>
                )}
                <div>
                  <p className={styles.meta} style={{ marginBottom: 4 }}>
                    Spotifyユーザー
                  </p>
                  <p style={{ fontWeight: 800, fontSize: 'var(--font-lg)' }}>
                    {me?.display_name || 'ユーザー'}
                  </p>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push('/')}
            aria-label="閉じる"
            style={{ background: 'none', border: 'none', color: '#adc2d8', fontSize: 22, cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
          >✕</button>
        </div>

        {error && (
          <div style={{ marginTop: 8 }}>
            <p className={styles.error}>{error}</p>
            <div className={styles.row} style={{ marginTop: 10 }}>
              <button type="button" className={styles.ghostButton} onClick={relogin}>
                再ログイン
              </button>
            </div>
          </div>
        )}

        <h2 className={styles.title} style={{ fontSize: 22, marginTop: 18, marginBottom: 8 }}>
          現在選んでいる5人
        </h2>
        <p className={styles.meta} style={{ marginBottom: 12 }}>
          この5人はいつでも入れ替えできます。
        </p>

        {loading ? (
          <div className={styles.grid}>
            {Array.from({ length: 5 }).map((_, i) => (
              <article key={`skeleton-${i}`} className={styles.artistCard}>
                <div className={styles.skeletonBlock} style={{ width: '100%', aspectRatio: '1 / 1', marginBottom: 8, borderRadius: 10 }} />
                <div className={styles.skeletonBlock} style={{ height: 14, width: '80%', marginBottom: 8 }} />
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {picks.map((artist) => (
              <Link key={artist.id} href={`/artists/${artist.id}`} className={styles.artistCard}>
                {artist.images?.[0]?.url ? (
                  <img src={artist.images[0].url} alt={artist.name} className={styles.artistImage} />
                ) : (
                  <div
                    className={styles.avatarFallback}
                    style={{ width: '100%', aspectRatio: '1 / 1', marginBottom: 8 }}
                  >
                    {artist.name.slice(0, 2)}
                  </div>
                )}
                <p className={styles.artistName}>{artist.name}</p>
              </Link>
            ))}
          </div>
        )}

        <div className={styles.row}>
          <button type="button" className={styles.button} onClick={goReplace} disabled={loading}>
            アーティストを入れ替える
          </button>
        </div>


        <div className={styles.row} style={{ marginTop: 16 }}>
          <button type="button" className={styles.ghostButton} onClick={relogin} disabled={loading}>
            ログアウト
          </button>
        </div>
      </div>
    </div>
  )
}

