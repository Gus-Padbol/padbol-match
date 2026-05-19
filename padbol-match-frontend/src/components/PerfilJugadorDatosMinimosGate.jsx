import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';

/** Roles de panel: no exigen género/WhatsApp de jugador para navegar (p. ej. crear torneo). */
const ROLES_SKIP_PERFIL_JUGADOR_MINIMO = new Set(['super_admin', 'admin_club', 'admin_nacional']);

/** Si la sesión y el perfil no convergen en este tiempo, se cierra sesión y se va a login (evita pantalla colgada). */
const PERFIL_GATE_TIMEOUT_MS = 5000;

function pathBase(pathname) {
  return String(pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
}

function gateSkipsPerfilMinimo(pathOnly) {
  if (pathOnly === '/completar-perfil') return true;
  if (pathOnly === '/torneo/crear') return true;
  if (pathOnly === '/login' || pathOnly === '/auth' || pathOnly.startsWith('/auth/')) return true;
  if (pathOnly === '/acceso' || pathOnly.startsWith('/acceso/')) return true;
  if (pathOnly === '/registro' || pathOnly.startsWith('/registro/')) return true;
  if (pathOnly === '/') return true;
  if (pathOnly === '/admin' || pathOnly.startsWith('/admin/')) return true;
  if (pathOnly === '/terminos' || pathOnly.startsWith('/terminos/')) return true;
  if (pathOnly === '/privacidad' || pathOnly.startsWith('/privacidad/')) return true;
  return false;
}

/** Mismo gradiente que el hub: si ves esto, el gate está bloqueando la UI (sesión + carga de perfil). */
function GateBlockingSpinner() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        background: 'var(--bg-card)',
        color: '#64748b',
        fontWeight: 600,
        fontSize: '16px',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 40,
          height: 40,
          border: '3px solid #e2e8f0',
          borderTopColor: '#E11B22',
          borderRadius: '50%',
          animation: 'pmPerfilGateSpin 0.75s linear infinite',
        }}
      />
      Cargando…
      <style>{`@keyframes pmPerfilGateSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/**
 * Mientras `loading` o `profileLoading` con sesión, muestra spinner (evita hub “vacío” por carrera de perfil).
 * No redirige a completar perfil: eso ocurre al intentar reservar, armar partido o inscribirse a torneo.
 */
export default function PerfilJugadorDatosMinimosGate({ children }) {
  const { session, profileLoading, loading, signOutAndClear } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    return em ? { email: em } : null;
  }, [session?.user?.email]);
  const { rol } = useUserRole(currentCliente);

  const pathOnly = pathBase(location.pathname);
  const skipsGate =
    gateSkipsPerfilMinimo(pathOnly) ||
    (rol != null && ROLES_SKIP_PERFIL_JUGADOR_MINIMO.has(String(rol)));
  const blockUi = Boolean(session?.user) && !skipsGate && (loading || profileLoading);

  useEffect(() => {
    if (!blockUi) return undefined;
    const id = window.setTimeout(() => {
      void (async () => {
        try {
          signOutAndClear();
        } catch {
          /* ignore */
        }
        navigate('/', { replace: true });
      })();
    }, PERFIL_GATE_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [blockUi, navigate, signOutAndClear]);

  if (blockUi) {
    return <GateBlockingSpinner />;
  }

  // Sin sesión: loading/profileLoading en false → blockUi false → siempre children (nunca null aquí).
  // Con sesión y perfil OK o ruta excluida: igualmente children.
  return children;
}
