'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import styles from '../auth.module.css'

export default function RegisterPage() {
  const router  = useRouter()
  const { login } = useAuthStore()

  const [form, setForm] = useState({
    username:     '',
    email:        '',
    password:     '',
    display_name: '',
  })
  const [error, setError] = useState('')

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () => authApi.register(form),
    onSuccess: ({ data }) => {
      login(data.token, data.user)
      router.push('/')
    },
    onError: (err: any) => {
      setError(err.response?.data?.error ?? '登録に失敗しました')
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
          ZanoN
        </div>
        <h1 className={styles.title}>新規登録</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.group}>
            <label className={styles.label}>表示名</label>
            <input
              className={styles.input}
              type="text"
              value={form.display_name}
              onChange={set('display_name')}
              placeholder="田中 音太"
              required
            />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>ユーザー名</label>
            <div className={styles.inputPrefix}>
              <span className={styles.prefix}>@</span>
              <input
                className={`${styles.input} ${styles.inputWithPrefix}`}
                type="text"
                value={form.username}
                onChange={set('username')}
                placeholder="tanaka_oto"
                pattern="[a-zA-Z0-9_]+"
                required
              />
            </div>
            <div className={styles.hint}>英数字とアンダースコアのみ</div>
          </div>

          <div className={styles.group}>
            <label className={styles.label}>メールアドレス</label>
            <input
              className={styles.input}
              type="email"
              value={form.email}
              onChange={set('email')}
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
              value={form.password}
              onChange={set('password')}
              placeholder="8文字以上"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={styles.btnSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <span className="spinner" /> : '登録する'}
          </button>
        </form>

        <p className={styles.footer}>
          すでにアカウントをお持ちの方は{' '}
          <Link href="/login" className={styles.link}>ログイン</Link>
        </p>
      </div>
    </div>
  )
}