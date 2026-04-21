import React from 'react';
import { useNavigate } from 'react-router-dom';
import { buttonTertiaryStyle } from '../theme/uiStyles';

export const APP_HEADER_ROW = {
  width: '100%',
  maxWidth: '900px',
  margin: '0 auto',
  padding: '8px 20px',
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
};

export const APP_HEADER_LOGO = {
  height: '36px',
  display: 'block',
  filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.25))',
};

export const APP_HEADER_BTN_VOLVER = { ...buttonTertiaryStyle, padding: '9px 18px' };

const BTN_LOGOUT = {
  background: 'rgba(255,255,255,0.22)',
  border: '1px solid rgba(255,255,255,0.28)',
  borderRadius: '50%',
  width: '38px',
  height: '38px',
  color: 'white',
  fontSize: '16px',
  cursor: 'pointer',
  flexShrink: 0,
};

/**
 * IZQUIERDA: ← Volver (si backTo) o logo (si showLogo)
 * CENTRO: título
 * DERECHA: children opcionales + logout solo si onLogout
 */
export function AppScreenHeaderBar({
  title = '\u00a0',
  kicker = null,
  backTo = null,
  onLogout = null,
  showLogo = false,
  maxWidth: maxWidthProp,
  childrenRight = null,
}) {
  const navigate = useNavigate();
  const maxWidth = maxWidthProp ?? '900px';

  return (
    <div
      style={{
        ...APP_HEADER_ROW,
        maxWidth,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginTop: '10px',
        marginBottom: '20px',
      }}
    >
      <div
        style={{
          flex: '0 1 34%',
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        {backTo ? (
          <button type="button" onClick={() => navigate(backTo)} style={APP_HEADER_BTN_VOLVER}>
            ← Volver
          </button>
        ) : showLogo ? (
          <img src="/logo-padbol-match.png" alt="Padbol Match" style={APP_HEADER_LOGO} />
        ) : (
          <span style={{ minWidth: '44px', display: 'inline-block' }} aria-hidden />
        )}
      </div>

      <div
        style={{
          flex: '1 1 32%',
          minWidth: 0,
          textAlign: 'center',
          padding: '0 4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: kicker ? 2 : 0,
        }}
      >
        {kicker ? (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.88)',
              lineHeight: 1.2,
            }}
          >
            {kicker}
          </span>
        ) : null}
        <span
          style={{
            fontWeight: 800,
            fontSize: 'clamp(14px, 3.5vw, 16px)',
            color: 'white',
            lineHeight: 1.2,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: kicker ? 'normal' : 'nowrap',
            maxWidth: '100%',
          }}
        >
          {title}
        </span>
      </div>

      <div
        style={{
          flex: '0 1 34%',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        {childrenRight}
        {onLogout ? (
          <button type="button" onClick={() => onLogout()} style={BTN_LOGOUT} aria-label="Cerrar sesión">
            ⏻
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Home con sesión: logo izquierda, título centro, acciones derecha (sin ← Volver) */
export function AppScreenHeaderHome({ children, title = 'Inicio', onLogout, showLogo = true }) {
  return (
    <AppScreenHeaderBar showLogo={showLogo} title={title} onLogout={onLogout} maxWidth="900px">
      {children}
    </AppScreenHeaderBar>
  );
}

/** Pantalla interior: ← Volver, título, sin logo */
export function AppScreenHeaderBack({ to = '/', title = 'Padbol Match', kicker = null, onLogout = null }) {
  return <AppScreenHeaderBar backTo={to} title={title} kicker={kicker} onLogout={onLogout} />;
}

export function AppScreenHeaderBackFloating({ to = '/', title = 'Padbol Match' }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
      <AppScreenHeaderBar backTo={to} title={title} />
    </div>
  );
}
