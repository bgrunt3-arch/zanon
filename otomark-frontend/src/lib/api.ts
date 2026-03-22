import type { SpotifyArtist } from './orbit'
import { isForceMockFallback } from './orbit'

function getApiBase(): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').trim()
  return base ? base.replace(/\/$/, '') : ''
}

function apiUrl(path: string): string {
  const base = getApiBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : `/api/v1${p}`
}

function isMockMode(): boolean {
  const byEnv = (process.env.NEXT_PUBLIC_MOCK_MODE ?? '').toLowerCase() === 'true'
  if (byEnv) return true
  if (typeof window === 'undefined') return false
  try {
    if (localStorage.getItem('orbit.mockMode') === '1') return true
    if (isForceMockFallback()) return true
    return false
  } catch {
    return false
  }
}

type SaveFavePayload = {
  artist_id: string
  artist_name: string
  artist_image_url: string | null
}

// Next.js の rewrites を使い、同一オリジン配下（/api/v1/...）へ投げる
// -> CORS を避けられるようにする
async function postFave(payload: SaveFavePayload, token: string): Promise<void> {
  const res = await fetch(apiUrl('/faves'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    // バックエンドが { error: '...' } を返す想定。文字列があればそれを優先表示する
    let message = text
    try {
      const json = JSON.parse(text)
      message = json?.error ?? json?.message ?? text
    } catch {
      // ignore
    }
    throw new Error(message || `Failed to save fave artist (${res.status})`)
  }
}

async function getUserFaves(token: string): Promise<Array<{ artist_id: string }>> {
  const res = await fetch(apiUrl('/faves'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Failed to fetch faves (${res.status})`)
  }

  const data = (await res.json()) as { faves?: Array<{ artist_id: string }> }
  return data.faves ?? []
}

async function deleteFave(artistId: string, token: string): Promise<void> {
  const res = await fetch(apiUrl(`/faves/${encodeURIComponent(artistId)}`), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = text
    try {
      const json = JSON.parse(text)
      message = json?.error ?? json?.message ?? text
    } catch {
      // ignore
    }
    throw new Error(message || `Failed to delete fave artist (${res.status})`)
  }
}

export async function saveUserFaves(artists: SpotifyArtist[], token: string): Promise<void> {
  if (isMockMode()) {
    return
  }
  const topFive = artists.slice(0, 5)

  // 既存のお気に入りを「完全に desired と一致」させる。
  // 削除 → 挿入の順にして、バックエンド側の最大5件制約で insert が失敗しないようにする。
  const existing = await getUserFaves(token)
  const existingIds = new Set(existing.map((f) => f.artist_id))
  const desiredIds = new Set(topFive.map((a) => a.id))

  const toDelete = [...existingIds].filter((id) => !desiredIds.has(id))
  for (const artistId of toDelete) {
    await deleteFave(artistId, token)
  }

  const toInsert = topFive.filter((artist) => !existingIds.has(artist.id))

  for (const artist of toInsert) {
    await postFave(
      {
        artist_id: artist.id,
        artist_name: artist.name,
        artist_image_url: artist.images[0]?.url ?? null,
      },
      token,
    )
  }
}

export async function exchangeSpotifyTokenForAppJwt(spotifyAccessToken: string): Promise<string> {
  if (isMockMode()) {
    return 'mock-app-jwt'
  }
  const res = await fetch(apiUrl('/auth/spotify'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${spotifyAccessToken}`,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Spotify token exchange failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { token?: string }
  if (!data.token) throw new Error('App JWT not returned')
  return data.token
}
