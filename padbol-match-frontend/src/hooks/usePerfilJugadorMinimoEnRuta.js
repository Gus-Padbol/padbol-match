import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  perfilJugadorDatosMinimosCompletos,
  rutaExigePerfilJugadorMinimo,
} from '../utils/perfilJugadorMinimo';

/** Si la ruta actual exige perfil mínimo y falta, redirige a `/completar-perfil` (acceso directo por URL). */
export function usePerfilJugadorMinimoEnRuta() {
  const { session, userProfile, profileLoading, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || profileLoading) return;
    if (!session?.user) return;
    const pathOnly = String(location.pathname || '').split('?')[0].split('#')[0];
    if (!rutaExigePerfilJugadorMinimo(pathOnly)) return;
    if (perfilJugadorDatosMinimosCompletos(userProfile)) return;
    navigate('/completar-perfil', { replace: true, state: { from: pathOnly } });
  }, [loading, profileLoading, session?.user, userProfile, location.pathname, navigate]);
}
