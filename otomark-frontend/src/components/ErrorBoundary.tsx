'use client'

import { Component, type ReactNode } from 'react'
import { setForceMockFallback } from '@/lib/orbit'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  handleRetryWithMock = () => {
    setForceMockFallback()
    this.setState({ hasError: false })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#0a0a0a',
            color: '#ffffff',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>エラーが発生しました</h1>
          <p style={{ color: '#adc2d8', marginBottom: 24, textAlign: 'center' }}>
            Spotify API の接続に問題がある可能性があります。
            <br />
            モックデータで続行できます。
          </p>
          <button
            type="button"
            onClick={this.handleRetryWithMock}
            style={{
              padding: '14px 24px',
              fontSize: 16,
              fontWeight: 700,
              background: '#1db954',
              color: '#ffffff',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            モックデータで続ける
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
