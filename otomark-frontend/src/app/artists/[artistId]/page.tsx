'use client'

import Link from 'next/link'
import { useArtist } from '@/lib/hooks'
import styles from './page.module.css'

export default function ArtistPage({ params }: { params: { artistId: string } }) {
  const artistId = Number(params.artistId)
  const { data: artist, isLoading } = useArtist(artistId)

  if (isLoading) return <div className={styles.center}>読み込み中...</div>
  if (!artist) return <div className={styles.center}>アーティストが見つかりません</div>

  const albums = artist.albums ?? []

  return (
    <div className={styles.page}>
      {/* ヘッダー */}
      <header className={styles.header}>
        <div className={styles.avatar}>
          {artist.image_url
            ? <img src={artist.image_url} alt={artist.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : <span className={styles.avatarEmoji}>🎤</span>}
        </div>
        <div className={styles.meta}>
          <div className={styles.metaLabel}>Artist</div>
          <h1 className={styles.title}>{artist.name}</h1>
          <div className={styles.subMeta}>
            {artist.country && <span>{artist.country}</span>}
            {artist.albums_count != null && (
              <span>{artist.albums_count} アルバム</span>
            )}
          </div>
          {artist.genres?.length > 0 && (
            <div className={styles.genres}>
              {artist.genres.map(g => (
                <span key={g} className={styles.genre}>{g}</span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ディスコグラフィー */}
      <section className={styles.section}>
        <div className={styles.sectionLabel}>Discography</div>
        <h2 className={styles.sectionTitle}>アルバム</h2>
        {albums.length === 0 ? (
          <div className={styles.empty}>アルバムがまだ登録されていません</div>
        ) : (
          <div className={styles.albumGrid}>
            {albums.map(album => (
              <Link key={album.id} href={`/albums/${album.id}`} className={styles.albumCard}>
                <div className={styles.albumCover}>
                  {album.cover_url
                    ? <img src={album.cover_url} alt={album.title} className={styles.coverImg} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    : <span className={styles.coverEmoji}>💿</span>}
                </div>
                <div className={styles.albumInfo}>
                  <div className={styles.albumTitle}>{album.title}</div>
                  <div className={styles.albumMeta}>
                    {album.release_date && (
                      <span>{album.release_date.slice(0, 4)}</span>
                    )}
                    {album.avg_score && (
                      <span className={styles.albumScore}>{Number(album.avg_score).toFixed(1)} ★</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
