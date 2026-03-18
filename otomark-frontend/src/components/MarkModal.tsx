'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCreateMark } from '@/lib/hooks'
import { useAuthStore } from '@/lib/store'
import { musicbrainzApi, type MBReleaseResult, type MBArtistResult, type MBRecordingResult } from '@/lib/api'
import styles from './MarkModal.module.css'

type InitialAlbum = { albumId: number; title: string; artist: string; coverUrl?: string | null }
type Props = { open: boolean; onClose: () => void; initialAlbum?: InitialAlbum }
type TargetType = 'album' | 'track' | 'artist'

export function MarkModal({ open, onClose, initialAlbum }: Props) {
  const router = useRouter()
  const qc = useQueryClient()
  const { isLoggedIn } = useAuthStore()
  const createMark = useCreateMark()

  const [type, setType] = useState<TargetType>('album')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selected, setSelected] = useState<MBReleaseResult | MBArtistResult | MBRecordingResult | null>(null)
  const [score, setScore] = useState(0)
  const [review, setReview] = useState('')
  const [hovered, setHovered] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // debounce 500ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 500)
    return () => clearTimeout(t)
  }, [query])

  // MusicBrainz検索
  const mbType = type === 'album' ? 'release' : type === 'track' ? 'recording' : 'artist'
  const { data: searchData, isFetching } = useQuery<(MBReleaseResult | MBArtistResult | MBRecordingResult)[]>({
    queryKey: ['mb-search', mbType, debouncedQuery],
    queryFn: async () => {
      if (mbType === 'release') return musicbrainzApi.searchReleases(debouncedQuery).then(r => r.data.results)
      if (mbType === 'artist') return musicbrainzApi.searchArtists(debouncedQuery).then(r => r.data.results)
      return musicbrainzApi.searchRecordings(debouncedQuery).then(r => r.data.results)
    },
    enabled: debouncedQuery.length >= 2 && !selected,
    staleTime: 1000 * 60,
  })

  // MusicBrainzインポート → マーク作成
  const importMutation = useMutation({
    mutationFn: (mbid: string) => musicbrainzApi.import({ type: mbType, mbid }).then(r => r.data),
  })

  if (!open) return null

  const handleSelect = (item: MBReleaseResult | MBArtistResult | MBRecordingResult) => {
    setSelected(item)
    setShowResults(false)
    setQuery('title' in item ? (item as MBReleaseResult).title : (item as MBArtistResult).name)
  }

  const handleSubmit = async () => {
    if (!isLoggedIn) { router.push('/login'); return }

    try {
      if (initialAlbum) {
        // アルバム詳細から：インポート不要、DB IDを直接使用
        await createMark.mutateAsync({
          album_id: initialAlbum.albumId,
          score:  score > 0 ? score : undefined,
          review: review.trim() || undefined,
        })
        setScore(0); setReview('')
        onClose()
        return
      }

      if (!selected) return
      const imported = await importMutation.mutateAsync(selected.mbid)
      await createMark.mutateAsync({
        album_id:  type === 'album'  ? imported.albumId  : undefined,
        track_id:  type === 'track'  ? imported.trackId  : undefined,
        artist_id: type === 'artist' ? imported.artistId : undefined,
        score:  score > 0 ? score : undefined,
        review: review.trim() || undefined,
      })
      setSelected(null); setQuery(''); setDebouncedQuery(''); setScore(0); setReview('')
      onClose()
    } catch (e) {
      console.error(e)
    }
  }

  const handleTypeChange = (t: TargetType) => {
    setType(t)
    setSelected(null)
    setQuery('')
    setDebouncedQuery('')
  }

  const isPending = importMutation.isPending || createMark.isPending
  const canSubmit = initialAlbum ? true : !!selected
  const results = searchData ?? []

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.title}>🎵 作品をマーク</div>

        {/* initialAlbum が指定された場合はアルバムカードを固定表示 */}
        {initialAlbum ? (
          <div className={styles.group}>
            <div className={styles.selectedCard}>
              <div className={styles.resultCover}>
                {initialAlbum.coverUrl
                  ? <img src={initialAlbum.coverUrl} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : '💿'}
              </div>
              <div className={styles.resultInfo}>
                <div className={styles.resultTitle}>{initialAlbum.title}</div>
                <div className={styles.resultMeta}>{initialAlbum.artist}</div>
              </div>
            </div>
          </div>
        ) : (
          <>
        {/* 種類 */}
        <div className={styles.group}>
          <label className={styles.label}>種類</label>
          <div className={styles.typeRow}>
            {(['album', 'track', 'artist'] as TargetType[]).map(t => (
              <button
                key={t}
                className={`${styles.typeBtn} ${type === t ? styles.typeBtnActive : ''}`}
                onClick={() => handleTypeChange(t)}
              >
                {{ album: 'アルバム', track: '曲', artist: 'アーティスト' }[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 検索 */}
        <div className={styles.group}>
          <label className={styles.label}>検索</label>

          {selected ? (
            // 選択済み表示
            <div className={styles.selectedCard}>
              <div className={styles.resultCover}>
                {'coverUrl' in selected ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(selected as MBReleaseResult).coverUrl}
                    alt=""
                    width={44} height={44}
                    style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : type === 'artist' ? '🎤' : '🎵'}
              </div>
              <div className={styles.resultInfo}>
                <div className={styles.resultTitle}>
                  {'title' in selected ? selected.title : (selected as MBArtistResult).name}
                </div>
                <div className={styles.resultMeta}>
                  {'artist' in selected ? (selected as MBReleaseResult).artist : ''}
                  {'date' in selected && (selected as MBReleaseResult).date ? ` · ${(selected as MBReleaseResult).date?.slice(0, 4)}` : ''}
                </div>
              </div>
              <button className={styles.selectedClear} onClick={() => { setSelected(null); setQuery(''); setDebouncedQuery('') }}>✕</button>
            </div>
          ) : (
            // 検索フィールド
            <div className={styles.searchWrapper}>
              <input
                ref={inputRef}
                className={styles.input}
                value={query}
                onChange={e => { setQuery(e.target.value); setShowResults(true) }}
                onFocus={() => setShowResults(true)}
                placeholder={type === 'album' ? '例：宇宙 日本 世田谷' : type === 'track' ? '例：ナイトフライ' : '例：フィッシュマンズ'}
                autoFocus
              />
              {showResults && query.length >= 2 && (
                <div className={styles.resultList}>
                  {isFetching ? (
                    <div className={styles.searching}>検索中...</div>
                  ) : results.length === 0 ? (
                    <div className={styles.searching}>見つかりませんでした</div>
                  ) : results.map((item: any) => (
                    <div key={item.mbid} className={styles.resultItem} onClick={() => handleSelect(item)}>
                      <div className={styles.resultCover}>
                        {item.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.coverUrl}
                            alt=""
                            width={44} height={44}
                            style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : type === 'artist' ? '🎤' : '🎵'}
                      </div>
                      <div className={styles.resultInfo}>
                        <div className={styles.resultTitle}>{item.title ?? item.name}</div>
                        <div className={styles.resultMeta}>
                          {item.artist ?? item.country ?? ''}
                          {item.date ? ` · ${item.date.slice(0, 4)}` : ''}
                          {item.trackCount ? ` · ${item.trackCount}曲` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
          </>
        )}

        {/* 評価 */}
        <div className={styles.group}>
          <label className={styles.label}>評価</label>
          <div className={styles.stars}>
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                className={`${styles.star} ${n <= (hovered || score) ? styles.starLit : ''}`}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setScore(n === score ? 0 : n)}
              >★</button>
            ))}
            {score > 0 && <span className={styles.scoreLabel}>{score}.0</span>}
          </div>
        </div>

        {/* レビュー */}
        <div className={styles.group}>
          <label className={styles.label}>レビュー（任意）</label>
          <textarea
            className={styles.textarea}
            value={review}
            onChange={e => setReview(e.target.value)}
            placeholder="この作品への感想を書こう..."
            rows={4}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onClose}>キャンセル</button>
          <button
            className={styles.btnSubmit}
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
          >
            {isPending ? <span className="spinner" /> : 'マークする'}
          </button>
        </div>
      </div>
    </div>
  )
}
