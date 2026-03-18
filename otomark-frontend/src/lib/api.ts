import axios from 'axios'

// ===== Axiosインスタンス =====
export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// リクエストインターセプター: JWTトークンを自動付与
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('otomark_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// レスポンスインターセプター: 401時は自動ログアウト
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('otomark_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ===== 共通型定義 =====
export type User = {
  id: number
  username: string
  email: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  marks_count?: number
  reviews_count?: number
  followers_count?: number
  following_count?: number
  is_following?: boolean
}

export type Artist = {
  id: number
  name: string
  image_url: string | null
  genres: string[]
  country: string | null
  albums_count?: number
  marks_count?: number
}

export type Album = {
  id: number
  title: string
  cover_url: string | null
  release_date: string | null
  genres: string[]
  artist_id: number
  artist_name: string
  avg_score: number | null
  marks_count: number
  reviews_count: number
  tracks?: Track[]
  reviews?: Review[]
}

export type Track = {
  id: number
  title: string
  duration: number | null
  track_number: number | null
  album_id: number | null
  artist_id: number
  artist_name?: string
}

export type Mark = {
  id: number
  score: number | null
  listened_at: string
  album_id: number | null
  album_title: string | null
  album_cover: string | null
  artist_id: number | null
  artist_name: string | null
  track_id: number | null
  track_title: string | null
  review_id: number | null
  review_body: string | null
  likes_count?: number
}

export type Comment = {
  id: number
  body: string
  created_at: string
  user_id: number
  username: string
  display_name: string
  avatar_url: string | null
}

export type Review = {
  id: number
  body: string
  likes_count: number
  created_at: string
  updated_at?: string
  score: number | null
  user_id: number
  username: string
  display_name: string
  avatar_url: string | null
  album_id: number | null
  album_title: string | null
  album_cover: string | null
  artist_id: number | null
  artist_name: string | null
  track_id: number | null
  track_title: string | null
  is_liked?: boolean
  is_saved?: boolean
}

// ===== API関数 =====

// --- 認証 ---
export const authApi = {
  register: (data: { username: string; email: string; password: string; display_name: string }) =>
    apiClient.post<{ token: string; user: User }>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<{ token: string; user: User }>('/auth/login', data),

  me: () =>
    apiClient.get<User>('/auth/me'),

  updateProfile: (data: { display_name?: string; bio?: string }) =>
    apiClient.put<User>('/auth/profile', data),
}

// --- アルバム ---
export const albumsApi = {
  list: (params?: { q?: string; genre?: string; page?: number; limit?: number }) =>
    apiClient.get<{ albums: Album[]; page: number; limit: number }>('/albums', { params }),

  get: (albumId: number) =>
    apiClient.get<Album>(`/albums/${albumId}`),
}

// --- アーティスト ---
export const artistsApi = {
  list: (params?: { q?: string; page?: number }) =>
    apiClient.get<{ artists: Artist[] }>('/artists', { params }),

  get: (artistId: number) =>
    apiClient.get<Artist & { albums: Album[] }>(`/artists/${artistId}`),
}

// --- マーク ---
export const marksApi = {
  create: (data: {
    album_id?: number
    track_id?: number
    artist_id?: number
    score?: number
    review?: string
    listened_at?: string
  }) =>
    apiClient.post<{ success: boolean; markId: number; reviewId: number | null }>('/marks', data),

  delete: (markId: number) =>
    apiClient.delete(`/marks/${markId}`),

  byUser: (username: string, params?: { page?: number; limit?: number }) =>
    apiClient.get<{ marks: Mark[]; page: number; limit: number }>(`/marks/user/${username}`, { params }),
}

// --- レビュー ---
export const reviewsApi = {
  timeline: (params?: { mode?: 'all' | 'following'; page?: number; limit?: number }) =>
    apiClient.get<{ reviews: Review[]; page: number; limit: number }>('/reviews', { params }),

  get: (reviewId: number) =>
    apiClient.get<Review>(`/reviews/${reviewId}`),

  update: (reviewId: number, body: string) =>
    apiClient.put(`/reviews/${reviewId}`, { body }),

  delete: (reviewId: number) =>
    apiClient.delete(`/reviews/${reviewId}`),

  like: (reviewId: number) =>
    apiClient.post<{ likes_count: number }>(`/reviews/${reviewId}/like`),

  unlike: (reviewId: number) =>
    apiClient.delete<{ likes_count: number }>(`/reviews/${reviewId}/like`),

  save: (reviewId: number) =>
    apiClient.post<{ saved: boolean }>(`/reviews/${reviewId}/save`),

  unsave: (reviewId: number) =>
    apiClient.delete<{ saved: boolean }>(`/reviews/${reviewId}/save`),
}

// --- 保存済みレビュー ---
export const savedApi = {
  list: () => apiClient.get<{ reviews: Review[] }>('/auth/saved'),
}

// --- コメント ---
export const commentsApi = {
  list: (reviewId: number) =>
    apiClient.get<{ comments: Comment[] }>(`/reviews/${reviewId}/comments`),

  create: (reviewId: number, body: string) =>
    apiClient.post<Comment>(`/reviews/${reviewId}/comments`, { body }),

  delete: (reviewId: number, commentId: number) =>
    apiClient.delete(`/reviews/${reviewId}/comments/${commentId}`),
}

// --- ランキング ---
export const rankingApi = {
  albums: (params?: { genre?: string; period?: 'week' | 'month' | 'alltime'; limit?: number }) =>
    apiClient.get<{ albums: Album[]; period: string; genre: string }>('/ranking/albums', { params }),

  artists: (params?: { limit?: number }) =>
    apiClient.get<{ artists: Artist[] }>('/ranking/artists', { params }),
}

// --- 通知 ---
export type Notification = {
  id: number
  type: 'like' | 'comment' | 'follow'
  is_read: boolean
  created_at: string
  review_id: number | null
  actor_username: string
  actor_display_name: string
  review_body: string | null
}

export const notificationsApi = {
  list: () => apiClient.get<{ notifications: Notification[]; unread_count: number }>('/notifications'),
  readAll: () => apiClient.post('/notifications/read-all'),
}

// --- 聴きたいリスト ---
export type WantItem = {
  id: number
  album_id: number | null
  album_title: string | null
  album_cover: string | null
  artist_id: number | null
  artist_name: string | null
  track_id: number | null
  track_title: string | null
  created_at: string
}

export const wantApi = {
  add: (data: { album_id?: number; artist_id?: number; track_id?: number }) =>
    apiClient.post('/marks/want', data),
  remove: (id: number) =>
    apiClient.delete(`/marks/want/${id}`),
  list: () => apiClient.get<{ items: WantItem[] }>('/marks/want'),
}

// --- ユーザー ---
export const usersApi = {
  get: (username: string) =>
    apiClient.get<User>(`/users/${username}`),

  reviews: (username: string, params?: { page?: number }) =>
    apiClient.get<{ reviews: Review[] }>(`/users/${username}/reviews`, { params }),

  follow: (username: string) =>
    apiClient.post(`/users/${username}/follow`),

  unfollow: (username: string) =>
    apiClient.delete(`/users/${username}/follow`),

  followers: (username: string) =>
    apiClient.get<{ followers: User[] }>(`/users/${username}/followers`),

  following: (username: string) =>
    apiClient.get<{ following: User[] }>(`/users/${username}/following`),
}

// --- MusicBrainz ---
export type MBReleaseResult = {
  mbid: string
  title: string
  artist: string
  date: string | null
  coverUrl: string
  trackCount: number | null
}

export type MBArtistResult = {
  mbid: string
  name: string
  country: string | null
  genres: string[]
}

export type MBRecordingResult = {
  mbid: string
  title: string
  artist: string
  duration: number | null
  albumTitle: string | null
  albumMbid: string | null
}

export type MBImportResult = {
  artistId?: number
  albumId?: number
  trackId?: number
}

export const musicbrainzApi = {
  searchReleases: (q: string) =>
    apiClient.get<{ results: MBReleaseResult[] }>('/musicbrainz/search', { params: { q, type: 'release' } }),

  searchArtists: (q: string) =>
    apiClient.get<{ results: MBArtistResult[] }>('/musicbrainz/search', { params: { q, type: 'artist' } }),

  searchRecordings: (q: string) =>
    apiClient.get<{ results: MBRecordingResult[] }>('/musicbrainz/search', { params: { q, type: 'recording' } }),

  import: (data: { type: 'release' | 'artist' | 'recording'; mbid: string }) =>
    apiClient.post<MBImportResult>('/musicbrainz/import', data),
}