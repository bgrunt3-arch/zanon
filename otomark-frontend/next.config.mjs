import { networkInterfaces } from 'node:os'

/** @type {import('next').NextConfig} */
// 開発時: LAN IP や別ホストで開くと /_next/ が 404 になることがある → allowedDevOrigins を拡張。
// この PC の非ループバック IPv4 を自動追加。.env.local の NEXT_DEV_EXTRA_ORIGINS（カンマ区切り）もマージ。
/** @returns {string[]} */
function localLanIPv4Hosts() {
  try {
    const nets = networkInterfaces()
    /** @type {string[]} */
    const out = []
    for (const list of Object.values(nets)) {
      if (!list) continue
      for (const n of list) {
        const v4 = n.family === 'IPv4' || n.family === 4
        if (v4 && !n.internal) out.push(n.address)
      }
    }
    return [...new Set(out)]
  } catch {
    return []
  }
}

const extraDevOrigins = (process.env.NEXT_DEV_EXTRA_ORIGINS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

const nextConfig = {
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    ...localLanIPv4Hosts(),
    ...extraDevOrigins,
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'coverartarchive.org' },
      { protocol: 'https', hostname: '*.musicbrainz.org' },
    ],
  },
  async redirects() {
    return [
      { source: '/favicon.ico', destination: '/icon.svg', permanent: false },
    ]
  },
  async rewrites() {
    const isDev = process.env.NODE_ENV !== 'production'
    const backendUrl = process.env.NEXT_BACKEND_URL
      ?? (isDev ? 'http://localhost:3002/api/v1' : 'https://zanon-production.up.railway.app/api/v1')
    const paymentUrl = process.env.NEXT_PAYMENT_URL ?? 'http://localhost:3002/api/v1'
    return [
      {
        source: '/api/v1/payment/:path*',
        destination: `${paymentUrl}/payment/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ]
  },
}

export default nextConfig