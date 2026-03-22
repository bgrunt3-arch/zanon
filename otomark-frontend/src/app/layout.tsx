import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LayoutShell } from '@/components/LayoutShell'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#121212',
}

export const metadata: Metadata = {
  title: 'Orbit',
  description: '推し5人のタイムラインアプリ',
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: 'Orbit',
    description: '推し5人のタイムラインアプリ',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isMockMode = (process.env.NEXT_PUBLIC_MOCK_MODE ?? '').toLowerCase() === 'true'

  return (
    <html lang="ja">
      <body>
        {isMockMode && <div className="mockModeBadge">MOCK MODE</div>}
        <ErrorBoundary>
          <LayoutShell>{children}</LayoutShell>
        </ErrorBoundary>
      </body>
    </html>
  )
}
