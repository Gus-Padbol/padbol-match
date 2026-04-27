import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const btnVolver = {
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.22)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  padding: '8px 10px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
};

const LOGOUT_BTN_SIZE = 34;

/**
 * Rutas donde no se muestra ⏻ cerrar sesión.
 * Solo en Mi Perfil (`/mi-perfil`) se muestra; en hub (`/`, `/hub`, …) y el resto, oculto.
 */
function hideLogoutForPathname(pathname) {
  const pathOnly =
    String(pathname || '/')
      .split('?')[0]
      .split('#')[0]
      .replace(/\/+$/, '') || '/';
  if (pathOnly === '/mi-perfil' || pathOnly.startsWith('/mi-perfil/')) return false;
  return true;
}

/**
 * Barra superior fija: ← Volver alineado a la izquierda (tras safe-area), título centrado, cierre de sesión.
 * Grid 1fr / auto / 1fr: con `showBack={false}` un hueco a la derecha de la 1ª columna equilibra el título.
 */
export default function AppHeader({
  title,
  showBack = true,
  onBack,
  backLabel,
  titleColor,
  /** Si true, no se muestra el botón de cerrar sesión (p. ej. perfil público de sede). */
  hideLogout = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, signOutAndClear } = useAuth();
  const titleStr = String(title ?? '').trim();
  const hideLogoutEffective = hideLogout || hideLogoutForPathname(location.pathname);

  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    if (typeof window !== 'undefined') window.history.back();
  };

  const padL = 'calc(8px + env(safe-area-inset-left, 0px))';
  const padR = 'calc(8px + env(safe-area-inset-right, 0px))';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        minHeight: '56px',
        background: '#0f172a',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        columnGap: '8px',
        padding: `8px ${padR} 8px ${padL}`,
        boxSizing: 'border-box',
        zIndex: 1002,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: showBack ? 'flex-start' : 'flex-end',
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            style={{ ...btnVolver, flexShrink: 0 }}
            aria-label="Volver atrás"
          >
            {backLabel || '← Volver'}
          </button>
        ) : (
          <span
            aria-hidden
            style={{
              width: LOGOUT_BTN_SIZE,
              height: LOGOUT_BTN_SIZE,
              flexShrink: 0,
            }}
          />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minWidth: 0,
          maxWidth: 'min(72vw, 420px)',
        }}
      >
        {titleStr ? (
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              color: titleColor || '#fff',
              fontSize: '15px',
              fontWeight: 600,
              margin: 0,
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              padding: '4px 6px',
              fontFamily: 'inherit',
              width: '100%',
              maxWidth: '100%',
            }}
            title={`${titleStr} — Ir al inicio`}
            aria-label={`${titleStr}, ir al inicio`}
          >
            {titleStr}
          </button>
        ) : (
          <span
            aria-hidden
            style={{
              display: 'block',
              width: 0,
              height: 1,
              overflow: 'hidden',
            }}
          />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        {!hideLogoutEffective && session?.user ? (
          <button
            type="button"
            onClick={async () => {
              await signOutAndClear();
              navigate('/');
            }}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            style={{
              width: LOGOUT_BTN_SIZE,
              height: LOGOUT_BTN_SIZE,
              padding: 0,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: '#e2e8f0',
              fontSize: 16,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ⏻
          </button>
        ) : !hideLogoutEffective ? (
          <span
            aria-hidden
            style={{
              width: LOGOUT_BTN_SIZE,
              height: LOGOUT_BTN_SIZE,
              flexShrink: 0,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
