'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import styles from '../auth.module.css'

export default function LoginPage() {
  const router  = useRouter()
  const { login } = useAuthStore()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')

  const mutation = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: ({ data }) => {
      login(data.token, data.user)
      router.push('/')
    },
    onError: (err: any) => {
      setError(err.response?.data?.error ?? 'ログインに失敗しました')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    mutation.mutate()
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoDot} />
          Orbit
        </div>
        <h1 className={styles.title}>ログイン</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.group}>
            <label className={styles.label}>メールアドレス</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>パスワード</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={styles.btnSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <span className="spinner" /> : 'ログイン'}
          </button>
        </form>

        <p className={styles.footer}>
          アカウントをお持ちでない方は{' '}
          <Link href="/register" className={styles.link}>新規登録</Link>
        </p>
      </div>
    </div>
  )
}