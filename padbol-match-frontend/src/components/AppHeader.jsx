import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDisplayName } from '../utils/displayName';
import { loginRedirectAfterHubEntry } from '../utils/authLoginRedirect';

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
  /** Hub principal: entrada directa a login o chip de usuario (no depende de reservar). */
  hubDirectLogin = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, signOutAndClear, userProfile, loading: authLoading } = useAuth();
  const titleStr = String(title ?? '').trim();
  const hideLogoutEffective = hideLogout;

  const pathOnly = useMemo(
    () =>
      String(location.pathname || '/')
        .split('?')[0]
        .split('#')[0]
        .replace(/\/+$/, '') || '/',
    [location.pathname]
  );
  const authEmail = String(session?.user?.email || '').trim().toLowerCase();
  const showLogout = !hideLogoutEffective && Boolean(session?.user);
  const loginFromHubUrl = `/login?redirect=${encodeURIComponent(loginRedirectAfterHubEntry(location))}`;
  const hubNombreCorto = (() => {
    const alias = String(userProfile?.alias || '').trim();
    if (alias) return alias;
    const full = getDisplayName(userProfile, session);
    const first = String(full || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0];
    return first || 'Cuenta';
  })();
  const hubFotoUrl = String(userProfile?.foto_url || userProfile?.foto || '').trim();
  const hubInicial = String(hubNombreCorto || '?')
    .charAt(0)
    .toUpperCase();
  const showAdmin = !hideLogoutEffective && authEmail === 'padbolinternacional@gmail.com';
  const isOnAdmin = pathOnly === '/admin' || pathOnly.startsWith('/admin/');
  const miPerfilLogoutSpacing =
    showLogout && (pathOnly === '/mi-perfil' || pathOnly.startsWith('/mi-perfil/'));

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
          justifyContent: showLogout || showAdmin ? 'flex-end' : (miPerfilLogoutSpacing ? 'flex-end' : 'flex-start'),
          alignItems: 'center',
          minWidth: 0,
          width: '100%',
          marginLeft: miPerfilLogoutSpacing ? 'auto' : undefined,
          marginRight: showLogout || showAdmin ? '16px' : 0,
          paddingLeft: miPerfilLogoutSpacing ? '8px' : 0,
          paddingRight: miPerfilLogoutSpacing ? '8px' : 0,
          boxSizing: 'border-box',
        }}
      >
        {showLogout || showAdmin ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginLeft: miPerfilLogoutSpacing ? 'auto' : 0,
            }}
          >
            {hubDirectLogin && session?.user ? (
              <button
                type="button"
                onClick={() => navigate('/mi-perfil')}
                aria-label="Ir a mi perfil"
                title="Mi perfil"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  maxWidth: 'min(42vw, 160px)',
                  padding: '4px 8px 4px 4px',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'rgba(255,255,255,0.12)',
                  color: '#f8fafc',
                  cursor: 'pointer',
                  flexShrink: 1,
                  minWidth: 0,
                }}
              >
                {hubFotoUrl ? (
                  <img
                    src={hubFotoUrl}
                    alt=""
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: '1px solid rgba(255,255,255,0.25)',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {hubInicial}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {hubNombreCorto}
                </span>
              </button>
            ) : null}
            {showAdmin ? (
              <button
                type="button"
                onClick={() => navigate(isOnAdmin ? '/' : '/admin')}
                aria-label={isOnAdmin ? 'Volver a la app' : 'Ir a Admin'}
                title={isOnAdmin ? 'Volver a la app' : 'Admin'}
                style={{
                  height: LOGOUT_BTN_SIZE,
                  padding: '0 10px',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'rgba(255,255,255,0.14)',
                  color: '#e2e8f0',
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isOnAdmin ? '← App' : '⚙️ Admin'}
              </button>
            ) : null}
            {showLogout ? (
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
            ) : null}
          </div>
        ) : hubDirectLogin && !session?.user && !authLoading ? (
          <button
            type="button"
            onClick={() => navigate(loginFromHubUrl)}
            style={{
              padding: '8px 12px',
              borderRadius: '999px',
              border: 'none',
              background: 'rgba(255,255,255,0.95)',
              color: '#1e1b4b',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            Iniciar sesión
          </button>
        ) : hubDirectLogin && !session?.user && authLoading ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.65)',
              padding: '8px 4px',
            }}
          >
            …
          </span>
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
