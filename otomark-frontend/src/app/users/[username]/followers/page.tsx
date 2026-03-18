'use client'

import Link from 'next/link'
import { useFollowers } from '@/lib/hooks'
import styles from './page.module.css'

export default function FollowersPage({ params }: { params: { username: string } }) {
  const { username } = params
  const { data: users = [], isLoading } = useFollowers(username)

  return (
    <div className={styles.page}>
      <div className={styles.back}>
        <Link href={`/users/${username}`} className={styles.backLink}>← @{username}</Link>
      </div>
      <h1 className={styles.title}>フォロワー</h1>

      {isLoading ? (
        <div className={styles.center}><div className="spinner" /></div>
      ) : users.length === 0 ? (
        <div className={styles.empty}>フォロワーはまだいません</div>
      ) : (
        <div className={styles.list}>
          {users.map(u => (
            <Link key={u.id} href={`/users/${u.username}`} className={styles.userCard}>
              <div className={styles.avatar}>
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" className={styles.avatarImg} />
                  : (u.display_name?.[0] ?? '?')}
              </div>
              <div>
                <div className={styles.displayName}>{u.display_name}</div>
                <div className={styles.handle}>@{u.username}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
