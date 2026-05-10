import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { perfilJugadorDatosMinimosCompletos } from '../utils/perfilJugadorMinimo';

function pathBase(pathname) {
  return String(pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
}

function gateSkipsPerfilMinimo(pathOnly) {
  if (pathOnly === '/completar-perfil') return true;
  if (pathOnly === '/login' || pathOnly === '/auth' || pathOnly.startsWith('/auth/')) return true;
  if (pathOnly === '/admin' || pathOnly.startsWith('/admin/')) return true;
  return false;
}

/**
 * Redirige a `/completar-perfil` si hay sesión pero falta género o WhatsApp en `jugadores_perfil`
 * (p. ej. primer login con Google OAuth).
 */
export default function PerfilJugadorDatosMinimosGate({ children }) {
  const { session, userProfile, profileLoading, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || profileLoading) return;
    if (!session?.user) return;
    const pathOnly = pathBase(location.pathname);
    if (gateSkipsPerfilMinimo(pathOnly)) return;
    if (perfilJugadorDatosMinimosCompletos(userProfile)) return;
    navigate('/completar-perfil', { replace: true, state: { from: pathOnly } });
  }, [loading, profileLoading, session?.user?.id, userProfile, location.pathname, navigate]);

  return children;
}
