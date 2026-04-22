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
import AccesoCuenta from './pages/AccesoCuenta';
import { buildMiPerfilRegistroUrl } from './utils/miPerfilRegistroUrl';
import { authUrlWithRedirect } from './utils/authLoginRedirect';
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

/** `/login` legacy: con query/hash de auth → `/auth`; sin intención → HUB (navegación pública). */
function LoginToAuthRedirect() {
  const { search, hash } = useLocation();
  const qs = search || '';
  const h = hash || '';
  const hasQueryParams = qs.length > 1;
  const hasOAuthHash =
    h.includes('access_token') ||
    h.includes('refresh_token') ||
    h.includes('type=recovery') ||
    h.includes('error=');
  if (hasQueryParams || hasOAuthHash) {
    return <Navigate to={`/auth${qs}${h}`} replace />;
  }
  return <Navigate to="/" replace />;
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

/**
 * `/auth` solo con intención explícita o callback (OAuth, PKCE, email, ?redirect=…).
 * Entrada vacía en `/auth` → HUB (evita PWA/Site URL que abran login como pantalla inicial).
 * Acceso voluntario sin destino: `/auth?redirect=/` o `/auth?login=1`.
 */
function AuthRoute() {
  const { search, hash } = useLocation();
  if (!authLocationShowsLoginScreen(search, hash)) {
    return <Navigate to="/" replace />;
  }
  return <AccesoCuenta />;
}

function AppContent() {
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

  const loggedIn = Boolean(session?.user);

  return (
    <>
      <div style={{ minHeight: '100vh', boxSizing: 'border-box' }}>
        <Routes>
          <Route path="/" element={<UserHome />} />
          <Route path="/hub" element={<UserHome />} />
          <Route path="/inicio" element={<UserHome />} />
          <Route path="/home" element={<UserHome />} />

          {/* resto de rutas NO TOCAR */}
          <Route path="/auth" element={<AuthRoute />} />
          <Route path="/login" element={<LoginToAuthRedirect />} />
          <Route path="/registro" element={<RegistroToMiPerfilRedirect />} />
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
          <Route path="/mi-perfil" element={<MiPerfil />} />
          <Route
            path="/admin"
            element={
              roleLoading ? (
                <div style={{ color: 'white', padding: 24, textAlign: 'center' }}>Cargando permisos…</div>
              ) : !loggedIn ? (
                <Navigate to={authUrlWithRedirect('/admin')} replace />
              ) : canAccessAdmin() ? (
                <AdminDashboard rol={rol} sedeId={sedeId} />
              ) : (
                <Navigate to="/" replace />
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
