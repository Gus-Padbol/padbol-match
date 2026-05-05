import React, { useMemo, useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useSearchParams,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import './App.css';
import ReservaForm from './pages/ReservaForm';
import AdminDashboard from './pages/AdminDashboard';
import TorneoCrear from './pages/TorneoCrear';
import FormEquipos from './pages/FormEquipos';
import MiPerfil from './pages/MiPerfil';
import PerfilPublico from './PerfilPublico';
import TorneoVista from './pages/TorneoVista';
import Rankings from './pages/Rankings';
import TorneosPublicos from './pages/TorneosPublicos';
import SedePublica from './pages/SedePublica';
import SedesPublicas from './pages/SedesPublicas';
import EquipoPerfil from './pages/EquipoPerfil';
import PagoExitoso from './pages/PagoExitoso';
import PagoFallido from './pages/PagoFallido';
import useUserRole from './hooks/useUserRole';
import EquipoVista from './pages/EquipoVista';
import UserHome from './pages/UserHome';
import Login from './pages/Login';
import AccesoCuenta from './pages/AccesoCuenta';
import ProtectedRoute from './components/ProtectedRoute';
import NuevaSede from './components/NuevaSede';
import { buildMiPerfilRegistroUrl } from './utils/miPerfilRegistroUrl';
import { useAuth } from './context/AuthContext';
import { getDisplayName } from './utils/displayName';
import {
  isPadbolModoJugadorActivo,
  PADBOL_MODO_JUGADOR_CHANGED_EVENT,
} from './utils/padbolModoJugador';

function LegacyPerfilRedirect() {
  const loc = useLocation();
  const suffix = `${loc.search || ''}${loc.hash || ''}`;
  return <Navigate to={`/mi-perfil${suffix}`} replace />;
}

function RegistroToMiPerfilRedirect() {
  const [sp] = useSearchParams();
  const r = sp.get('redirect') || '';
  return <Navigate to={buildMiPerfilRegistroUrl(r)} replace />;
}

/** Solo `/auth` con callback (hash/query de proveedor). `redirect` solo no abre login aquí — usar `/login`. */
function authLocationShowsLoginScreen(search, hash) {
  const h = hash || '';
  if (h.length > 1) return true;
  const qs = search || '';
  if (qs.length <= 1) return false;
  try {
    const sp = new URLSearchParams(qs);
    return (
      sp.has('code') ||
      sp.has('error') ||
      sp.has('error_description') ||
      sp.has('token_hash') ||
      sp.has('type') ||
      sp.get('login') === '1'
    );
  } catch {
    return true;
  }
}

function AuthRoute() {
  const { search, hash } = useLocation();
  if (!authLocationShowsLoginScreen(search, hash)) {
    return <Navigate to="/" replace />;
  }
  return <AccesoCuenta />;
}

function AdminDashboardGate() {
  const navigate = useNavigate();
  const { session, userProfile } = useAuth();

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return {
      email: em,
      nombre: getDisplayName(userProfile, session),
      whatsapp: String(userProfile?.whatsapp || '').trim(),
      foto: userProfile?.foto_url ?? userProfile?.foto ?? null,
    };
  }, [session, userProfile]);

  const { rol, sedeId, loading: roleLoading } = useUserRole(currentCliente);

  const [padbolModoJugadorGateRev, setPadbolModoJugadorGateRev] = useState(0);
  useEffect(() => {
    const bump = () => setPadbolModoJugadorGateRev((n) => n + 1);
    if (typeof window === 'undefined') return undefined;
    window.addEventListener(PADBOL_MODO_JUGADOR_CHANGED_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener(PADBOL_MODO_JUGADOR_CHANGED_EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  const modoJugadorBloqueaAdmin = useMemo(
    () => isPadbolModoJugadorActivo({ email: currentCliente?.email, rol }),
    [currentCliente?.email, rol, padbolModoJugadorGateRev]
  );

  /** Solo roles definidos en `user_roles` (sin fallback por email a super_admin). */
  const canAccessAdmin = () => ['super_admin', 'admin_nacional', 'admin_club'].includes(rol);

  const email = currentCliente?.email ?? null;
  console.log('GATE:', { roleLoading, rol, sedeId, email, canAccess: canAccessAdmin() });

  const spinner = (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.95)',
        fontWeight: 600,
        fontSize: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(255,255,255,0.25)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'adminGateSpin 0.75s linear infinite',
        }}
      />
      Cargando panel…
      <style>{`@keyframes adminGateSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  /* Mientras useUserRole carga: nunca denegar (rol puede ser null un instante). */
  if (roleLoading) {
    return spinner;
  }

  if (modoJugadorBloqueaAdmin) {
    return <Navigate to="/hub" replace />;
  }

  if (canAccessAdmin()) {
    return <AdminDashboard rol={rol} sedeId={sedeId} />;
  }

  /* roleLoading === false: rol ya resuelto; sin rol de panel → denegar. */
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 24,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.95)',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ margin: 0, fontSize: '17px', fontWeight: 600, maxWidth: 360 }}>
        No tenés permisos para acceder al panel
      </p>
      <button
        type="button"
        onClick={() => navigate('/hub')}
        style={{
          padding: '12px 20px',
          borderRadius: 12,
          border: 'none',
          fontWeight: 700,
          fontSize: '15px',
          cursor: 'pointer',
          background: '#fff',
          color: '#1e293b',
        }}
      >
        Volver al hub
      </button>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  useEffect(() => {
    console.log('PATH ACTUAL:', window.location.pathname);
  }, [location.pathname]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Routes>
        <Route path="/" element={<UserHome />} />
        <Route path="/hub" element={<UserHome />} />
        <Route path="/inicio" element={<UserHome />} />
        <Route path="/home" element={<UserHome />} />

        <Route path="/auth" element={<AuthRoute />} />
        <Route path="/registro" element={<RegistroToMiPerfilRedirect />} />

        <Route path="/reserva" element={<Navigate to="/reservar" replace />} />
        <Route path="/reservar" element={<ReservaForm />} />

        <Route path="/torneos" element={<TorneosPublicos />} />
        <Route path="/torneo/crear" element={<TorneoCrear />} />
        <Route path="/torneo/:id/jugadores" element={<Navigate to="/mi-perfil" replace />} />
        <Route path="/torneo/:id/equipos/:equipoId" element={<EquipoVista />} />
        <Route path="/equipo/:id" element={<EquipoPerfil />} />
        <Route path="/torneo/:id/equipos" element={<FormEquipos />} />
        <Route path="/crear-equipo" element={<Navigate to="/torneos" replace />} />
        <Route path="/pago-exitoso" element={<PagoExitoso />} />
        <Route path="/pago-fallido" element={<PagoFallido />} />
        <Route path="/torneo/:torneoId" element={<TorneoVista />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/sedes" element={<SedesPublicas />} />
        <Route path="/sede/:sedeId" element={<SedePublica />} />
        <Route path="/mi-perfil" element={<MiPerfil />} />
        <Route path="/jugador/:alias" element={<PerfilPublico />} />

        <Route path="/login" element={<Login />} />

        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <LegacyPerfilRedirect />
            </ProtectedRoute>
          }
        />
        {/* /admin: AdminDashboardGate espera user_roles y no usa lista legacy de emails para super_admin. */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboardGate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/nueva-sede"
          element={
            <ProtectedRoute>
              <NuevaSede />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;
