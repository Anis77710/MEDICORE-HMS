import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Keep the console error so devs can still see the full trace
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null })
    window.location.href = '/'
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg, #f8fafc)',
          padding: '2rem',
        }}
      >
        <div
          style={{
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '1rem',
            padding: '2.5rem 3rem',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,.07)',
          }}
        >
          {/* Icon */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: '#fef2f2',
              marginBottom: '1.25rem',
            }}
          >
            <AlertTriangle size={28} color="#dc2626" strokeWidth={2} />
          </div>

          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text, #0f172a)',
              margin: '0 0 .5rem',
            }}
          >
            Something went wrong
          </h2>

          <p
            style={{
              fontSize: '.9rem',
              color: 'var(--muted, #64748b)',
              margin: '0 0 1.75rem',
              lineHeight: 1.6,
            }}
          >
            An unexpected error occurred. Our team has been notified. You can
            try refreshing the page or return to the dashboard.
          </p>

          {/* Error detail - collapsed, dev-friendly */}
          {this.state.error.message && (
            <details
              style={{
                textAlign: 'left',
                marginBottom: '1.5rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '.5rem',
                padding: '.75rem 1rem',
                fontSize: '.8rem',
                color: '#64748b',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}>
                Error details
              </summary>
              <pre
                style={{
                  marginTop: '.5rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.5,
                }}
              >
                {this.state.error.message}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '.5rem',
              background: 'var(--primary, #0e7490)',
              color: '#fff',
              border: 'none',
              borderRadius: '.625rem',
              padding: '.65rem 1.5rem',
              fontSize: '.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} />
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }
}
