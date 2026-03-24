const STORAGE_KEY = 'orbit.playlists'

/** File → 正方形にクロップ＆圧縮した base64 DataURL を返す */
export function compressImageFile(file: File, size = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const src = e.target?.result as string
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        // 中央クロップ（短辺に合わせる）
        const s = Math.min(img.width, img.height)
        const sx = (img.width - s) / 2
        const sy = (img.height - s) / 2
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

export type LocalTrack = {
  id: string
  name: string
  artistName: string
  albumName: string
  coverUrl: string | null
  uri: string
  durationMs: number
}

export type LocalPlaylist = {
  id: string
  name: string
  description: string
  coverUrl: string | null
  createdAt: string
  tracks: LocalTrack[]
}

export function getLocalPlaylists(): LocalPlaylist[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as LocalPlaylist[]
  } catch {
    return []
  }
}

function setLocalPlaylists(playlists: LocalPlaylist[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists))
}

export function saveLocalPlaylist(playlist: LocalPlaylist): void {
  const playlists = getLocalPlaylists()
  const idx = playlists.findIndex((p) => p.id === playlist.id)
  if (idx >= 0) {
    playlists[idx] = playlist
  } else {
    playlists.push(playlist)
  }
  setLocalPlaylists(playlists)
}

export function deleteLocalPlaylist(id: string): void {
  setLocalPlaylists(getLocalPlaylists().filter((p) => p.id !== id))
}

export function addTrackToPlaylist(playlistId: string, track: LocalTrack): void {
  const playlists = getLocalPlaylists()
  const playlist = playlists.find((p) => p.id === playlistId)
  if (!playlist) return
  if (playlist.tracks.some((t) => t.id === track.id)) return
  playlist.tracks.push(track)
  setLocalPlaylists(playlists)
}

export function updatePlaylistCover(playlistId: string, coverUrl: string | null): void {
  const playlists = getLocalPlaylists()
  const playlist = playlists.find((p) => p.id === playlistId)
  if (!playlist) return
  playlist.coverUrl = coverUrl
  setLocalPlaylists(playlists)
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string): void {
  const playlists = getLocalPlaylists()
  const playlist = playlists.find((p) => p.id === playlistId)
  if (!playlist) return
  playlist.tracks = playlist.tracks.filter((t) => t.id !== trackId)
  setLocalPlaylists(playlists)
}

export function renameLocalPlaylist(id: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  const playlists = getLocalPlaylists()
  const playlist = playlists.find((p) => p.id === id)
  if (!playlist) return
  playlist.name = trimmed
  setLocalPlaylists(playlists)
}

export function reorderPlaylistTracks(id: string, trackIds: string[]): void {
  const playlists = getLocalPlaylists()
  const playlist = playlists.find((p) => p.id === id)
  if (!playlist) return
  const map = new Map(playlist.tracks.map((t) => [t.id, t]))
  playlist.tracks = trackIds.map((tid) => map.get(tid)).filter((t): t is LocalTrack => !!t)
  setLocalPlaylists(playlists)
}
