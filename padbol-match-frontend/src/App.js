import React, { useMemo, useEffect } from 'react';
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
import UnirsePage from './pages/UnirsePage';
import SedesPublicas from './pages/SedesPublicas';
import EquipoPerfil from './pages/EquipoPerfil';
import PagoExitoso from './pages/PagoExitoso';
import PagoFallido from './pages/PagoFallido';
import useUserRole from './hooks/useUserRole';
import EquipoVista from './pages/EquipoVista';
import UserHome from './pages/UserHome';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import AccesoCuenta from './pages/AccesoCuenta';
import ProtectedRoute from './components/ProtectedRoute';
import PerfilJugadorDatosMinimosGate from './components/PerfilJugadorDatosMinimosGate';
import CompletarPerfilOAuth from './pages/CompletarPerfilOAuth';
import NuevaSede from './components/NuevaSede';
import InvitarAdminClubPage from './pages/InvitarAdminClubPage';
import { buildMiPerfilRegistroUrl } from './utils/miPerfilRegistroUrl';
import { useAuth } from './context/AuthContext';
import { getDisplayName } from './utils/displayName';

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

/** `/auth` con callback (hash/query de proveedor), `?modo=registro` / `?login=1`, o `?redirect=` interno. Sin eso (salvo URL vacía), redirige a `/`. */
function authLocationShowsLoginScreen(search, hash) {
  const h = hash || '';
  if (h.length > 1) return true;
  const qs = search || '';
  if (qs.length <= 1) return false;
  try {
    const sp = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);
    return (
      sp.has('code') ||
      sp.has('error') ||
      sp.has('error_description') ||
      sp.has('token_hash') ||
      sp.has('type') ||
      sp.has('redirect') ||
      sp.get('login') === '1' ||
      sp.get('modo') === 'registro' ||
      sp.get('modo') === 'register' ||
      sp.get('registro') === '1'
    );
  } catch {
    return true;
  }
}

function authRouteIsBare(search, hash) {
  const q = String(search || '').replace(/^\?/, '');
  const h = hash || '';
  return q.length === 0 && h.length <= 1;
}

function AuthRoute() {
  const { search, hash } = useLocation();
  if (authRouteIsBare(search, hash)) {
    return <AccesoCuenta />;
  }
  if (!authLocationShowsLoginScreen(search, hash)) {
    return <Navigate to="/" replace />;
  }
  return <AccesoCuenta />;
}

/** `/` para visitantes: landing. Con sesión → hub (home habitual). */
function RootHomeRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #0b1020 0%, #151832 100%)',
          color: 'rgba(248, 250, 252, 0.92)',
          fontWeight: 600,
          fontSize: '15px',
          boxSizing: 'border-box',
          padding: 24,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 36,
            height: 36,
            marginRight: 14,
            border: '3px solid rgba(255,255,255,0.2)',
            borderTopColor: '#a5b4fc',
            borderRadius: '50%',
            animation: 'rootHomeSpin 0.75s linear infinite',
          }}
        />
        Cargando…
        <style>{`@keyframes rootHomeSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (session?.user) {
    return <Navigate to="/hub" replace />;
  }

  return <LandingPage />;
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
        No tienes permisos para acceder al panel
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
    <PerfilJugadorDatosMinimosGate>
    <Routes>
        <Route path="/" element={<RootHomeRoute />} />
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
        <Route path="/unirse" element={<UnirsePage />} />
        <Route path="/invitar-admin-club/:token" element={<InvitarAdminClubPage />} />
        <Route path="/join" element={<Navigate to="/unirse" replace />} />
        <Route path="/sede/:sedeId" element={<SedePublica />} />
        <Route path="/mi-perfil" element={<MiPerfil />} />
        <Route path="/jugador/:alias" element={<PerfilPublico />} />

        <Route path="/login" element={<Login />} />

        <Route
          path="/completar-perfil"
          element={
            <ProtectedRoute>
              <CompletarPerfilOAuth />
            </ProtectedRoute>
          }
        />

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
    </PerfilJugadorDatosMinimosGate>
  );
}

function App() {
  return (
    <Router>
      <div
        style={{
          width: '100%',
          maxWidth: '900px',
          marginLeft: 'auto',
          marginRight: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;
