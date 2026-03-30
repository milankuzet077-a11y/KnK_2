import React from 'react'

type Props = {
  children: React.ReactNode
  /** Optional custom fallback renderer */
  fallback?: (err: unknown) => React.ReactNode
  /** Optional reset callback (e.g. clear storage) */
  onReset?: () => void
}

type State = {
  hasError: boolean
  err: unknown
}

/**
 * Minimal Error Boundary so unexpected runtime errors don't blank the entire app.
 * This does not change normal UX; it only shows a fallback when something crashes.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, err: null }

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, err }
  }

  componentDidCatch(_err: unknown) {}

  private handleReset = () => {
    try {
      this.props.onReset?.()
    } finally {
      // Hard reload to restore a clean state.
      window.location.reload()
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return <>{this.props.fallback(this.state.err)}</>

    return (
      <div
        className="fullscreen"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f14',
          color: 'white',
          textAlign: 'center',
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold)', marginBottom: 12 }}>
          Nešto nije u redu
        </h2>
        <p style={{ opacity: 0.75, fontSize: 15, lineHeight: 1.5, maxWidth: 360, marginBottom: 16 }}>
          Aplikacija je naišla na grešku. Možete pokušati reset podataka i ponovno učitavanje.
        </p>
        <button
          className="btn"
          onClick={this.handleReset}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)',
            color: 'white',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Resetuj i osveži
        </button>
      </div>
    )
  }
}
