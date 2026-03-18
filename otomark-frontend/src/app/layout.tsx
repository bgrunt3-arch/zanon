import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Nav } from '@/components/Nav'
import { ToastContainer } from '@/components/Toast'

export const metadata: Metadata = {
  title: 'Otomark - 音楽レビューSNS',
  description: '聴いた音楽を記録して、レビューをシェアしよう',
  openGraph: {
    title: 'Otomark',
    description: '聴いた音楽を記録して、レビューをシェアしよう',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          <Nav />
          <main>{children}</main>
          <ToastContainer />
        </Providers>
      </body>
    </html>
  )
}
