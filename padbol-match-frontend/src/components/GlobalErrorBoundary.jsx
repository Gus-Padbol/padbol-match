import React from 'react';
import i18n from '../i18n';
import { resolveTranslation } from '../i18n/tSafe';

/**
 * Evita pantalla vacía (solo gradiente de `body`) si un hijo revienta en el render.
 */
export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[PM ErrorBoundary] Uncaught error (full):', error);
    console.error('[PM ErrorBoundary] error.message:', error?.message);
    console.error('[PM ErrorBoundary] error.stack:', error?.stack);
    if (errorInfo) {
      console.error('[PM ErrorBoundary] errorInfo (full):', errorInfo);
      if (errorInfo.componentStack) {
        console.error('[PM ErrorBoundary] componentStack:\n', errorInfo.componentStack);
      }
    }
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

    const err = this.state.error;
    const title = resolveTranslation(
      'general.somethingWentWrong',
      i18n.t('general.somethingWentWrong'),
      'Algo salió mal',
    );
    const bodyDefault =
      'La app encontró un error al mostrar esta pantalla. Puedes volver al inicio o al acceso.';
    const goHome = resolveTranslation('general.goHome', i18n.t('general.goHome'), 'Ir al inicio');
    const goLogin = resolveTranslation('general.goLogin', i18n.t('general.goLogin'), 'Ir a acceso');
    const showDevDetail =
      typeof process !== 'undefined' && process.env.NODE_ENV === 'development' && err?.message;

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
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{title}</h1>
        <p style={{ margin: 0, maxWidth: 360, fontSize: '15px', lineHeight: 1.5, opacity: 0.9 }}>
          {bodyDefault}
        </p>
        {showDevDetail ? (
          <pre
            style={{
              margin: 0,
              maxWidth: 'min(100%, 520px)',
              padding: 12,
              fontSize: 11,
              lineHeight: 1.4,
              textAlign: 'left',
              overflow: 'auto',
              background: 'rgba(0,0,0,0.35)',
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {String(err.message)}
          </pre>
        ) : null}
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
            {goHome}
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
            {goLogin}
          </button>
        </div>
      </div>
    );
  }
}
