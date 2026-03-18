import Link from 'next/link'

export default function SupportSuccessPage() {
  return (
    <main style={{ textAlign: 'center', padding: '6rem 2rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>☕</div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.75rem' }}>
        サポートありがとうございます！
      </h1>
      <p style={{ color: 'var(--text2)', marginBottom: '2rem' }}>
        あなたの応援が ZanoN の開発を支えます。
      </p>
      <Link
        href="/"
        style={{
          background: 'var(--accent)',
          color: '#0a0a0f',
          padding: '10px 24px',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '0.9rem',
        }}
      >
        ホームへ戻る
      </Link>
    </main>
  )
}
