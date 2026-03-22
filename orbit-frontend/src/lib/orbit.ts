// Spotify API utilities for the Orbit feed feature

const SPOTIFY_API = 'https://api.spotify.com/v1'
const TOKEN_KEY = 'orbit.spotify.accessToken'
const ARTISTS_KEY = 'orbit.spotify.selectedArtists'
const TRACKS_RATE_LIMIT_KEY = 'orbit.spotify.tracksRateLimitedUntil'
const ALBUMS_RATE_LIMIT_KEY = 'orbit.spotify.albumsRateLimitedUntil'
const LAST_RATE_LIMIT_KEY = 'orbit.spotify.lastRateLimitedUntil'
const LAST_RETRY_AFTER_KEY = 'orbit.spotify.lastRetryAfterSec'

export type SpotifyArtist = {
  id: string
  name: string
  images: Array<{ url: string }>
}

export type SpotifyTrack = {
  id: string
  name: string
  artists: Array<{ id: string; name: string }>
  album?: {
    name: string
    release_date?: string
    images: Array<{ url: string }>
  }
  external_urls?: { spotify: string }
  popularity?: number
}

type SpotifyAlbum = {
  id: string
  name: string
  release_date: string
  images: Array<{ url: string }>
}

// ===== localStorage helpers =====

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function clearAccessToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

export function getSelectedArtists(): SpotifyArtist[] {
  try {
    const raw = localStorage.getItem(ARTISTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ===== Spotify API fetch helpers =====

async function spotifyGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '60')
    const untilMs = Date.now() + retryAfter * 1000
    try {
      sessionStorage.setItem(LAST_RATE_LIMIT_KEY, String(untilMs))
      sessionStorage.setItem(LAST_RETRY_AFTER_KEY, String(retryAfter))
    } catch {
      // ignore
    }
    throw new Error(`Spotify API の利用上限に達しました（429）`)
  }
  if (!res.ok) {
    throw new Error(`Spotify API error: status ${res.status} (${path})`)
  }
  return res.json() as Promise<T>
}

export async function fetchMe(
  token: string,
): Promise<{ display_name: string | null; country: string }> {
  return spotifyGet(token, '/me')
}

export async function fetchArtistTopTracks(
  token: string,
  artistId: string,
  market: string,
): Promise<SpotifyTrack[]> {
  try {
    const data = await spotifyGet<{ tracks: SpotifyTrack[] }>(
      token,
      `/artists/${artistId}/top-tracks?market=${encodeURIComponent(market)}`,
    )
    return data.tracks ?? []
  } catch (e: any) {
    if (/利用上限|429/.test(e?.message ?? '')) {
      try {
        const untilMs = sessionStorage.getItem(LAST_RATE_LIMIT_KEY)
        if (untilMs) sessionStorage.setItem(TRACKS_RATE_LIMIT_KEY, untilMs)
      } catch {
        // ignore
      }
    }
    throw e
  }
}

export async function fetchArtistRecentAlbums(
  token: string,
  artistId: string,
  limit: number,
  market: string,
): Promise<SpotifyAlbum[]> {
  try {
    const data = await spotifyGet<{ items: SpotifyAlbum[] }>(
      token,
      `/artists/${artistId}/albums?include_groups=album,single&limit=${limit}&market=${encodeURIComponent(market)}`,
    )
    return data.items ?? []
  } catch (e: any) {
    if (/利用上限|429/.test(e?.message ?? '')) {
      try {
        const untilMs = sessionStorage.getItem(LAST_RATE_LIMIT_KEY)
        if (untilMs) sessionStorage.setItem(ALBUMS_RATE_LIMIT_KEY, untilMs)
      } catch {
        // ignore
      }
    }
    throw e
  }
}

export async function fetchAlbumTracks(
  token: string,
  albumId: string,
  limit: number,
): Promise<SpotifyTrack[]> {
  try {
    const data = await spotifyGet<{ items: SpotifyTrack[] }>(
      token,
      `/albums/${albumId}/tracks?limit=${limit}`,
    )
    return data.items ?? []
  } catch (e: any) {
    if (/利用上限|429/.test(e?.message ?? '')) {
      try {
        const untilMs = sessionStorage.getItem(LAST_RATE_LIMIT_KEY)
        if (untilMs) sessionStorage.setItem(ALBUMS_RATE_LIMIT_KEY, untilMs)
      } catch {
        // ignore
      }
    }
    throw e
  }
}
