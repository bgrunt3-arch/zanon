'use client'

import { useState } from 'react'
import styles from '../orbit.module.css'
import { getSpotifyAuthorizeUrl } from '@/lib/orbit'

export default function LoginPage() {
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setError('')
    try {
      const authorizeUrl = await getSpotifyAuthorizeUrl()
      window.location.href = authorizeUrl
    } catch {
      setError('Spotifyログインの開始に失敗しました。再試行してください。')
    }
  }

  return (
    <div className={styles.center}>
      <div className={styles.card}>
        <h1 className={styles.logo}>
          Orbit
        </h1>
        <p className={styles.subtitle}>推し5人のタイムラインを、Spotifyから始めよう。</p>
        <button className={styles.button} type="button" onClick={handleLogin}>
          Spotifyでログイン
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  )
}