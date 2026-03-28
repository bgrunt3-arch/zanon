import { getCached, setCached } from './cache'

function proxyUrl(params: Record<string, string>): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')
  const endpoint = base ? `${base}/api/v1/lastfm/proxy` : '/api/v1/lastfm/proxy'
  const p = new URLSearchParams(params)
  return `${endpoint}?${p}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type LastFmTrack = {
  name: string
  playcount: string
  listeners: string
  url: string
  artist: { name: string; url: string }
  image: Array<{ '#text': string; size: string }>
}

export type LastFmArtistInfo = {
  name: string
  url: string
  image: Array<{ '#text': string; size: string }>
  stats: { listeners: string; playcount: string }
  bio: {
    summary: string
    content: string
    published: string
    links: { link: { href: string; rel: string; '#text': string } }
  }
  tags: { tag: Array<{ name: string; url: string }> }
  similar: { artist: Array<{ name: string; url: string; image: Array<{ '#text': string; size: string }> }> }
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * アーティストのトップトラックを取得
 * https://www.last.fm/api/show/artist.getTopTracks
 */
export async function fetchArtistRecentTracks(
  artistName: string,
  limit = 10,
): Promise<LastFmTrack[]> {
  const url = proxyUrl({ method: 'artist.gettoptracks', artist: artistName, limit: String(limit) })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Last.fm gettoptracks failed: ${res.status}`)
  const data = await res.json()
  return (data.toptracks?.track as LastFmTrack[]) ?? []
}

export type LastFmAlbum = {
  name: string
  playcount: number
  url: string
  artist: { name: string; mbid: string; url: string }
  image: Array<{ '#text': string; size: string }>
  mbid?: string
}

/**
 * アーティストのトップアルバムを取得（新着リリース表示に使用）
 * https://www.last.fm/api/show/artist.getTopAlbums
 */
export async function fetchArtistNewReleases(
  artistName: string,
  limit = 3,
): Promise<LastFmAlbum[]> {
  const url = proxyUrl({ method: 'artist.gettopalbums', artist: artistName, limit: String(limit) })
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.topalbums?.album as LastFmAlbum[]) ?? []
  } catch {
    return []
  }
}

export type LastFmSimilarArtist = {
  name: string
  url: string
  image: Array<{ '#text': string; size: string }>
  match: string
}

/**
 * 似たアーティストを取得
 * https://www.last.fm/api/show/artist.getSimilar
 */
export async function fetchSimilarArtists(
  artistName: string,
  limit = 6,
): Promise<LastFmSimilarArtist[]> {
  const url = proxyUrl({ method: 'artist.getsimilar', artist: artistName, limit: String(limit) })
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.similarartists?.artist as LastFmSimilarArtist[]) ?? []
  } catch {
    return []
  }
}

/**
 * アーティストの詳細情報（バイオ・タグ・類似アーティスト等）を取得
 * https://www.last.fm/api/show/artist.getInfo
 */
export async function fetchArtistNews(artistName: string): Promise<LastFmArtistInfo | null> {
  const cacheKey = `lastfm.artistInfo.${artistName}`
  const cached = getCached<LastFmArtistInfo>(cacheKey)
  if (cached) return cached

  const url = proxyUrl({ method: 'artist.getinfo', artist: artistName })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Last.fm getinfo failed: ${res.status}`)
  const data = await res.json()
  const result = (data.artist as LastFmArtistInfo) ?? null
  if (result) setCached(cacheKey, result, 60 * 60 * 1000)
  return result
}
