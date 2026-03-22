'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { useWantList, useRemoveWant } from '@/lib/hooks'
import type { WantItem } from '@/lib/api'
import styles from './page.module.css'

function WantCard({ item }: { item: WantItem }) {
  const remove = useRemoveWant()

  const cover = item.album_cover
  const title = item.album_title ?? item.track_title ?? item.artist_name ?? '不明'
  const sub   = item.album_title ? item.artist_name : item.album_title ?? null
  const href  = item.album_id
    ? `/albums/${item.album_id}`
    : item.artist_id
      ? `/artists/${item.artist_id}`
      : null

  return (
    <div className={styles.card}>
      {href ? (
        <Link href={href} className={styles.cover}>
          {cover
            ? <img src={cover} alt={title} className={styles.coverImg} />
            : <span className={styles.coverPlaceholder}>🎵</span>}
        </Link>
      ) : (
        <div className={styles.cover}>
          <span className={styles.coverPlaceholder}>🎵</span>
        </div>
      )}
      <div className={styles.info}>
        {href ? (
          <Link href={href} className={styles.title}>{title}</Link>
        ) : (
          <span className={styles.title}>{title}</span>
        )}
        {sub && <div className={styles.sub}>{sub}</div>}
        {item.track_title && <div className={styles.badge}>曲</div>}
        {item.album_title && !item.track_title && <div className={styles.badge}>アルバム</div>}
        {item.artist_name && !item.album_title && !item.track_title && <div className={styles.badge}>アーティスト</div>}
      </div>
      <button
        className={styles.removeBtn}
        onClick={() => remove.mutate(item.id)}
        disabled={remove.isPending}
        aria-label="リストから削除"
      >
        ✕
      </button>
    </div>
  )
}

export default function WantPage() {
  const router = useRouter()
  const { isLoggedIn } = useAuthStore()
  const { data: items = [], isLoading } = useWantList()

  useEffect(() => {
    if (!isLoggedIn) router.push('/login')
  }, [isLoggedIn, router])

  if (!isLoggedIn) return null

  return (
    <div className={styles.page}>
      <div className={styles.sectionLabel}>聴きたいリスト</div>
      <h1 className={styles.pageTitle}>聴きたいリスト</h1>

      {isLoading ? (
        <div className={styles.center}><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          聴きたいリストはまだありません。<br />
          アルバム・曲・アーティストのページから追加できます。
        </div>
      ) : (
        <div className={styles.list}>
          {items.map(item => <WantCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}
