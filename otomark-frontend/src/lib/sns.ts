/**
 * SNS取得サービス層
 * MusicBrainz / X API 等の将来実装を見据えた抽象化
 */

import { getArtistLatestPost, getRecentSnsPosts } from './mockData'

/** MusicBrainz から取得するアーティスト情報（ID, SNSリンク等） */
export type MusicBrainzArtist = {
  mbid: string
  name: string
  /** 公式サイト、SNS等のURL一覧。例: { type: 'social network', url: 'https://twitter.com/...' } */
  urlRelations: Array<{
    type: string
    typeId: string
    url: string
  }>
}

/** 対応SNSプラットフォーム。MusicBrainz の social network / youtube / video channel から取得 */
export type SnsPlatform = 'x' | 'instagram' | 'youtube'

export type ArtistSnsPost = {
  artistId: string
  artistName: string
  handle: string
  avatarUrl: string | null
  content: string
  postedAt: string
  /** 投稿元プラットフォーム。未指定時は 'x' */
  platform?: SnsPlatform
  /** 元投稿へのリンク（任意） */
  url?: string | null
}

function isMockMode(): boolean {
  const byEnv = (process.env.NEXT_PUBLIC_MOCK_MODE ?? '').toLowerCase() === 'true'
  if (byEnv) return true
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('orbit.mockMode') === '1'
  } catch {
    return false
  }
}

/**
 * アーティストの最新SNS投稿を取得する。
 * UIは常にこのインターフェース経由で取得し、データソースを意識しない。
 */
export async function fetchLatestSnsPost(artistId: string): Promise<ArtistSnsPost | null> {
  if (isMockMode()) {
    return getArtistLatestPost(artistId)
  }

  // === MusicBrainz + 各SNS API（将来実装） ===
  // 1. artistId (Spotify ID) → MusicBrainz MBID（バックエンド /api/artists/:spotifyId/mbid）
  // 2. MusicBrainz: GET /ws/2/artist/{mbid}?inc=url-rels
  //    - social network: twitter.com, instagram.com, facebook.com 等
  //    - youtube: 公式YouTubeチャンネル
  //    - video channel: その他動画サイト
  // 3. URL から各プラットフォームの handle/channelId を抽出
  // 4. 各APIで投稿取得:
  //    - X API v2: users/:id/tweets, max_results=100
  //    - Instagram Graph API: /{user-id}/media (Business/Creator 要)
  //    - YouTube Data API v3: activities.list(channelId), maxResults=50
  // 5. ArtistSnsPost 形式に変換（platform, url 付き）して return
  return null
}

/** X API v2: 1リクエストあたり最大100件。5人×100=500が上限 */
export const SNS_POSTS_LIMIT_TOTAL = 500
/** 1アーティストあたりの取得上限（X API max_results） */
export const SNS_POSTS_LIMIT_PER_ARTIST = 100

/** アーティスト情報（名前はモックフォールバック用） */
export type ArtistInfo = { id: string; name: string }

/** MusicBrainz から取得した SNS URL マップ（platform → URL） */
export type ArtistSnsUrls = Record<string, string>

function getApiBase(): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').trim()
  return base ? base.replace(/\/$/, '') : ''
}

/** バックエンド経由で MusicBrainz から複数アーティストの SNS URL を取得。名前一致するもののみ返す（誤登録を弾く） */
async function fetchArtistSnsUrlsBatch(artistInfo: ArtistInfo[]): Promise<Record<string, ArtistSnsUrls>> {
  if (artistInfo.length === 0) return {}
  const base = getApiBase()
  const url = base ? `${base}/api/v1/musicbrainz/artist-sns-urls-batch` : '/api/v1/musicbrainz/artist-sns-urls-batch'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artists: artistInfo.map((a) => ({ id: a.id, name: a.name })) }),
  })
  if (!res.ok) return {}
  const data = (await res.json()) as { artists?: Record<string, { urls: ArtistSnsUrls }> }
  const out: Record<string, ArtistSnsUrls> = {}
  for (const [id, v] of Object.entries(data?.artists ?? {})) {
    if (v?.urls && Object.keys(v.urls).length > 0) out[id] = v.urls
  }
  return out
}

/** URL からハンドル（@username）を抽出 */
function extractHandle(url: string, platform: SnsPlatform): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, '')
    if (platform === 'youtube') {
      const m = path.match(/\/@([^/]+)/)
      if (m) return `@${m[1]}`
      const ch = path.match(/\/channel\/([^/]+)/)
      if (ch) return ch[1]
    }
    const seg = path.split('/').filter(Boolean).pop()
    return seg ? `@${seg}` : '@'
  } catch {
    return '@'
  }
}

/** MusicBrainz の SNS URL から本物のプロフィールカードを生成 */
function buildProfileCardsFromUrls(
  urlsByArtist: Record<string, ArtistSnsUrls>,
  artistInfo: ArtistInfo[],
): ArtistSnsPost[] {
  const infoMap = new Map(artistInfo.map((a) => [a.id, a.name]))
  const platformOrder: SnsPlatform[] = ['x', 'instagram', 'youtube']
  const platformLabels: Record<SnsPlatform, string> = {
    x: 'X',
    instagram: 'Instagram',
    youtube: 'YouTube',
  }
  const cards: ArtistSnsPost[] = []
  for (const [artistId, urls] of Object.entries(urlsByArtist)) {
    const artistName = infoMap.get(artistId) ?? 'Artist'
    for (const platform of platformOrder) {
      const url = urls[platform]
      if (!url) continue
      const handle = extractHandle(url, platform)
      cards.push({
        artistId,
        artistName,
        handle,
        avatarUrl: null,
        content: `${platformLabels[platform]} でフォロー`,
        postedAt: '公式アカウント',
        platform,
        url,
      })
    }
  }
  return cards
}

/**
 * 複数アーティストの直近SNS投稿を取得。最大 limit 件（API上限: 500）。
 * MusicBrainz から取得した公式 SNS プロフィールURL を本物として表示。モックは使わない。
 */
export async function fetchRecentSnsPosts(
  artistIds: string[],
  limit = SNS_POSTS_LIMIT_TOTAL,
  artistInfo?: ArtistInfo[],
): Promise<ArtistSnsPost[]> {
  const info = artistInfo ?? artistIds.map((id) => ({ id, name: 'Artist' }))

  if (isMockMode()) {
    return getRecentSnsPosts(artistIds, limit, artistInfo)
  }

  try {
    const urlsByArtist = await fetchArtistSnsUrlsBatch(info)
    const cards = buildProfileCardsFromUrls(urlsByArtist, info)
    return cards.slice(0, limit)
  } catch {
    return []
  }
}
