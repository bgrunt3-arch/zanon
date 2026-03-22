/**
 * Spotify API プロキシ。Next.js rewrites は Authorization ヘッダーを転送しないため、
 * Route Handler で明示的にバックエンドへ転送する。
 */
import { NextRequest, NextResponse } from 'next/server'

function getBackendUrl(): string {
  const isDev = process.env.NODE_ENV !== 'production'
  return (
    process.env.NEXT_BACKEND_URL ??
    (isDev ? 'http://localhost:3002/api/v1' : 'https://zanon-production.up.railway.app/api/v1')
  )
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Spotify access token が必要です' }, { status: 400 })
  }

  const path = request.nextUrl.searchParams.get('path') ?? ''
  if (!path) {
    return NextResponse.json({ error: 'path が必要です' }, { status: 400 })
  }

  const normalized = path.startsWith('/') ? path : `/${path}`
  const backendUrl = `${getBackendUrl()}/spotify/proxy?path=${encodeURIComponent(normalized)}`

  const headers = new Headers()
  headers.set('Authorization', auth)

  const res = await fetch(backendUrl, { headers })

  const retryAfter = res.headers.get('Retry-After')
  const contentType = res.headers.get('Content-Type') ?? 'application/json'

  const body = await res.arrayBuffer()
  return new NextResponse(body, {
    status: res.status,
    headers: {
      'Content-Type': contentType,
      ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
    },
  })
}
