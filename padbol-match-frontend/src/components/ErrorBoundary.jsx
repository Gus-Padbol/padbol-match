import React from 'react';

const IS_DEV = process.env.NODE_ENV === 'development';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo } = this.state;
    const label = this.props.label || 'esta sección';

    return (
      <div style={{
        minHeight: '40vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: '#0f0f14',
        color: '#f1f5f9',
        fontFamily: 'system-ui, sans-serif',
      }}
      >
        <div style={{
          maxWidth: '640px',
          width: '100%',
          background: '#1a1a24',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}
        >
          <h2 style={{ margin: '0 0 0.75rem', color: '#fca5a5', fontSize: '1.25rem' }}>
            Algo salió mal
          </h2>
          <p style={{ margin: '0 0 1rem', color: '#94a3b8', lineHeight: 1.5 }}>
            Hubo un problema al cargar {label}. Podés reintentar o volver al inicio.
          </p>

          {IS_DEV && error && (
            <details open style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', color: '#fbbf24', marginBottom: '0.5rem' }}>
                Detalle del error (solo desarrollo)
              </summary>
              <pre style={{
                background: '#0a0a0a',
                color: '#fde68a',
                padding: '1rem',
                borderRadius: '8px',
                overflow: 'auto',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
              >
                {error.toString()}
                {errorInfo?.componentStack ? `\n${errorInfo.componentStack}` : ''}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                padding: '0.6rem 1.2rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '0.6rem 1.2rem',
                background: 'rgba(255,255,255,0.08)',
                color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
