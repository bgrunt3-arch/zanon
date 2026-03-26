'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../orbit.module.css'
import { exchangeCodeForToken, getAccessToken, getSelectedArtists, saveAccessToken, clearAccessToken } from '@/lib/orbit'

const EXCHANGED_CODE_KEY = 'orbit.spotify.exchangedCode'

export default function CallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string>('')

  const goTo = (path: string) => {
    const origin = window.location.origin
    const normalized = path.startsWith('/') ? path : `/${path}`
    const targetUrl = `${origin}${normalized}`

    // OAuth / callback が何らかの理由でフレーム内で開かれると、
    // Next の router での遷移がセキュリティ的にブロックされることがある。
    // その場合は top へ遷移する方が成功しやすい。
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = targetUrl
        return
      }
    } catch {
      // window.top が参照できない/制御できない場合はフォールバックする
    }
    window.location.href = targetUrl
  }

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      goTo('/login')
      return
    }

    // React StrictMode in dev can re-run effects; guard with sessionStorage so we don't
    // exchange the same authorization code twice (Spotify returns 400 on 2nd attempt).
    const alreadyExchanged = sessionStorage.getItem(EXCHANGED_CODE_KEY) === code
    if (alreadyExchanged) {
      // 1回目の交換が終わって access token が保存されている場合のみ遷移する
      const accessToken = getAccessToken()
      if (accessToken) {
        const picks = getSelectedArtists()
        goTo(picks.length === 5 ? '/' : '/onboarding')
      }
      return
    }

    // Mark as "in progress" immediately so StrictMode double-invocation doesn't exchange twice.
    sessionStorage.setItem(EXCHANGED_CODE_KEY, code)

    // 念のため古いトークンを削除してから新しいトークンを取得する
    clearAccessToken()
    exchangeCodeForToken(code)
      .then((token) => {
        saveAccessToken(token)
        const picks = getSelectedArtists()
        goTo(picks.length === 5 ? '/' : '/onboarding')
      })
       .catch((err: any) => {
        sessionStorage.removeItem(EXCHANGED_CODE_KEY)
        // err.message includes Spotify's response body (JSON with error/error_description) when possible
        setError(err?.message || 'Spotify認証に失敗しました。もう一度ログインからやり直してください。')
        // 自動遷移が効かなかった場合でも操作できるようにUIを出す
        setTimeout(() => goTo('/login'), 1200)
      })
  }, [router])

  return (
    <div className={styles.center}>
      <div className={styles.card}>
        {error ? (
          <>
            <h2 className={styles.title}>認証エラー</h2>
            <p className={styles.error}>{error}</p>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className={styles.skeletonBlock} style={{ width: 180, height: 28 }} />
            <div className={styles.skeletonBlock} style={{ width: 220, height: 18 }} />
          </div>
        )}
      </div>
    </div>
  )
}
