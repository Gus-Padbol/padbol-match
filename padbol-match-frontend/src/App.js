import React, { useMemo } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useSearchParams,
  useLocation,
} from 'react-router-dom';
import './App.css';
import ReservaForm from './pages/ReservaForm';
import AdminDashboard from './pages/AdminDashboard';
import TorneoCrear from './pages/TorneoCrear';
import FormEquipos from './pages/FormEquipos';
import MiPerfil from './pages/MiPerfil';
import TorneoVista from './pages/TorneoVista';
import Rankings from './pages/Rankings';
import TorneosPublicos from './pages/TorneosPublicos';
import SedePublica from './pages/SedePublica';
import SedesPublicas from './pages/SedesPublicas';
import PagoExitoso from './pages/PagoExitoso';
import PagoFallido from './pages/PagoFallido';
import useUserRole from './hooks/useUserRole';
import EquipoVista from './pages/EquipoVista';
import UserHome from './pages/UserHome';
import HomePublic from './pages/HomePublic';
import AccesoCuenta from './pages/AccesoCuenta';
import { buildMiPerfilRegistroUrl } from './utils/miPerfilRegistroUrl';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { GlobalSessionBar, GLOBAL_SESSION_BAR_HEIGHT } from './components/AppUnifiedHeader';
import { getDisplayName } from './utils/displayName';
import { nombreCompletoJugadorPerfil } from './utils/jugadorPerfil';

const ADMIN_EMAILS = [
  'padbolinternacional@gmail.com',
  'admin@padbol.com',
  'sm@padbol.com',
  'juanpablo@padbol.com',
];

function LegacyPerfilRedirect() {
  const loc = useLocation();
  const suffix = `${loc.search || ''}${loc.hash || ''}`;
  return <Navigate to={`/mi-perfil${suffix}`} replace />;
}

function LoginToAuthRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/auth${search || ''}`} replace />;
}

function RegistroToMiPerfilRedirect() {
  const [sp] = useSearchParams();
  const r = sp.get('redirect') || '';
  return <Navigate to={buildMiPerfilRegistroUrl(r)} replace />;
}

/** Raíz: home público si no hay sesión; si hay sesión → HUB. */
function RootHome() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div
        style={{
          color: 'white',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg,#667eea,#764ba2)',
        }}
      >
        Cargando sesión…
      </div>
    );
  }
  if (session?.user) return <Navigate to="/hub" replace />;
  return <HomePublic />;
}

function AppContent() {
  const location = useLocation();
  const { session, userProfile } = useAuth();

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    const nombreDb =
      String(userProfile?.alias || '').trim() ||
      nombreCompletoJugadorPerfil(userProfile) ||
      String(userProfile?.nombre || '').trim();
    return {
      email: em,
      nombre: nombreDb || getDisplayName(userProfile, session),
      whatsapp: String(userProfile?.whatsapp || '').trim(),
      foto: userProfile?.foto ?? null,
    };
  }, [session, userProfile]);

  const { rol, sedeId, loading: roleLoading } = useUserRole(currentCliente);

  const canAccessAdmin = () => {
    const email = (currentCliente?.email || '').trim().toLowerCase();
    if (ADMIN_EMAILS.includes(email)) return true;
    return ['super_admin', 'admin_nacional', 'admin_club'].includes(rol);
  };

  const loggedIn = Boolean(session?.user);

  const showGlobalBar = !(location.pathname === '/auth' && !session?.user);
  const mainPadTop = showGlobalBar ? GLOBAL_SESSION_BAR_HEIGHT : 0;

  return (
    <>
      <GlobalSessionBar />
      <div style={{ paddingTop: mainPadTop, minHeight: '100vh', boxSizing: 'border-box' }}>
        <Routes>
          <Route path="/auth" element={<AccesoCuenta />} />
          <Route path="/login" element={<LoginToAuthRedirect />} />
          <Route path="/registro" element={<RegistroToMiPerfilRedirect />} />
          <Route path="/" element={<RootHome />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route
            path="/inicio"
            element={loggedIn ? <Navigate to="/hub" replace /> : <Navigate to="/" replace />}
          />
          <Route
            path="/hub"
            element={
              <ProtectedRoute>
                <UserHome />
              </ProtectedRoute>
            }
          />
          <Route path="/reservar" element={<ReservaForm />} />
          <Route path="/torneos" element={<TorneosPublicos />} />
          <Route path="/torneo/crear" element={<TorneoCrear />} />
          <Route path="/torneo/:id/jugadores" element={<Navigate to="/mi-perfil" replace />} />
          <Route path="/torneo/:id/equipos/:equipoId" element={<EquipoVista />} />
          <Route path="/torneo/:id/equipos" element={<FormEquipos />} />
          <Route path="/crear-equipo" element={<Navigate to="/torneos" replace />} />
          <Route path="/pago-exitoso" element={<PagoExitoso />} />
          <Route path="/pago-fallido" element={<PagoFallido />} />
          <Route path="/torneo/:torneoId" element={<TorneoVista />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/sedes" element={<SedesPublicas />} />
          <Route path="/sede/:sedeId" element={<SedePublica />} />
          <Route path="/perfil" element={<LegacyPerfilRedirect />} />
          <Route
            path="/mi-perfil"
            element={
              <ProtectedRoute>
                <MiPerfil />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              roleLoading ? (
                <div style={{ color: 'white', padding: 24, textAlign: 'center' }}>Cargando permisos…</div>
              ) : !loggedIn ? (
                <Navigate to="/" replace />
              ) : canAccessAdmin() ? (
                <AdminDashboard rol={rol} sedeId={sedeId} />
              ) : (
                <Navigate to="/hub" replace />
              )
            }
          />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
