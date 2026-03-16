import {
    useQuery,
    useMutation,
    useInfiniteQuery,
    useQueryClient,
    type InfiniteData,
  } from '@tanstack/react-query'
  import {
    albumsApi,
    artistsApi,
    marksApi,
    reviewsApi,
    rankingApi,
    usersApi,
    authApi,
    type Review,
  } from './api'
  
  // ===== クエリキー定数（キャッシュの識別子） =====
  export const queryKeys = {
    albums:      (params?: object) => ['albums', params] as const,
    album:       (id: number)      => ['albums', id]     as const,
    artists:     (params?: object) => ['artists', params] as const,
    artist:      (id: number)      => ['artists', id]    as const,
    timeline:    (mode: string)    => ['reviews', 'timeline', mode] as const,
    review:      (id: number)      => ['reviews', id]    as const,
    ranking:     (params?: object) => ['ranking', params] as const,
    rankArtists: ()                => ['ranking', 'artists'] as const,
    user:        (username: string)=> ['users', username] as const,
    userReviews: (username: string)=> ['users', username, 'reviews'] as const,
    userMarks:   (username: string)=> ['users', username, 'marks']   as const,
    me:          ()                => ['auth', 'me']     as const,
  }
  
  // =============================================
  // アルバム
  // =============================================
  export function useAlbums(params?: { q?: string; genre?: string; page?: number }) {
    return useQuery({
      queryKey: queryKeys.albums(params),
      queryFn: () => albumsApi.list(params).then(r => r.data),
      staleTime: 1000 * 60 * 5, // 5分キャッシュ
    })
  }
  
  export function useAlbum(albumId: number) {
    return useQuery({
      queryKey: queryKeys.album(albumId),
      queryFn: () => albumsApi.get(albumId).then(r => r.data),
      staleTime: 1000 * 60 * 10,
      enabled: albumId > 0,
    })
  }
  
  // =============================================
  // アーティスト
  // =============================================
  export function useArtists(params?: { q?: string }) {
    return useQuery({
      queryKey: queryKeys.artists(params),
      queryFn: () => artistsApi.list(params).then(r => r.data),
      staleTime: 1000 * 60 * 5,
    })
  }
  
  export function useArtist(artistId: number) {
    return useQuery({
      queryKey: queryKeys.artist(artistId),
      queryFn: () => artistsApi.get(artistId).then(r => r.data),
      staleTime: 1000 * 60 * 10,
      enabled: artistId > 0,
    })
  }
  
  // =============================================
  // タイムライン（無限スクロール）
  // =============================================
  export function useTimeline(mode: 'all' | 'following' = 'all') {
    return useInfiniteQuery({
      queryKey: queryKeys.timeline(mode),
      queryFn: ({ pageParam = 1 }) =>
        reviewsApi.timeline({ mode, page: pageParam as number, limit: 20 }).then(r => r.data),
      initialPageParam: 1,
      getNextPageParam: (last, _, lastPageParam) =>
        last.reviews.length === 20 ? (lastPageParam as number) + 1 : undefined,
      staleTime: 1000 * 30, // タイムラインは30秒で再フェッチ
    })
  }
  
  // =============================================
  // ランキング
  // =============================================
  export function useRanking(params?: { genre?: string; period?: 'week' | 'month' | 'alltime' }) {
    return useQuery({
      queryKey: queryKeys.ranking(params),
      queryFn: () => rankingApi.albums(params).then(r => r.data),
      staleTime: 1000 * 60 * 5,
    })
  }
  
  export function useRankingArtists() {
    return useQuery({
      queryKey: queryKeys.rankArtists(),
      queryFn: () => rankingApi.artists({ limit: 20 }).then(r => r.data),
      staleTime: 1000 * 60 * 5,
    })
  }
  
  // =============================================
  // ユーザー
  // =============================================
  export function useUser(username: string) {
    return useQuery({
      queryKey: queryKeys.user(username),
      queryFn: () => usersApi.get(username).then(r => r.data),
      enabled: username.length > 0,
      staleTime: 1000 * 60 * 3,
    })
  }
  
  export function useUserReviews(username: string) {
    return useQuery({
      queryKey: queryKeys.userReviews(username),
      queryFn: () => usersApi.reviews(username).then(r => r.data),
      enabled: username.length > 0,
    })
  }
  
  export function useUserMarks(username: string) {
    return useQuery({
      queryKey: queryKeys.userMarks(username),
      queryFn: () => marksApi.byUser(username).then(r => r.data),
      enabled: username.length > 0,
    })
  }
  
  // =============================================
  // 自分のプロフィール
  // =============================================
  export function useMe() {
    return useQuery({
      queryKey: queryKeys.me(),
      queryFn: () => authApi.me().then(r => r.data),
      retry: false,         // 401は再試行しない
      staleTime: 1000 * 60 * 5,
    })
  }
  
  // =============================================
  // ミューテーション
  // =============================================
  
  // マーク作成
  export function useCreateMark() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: marksApi.create,
      onSuccess: (_, vars) => {
        // マイページのマーク一覧を無効化（再フェッチ）
        qc.invalidateQueries({ queryKey: ['users'] })
        qc.invalidateQueries({ queryKey: queryKeys.me() })
      },
    })
  }
  
  // マーク削除
  export function useDeleteMark() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: marksApi.delete,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['users'] })
      },
    })
  }
  
  // いいね（楽観的更新）
  export function useLikeReview() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: ({ reviewId, liked }: { reviewId: number; liked: boolean }) =>
        liked ? reviewsApi.unlike(reviewId) : reviewsApi.like(reviewId),
  
      // 楽観的更新: APIレスポンスを待たずにUIを即時反映
      onMutate: async ({ reviewId, liked }) => {
        await qc.cancelQueries({ queryKey: ['reviews'] })
  
        // タイムラインキャッシュを即時書き換え
        const updatePages = (old: InfiniteData<{ reviews: Review[] }> | undefined) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              reviews: page.reviews.map(r =>
                r.id === reviewId
                  ? { ...r, likes_count: liked ? r.likes_count - 1 : r.likes_count + 1 }
                  : r
              ),
            })),
          }
        }
  
        qc.setQueryData(queryKeys.timeline('all'),       updatePages)
        qc.setQueryData(queryKeys.timeline('following'), updatePages)
      },
  
      onError: () => {
        // エラー時はキャッシュをサーバーの状態に戻す
        qc.invalidateQueries({ queryKey: ['reviews'] })
      },
    })
  }
  
  // レビュー削除
  export function useDeleteReview() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: reviewsApi.delete,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['reviews'] })
        qc.invalidateQueries({ queryKey: ['users'] })
      },
    })
  }
  
  // フォロー / アンフォロー
  export function useFollow() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: ({ username, following }: { username: string; following: boolean }) =>
        following ? usersApi.unfollow(username) : usersApi.follow(username),
      onSuccess: (_, { username }) => {
        qc.invalidateQueries({ queryKey: queryKeys.user(username) })
        qc.invalidateQueries({ queryKey: queryKeys.me() })
      },
    })
  }