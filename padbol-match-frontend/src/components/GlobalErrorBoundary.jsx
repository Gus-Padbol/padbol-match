import React from 'react';

/**
 * Evita pantalla vacía (solo gradiente de `body`) si un hijo revienta en el render.
 */
export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[PM ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    try {
      window.location.assign('/');
    } catch {
      window.location.href = '/';
    }
  };

  handleLogin = () => {
    try {
      window.location.assign('/login');
    } catch {
      window.location.href = '/login';
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: '100dvh',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
          color: 'rgba(248, 250, 252, 0.95)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Algo salió mal</h1>
        <p style={{ margin: 0, maxWidth: 360, fontSize: '15px', lineHeight: 1.5, opacity: 0.9 }}>
          La app encontró un error al mostrar esta pantalla. Puedes volver al inicio o al acceso.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              border: 'none',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              background: 'var(--bg-card)',
              color: '#0f172a',
            }}
          >
            Ir al inicio
          </button>
          <button
            type="button"
            onClick={this.handleLogin}
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              border: '2px solid rgba(255,255,255,0.35)',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              background: 'transparent',
              color: '#fff',
            }}
          >
            Ir a acceso
          </button>
        </div>
      </div>
    );
  }
}
