/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'coverartarchive.org' },
      { protocol: 'https', hostname: '*.musicbrainz.org' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_BACKEND_URL ?? 'http://localhost:3000/api/v1'}/:path*`,
      },
    ]
  },
}

export default nextConfig