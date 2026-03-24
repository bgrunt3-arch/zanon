'use client'

import { useEffect, useRef, useState } from 'react'

export type LyricLine = {
  timeMs: number
  text: string
}

export type LyricsState = {
  lines: LyricLine[]       // 同期歌詞（空なら plain に fallback）
  plain: string | null     // プレーンテキスト歌詞
  loading: boolean
  error: boolean
  instrumental: boolean
}

/** LRC 形式の1行を解析: "[mm:ss.xx] text" */
function parseLrcLine(line: string): LyricLine | null {
  const m = line.match(/^\[(\d+):(\d+)\.(\d+)\]\s*(.*)$/)
  if (!m) return null
  const min = parseInt(m[1], 10)
  const sec = parseInt(m[2], 10)
  const cs = parseInt(m[3], 10)
  const timeMs = (min * 60 + sec) * 1000 + cs * 10
  return { timeMs, text: m[4] }
}

function parseLrc(lrc: string): LyricLine[] {
  return lrc
    .split('\n')
    .map(parseLrcLine)
    .filter((l): l is LyricLine => l !== null && l.text.trim() !== '')
}

export function useLyrics(
  trackName: string | null,
  artistName: string | null,
  durationMs: number,
): LyricsState {
  const [state, setState] = useState<LyricsState>({
    lines: [],
    plain: null,
    loading: false,
    error: false,
    instrumental: false,
  })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!trackName || !artistName) {
      setState({ lines: [], plain: null, loading: false, error: false, instrumental: false })
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setState((s) => ({ ...s, loading: true, error: false }))

    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
      ...(durationMs > 0 ? { duration: String(Math.round(durationMs / 1000)) } : {}),
    })

    fetch(`https://lrclib.net/api/get?${params}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (res.status === 404) {
          setState({ lines: [], plain: null, loading: false, error: false, instrumental: false })
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const lines = data.syncedLyrics ? parseLrc(data.syncedLyrics) : []
        setState({
          lines,
          plain: data.plainLyrics ?? null,
          loading: false,
          error: false,
          instrumental: !!data.instrumental,
        })
      })
      .catch((e) => {
        if (e.name === 'AbortError') return
        setState((s) => ({ ...s, loading: false, error: true }))
      })

    return () => ctrl.abort()
  }, [trackName, artistName, durationMs])

  return state
}

/** 現在の再生位置に対応する行インデックスを返す */
export function getCurrentLineIndex(lines: LyricLine[], positionMs: number): number {
  if (lines.length === 0) return -1
  let idx = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= positionMs) idx = i
    else break
  }
  return idx
}
