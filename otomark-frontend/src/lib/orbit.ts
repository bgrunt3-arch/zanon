export type SpotifyArtist = {
  id: string
  name: string
  images: Array<{ url: string; height: number | null; width: number | null }>
  genres: string[]
  followers: { total: number }
}

/** Spotify Audio Features API の主要項目（0.0-1.0） */
export type AudioFeatures = {
  /** 明るさ・ポジティブさ */
  valence: number
  /** 激しさ・活動性 */
  energy: number
  /** 踊りやすさ */
  danceability: number
}

export type SpotifyTrack = {
  id: string
  name: string
  // 一部レスポンスでフィールドが欠けることがあるので optional にしておく
  popularity?: number
  external_urls?: { spotify: string }
  /** MusicBrainz 連携用。GET /tracks/{id} で取得 */
  external_ids?: { isrc?: string }
  /** GET /audio-features/{id} で取得。バッチは最大100件 */
  audio_features?: AudioFeatures
  album?: {
    name?: string
    /** Spotify の release_date は `YYYY` / `YYYY-MM` / `YYYY-MM-DD` のいずれか */
    release_date?: string | null
    images?: Array<{ url: string; height: number | null; width: number | null }>
  }
  artists: Array<{
    id: string
    name: string
  }>
}

export type SpotifyMe = {
  id: string
  display_name: string | null
  /** user-read-private スコープ時に付く（ISO 3166-1 alpha-2） */
  country?: string
  images: Array<{ url: string; height: number | null; width: number | null }>
  /** Spotify プランの種別（"premium" | "free" | "open" など） */
  product?: string
}

const MOCK_ACCESS_TOKEN = 'mock-access-token'
const MOCK_APP_JWT = 'mock-app-jwt'
const MOCK_IMAGE_URL = '/icon.svg'

const SPOTIFY_AUTH_BASE = 'https://accounts.spotify.com/authorize'
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'
const SPOTIFY_TOKEN_BASE = 'https://accounts.spotify.com/api/token'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const FORCE_MOCK_FALLBACK_KEY = 'orbit.forceMockFallback'

export function isForceMockFallback(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(FORCE_MOCK_FALLBACK_KEY) === '1'
  } catch {
    return false
  }
}

export function setForceMockFallback(): void {
  try {
    sessionStorage.setItem(FORCE_MOCK_FALLBACK_KEY, '1')
  } catch {
    // ignore
  }
}

export function clearForceMockFallback(): void {
  try {
    sessionStorage.removeItem(FORCE_MOCK_FALLBACK_KEY)
  } catch {
    // ignore
  }
}

export function isMockMode(): boolean {
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

const MOCK_ARTISTS: SpotifyArtist[] = [
  { id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['k-pop'], followers: { total: 12000000 } },
  { id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['k-pop'], followers: { total: 9500000 } },
  { id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['k-pop'], followers: { total: 2300000 } },
  { id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['k-pop'], followers: { total: 15000000 } },
  { id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['j-pop'], followers: { total: 800000 } },
  { id: '2M1Q3lY4n2h4L6x7u8v9w0', name: 'BOYNEXTDOOR', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['k-pop'], followers: { total: 1800000 } },
  { id: '1dfeR4HaWDbWqFHLkxsg1d', name: 'Queen', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['rock'], followers: { total: 42000000 } },
  { id: '06HL4z0CvFAxyc27GXpf02', name: 'Taylor Swift', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['pop'], followers: { total: 120000000 } },
  { id: '3TVXtAsR1Inumwj472S9r4', name: 'Drake', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['hip hop'], followers: { total: 85000000 } },
  { id: '66CXWjxzNUsdJxJ2JdwvnR', name: 'Ariana Grande', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['pop'], followers: { total: 110000000 } },
  { id: 'mock-suda', name: '菅田将暉', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['j-pop'], followers: { total: 500000 } },
  { id: 'mock-yoasobi', name: 'YOASOBI', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['j-pop'], followers: { total: 8000000 } },
  { id: 'mock-aimer', name: 'Aimer', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }], genres: ['j-pop'], followers: { total: 3000000 } },
]

const MOCK_SELECTED_ARTISTS: SpotifyArtist[] = MOCK_ARTISTS.slice(0, 5)

const MOCK_ME: SpotifyMe = {
  id: 'mock-user',
  display_name: 'Mock Developer',
  country: 'JP',
  images: [{ url: MOCK_IMAGE_URL, height: 300, width: 300 }],
}

/** 本番同様: top-tracks(10) + アルバム3枚×20曲。各アーティスト30曲 */
const MOCK_TOP_TRACKS: SpotifyTrack[] = [
  // aespa (10曲)
  { id: 'm1', name: 'Supernova', popularity: 86, external_urls: { spotify: 'https://open.spotify.com/track/m1' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1b', name: 'Armageddon', popularity: 85, external_urls: { spotify: 'https://open.spotify.com/track/m1b' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1c', name: 'Drama', popularity: 84, external_urls: { spotify: 'https://open.spotify.com/track/m1c' }, album: { name: 'Drama', release_date: '2023-11-10', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1d', name: 'Next Level', popularity: 90, external_urls: { spotify: 'https://open.spotify.com/track/m1d' }, album: { name: 'Savage', release_date: '2021-05-17', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1e', name: 'Black Mamba', popularity: 82, external_urls: { spotify: 'https://open.spotify.com/track/m1e' }, album: { name: 'Black Mamba', release_date: '2020-11-17', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1f', name: 'Spicy', popularity: 80, external_urls: { spotify: 'https://open.spotify.com/track/m1f' }, album: { name: 'MY WORLD', release_date: '2023-05-08', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1g', name: 'Savage', popularity: 88, external_urls: { spotify: 'https://open.spotify.com/track/m1g' }, album: { name: 'Savage', release_date: '2021-10-05', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1h', name: 'Girls', popularity: 79, external_urls: { spotify: 'https://open.spotify.com/track/m1h' }, album: { name: 'Girls', release_date: '2022-07-08', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1i', name: 'Illusion', popularity: 77, external_urls: { spotify: 'https://open.spotify.com/track/m1i' }, album: { name: 'Girls', release_date: '2022-07-08', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1j', name: 'Life\'s Too Short', popularity: 75, external_urls: { spotify: 'https://open.spotify.com/track/m1j' }, album: { name: 'Girls', release_date: '2022-07-08', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  // NewJeans (10曲)
  { id: 'm2', name: 'How Sweet', popularity: 84, external_urls: { spotify: 'https://open.spotify.com/track/m2' }, album: { name: 'How Sweet', release_date: '2024-05-24', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2b', name: 'Super Shy', popularity: 88, external_urls: { spotify: 'https://open.spotify.com/track/m2b' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2c', name: 'Ditto', popularity: 92, external_urls: { spotify: 'https://open.spotify.com/track/m2c' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2d', name: 'OMG', popularity: 90, external_urls: { spotify: 'https://open.spotify.com/track/m2d' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2e', name: 'Hype Boy', popularity: 94, external_urls: { spotify: 'https://open.spotify.com/track/m2e' }, album: { name: 'New Jeans', release_date: '2022-08-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2f', name: 'Attention', popularity: 91, external_urls: { spotify: 'https://open.spotify.com/track/m2f' }, album: { name: 'New Jeans', release_date: '2022-08-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2g', name: 'ETA', popularity: 87, external_urls: { spotify: 'https://open.spotify.com/track/m2g' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2h', name: 'Cool With You', popularity: 85, external_urls: { spotify: 'https://open.spotify.com/track/m2h' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2i', name: 'New Jeans', popularity: 83, external_urls: { spotify: 'https://open.spotify.com/track/m2i' }, album: { name: 'New Jeans', release_date: '2022-08-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2j', name: 'Cookie', popularity: 81, external_urls: { spotify: 'https://open.spotify.com/track/m2j' }, album: { name: 'New Jeans', release_date: '2022-08-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  // ILLIT (10曲)
  { id: 'm3', name: 'Magnetic', popularity: 83, external_urls: { spotify: 'https://open.spotify.com/track/m3' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3b', name: 'Lucky Girl Syndrome', popularity: 81, external_urls: { spotify: 'https://open.spotify.com/track/m3b' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3c', name: 'My World', popularity: 79, external_urls: { spotify: 'https://open.spotify.com/track/m3c' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3d', name: 'Midnight Fiction', popularity: 77, external_urls: { spotify: 'https://open.spotify.com/track/m3d' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3e', name: 'Don\'t Wanna Go Back', popularity: 75, external_urls: { spotify: 'https://open.spotify.com/track/m3e' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3f', name: 'Hide & Seek', popularity: 73, external_urls: { spotify: 'https://open.spotify.com/track/m3f' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3g', name: 'I\'ll Be There', popularity: 71, external_urls: { spotify: 'https://open.spotify.com/track/m3g' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3h', name: 'Nothing', popularity: 69, external_urls: { spotify: 'https://open.spotify.com/track/m3h' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3i', name: 'Real', popularity: 67, external_urls: { spotify: 'https://open.spotify.com/track/m3i' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3j', name: 'We Together', popularity: 65, external_urls: { spotify: 'https://open.spotify.com/track/m3j' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  // j-hope (10曲)
  { id: 'm4', name: 'NEURON', popularity: 78, external_urls: { spotify: 'https://open.spotify.com/track/m4' }, album: { name: 'HOPE ON THE STREET VOL.1', release_date: '2024-03-29', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4b', name: 'Chicken Noodle Soup', popularity: 85, external_urls: { spotify: 'https://open.spotify.com/track/m4b' }, album: { name: 'Chicken Noodle Soup', release_date: '2019-09-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4c', name: 'Daydream', popularity: 82, external_urls: { spotify: 'https://open.spotify.com/track/m4c' }, album: { name: 'Hope World', release_date: '2018-03-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4d', name: 'Arson', popularity: 80, external_urls: { spotify: 'https://open.spotify.com/track/m4d' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4e', name: 'More', popularity: 76, external_urls: { spotify: 'https://open.spotify.com/track/m4e' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4f', name: 'Hope World', popularity: 74, external_urls: { spotify: 'https://open.spotify.com/track/m4f' }, album: { name: 'Hope World', release_date: '2018-03-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4g', name: 'P.O.P', popularity: 72, external_urls: { spotify: 'https://open.spotify.com/track/m4g' }, album: { name: 'Hope World', release_date: '2018-03-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4h', name: 'Base Line', popularity: 70, external_urls: { spotify: 'https://open.spotify.com/track/m4h' }, album: { name: 'Hope World', release_date: '2018-03-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4i', name: 'Hangsang', popularity: 68, external_urls: { spotify: 'https://open.spotify.com/track/m4i' }, album: { name: 'Hope World', release_date: '2018-03-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4j', name: 'Blue Side', popularity: 66, external_urls: { spotify: 'https://open.spotify.com/track/m4j' }, album: { name: 'Hope World', release_date: '2018-03-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  // りぶ (10曲)
  { id: 'm5', name: 'Rib Night', popularity: 70, external_urls: { spotify: 'https://open.spotify.com/track/m5' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5b', name: 'Rib', popularity: 68, external_urls: { spotify: 'https://open.spotify.com/track/m5b' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5c', name: '夜明けと蛍', popularity: 72, external_urls: { spotify: 'https://open.spotify.com/track/m5c' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5d', name: 'ロストワン', popularity: 66, external_urls: { spotify: 'https://open.spotify.com/track/m5d' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5e', name: 'アンチグラビティ', popularity: 64, external_urls: { spotify: 'https://open.spotify.com/track/m5e' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5f', name: 'サンセット', popularity: 62, external_urls: { spotify: 'https://open.spotify.com/track/m5f' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5g', name: 'スノードロップ', popularity: 60, external_urls: { spotify: 'https://open.spotify.com/track/m5g' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5h', name: 'パレード', popularity: 58, external_urls: { spotify: 'https://open.spotify.com/track/m5h' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5i', name: 'オーバーライト', popularity: 56, external_urls: { spotify: 'https://open.spotify.com/track/m5i' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5j', name: 'エンドロール', popularity: 54, external_urls: { spotify: 'https://open.spotify.com/track/m5j' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  // アルバム収録曲用（本番: 3枚×20曲。top-tracks と重複・補完）
  // aespa +20 (計30)
  { id: 'm1k', name: 'aespa Track 11', popularity: 74, external_urls: { spotify: 'https://open.spotify.com/track/m1k' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1l', name: 'aespa Track 12', popularity: 73, external_urls: { spotify: 'https://open.spotify.com/track/m1l' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1m', name: 'aespa Track 13', popularity: 72, external_urls: { spotify: 'https://open.spotify.com/track/m1m' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1n', name: 'aespa Track 14', popularity: 71, external_urls: { spotify: 'https://open.spotify.com/track/m1n' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1o', name: 'aespa Track 15', popularity: 70, external_urls: { spotify: 'https://open.spotify.com/track/m1o' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1p', name: 'aespa Track 16', popularity: 69, external_urls: { spotify: 'https://open.spotify.com/track/m1p' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1q', name: 'aespa Track 17', popularity: 68, external_urls: { spotify: 'https://open.spotify.com/track/m1q' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1r', name: 'aespa Track 18', popularity: 67, external_urls: { spotify: 'https://open.spotify.com/track/m1r' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1s', name: 'aespa Track 19', popularity: 66, external_urls: { spotify: 'https://open.spotify.com/track/m1s' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1t', name: 'aespa Track 20', popularity: 65, external_urls: { spotify: 'https://open.spotify.com/track/m1t' }, album: { name: 'Armageddon', release_date: '2024-05-27', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1u', name: 'aespa Track 21', popularity: 64, external_urls: { spotify: 'https://open.spotify.com/track/m1u' }, album: { name: 'Drama', release_date: '2023-11-10', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1v', name: 'aespa Track 22', popularity: 63, external_urls: { spotify: 'https://open.spotify.com/track/m1v' }, album: { name: 'Drama', release_date: '2023-11-10', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1w', name: 'aespa Track 23', popularity: 62, external_urls: { spotify: 'https://open.spotify.com/track/m1w' }, album: { name: 'Drama', release_date: '2023-11-10', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1x', name: 'aespa Track 24', popularity: 61, external_urls: { spotify: 'https://open.spotify.com/track/m1x' }, album: { name: 'Drama', release_date: '2023-11-10', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1y', name: 'aespa Track 25', popularity: 60, external_urls: { spotify: 'https://open.spotify.com/track/m1y' }, album: { name: 'Drama', release_date: '2023-11-10', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1z', name: 'aespa Track 26', popularity: 59, external_urls: { spotify: 'https://open.spotify.com/track/m1z' }, album: { name: 'Drama', release_date: '2023-11-10', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1a2', name: 'aespa Track 27', popularity: 58, external_urls: { spotify: 'https://open.spotify.com/track/m1a2' }, album: { name: 'Drama', release_date: '2023-11-10', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1a3', name: 'aespa Track 28', popularity: 57, external_urls: { spotify: 'https://open.spotify.com/track/m1a3' }, album: { name: 'Drama', release_date: '2023-11-10', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1a4', name: 'aespa Track 29', popularity: 56, external_urls: { spotify: 'https://open.spotify.com/track/m1a4' }, album: { name: 'Drama', release_date: '2023-11-10', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  { id: 'm1a5', name: 'aespa Track 30', popularity: 55, external_urls: { spotify: 'https://open.spotify.com/track/m1a5' }, album: { name: 'Drama', release_date: '2023-11-10', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6YVMFz59CuY7ngCxTxjpxE', name: 'aespa' }] },
  // NewJeans +20, ILLIT +20, j-hope +20, りぶ +20 (各30曲)
  { id: 'm2k', name: 'NewJeans Track 11', popularity: 80, external_urls: { spotify: 'https://open.spotify.com/track/m2k' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2l', name: 'NewJeans Track 12', popularity: 79, external_urls: { spotify: 'https://open.spotify.com/track/m2l' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2m', name: 'NewJeans Track 13', popularity: 78, external_urls: { spotify: 'https://open.spotify.com/track/m2m' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2n', name: 'NewJeans Track 14', popularity: 77, external_urls: { spotify: 'https://open.spotify.com/track/m2n' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2o', name: 'NewJeans Track 15', popularity: 76, external_urls: { spotify: 'https://open.spotify.com/track/m2o' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2p', name: 'NewJeans Track 16', popularity: 75, external_urls: { spotify: 'https://open.spotify.com/track/m2p' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2q', name: 'NewJeans Track 17', popularity: 74, external_urls: { spotify: 'https://open.spotify.com/track/m2q' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2r', name: 'NewJeans Track 18', popularity: 73, external_urls: { spotify: 'https://open.spotify.com/track/m2r' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2s', name: 'NewJeans Track 19', popularity: 72, external_urls: { spotify: 'https://open.spotify.com/track/m2s' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2t', name: 'NewJeans Track 20', popularity: 71, external_urls: { spotify: 'https://open.spotify.com/track/m2t' }, album: { name: 'Get Up', release_date: '2023-07-07', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2u', name: 'NewJeans Track 21', popularity: 70, external_urls: { spotify: 'https://open.spotify.com/track/m2u' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2v', name: 'NewJeans Track 22', popularity: 69, external_urls: { spotify: 'https://open.spotify.com/track/m2v' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2w', name: 'NewJeans Track 23', popularity: 68, external_urls: { spotify: 'https://open.spotify.com/track/m2w' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2x', name: 'NewJeans Track 24', popularity: 67, external_urls: { spotify: 'https://open.spotify.com/track/m2x' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2y', name: 'NewJeans Track 25', popularity: 66, external_urls: { spotify: 'https://open.spotify.com/track/m2y' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2z', name: 'NewJeans Track 26', popularity: 65, external_urls: { spotify: 'https://open.spotify.com/track/m2z' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2a2', name: 'NewJeans Track 27', popularity: 64, external_urls: { spotify: 'https://open.spotify.com/track/m2a2' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2a3', name: 'NewJeans Track 28', popularity: 63, external_urls: { spotify: 'https://open.spotify.com/track/m2a3' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2a4', name: 'NewJeans Track 29', popularity: 62, external_urls: { spotify: 'https://open.spotify.com/track/m2a4' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm2a5', name: 'NewJeans Track 30', popularity: 61, external_urls: { spotify: 'https://open.spotify.com/track/m2a5' }, album: { name: 'OMG', release_date: '2023-01-02', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '2wY79sveU1sp5g7SokKOiI', name: 'NewJeans' }] },
  { id: 'm3k', name: 'ILLIT Track 11', popularity: 64, external_urls: { spotify: 'https://open.spotify.com/track/m3k' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3l', name: 'ILLIT Track 12', popularity: 63, external_urls: { spotify: 'https://open.spotify.com/track/m3l' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3m', name: 'ILLIT Track 13', popularity: 62, external_urls: { spotify: 'https://open.spotify.com/track/m3m' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3n', name: 'ILLIT Track 14', popularity: 61, external_urls: { spotify: 'https://open.spotify.com/track/m3n' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3o', name: 'ILLIT Track 15', popularity: 60, external_urls: { spotify: 'https://open.spotify.com/track/m3o' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3p', name: 'ILLIT Track 16', popularity: 59, external_urls: { spotify: 'https://open.spotify.com/track/m3p' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3q', name: 'ILLIT Track 17', popularity: 58, external_urls: { spotify: 'https://open.spotify.com/track/m3q' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3r', name: 'ILLIT Track 18', popularity: 57, external_urls: { spotify: 'https://open.spotify.com/track/m3r' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3s', name: 'ILLIT Track 19', popularity: 56, external_urls: { spotify: 'https://open.spotify.com/track/m3s' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3t', name: 'ILLIT Track 20', popularity: 55, external_urls: { spotify: 'https://open.spotify.com/track/m3t' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3u', name: 'ILLIT Track 21', popularity: 54, external_urls: { spotify: 'https://open.spotify.com/track/m3u' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3v', name: 'ILLIT Track 22', popularity: 53, external_urls: { spotify: 'https://open.spotify.com/track/m3v' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3w', name: 'ILLIT Track 23', popularity: 52, external_urls: { spotify: 'https://open.spotify.com/track/m3w' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3x', name: 'ILLIT Track 24', popularity: 51, external_urls: { spotify: 'https://open.spotify.com/track/m3x' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3y', name: 'ILLIT Track 25', popularity: 50, external_urls: { spotify: 'https://open.spotify.com/track/m3y' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3z', name: 'ILLIT Track 26', popularity: 49, external_urls: { spotify: 'https://open.spotify.com/track/m3z' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3a2', name: 'ILLIT Track 27', popularity: 48, external_urls: { spotify: 'https://open.spotify.com/track/m3a2' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3a3', name: 'ILLIT Track 28', popularity: 47, external_urls: { spotify: 'https://open.spotify.com/track/m3a3' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3a4', name: 'ILLIT Track 29', popularity: 46, external_urls: { spotify: 'https://open.spotify.com/track/m3a4' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm3a5', name: 'ILLIT Track 30', popularity: 45, external_urls: { spotify: 'https://open.spotify.com/track/m3a5' }, album: { name: 'SUPER REAL ME', release_date: '2024-03-25', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '5J7V5xRGJ4F4D2f7QjB5x3', name: 'ILLIT' }] },
  { id: 'm4k', name: 'j-hope Track 11', popularity: 65, external_urls: { spotify: 'https://open.spotify.com/track/m4k' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4l', name: 'j-hope Track 12', popularity: 64, external_urls: { spotify: 'https://open.spotify.com/track/m4l' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4m', name: 'j-hope Track 13', popularity: 63, external_urls: { spotify: 'https://open.spotify.com/track/m4m' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4n', name: 'j-hope Track 14', popularity: 62, external_urls: { spotify: 'https://open.spotify.com/track/m4n' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4o', name: 'j-hope Track 15', popularity: 61, external_urls: { spotify: 'https://open.spotify.com/track/m4o' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4p', name: 'j-hope Track 16', popularity: 60, external_urls: { spotify: 'https://open.spotify.com/track/m4p' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4q', name: 'j-hope Track 17', popularity: 59, external_urls: { spotify: 'https://open.spotify.com/track/m4q' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4r', name: 'j-hope Track 18', popularity: 58, external_urls: { spotify: 'https://open.spotify.com/track/m4r' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4s', name: 'j-hope Track 19', popularity: 57, external_urls: { spotify: 'https://open.spotify.com/track/m4s' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4t', name: 'j-hope Track 20', popularity: 56, external_urls: { spotify: 'https://open.spotify.com/track/m4t' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4u', name: 'j-hope Track 21', popularity: 55, external_urls: { spotify: 'https://open.spotify.com/track/m4u' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4v', name: 'j-hope Track 22', popularity: 54, external_urls: { spotify: 'https://open.spotify.com/track/m4v' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4w', name: 'j-hope Track 23', popularity: 53, external_urls: { spotify: 'https://open.spotify.com/track/m4w' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4x', name: 'j-hope Track 24', popularity: 52, external_urls: { spotify: 'https://open.spotify.com/track/m4x' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4y', name: 'j-hope Track 25', popularity: 51, external_urls: { spotify: 'https://open.spotify.com/track/m4y' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4z', name: 'j-hope Track 26', popularity: 50, external_urls: { spotify: 'https://open.spotify.com/track/m4z' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4a2', name: 'j-hope Track 27', popularity: 49, external_urls: { spotify: 'https://open.spotify.com/track/m4a2' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4a3', name: 'j-hope Track 28', popularity: 48, external_urls: { spotify: 'https://open.spotify.com/track/m4a3' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4a4', name: 'j-hope Track 29', popularity: 47, external_urls: { spotify: 'https://open.spotify.com/track/m4a4' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm4a5', name: 'j-hope Track 30', popularity: 46, external_urls: { spotify: 'https://open.spotify.com/track/m4a5' }, album: { name: 'Jack In The Box', release_date: '2022-07-15', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'j-hope' }] },
  { id: 'm5k', name: 'りぶ Track 11', popularity: 53, external_urls: { spotify: 'https://open.spotify.com/track/m5k' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5l', name: 'りぶ Track 12', popularity: 52, external_urls: { spotify: 'https://open.spotify.com/track/m5l' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5m', name: 'りぶ Track 13', popularity: 51, external_urls: { spotify: 'https://open.spotify.com/track/m5m' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5n', name: 'りぶ Track 14', popularity: 50, external_urls: { spotify: 'https://open.spotify.com/track/m5n' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5o', name: 'りぶ Track 15', popularity: 49, external_urls: { spotify: 'https://open.spotify.com/track/m5o' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5p', name: 'りぶ Track 16', popularity: 48, external_urls: { spotify: 'https://open.spotify.com/track/m5p' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5q', name: 'りぶ Track 17', popularity: 47, external_urls: { spotify: 'https://open.spotify.com/track/m5q' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5r', name: 'りぶ Track 18', popularity: 46, external_urls: { spotify: 'https://open.spotify.com/track/m5r' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5s', name: 'りぶ Track 19', popularity: 45, external_urls: { spotify: 'https://open.spotify.com/track/m5s' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5t', name: 'りぶ Track 20', popularity: 44, external_urls: { spotify: 'https://open.spotify.com/track/m5t' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5u', name: 'りぶ Track 21', popularity: 43, external_urls: { spotify: 'https://open.spotify.com/track/m5u' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5v', name: 'りぶ Track 22', popularity: 42, external_urls: { spotify: 'https://open.spotify.com/track/m5v' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5w', name: 'りぶ Track 23', popularity: 41, external_urls: { spotify: 'https://open.spotify.com/track/m5w' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5x', name: 'りぶ Track 24', popularity: 40, external_urls: { spotify: 'https://open.spotify.com/track/m5x' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5y', name: 'りぶ Track 25', popularity: 39, external_urls: { spotify: 'https://open.spotify.com/track/m5y' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5z', name: 'りぶ Track 26', popularity: 38, external_urls: { spotify: 'https://open.spotify.com/track/m5z' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5a2', name: 'りぶ Track 27', popularity: 37, external_urls: { spotify: 'https://open.spotify.com/track/m5a2' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5a3', name: 'りぶ Track 28', popularity: 36, external_urls: { spotify: 'https://open.spotify.com/track/m5a3' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5a4', name: 'りぶ Track 29', popularity: 35, external_urls: { spotify: 'https://open.spotify.com/track/m5a4' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
  { id: 'm5a5', name: 'りぶ Track 30', popularity: 34, external_urls: { spotify: 'https://open.spotify.com/track/m5a5' }, album: { name: 'Rib', release_date: '2023-09-01', images: [{ url: MOCK_IMAGE_URL, height: 640, width: 640 }] }, artists: [{ id: '6fWVd57NKTalqvmjRd2t8Z', name: 'りぶ' }] },
]

/** モック楽曲の検索用。名前一致でフォールバック（Spotify ID が異なる場合も表示） */
const MOCK_ARTIST_ID_BY_NAME: Record<string, string> = {
  aespa: '6YVMFz59CuY7ngCxTxjpxE',
  NewJeans: '2wY79sveU1sp5g7SokKOiI',
  ILLIT: '5J7V5xRGJ4F4D2f7QjB5x3',
  'j-hope': '4gzpq5DPGxSnKTe4SA8HAU',
  'りぶ': '6fWVd57NKTalqvmjRd2t8Z',
  Rib: '6fWVd57NKTalqvmjRd2t8Z',
}

function getMockTrackArtistId(artistId: string): string {
  const hasTracks = MOCK_TOP_TRACKS.some((t) => t.artists.some((a) => a.id === artistId))
  if (hasTracks) return artistId
  try {
    const selected = getSelectedArtists()
    const artist = selected.find((a) => a.id === artistId)
    if (artist) {
      const name = artist.name.trim()
      if (MOCK_ARTIST_ID_BY_NAME[name]) return MOCK_ARTIST_ID_BY_NAME[name]
      if (/りぶ|^rib$/i.test(name)) return MOCK_ARTIST_ID_BY_NAME['りぶ']
    }
  } catch {
    // ignore
  }
  return artistId
}

function getMockArtistById(artistId: string): SpotifyArtist | null {
  const fromPreset = MOCK_ARTISTS.find((a) => a.id === artistId)
  if (fromPreset) return fromPreset
  try {
    const selected = getSelectedArtists()
    const fromSelected = selected.find((a) => a.id === artistId)
    if (fromSelected) return fromSelected
  } catch {
    // ignore
  }
  return null
}

/** trackId から deterministic なモック audio_features を生成 */
function getMockAudioFeatures(trackId: string): AudioFeatures {
  let h = 0
  for (let i = 0; i < trackId.length; i++) h = (h * 31 + trackId.charCodeAt(i)) >>> 0
  return {
    valence: 0.3 + ((h % 70) / 100),
    energy: 0.4 + (((h >> 8) % 50) / 100),
    danceability: 0.5 + (((h >> 16) % 45) / 100),
  }
}

/** trackId からモック ISRC を生成（形式: CCXXXYYNNNNN） */
function getMockIsrc(trackId: string): string {
  const h = trackId.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0)
  const n = String((h % 100000) + 10000).slice(0, 5)
  return `USRC${String.fromCharCode(65 + (h % 26))}${String.fromCharCode(65 + ((h >> 5) % 26))}${n}`
}

function enrichMockTrack(track: SpotifyTrack): SpotifyTrack {
  if (track.audio_features && track.external_ids?.isrc) return track
  return {
    ...track,
    audio_features: track.audio_features ?? getMockAudioFeatures(track.id),
    external_ids: track.external_ids ?? { isrc: getMockIsrc(track.id) },
  }
}

function buildMockTrackForArtist(artistId: string): SpotifyTrack {
  const artist = getMockArtistById(artistId)
  const artistName = artist?.name ?? 'Mock Artist'
  const coverUrl = artist?.images?.[0]?.url ?? MOCK_IMAGE_URL

  return enrichMockTrack({
    id: `mock-track-${artistId}`,
    name: `${artistName} Mock Track`,
    popularity: 78,
    external_urls: { spotify: `https://open.spotify.com/track/mock-${encodeURIComponent(artistId)}` },
    album: {
      name: `${artistName} Mock Album`,
      release_date: '2024-01-01',
      images: [{ url: coverUrl, height: 640, width: 640 }],
    },
    artists: [{ id: artistId, name: artistName }],
  })
}


// 常に相対URLで Next.js rewrites 経由にし、CORS を回避
function getSpotifyProxyUrl(path: string): string {
  const targetPath = path.startsWith('/') ? path : `/${path}`
  return `/api/v1/spotify/proxy?path=${encodeURIComponent(targetPath)}`
}

// in-flight 重複排除: 同一URLへの並行リクエストを1本に束ねる
const _inflight = new Map<string, Promise<Response>>()

// リフレッシュの並走防止: 複数の401が同時に来ても1回だけリフレッシュする
let _refreshPromise: Promise<string | null> | null = null

function refreshOnce(): Promise<string | null> {
  if (!_refreshPromise) {
    _refreshPromise = refreshAccessToken().finally(() => {
      _refreshPromise = null
    })
  }
  return _refreshPromise
}

/** GET 系の共通処理。429 のとき Retry-After / バックオフで数回だけ待って再試行。401 時は自動リフレッシュ＆リトライ */
export async function spotifyGet(path: string, token: string): Promise<Response> {
  // ブラウザ→Spotify直叩きだと CORS で Retry-After が読めないことがあるため、
  // バックエンドのプロキシ経由で取得する。
  const url = getSpotifyProxyUrl(path)

  // 同じURLが既にin-flight中なら同じPromiseを返す（リクエスト数削減）
  const inflightKey = url
  const existing = _inflight.get(inflightKey)
  if (existing) return existing.then((r) => r.clone())

  let attempt = 0
  // 429 の再試行は増やしすぎると逆に呼び出し回数が増えて不利なので最小限にする
  const max = 1
  let lastRes: Response | null = null

  const doFetch = async (): Promise<Response> => {
  let currentToken = token
  while (attempt < max) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${currentToken}` },
    })
    lastRes = res

    // 401: トークン期限切れ → シングルトンでリフレッシュして1回だけリトライ
    if (res.status === 401) {
      const newToken = await refreshOnce()
      if (newToken) {
        currentToken = newToken
        const retried = await fetch(url, { headers: { Authorization: `Bearer ${newToken}` } })
        lastRes = retried
        return retried
      }
      // リフレッシュ失敗 → ログアウトしてログイン画面へ
      clearAccessToken()
      if (typeof window !== 'undefined') window.location.href = '/login'
      return res
    }

    if (res.status !== 429) return res

    // UI 表示用: 429 の Retry-After をその場で必ず保存。
    // （albums/top-tracks 側のフラグ更新がズレても、表示だけは正確にする）
    try {
      let sec = NaN

      // まずはヘッダから取得（プロキシ経由なら読めるはず）
      const ra = res.headers.get('Retry-After')
      sec = ra ? parseInt(ra, 10) : NaN

      // それでも取れない場合の保険（429 時のボディに retryAfter を含めている）
      if (!Number.isFinite(sec)) {
        try {
          const payload = await res.clone().json().catch(() => null)
          const raw = payload?.retryAfter
          if (raw !== undefined && raw !== null) {
            sec = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
          }
        } catch {
          // ignore
        }
      }

      const untilMs = Date.now() + (Number.isFinite(sec) ? sec * 1000 : DEFAULT_429_FALLBACK_MS)
      sessionStorage.setItem(LAST_RATE_LIMIT_UNTIL_KEY, String(untilMs))
      if (Number.isFinite(sec)) {
        sessionStorage.setItem(LAST_RATE_LIMIT_RETRY_AFTER_SEC_KEY, String(sec))
      } else {
        sessionStorage.removeItem(LAST_RATE_LIMIT_RETRY_AFTER_SEC_KEY)
      }
    } catch {
      // ignore
    }

    // Retry-After が大きい場合、ここでリトライしても再429になる可能性が高いので
    // 呼び出し側の RateLimitedUntil フラグ処理へ委譲する（即中断）。
    const ra = res.headers.get('Retry-After')
    const sec = ra ? parseInt(ra, 10) : NaN
    if (Number.isFinite(sec) && sec > 30) {
      return res
    }

    // Retry-After が短い/無い場合だけ、短時間待って 1 回だけ再試行する。
    const ms = Number.isFinite(sec) ? Math.max(500, sec * 1000) : 900 * (attempt + 1)
    await sleep(Math.min(10_000, ms))
    attempt++
  }
  // 最後も 429 ならそのレスポンスを返して呼び出し側で判断させる
    return lastRes ?? fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  }

  const promise = doFetch()
  _inflight.set(inflightKey, promise)
  promise.finally(() => _inflight.delete(inflightKey))
  return promise
}

/** 最大100件まで。API: GET /audio-features?ids=... */
const AUDIO_FEATURES_BATCH_SIZE = 100

/**
 * 複数トラックの Audio Features を一括取得。
 * 呼び出し側で必要に応じて使用（メインフローには自動組み込みしない）。
 */
export async function fetchAudioFeatures(
  token: string,
  trackIds: string[],
): Promise<Map<string, AudioFeatures>> {
  if (isMockMode() || token === MOCK_ACCESS_TOKEN) return new Map()
  const unique = [...new Set(trackIds)].filter(Boolean)
  const result = new Map<string, AudioFeatures>()
  for (let i = 0; i < unique.length; i += AUDIO_FEATURES_BATCH_SIZE) {
    const batch = unique.slice(i, i + AUDIO_FEATURES_BATCH_SIZE)
    const ids = batch.join(',')
    const res = await spotifyGet(`/audio-features?ids=${encodeURIComponent(ids)}`, token)
    if (!res.ok) break
    const data = (await res.json()) as { audio_features?: Array<{ id: string; valence?: number; energy?: number; danceability?: number } | null> }
    const features = data.audio_features ?? []
    for (let j = 0; j < features.length; j++) {
      const f = features[j]
      const trackId = batch[j]
      if (f && trackId && typeof f.valence === 'number' && typeof f.energy === 'number' && typeof f.danceability === 'number') {
        result.set(trackId, { valence: f.valence, energy: f.energy, danceability: f.danceability })
      }
    }
    if (i + AUDIO_FEATURES_BATCH_SIZE < unique.length) await sleep(100)
  }
  return result
}

const CLIENT_ID = (process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? '').trim()
const SCOPE = 'user-top-read user-read-private user-read-email streaming user-modify-playback-state user-read-recently-played user-library-read playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private'

function getSpotifyRedirectUri(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI ?? '').trim()
  if (fromEnv) return fromEnv

  // 起動ポートが変わると OAuth の redirect_uri もズレるため、
  // 環境変数が無ければブラウザの origin に追従する。
  if (typeof window !== 'undefined') return `${window.location.origin}/callback`

  // サーバ側実行になった場合の保険（ただし本プロジェクトでは基本クライアント呼び出し）
  return 'http://127.0.0.1:3000/callback'
}

const TOKEN_KEY = 'orbit.spotify.accessToken'
const REFRESH_TOKEN_KEY = 'orbit.spotify.refreshToken'
const PICKS_KEY = 'orbit.selectedArtists'
const ACTIVE_ARTIST_KEY = 'orbit.feed.activeArtistId'
const CODE_VERIFIER_KEY = 'orbit.spotify.codeVerifier'
const ALBUMS_RATE_LIMIT_UNTIL_KEY = 'orbit.spotify.albumsRateLimitedUntil'
const TRACKS_RATE_LIMIT_UNTIL_KEY = 'orbit.spotify.tracksRateLimitedUntil'
const LAST_RATE_LIMIT_UNTIL_KEY = 'orbit.spotify.lastRateLimitedUntil'
const LAST_RATE_LIMIT_RETRY_AFTER_SEC_KEY = 'orbit.spotify.lastRetryAfterSec'
// Retry-After ヘッダが CORS で読み取れないことがあるため、
// ヘッダ値を取れなかった場合のフォールバック（安全側で長め）
const DEFAULT_429_FALLBACK_MS = 24 * 60 * 60 * 1000


// ---- API レスポンスキャッシュ (localStorage) ----
const CACHE_TTL_SHORT = 60 * 60 * 1000 // 1時間: top tracks, me等
const CACHE_TTL_LONG = 24 * 60 * 60 * 1000 // 24時間: albums, artist情報等

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: T; expiresAt: number }
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, expiresAt: Date.now() + ttlMs }))
  } catch {
    // storage full等は無視
  }
}

function getRateLimitedUntil(key: string): number {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function setRateLimitedUntil(key: string, untilMs: number): void {
  try {
    sessionStorage.setItem(key, String(untilMs))
  } catch {
    // ignore
  }
}

function isRateLimited(key: string): boolean {
  return Date.now() < getRateLimitedUntil(key)
}

function retryAfterMs(res: Response, fallbackMs: number): number {
  try {
    const ra = res.headers.get('Retry-After')
    if (!ra) return fallbackMs
    const sec = parseInt(ra, 10)
    if (!Number.isFinite(sec)) return fallbackMs
    // 429 の Retry-After は「分単位〜時間単位」でも返ることがある。
    // ここを短く切り詰めると、クールダウンが終わる前に再実行して再429しやすい。
    // UX/永続化の観点で最大24時間までに制限する。
    return Math.min(24 * 60 * 60 * 1000, Math.max(500, sec * 1000))
  } catch {
    return fallbackMs
  }
}

export async function getSpotifyAuthorizeUrl(): Promise<string> {
  if (isMockMode()) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000'
    return `${origin}/callback?code=mock`
  }
  if (!CLIENT_ID) {
    throw new Error('Spotify client_id is not configured')
  }

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getSpotifyRedirectUri(),
    scope: SCOPE,
    show_dialog: 'true',
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  })
  return `${SPOTIFY_AUTH_BASE}?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  if (isMockMode()) {
    return MOCK_ACCESS_TOKEN
  }
  if (!CLIENT_ID) {
    throw new Error('Spotify client_id is not configured')
  }

  const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY)
  if (!codeVerifier) {
    throw new Error('PKCE code verifier is missing')
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getSpotifyRedirectUri(),
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  })

  const res = await fetch(SPOTIFY_TOKEN_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const bodyText = await res.text()
    throw new Error(`Failed to exchange authorization code: ${bodyText}`)
  }

  const data = (await res.json()) as { access_token?: string; refresh_token?: string }
  if (!data.access_token) {
    throw new Error('access_token not found in response')
  }

  if (data.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
  }

  sessionStorage.removeItem(CODE_VERIFIER_KEY)
  return data.access_token
}

export function hasCodeVerifier(): boolean {
  return Boolean(sessionStorage.getItem(CODE_VERIFIER_KEY))
}

export function clearCodeVerifier(): void {
  sessionStorage.removeItem(CODE_VERIFIER_KEY)
}

export function saveAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getAccessToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) return token
  return isMockMode() ? MOCK_ACCESS_TOKEN : null
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

/** リフレッシュトークンでアクセストークンを再取得し localStorage を更新する。失敗時は null を返す */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken || !CLIENT_ID) return null

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    })
    const res = await fetch(SPOTIFY_TOKEN_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) return null

    const data = (await res.json()) as { access_token?: string; refresh_token?: string }
    if (!data.access_token) return null

    localStorage.setItem(TOKEN_KEY, data.access_token)
    // Spotify は新しい refresh_token を返すことがある（ローテーション）
    if (data.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
    }
    return data.access_token
  } catch {
    return null
  }
}

export function saveSelectedArtists(artists: SpotifyArtist[]): void {
  localStorage.setItem(PICKS_KEY, JSON.stringify(artists))
  const activeArtistId = localStorage.getItem(ACTIVE_ARTIST_KEY)
  if (!activeArtistId || activeArtistId === 'all') return

  const exists = artists.some((artist) => artist.id === activeArtistId)
  if (!exists) {
    localStorage.setItem(ACTIVE_ARTIST_KEY, 'all')
  }
}

export function getSelectedArtists(): SpotifyArtist[] {
  const raw = localStorage.getItem(PICKS_KEY)
  if (!raw) return isMockMode() ? MOCK_SELECTED_ARTISTS : []
  try {
    return JSON.parse(raw) as SpotifyArtist[]
  } catch {
    return isMockMode() ? MOCK_SELECTED_ARTISTS : []
  }
}

/**
 * Orbit Score: トラックの「推しとの相性」を 0–100 で算出。
 * - 再生回数（Spotify popularity）: 曲の人気度
 * - 親密度（affinity）: 選択順＝聴取量の代理（1番目＝よく聴く→高スコア）
 * モック時も選択順で一貫したスコアになり、「よく聴く推し＝高スコア」となる。
 */
export function computeOrbitScore(params: {
  track: SpotifyTrack
  selectedArtists: SpotifyArtist[]
  overlapCount?: number
}): number {
  const { track, selectedArtists, overlapCount = 0 } = params

  const pickIds = new Set(selectedArtists.map((a) => a.id))
  const trackArtistIds = new Set(track.artists.map((a) => a.id))

  let maxAffinity = 0
  for (let i = 0; i < selectedArtists.length; i++) {
    if (trackArtistIds.has(selectedArtists[i].id)) {
      const affinity = 100 - i * 15
      if (affinity > maxAffinity) maxAffinity = affinity
    }
  }

  const overlapBonus = Math.max(0, (overlapCount - 1) * 4)
  const base = 20 + maxAffinity * 0.6 + overlapBonus
  return Math.min(100, Math.max(0, Math.round(base)))
}

/** Spotify の popularity (0-100), followers, genres を含む拡張アーティスト型 */
export type ExtendedArtist = SpotifyArtist & {
  popularity?: number
}

/**
 * Orbit Loyalty Score（推し貢献度スコア）
 * ユーザーの top_tracks 内での出現回数 × マイナー度（popularity が低いほど高得点）
 */
export function computeOrbitLoyaltyScore(params: {
  countInTopTracks: number
  popularity: number
}): number {
  const { countInTopTracks } = params
  if (countInTopTracks <= 0) return 0
  return countInTopTracks * 50
}

/** トラックが top_tracks 内に出現する回数を返す */
export function countTrackInTopTracks(trackId: string, topTracks: SpotifyTrack[]): number {
  return topTracks.filter((t) => t.id === trackId).length
}

const TOP_ARTISTS_LIMIT = 10

async function fetchTopArtistsForRange(
  token: string,
  timeRange: 'medium_term' | 'short_term' | 'long_term',
): Promise<SpotifyArtist[]> {
  const cacheKey = `orbit.cache.topArtists.${timeRange}`
  const cached = cacheGet<SpotifyArtist[]>(cacheKey)
  if (cached) return cached

  const res = await spotifyGet(
    `/me/top/artists?limit=${TOP_ARTISTS_LIMIT}&time_range=${timeRange}`,
    token,
  )
  if (!res.ok) {
    if (res.status === 429) return []
    const text = await res.text().catch(() => '')
    throw new Error(`Spotify API error (top-artists) ${res.status}: ${text}`)
  }
  const data = (await res.json()) as { items?: SpotifyArtist[] }
  const items = (data.items ?? []) as SpotifyArtist[]
  cacheSet(cacheKey, items, CACHE_TTL_SHORT)
  return items
}

export async function fetchTopArtists(token: string): Promise<SpotifyArtist[]> {
  if (isMockMode() || token === MOCK_ACCESS_TOKEN) {
    return MOCK_ARTISTS.slice(0, TOP_ARTISTS_LIMIT)
  }

  // medium_term だけだと8件など少なく返ることがあるため、
  // 10件未満なら short_term / long_term も取得してマージする
  const seen = new Set<string>()
  const merged: SpotifyArtist[] = []

  const addUnique = (items: SpotifyArtist[]) => {
    for (const a of items) {
      if (merged.length >= TOP_ARTISTS_LIMIT) break
      if (seen.has(a.id)) continue
      seen.add(a.id)
      merged.push(a)
    }
  }

  const medium = await fetchTopArtistsForRange(token, 'medium_term')
  addUnique(medium)

  if (merged.length < TOP_ARTISTS_LIMIT) {
    const short = await fetchTopArtistsForRange(token, 'short_term')
    addUnique(short)
  }
  if (merged.length < TOP_ARTISTS_LIMIT) {
    const long = await fetchTopArtistsForRange(token, 'long_term')
    addUnique(long)
  }

  return merged
}

/** Spotify Search の offset 上限（公式: Maximum 1000） */
export const SPOTIFY_SEARCH_MAX_OFFSET = 1000

/**
 * Search API では `limit` クエリを送ると環境によってエラーになるため送らない。
 * 未指定時のデフォルト件数（公式想定）に合わせてページングする。
 */
export const SPOTIFY_SEARCH_PAGE_SIZE = 20

/** 初回検索でまとめて取る上限（limit クエリ無しのため複数回 offset で取得） */
const SEARCH_AGGREGATE_MAX_ITEMS = 100
const SEARCH_AGGREGATE_MAX_REQUESTS = 24

export type AggregatedSearch<T> = {
  items: T[]
  /** 次の「さらに読み込む」用 offset（直近まで進んだ値） */
  nextOffset: number
  hasMore: boolean
}

/**
 * 検索を offset だけ進めながら複数回叩き、1画面にまとめる（API が5件ずつ等でも対応）。
 */
export async function searchAllTracksAggregated(
  token: string,
  query: string,
  options?: { maxItems?: number; startOffset?: number },
): Promise<AggregatedSearch<SpotifyTrack>> {
  const q = query.trim()
  if (!q) return { items: [], nextOffset: 0, hasMore: false }

  const maxItems = Math.min(options?.maxItems ?? SEARCH_AGGREGATE_MAX_ITEMS, 200)
  let offset = Math.max(0, Math.min(SPOTIFY_SEARCH_MAX_OFFSET, options?.startOffset ?? 0))
  const seen = new Set<string>()
  const merged: SpotifyTrack[] = []
  let lastBatchLen = 0
  let requests = 0

  while (
    merged.length < maxItems &&
    offset <= SPOTIFY_SEARCH_MAX_OFFSET &&
    requests < SEARCH_AGGREGATE_MAX_REQUESTS
  ) {
    requests += 1
    const batch = await searchAllTracks(token, q, offset)
    lastBatchLen = batch.length
    if (batch.length === 0) break
    for (const t of batch) {
      if (seen.has(t.id)) continue
      seen.add(t.id)
      merged.push(t)
      if (merged.length >= maxItems) break
    }
    offset += batch.length
    if (merged.length >= maxItems) break
  }

  const hasMore = lastBatchLen > 0 && offset <= SPOTIFY_SEARCH_MAX_OFFSET
  return { items: merged, nextOffset: offset, hasMore }
}

export async function searchArtistsAggregated(
  token: string,
  query: string,
  options?: { maxItems?: number; startOffset?: number },
): Promise<AggregatedSearch<SpotifyArtist>> {
  if (!query.trim()) return { items: [], nextOffset: 0, hasMore: false }

  const maxItems = Math.min(options?.maxItems ?? SEARCH_AGGREGATE_MAX_ITEMS, 200)
  let offset = Math.max(0, Math.min(SPOTIFY_SEARCH_MAX_OFFSET, options?.startOffset ?? 0))
  const seen = new Set<string>()
  const merged: SpotifyArtist[] = []
  let lastBatchLen = 0
  let requests = 0

  while (
    merged.length < maxItems &&
    offset <= SPOTIFY_SEARCH_MAX_OFFSET &&
    requests < SEARCH_AGGREGATE_MAX_REQUESTS
  ) {
    requests += 1
    const batch = await searchArtists(token, query, offset)
    lastBatchLen = batch.length
    if (batch.length === 0) break
    for (const a of batch) {
      if (seen.has(a.id)) continue
      seen.add(a.id)
      merged.push(a)
      if (merged.length >= maxItems) break
    }
    offset += batch.length
    if (merged.length >= maxItems) break
  }

  const hasMore = lastBatchLen > 0 && offset <= SPOTIFY_SEARCH_MAX_OFFSET
  return { items: merged, nextOffset: offset, hasMore }
}

/**
 * アーティスト検索。モック時は MOCK_ARTISTS を名前・ジャンルでフィルタ。
 * @param offset ページング用（0 始まり）。`SPOTIFY_SEARCH_PAGE_SIZE` ずつ進める。
 */
export async function searchArtists(
  token: string,
  query: string,
  offset = 0,
): Promise<SpotifyArtist[]> {
  const raw = query.trim()
  const q = raw.toLowerCase()
  const off = Math.max(0, Math.min(SPOTIFY_SEARCH_MAX_OFFSET, offset))
  const page = SPOTIFY_SEARCH_PAGE_SIZE
  // モックトークンの場合のみモックデータを返す（isMockMode()だけでは判定しない）
  if (token === MOCK_ACCESS_TOKEN) {
    if (!q) return MOCK_ARTISTS.slice(off, off + page)
    const filtered = MOCK_ARTISTS.filter(
      (a) =>
        a.name.toLowerCase().includes(q) || a.genres.some((g) => g.toLowerCase().includes(q)),
    )
    return filtered.slice(off, off + page)
  }
  if (!q) return []
  // 1文字クエリは Spotify API が 400 を返すことがあるためスキップ
  if (q.length < 2) return []

  if (off === 0) {
    const cacheKey = `orbit.cache.searchArtists.${q}`
    const cached = cacheGet<SpotifyArtist[]>(cacheKey)
    if (cached) return cached
  }

  const params = new URLSearchParams({ q: raw, type: 'artist' })
  if (off > 0) params.set('offset', String(off))

  const res = await spotifyGet(`/search?${params.toString()}`, token)
  if (!res.ok) {
    if (res.status === 429) return []
    const text = await res.text().catch(() => '')
    throw new Error(`Spotify API error (search-artists) ${res.status}: ${text}`)
  }
  const data = (await res.json()) as { artists?: { items?: SpotifyArtist[] } }
  console.log('search response:', data)
  const items = (data.artists?.items ?? []) as SpotifyArtist[]

  if (off === 0 && items.length > 0) {
    const cacheKey = `orbit.cache.searchArtists.${q}`
    cacheSet(cacheKey, items, CACHE_TTL_SHORT)
  }
  return items
}

export async function fetchTopTracks(token: string): Promise<SpotifyTrack[]> {
  if (isMockMode() || token === MOCK_ACCESS_TOKEN) {
    return MOCK_TOP_TRACKS.map(enrichMockTrack)
  }
  const cacheKey = 'orbit.cache.topTracks'
  const cached = cacheGet<SpotifyTrack[]>(cacheKey)
  if (cached) return cached

  const res = await spotifyGet('/me/top/tracks?limit=20&time_range=medium_term', token)

  if (!res.ok) {
    if (res.status === 429) {
      const until = Date.now() + retryAfterMs(res, DEFAULT_429_FALLBACK_MS)
      setRateLimitedUntil(TRACKS_RATE_LIMIT_UNTIL_KEY, until)
      setForceMockFallback()
      return MOCK_TOP_TRACKS.map(enrichMockTrack)
    }
    const text = await res.text().catch(() => '')
    throw new Error(`Spotify API error (top-tracks) ${res.status}: ${text}`)
  }

  const data = await res.json()
  const tracks = data.items as SpotifyTrack[]
  cacheSet(cacheKey, tracks, CACHE_TTL_SHORT)
  return tracks
}

export async function fetchArtistRecommendations(
  token: string,
  artistId: string,
  limit = 10,
): Promise<SpotifyTrack[]> {
  const mockResult = () => {
    const lookupId = getMockTrackArtistId(artistId)
    const matched = MOCK_TOP_TRACKS.filter((t) => t.artists.some((a) => a.id === lookupId))
    if (matched.length > 0) return matched.slice(0, limit).map(enrichMockTrack)
    return [buildMockTrackForArtist(artistId)].slice(0, limit)
  }

  if (isMockMode() || token === MOCK_ACCESS_TOKEN) return mockResult()

  const cacheKey = `orbit.cache.recommendations.${artistId}`
  const cached = cacheGet<SpotifyTrack[]>(cacheKey)
  if (cached) return cached

  const qs = new URLSearchParams({
    limit: String(Math.max(1, Math.min(50, limit))),
    seed_artists: artistId,
  })

  const res = await spotifyGet(`/recommendations?${qs.toString()}`, token)
  if (!res.ok) {
    if (res.status === 429) return mockResult()
    const text = await res.text().catch(() => '')
    if (res.status === 401) throw new Error(`Spotify API error (recommendations) ${res.status}: ${text}`)
    throw new Error(`Spotify API error (recommendations) ${res.status}: ${text}`)
  }

  const data = (await res.json()) as { tracks?: SpotifyTrack[] }
  const tracks = (data.tracks ?? []) as SpotifyTrack[]
  cacheSet(cacheKey, tracks, CACHE_TTL_SHORT)
  return tracks
}

/**
 * アーティストの人気曲。`market` を増やすと 403/429 が増えやすいので
 * まず `from_token` だけを試す。403 になった推しは session 内で以後再試行しない。
 */
/**
 * アーティスト単体取得。GET /artists/{id}
 */
export async function fetchArtist(token: string, artistId: string): Promise<SpotifyArtist | null> {
  if (isMockMode() || token === MOCK_ACCESS_TOKEN) {
    return getMockArtistById(artistId)
  }
  const cacheKey = `orbit.cache.artist.${artistId}`
  const cached = cacheGet<SpotifyArtist>(cacheKey)
  if (cached) return cached

  const res = await spotifyGet(`/artists/${artistId}`, token)
  if (!res.ok) {
    if (res.status === 429) return getMockArtistById(artistId)
    if (res.status === 404) return null
    const text = await res.text().catch(() => '')
    throw new Error(`Spotify API error (artist) ${res.status}: ${text}`)
  }
  const data = (await res.json()) as SpotifyArtist
  cacheSet(cacheKey, data, CACHE_TTL_LONG)
  return data
}

/**
 * 関連アーティスト取得。GET /artists/{id}/related-artists
 */
export async function fetchRelatedArtists(
  token: string,
  artistId: string,
): Promise<SpotifyArtist[]> {
  if (isMockMode() || token === MOCK_ACCESS_TOKEN) {
    const artist = getMockArtistById(artistId)
    if (!artist) return []
    return MOCK_ARTISTS.filter((a) => a.id !== artistId).slice(0, 6)
  }
  const cacheKey = `orbit.cache.relatedArtists.${artistId}`
  const cached = cacheGet<SpotifyArtist[]>(cacheKey)
  if (cached) return cached

  const res = await spotifyGet(`/artists/${artistId}/related-artists`, token)
  if (!res.ok) {
    if (res.status === 429) {
      const artist = getMockArtistById(artistId)
      if (!artist) return []
      return MOCK_ARTISTS.filter((a) => a.id !== artistId).slice(0, 6)
    }
    const text = await res.text().catch(() => '')
    throw new Error(`Spotify API error (related-artists) ${res.status}: ${text}`)
  }
  const data = (await res.json()) as { artists?: SpotifyArtist[] }
  const artists = (data.artists ?? []) as SpotifyArtist[]
  cacheSet(cacheKey, artists, CACHE_TTL_LONG)
  return artists
}

export async function fetchArtistTopTracks(
  token: string,
  artistId: string,
  _userCountry?: string | null,
): Promise<SpotifyTrack[]> {
  const mockResult = (() => {
    const lookupId = getMockTrackArtistId(artistId)
    const matched = MOCK_TOP_TRACKS.filter((t) => t.artists.some((a) => a.id === lookupId))
    if (matched.length > 0) {
      const tracks = matched.slice(0, 10).map(enrichMockTrack)
      if (lookupId !== artistId) {
        return tracks.map((t) => ({
          ...t,
          artists: t.artists.map((a) => (a.id === lookupId ? { ...a, id: artistId } : a)),
        }))
      }
      return tracks
    }
    return [buildMockTrackForArtist(artistId)]
  })

  if (isMockMode() || token === MOCK_ACCESS_TOKEN) {
    return mockResult()
  }

  // /artists/{id}/top-tracks は Development Mode では利用不可（2026年2月〜）
  return []
}

export async function fetchArtistRecentAlbums(
  token: string,
  artistId: string,
  limit = 5,
  userCountry?: string | null,
): Promise<
  Array<{
    id: string
    name?: string
    release_date?: string | null
    album_type?: string
    images?: Array<{ url: string; height: number | null; width: number | null }> | null
  }>
> {
  const mockAlbums = (() => {
    const artist = getMockArtistById(artistId)
    if (!artist) return []
    return [
      { id: `mock-album-${artistId}-1`, name: `${artist.name} Mock Release`, release_date: '2024-01-01', album_type: 'album', images: artist.images },
      { id: `mock-album-${artistId}-2`, name: `${artist.name} Mock Album 2`, release_date: '2023-06-01', album_type: 'album', images: artist.images },
      { id: `mock-album-${artistId}-3`, name: `${artist.name} Mock Album 3`, release_date: '2023-01-01', album_type: 'single', images: artist.images },
    ].slice(0, limit)
  })

  if (isMockMode() || token === MOCK_ACCESS_TOKEN) {
    return mockAlbums()
  }

  const cacheKey = `orbit.cache.artistAlbums.${artistId}`
  const cached = cacheGet<ReturnType<typeof mockAlbums>>(cacheKey)
  if (cached) return cached

  // 最新リリース抽出のためのアルバム/シングル一覧。
  // API 呼び出し量を抑えるため market 試行は最小限にする。
  // 429 が出たら他 market は試さずこの推しをスキップする（レート制限を悪化させない）。
  if (isRateLimited(ALBUMS_RATE_LIMIT_UNTIL_KEY)) return mockAlbums()

  const toAlbumItem = (a: any) => ({
    id: String(a.id),
    name: a.name ?? null,
    release_date: a.release_date ?? null,
    album_type: a.album_type ?? 'album',
    images: a.images ?? null,
  })

  const allItems: ReturnType<typeof toAlbumItem>[] = []
  let nextPath: string | null = `/artists/${artistId}/albums?include_groups=album%2Csingle`

  while (nextPath) {
    const res = await spotifyGet(nextPath, token)

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (res.status === 401) {
        throw new Error(`Spotify API error (artist albums) 401: ${text}`)
      }
      if (res.status === 429) {
        const until = Date.now() + retryAfterMs(res, DEFAULT_429_FALLBACK_MS)
        setRateLimitedUntil(ALBUMS_RATE_LIMIT_UNTIL_KEY, until)
        return allItems.length > 0 ? allItems : mockAlbums()
      }
      console.warn(`[Spotify albums] ${res.status} for artist ${artistId}:`, text)
      break
    }

    const data = (await res.json()) as { items?: Array<any>; next?: string | null }
    allItems.push(...(data.items ?? []).map(toAlbumItem))

    // next は完全URL（https://api.spotify.com/v1/...）なので、パス+クエリ部分だけ抽出
    if (data.next) {
      try {
        const u = new URL(data.next)
        nextPath = `${u.pathname.replace('/v1', '')}${u.search}`
      } catch {
        nextPath = null
      }
    } else {
      nextPath = null
    }
  }

  cacheSet(cacheKey, allItems, CACHE_TTL_LONG)
  return allItems
}

export async function fetchAlbumTracks(
  token: string,
  albumId: string,
  limit = 3,
): Promise<SpotifyTrack[]> {
  if (isMockMode() || token === MOCK_ACCESS_TOKEN) {
    const m = albumId.match(/^mock-album-(.+)-([123])$/)
    const rawArtistId = m ? m[1] : albumId.replace(/^mock-album-/, '')
    const lookupId = getMockTrackArtistId(rawArtistId)
    const albumNum = m ? Number(m[2]) : 1
    const matched = MOCK_TOP_TRACKS.filter((t) => t.artists.some((a) => a.id === lookupId))
    if (matched.length > 0) {
      const start = (albumNum - 1) * 10
      const slice = matched.slice(start, start + limit).map(enrichMockTrack)
      if (lookupId !== rawArtistId) {
        return slice.map((t) => ({
          ...t,
          artists: t.artists.map((a) => (a.id === lookupId ? { ...a, id: rawArtistId } : a)),
        }))
      }
      return slice
    }
    return [buildMockTrackForArtist(rawArtistId)].slice(0, limit)
  }
  const cacheKey = `orbit.cache.albumTracks.${albumId}`
  const cached = cacheGet<SpotifyTrack[]>(cacheKey)
  if (cached) return cached

  if (isRateLimited(TRACKS_RATE_LIMIT_UNTIL_KEY)) return []
  const res = await spotifyGet(`/albums/${albumId}/tracks?limit=${limit}`, token)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 401) {
      throw new Error(`Spotify API error (album tracks) ${res.status}: ${text}`)
    }
    if (res.status === 429) {
      const until = Date.now() + retryAfterMs(res, DEFAULT_429_FALLBACK_MS)
      setRateLimitedUntil(TRACKS_RATE_LIMIT_UNTIL_KEY, until)
      return []
    }
    return []
  }

  const data = (await res.json()) as { items?: SpotifyTrack[] }
  const tracks = (data.items ?? []) as SpotifyTrack[]
  cacheSet(cacheKey, tracks, CACHE_TTL_LONG)
  return tracks
}

/**
 * top-tracks が空のときの補完。`GET /v1/search` でアーティスト名からトラックを拾う。
 * NOTE: Search は `market=from_token` が 400 になる環境があるため、**ISO 国コードのみ**で試す。
 */
export async function searchTracksForArtist(
  token: string,
  artistId: string,
  artistName: string,
  _userCountry?: string | null,
  limit = 8,
): Promise<SpotifyTrack[]> {
  const mockResult = () => {
    const lookupId = getMockTrackArtistId(artistId)
    const byId = MOCK_TOP_TRACKS.filter((t) => t.artists.some((a) => a.id === lookupId))
    if (byId.length > 0) return byId.slice(0, limit).map(enrichMockTrack)
    const q = artistName.trim().toLowerCase()
    const byName = MOCK_TOP_TRACKS.filter((t) => t.artists.some((a) => a.name.toLowerCase().includes(q))).slice(0, limit)
    if (byName.length > 0) return byName.map(enrichMockTrack)
    return [buildMockTrackForArtist(artistId)].slice(0, limit)
  }

  if (isMockMode() || token === MOCK_ACCESS_TOKEN) return mockResult()

  const cacheKey = `orbit.cache.searchTracks.${artistId}`
  const cached = cacheGet<SpotifyTrack[]>(cacheKey)
  if (cached) return cached
  const safe = artistName.replace(/["']/g, '').trim()
  if (!safe) return []

  // Search は環境によって `q=<artist名だけ>` が 400 になることがあるため、
  // `artist:<name>` だけに絞る（その上で artistId が含まれるものを優先）
  const q = `artist:${safe}`

  // 候補を取りすぎると 429 になりやすいので控えめにする
  for (const _ of [0]) {
    const params = new URLSearchParams({
      q,
      type: 'track',
    })

    const res = await spotifyGet(`/search?${params.toString()}`, token)

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (res.status === 401) {
        throw new Error(`Spotify API error (search) ${res.status}: ${text}`)
      }
      // 400/429/その他は次のクエリ形式へ
      continue
    }

    const data = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } }
    const items = (data.tracks?.items ?? []) as SpotifyTrack[]
    if (items.length === 0) continue

    const byId = items.filter((t) => t.artists?.some((a) => a.id === artistId))
    const picked = (byId.length > 0 ? byId : items).slice(0, limit)
    if (picked.length > 0) {
      cacheSet(cacheKey, picked, CACHE_TTL_SHORT)
      return picked
    }
  }

  return mockResult()
}

/**
 * 5人の推しアーティストの曲を検索。クエリに曲名・アーティスト名でマッチするトラックを返す。
 */
export type FeedItem = {
  id: string
  title: string
  body: string
  coverUrl: string | null
  trackUrl: string
  spotifyUri: string
  score: number
  fetchedAt: string
  overlapCount: number
  artistIds: string[]
  sourcePickId: string | null
}

export function toISODate(value?: string | null): string | null {
  if (!value) return null
  if (/^\d{4}$/.test(value)) return new Date(`${value}-01-01T00:00:00.000Z`).toISOString()
  if (/^\d{4}-\d{2}$/.test(value)) return new Date(`${value}-01T00:00:00.000Z`).toISOString()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`).toISOString()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function buildFeedItems(
  items: Array<{
    track: SpotifyTrack
    sourcePickId: string | null
    fetchedAt: string | null
    albumName: string | null
    coverUrl: string | null
  }>,
  picks: SpotifyArtist[],
): FeedItem[] {
  const pickIds = new Set(picks.map((artist) => artist.id))
  const ranked = items.slice(0, 500).map(({ track, sourcePickId, fetchedAt, albumName, coverUrl }) => {
    const trackArtistIds = new Set(track.artists.map((a) => a.id))
    const overlapCount = [...trackArtistIds].filter((id) => pickIds.has(id)).length
    const score = computeOrbitScore({ track, selectedArtists: picks, overlapCount })
    return {
      track,
      sourcePickId,
      overlapCount,
      score,
      artistIds: [...trackArtistIds],
      fetchedAt,
      albumName,
      coverUrl,
    }
  })
  const related = ranked
    .filter((r) => r.overlapCount > 0)
    .sort((a, b) => (b.track.popularity ?? 0) - (a.track.popularity ?? 0))
  return related.map(({ track, overlapCount, score, artistIds, sourcePickId, fetchedAt, albumName, coverUrl }, index) => {
    const album = track.album
    const computedFetchedAt = fetchedAt ?? toISODate(album?.release_date) ?? new Date().toISOString()
    const artistNames = track.artists.map((artist) => artist.name).join(', ')
    const relation =
      overlapCount > 0
        ? `あなたの推し ${overlapCount} 人と重なるトラック。`
        : 'あなたの傾向に近いおすすめトラック。'
    return {
      id: `${track.id}-${index}`,
      title: `${track.name} - ${albumName ?? album?.name ?? track.name}`,
      body: `${artistNames} / ${relation}`,
      coverUrl: coverUrl ?? album?.images?.[0]?.url ?? null,
      trackUrl: track.external_urls?.spotify ?? '',
      spotifyUri: `spotify:track:${track.id}`,
      score,
      overlapCount,
      artistIds,
      sourcePickId,
      fetchedAt: computedFetchedAt,
    }
  })
}

export async function searchTracksFromArtists(
  token: string,
  artists: SpotifyArtist[],
  query: string,
  limit = 20,
): Promise<SpotifyTrack[]> {
  const q = query.trim()
  if (!q || artists.length === 0) return []

  const artistIds = new Set(artists.map((a) => a.id))

  if (isMockMode() || token === MOCK_ACCESS_TOKEN) {
    const lower = q.toLowerCase()
    const matched = MOCK_TOP_TRACKS.filter((t) => {
      if (!t.artists.some((a) => artistIds.has(a.id))) return false
      return (
        t.name.toLowerCase().includes(lower) ||
        t.artists.some((a) => a.name.toLowerCase().includes(lower)) ||
        t.album?.name?.toLowerCase().includes(lower)
      )
    })
    return matched.slice(0, limit).map(enrichMockTrack)
  }

  const params = new URLSearchParams({ q, type: 'track' })
  const res = await spotifyGet(`/search?${params.toString()}`, token)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 401) {
      throw new Error(`Spotify API error (search) ${res.status}: ${text}`)
    }
    return []
  }
  const data = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } }
  const items = (data.tracks?.items ?? []) as SpotifyTrack[]
  const filtered = items.filter((t) => t.artists?.some((a) => artistIds.has(a.id)))
  return filtered.slice(0, limit)
}

/**
 * @param offset ページング用（0 始まり）。`SPOTIFY_SEARCH_PAGE_SIZE` ずつ進める。
 */
export async function searchAllTracks(
  token: string,
  query: string,
  offset = 0,
): Promise<SpotifyTrack[]> {
  const q = query.trim()
  if (!q) return []

  const off = Math.max(0, Math.min(SPOTIFY_SEARCH_MAX_OFFSET, offset))
  const page = SPOTIFY_SEARCH_PAGE_SIZE

  if (isMockMode() || token === MOCK_ACCESS_TOKEN) {
    const lower = q.toLowerCase()
    const filtered = MOCK_TOP_TRACKS.filter((t) =>
      t.name.toLowerCase().includes(lower) ||
      t.artists.some((a) => a.name.toLowerCase().includes(lower)) ||
      t.album?.name?.toLowerCase().includes(lower)
    )
    return filtered.slice(off, off + page).map(enrichMockTrack)
  }

  const params = new URLSearchParams({ q, type: 'track' })
  if (off > 0) params.set('offset', String(off))
  const res = await spotifyGet(`/search?${params.toString()}`, token)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 401) {
      throw new Error(`Spotify API error (search) ${res.status}: ${text}`)
    }
    return []
  }
  const data = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } }
  return (data.tracks?.items ?? []) as SpotifyTrack[]
}

export async function fetchMe(token: string): Promise<SpotifyMe> {
  if (isMockMode() || token === MOCK_ACCESS_TOKEN) {
    return MOCK_ME
  }
  const cacheKey = 'orbit.cache.me'
  const cached = cacheGet<SpotifyMe>(cacheKey)
  if (cached) return cached

  const res = await spotifyGet('/me', token)

  if (!res.ok) {
    if (res.status === 429) return MOCK_ME
    const text = await res.text().catch(() => '')
    throw new Error(`Spotify API error (me) ${res.status}: ${text}`)
  }

  const data = (await res.json()) as SpotifyMe
  cacheSet(cacheKey, data, CACHE_TTL_SHORT)
  return data
}

export type TrackPreviewInfo = {
  previewUrl: string | null
  name: string
  artistName: string
  coverUrl: string | null
}

export async function fetchTrackPreview(trackId: string): Promise<TrackPreviewInfo | null> {
  const token = getAccessToken()
  if (!token) return null
  try {
    const res = await spotifyGet(`/tracks/${trackId}`, token)
    if (!res.ok) return null
    const data = (await res.json()) as {
      preview_url?: string | null
      name?: string
      artists?: Array<{ name: string }>
      album?: { images?: Array<{ url: string }> }
    }
    return {
      previewUrl: data?.preview_url ?? null,
      name: data?.name ?? '',
      artistName: data?.artists?.map((a) => a.name).join(', ') ?? '',
      coverUrl: data?.album?.images?.[0]?.url ?? null,
    }
  } catch {
    return null
  }
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(64)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
