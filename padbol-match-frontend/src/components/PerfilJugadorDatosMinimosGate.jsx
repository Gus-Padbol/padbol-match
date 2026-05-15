import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { perfilJugadorDatosMinimosCompletos } from '../utils/perfilJugadorMinimo';

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
 * Redirige a `/completar-perfil` si hay sesión pero falta género o WhatsApp en `jugadores_perfil`
 * (p. ej. primer login con Google o Facebook OAuth).
 * Mientras `loading` o `profileLoading`, no redirige: muestra spinner (evita hub violeta “vacío” por carrera de perfil).
 */
export default function PerfilJugadorDatosMinimosGate({ children }) {
  const { session, userProfile, profileLoading, loading, signOutAndClear } = useAuth();
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

  console.log('[PM Gate] render', {
    loading,
    profileLoading,
    sessionUid: session?.user?.id ?? null,
    hasSessionEmail: Boolean(session?.user?.email),
    pathOnly,
    skipsGate,
    blockUi,
    userProfile: userProfile
      ? {
          id: userProfile.id ?? null,
          genero: userProfile.genero ?? null,
          whatsappLen: String(userProfile.whatsapp || '').length,
        }
      : null,
    perfilMinimoOk: perfilJugadorDatosMinimosCompletos(userProfile),
  });

  useEffect(() => {
    if (loading || profileLoading) return;
    if (!session?.user) return;
    if (skipsGate) return;
    if (perfilJugadorDatosMinimosCompletos(userProfile)) return;
    navigate('/completar-perfil', { replace: true, state: { from: pathOnly } });
  }, [loading, profileLoading, session?.user?.id, userProfile, pathOnly, skipsGate, navigate]);

  useEffect(() => {
    if (!blockUi) return undefined;
    const id = window.setTimeout(() => {
      void (async () => {
        try {
          signOutAndClear();
        } catch {
          /* ignore */
        }
        navigate('/login', { replace: true });
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
