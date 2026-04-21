import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { buttonTertiaryStyle } from '../theme/uiStyles';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { authLoginRedirectPath } from '../utils/authLoginRedirect';
import { getDisplayName } from '../utils/getDisplayName';

export const APP_HEADER_ROW = {
  width: '100%',
  maxWidth: '900px',
  margin: '0 auto',
  padding: '14px 20px',
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

const textHola = {
  color: 'rgba(255,255,255,0.95)',
  fontSize: 'clamp(12px, 2.8vw, 14px)',
  fontWeight: 600,
  maxWidth: 'min(42vw, 160px)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const btnIngresar = {
  padding: '7px 14px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#1e1b4b',
  background: 'rgba(255,255,255,0.92)',
  border: 'none',
  borderRadius: '999px',
  cursor: 'pointer',
  flexShrink: 0,
};

export const GLOBAL_SESSION_BAR_HEIGHT = 48;

/**
 * Barra fija arriba a la derecha: misma fuente de sesión que AuthContext (Supabase).
 */
export function GlobalSessionBar() {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: GLOBAL_SESSION_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 14px',
        boxSizing: 'border-box',
        background: 'linear-gradient(90deg, rgba(102,126,234,0.92) 0%, rgba(118,75,162,0.95) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <HeaderSessionAuthStrip compact />
    </header>
  );
}

/**
 * Sesión desde Supabase; saludo desde userProfile (AuthContext).
 */
export function HeaderSessionAuthStrip({ compact = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, session } = useAuth();
  const [authReady, setAuthReady] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  const cargarNombre = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setSessionActive(false);
      setAuthReady(true);
      return;
    }

    setSessionActive(true);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    void cargarNombre();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void cargarNombre();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [cargarNombre]);

  const irIngresar = () => {
    if (location.pathname === '/auth') return;
    navigate(`/auth?redirect=${encodeURIComponent(authLoginRedirectPath(location))}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (!authReady) {
    return (
      <span style={{ ...textHola, opacity: 0.75, maxWidth: '28px' }} aria-hidden>
        …
      </span>
    );
  }

  const gap = compact ? '8px' : '10px';

  if (sessionActive) {
    const nombreMostrar = getDisplayName(userProfile, session);
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap,
          minWidth: 0,
          color: 'rgba(255,255,255,0.95)',
        }}
      >
        <span style={{ fontSize: '12px', opacity: 0.8 }} title={nombreMostrar}>
          Conectado como {nombreMostrar}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            background: 'red',
            color: 'white',
            borderRadius: '20px',
            padding: '6px 12px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            flexShrink: 0,
          }}
        >
          Salir
        </button>
      </div>
    );
  }

  if (location.pathname === '/auth') {
    return null;
  }

  return (
    <button type="button" onClick={irIngresar} style={btnIngresar}>
      Ingresar
    </button>
  );
}

/**
 * IZQUIERDA: ← Volver (si backTo) o logo (si showLogo)
 * CENTRO: título
 * DERECHA: children opcionales + estado de sesión (Conectado como… / Ingresar)
 */
export function AppScreenHeaderBar({
  title = '\u00a0',
  kicker = null,
  backTo = null,
  showLogo = false,
  maxWidth: maxWidthProp,
  childrenRight = null,
}) {
  const navigate = useNavigate();
  const maxWidth = maxWidthProp ?? '900px';

  return (
    <div style={{ ...APP_HEADER_ROW, maxWidth, display: 'flex', alignItems: 'center', gap: '12px' }}>
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
      </div>
    </div>
  );
}

/** Home con sesión: logo izquierda, título centro, acciones derecha (sin ← Volver) */
export function AppScreenHeaderHome({ children, title = 'Inicio' }) {
  return (
    <AppScreenHeaderBar showLogo title={title} maxWidth="900px" childrenRight={children} />
  );
}

/** Pantalla interior: ← Volver, título, sin logo */
export function AppScreenHeaderBack({ to = '/hub', title = 'Padbol Match', kicker = null }) {
  return <AppScreenHeaderBar backTo={to} title={title} kicker={kicker} />;
}

export function AppScreenHeaderBackFloating({ to = '/hub', title = 'Padbol Match' }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
      <AppScreenHeaderBar backTo={to} title={title} />
    </div>
  );
}
