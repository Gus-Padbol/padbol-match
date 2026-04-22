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
import Login from './pages/Login';
import AccesoCuenta from './pages/AccesoCuenta';
import ProtectedRoute from './components/ProtectedRoute';
import { buildMiPerfilRegistroUrl } from './utils/miPerfilRegistroUrl';
import { useAuth } from './context/AuthContext';
import { getDisplayName } from './utils/displayName';

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

function RegistroToMiPerfilRedirect() {
  const [sp] = useSearchParams();
  const r = sp.get('redirect') || '';
  return <Navigate to={buildMiPerfilRegistroUrl(r)} replace />;
}

function authLocationShowsLoginScreen(search, hash) {
  const h = hash || '';
  if (h.length > 1) return true;
  const qs = search || '';
  if (qs.length <= 1) return false;
  try {
    const sp = new URLSearchParams(qs);
    return (
      sp.has('redirect') ||
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
  const { session, userProfile } = useAuth();

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return {
      email: em,
      nombre: getDisplayName(userProfile, session),
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

  if (roleLoading) {
    return <div style={{ color: 'white', padding: 24, textAlign: 'center' }}>Cargando permisos…</div>;
  }
  if (canAccessAdmin()) {
    return <AdminDashboard rol={rol} sedeId={sedeId} />;
  }
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <div style={{ minHeight: '100vh', boxSizing: 'border-box' }}>
      <Routes>
        <Route path="/" element={<UserHome />} />
        <Route path="/hub" element={<UserHome />} />
        <Route path="/inicio" element={<UserHome />} />
        <Route path="/home" element={<UserHome />} />

        <Route path="/login" element={<Login />} />
        <Route path="/auth" element={<AuthRoute />} />
        <Route path="/registro" element={<RegistroToMiPerfilRedirect />} />

        <Route
          path="/reserva"
          element={
            <ProtectedRoute>
              <Navigate to="/reservar" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reservar"
          element={
            <ProtectedRoute>
              <ReservaForm />
            </ProtectedRoute>
          }
        />

        <Route path="/torneos" element={<TorneosPublicos />} />
        <Route path="/torneo/crear" element={<TorneoCrear />} />
        <Route path="/torneo/:id/jugadores" element={<Navigate to="/mi-perfil" replace />} />
        <Route
          path="/torneo/:id/equipos/:equipoId"
          element={
            <ProtectedRoute>
              <EquipoVista />
            </ProtectedRoute>
          }
        />
        <Route path="/torneo/:id/equipos" element={<FormEquipos />} />
        <Route path="/crear-equipo" element={<Navigate to="/torneos" replace />} />
        <Route path="/pago-exitoso" element={<PagoExitoso />} />
        <Route path="/pago-fallido" element={<PagoFallido />} />
        <Route path="/torneo/:torneoId" element={<TorneoVista />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/sedes" element={<SedesPublicas />} />
        <Route path="/sede/:sedeId" element={<SedePublica />} />
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <LegacyPerfilRedirect />
            </ProtectedRoute>
          }
        />
        <Route path="/mi-perfil" element={<MiPerfil />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboardGate />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
