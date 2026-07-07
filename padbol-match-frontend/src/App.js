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
import UnirsePage from './pages/UnirsePage';
import SedesPublicas from './pages/SedesPublicas';
import EquipoPerfil from './pages/EquipoPerfil';
import PagoExitoso from './pages/PagoExitoso';
import PagoFallido from './pages/PagoFallido';
import CheckinKiosco from './pages/CheckinKiosco';
import Jugar from './pages/Jugar';
import Competir from './pages/Competir';
import PartidosAbiertos from './pages/PartidosAbiertos';
import NotificacionesPage from './pages/NotificacionesPage';
import ArmarPartido from './pages/ArmarPartido';
import ClasesPage from './pages/ClasesPage';
import ClaseDetallePage from './pages/ClaseDetallePage';
import useUserRole from './hooks/useUserRole';
import EquipoVista from './pages/EquipoVista';
import UserHome from './pages/UserHome';
import LandingPage from './pages/LandingPage';
import SobrePadbolMatch from './pages/SobrePadbolMatch';
import ContactoSumarClub from './pages/ContactoSumarClub';
import AccesoCuenta from './pages/AccesoCuenta';
import ProtectedRoute from './components/ProtectedRoute';
import PerfilJugadorDatosMinimosGate from './components/PerfilJugadorDatosMinimosGate';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import ErrorBoundary from './components/ErrorBoundary';
import AppLanguageGate from './components/AppLanguageGate';
import ChatbotIASafe from './components/ChatbotIASafe';
import LegalFooterBar from './components/LegalFooterBar';
import CookieConsentBanner from './components/CookieConsentBanner';
import PwaUpdateBanner from './components/PwaUpdateBanner';
import TerminosCondiciones from './pages/TerminosCondiciones';
import PoliticaPrivacidad from './pages/PoliticaPrivacidad';
import {
  isLegalFooterGlobalBarVisiblePathname,
  LEGAL_FOOTER_GLOBAL_SPACER_PX,
} from './constants/hubLayout';
import CompletarPerfilOAuth from './pages/CompletarPerfilOAuth';
import AuthOAuthCallback from './pages/AuthOAuthCallback';
import NuevaSede from './components/NuevaSede';
import InvitarAdminClubPage from './pages/InvitarAdminClubPage';
import { buildMiPerfilRegistroUrl } from './utils/miPerfilRegistroUrl';
import { useAuth } from './context/AuthContext';
import { HubNavLayoutProvider } from './context/HubNavLayoutContext';
import { getDisplayName } from './utils/displayName';
import { scheduleHubEntryScrollReset } from './utils/hubEntryScrollReset';
import {
  userCanAccessAdminPanel,
  normalizeUserRole,
} from './utils/adminPanelRoles';
import ScoreboardDisplay from './pages/ScoreboardDisplay';
import ScoreboardCanchaDisplay from './pages/ScoreboardCanchaDisplay';
import ScoreboardControl from './pages/ScoreboardControl';
import ScoreboardJoin from './pages/ScoreboardJoin';
import ScoreboardScoreBugPage from './pages/ScoreboardScoreBugPage';
import ScoreboardScoreBugCanchaPage from './pages/ScoreboardScoreBugCanchaPage';

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

/** `/auth` o `/login` con callback OAuth, `?modo=registro`, `?login=1` o `?redirect=` interno. URL vacía → no es acceso explícito. */
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

/** Solo mostrar login/registro cuando la URL indica intención explícita (no en `/auth` o `/login` vacíos). */
function AuthEntryRoute() {
  const { search, hash } = useLocation();
  if (authRouteIsBare(search, hash) || !authLocationShowsLoginScreen(search, hash)) {
    return <Navigate to="/" replace />;
  }
  return <AccesoCuenta />;
}

/** `/acceso`: entrada explícita a ingresar (siempre formulario). */
function AccesoRoute() {
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

/**
 * Rutas desconocidas: evita quedarse sin match útil. Con sesión → hub; sin sesión → landing (/).
 * Mientras `loading` de auth, spinner compacto (no pantalla vacía sobre el gradiente de body).
 */
function WildcardFallback() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
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
        Cargando…
      </div>
    );
  }

  if (session?.user) {
    return <Navigate to="/hub" replace />;
  }

  return <Navigate to="/" replace />;
}

function AdminDashboardGate() {
  const navigate = useNavigate();
  const { session, userProfile, signOutAndClear } = useAuth();

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
  const rolPanel = normalizeUserRole(rol);
  const canAccessAdmin = userCanAccessAdminPanel(rolPanel);

  useEffect(() => {
    if (roleLoading) return;
    const email = String(session?.user?.email || '').trim().toLowerCase();
    console.log('[AdminDashboardGate] rol desde /api/auth/mi-rol', {
      email,
      rol: rolPanel,
      sedeId,
      canAccessAdmin,
    });
  }, [roleLoading, session?.user?.email, rolPanel, sedeId, canAccessAdmin]);

  const stillResolvingRole = roleLoading;

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

  if (stillResolvingRole) {
    return spinner;
  }

  if (canAccessAdmin && rolPanel) {
    return (
      <ErrorBoundary label="el panel de administración">
        <AdminDashboard rol={rolPanel} sedeId={sedeId} handleLogout={signOutAndClear} />
      </ErrorBoundary>
    );
  }

  /* Sin rol de panel en GET /api/auth/mi-rol → denegar. */
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
        onClick={() => {
          navigate('/hub');
          scheduleHubEntryScrollReset();
        }}
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

        <Route path="/auth" element={<AuthEntryRoute />} />
        <Route path="/auth/callback" element={<AuthOAuthCallback />} />
        <Route path="/acceso" element={<AccesoRoute />} />
        <Route path="/registro" element={<RegistroToMiPerfilRedirect />} />

        <Route path="/reserva" element={<Navigate to="/reservar" replace />} />
        <Route path="/reservar" element={<ReservaForm />} />
        <Route path="/jugar" element={<Jugar />} />
        <Route path="/jugar/buscar" element={<PartidosAbiertos />} />
        <Route path="/jugar/armar" element={<ArmarPartido />} />
        <Route path="/clases" element={<ClasesPage />} />
        <Route path="/clases/:id" element={<ClaseDetallePage />} />
        <Route path="/competir" element={<Competir />} />
        <Route path="/partidos-abiertos" element={<PartidosAbiertos />} />
        <Route path="/notificaciones" element={<NotificacionesPage />} />
        <Route path="/armar-partido" element={<ArmarPartido />} />

        <Route path="/torneos" element={<TorneosPublicos />} />
        <Route path="/torneo/crear" element={<TorneoCrear />} />
        <Route path="/torneo/:id/jugadores" element={<Navigate to="/mi-perfil" replace />} />
        <Route path="/torneo/:id/equipos/:equipoId" element={<EquipoVista />} />
        <Route path="/equipo/:id" element={<EquipoPerfil />} />
        <Route path="/torneo/:id/equipos" element={<FormEquipos />} />
        <Route path="/crear-equipo" element={<Navigate to="/torneos" replace />} />
        <Route path="/pago-exitoso" element={<PagoExitoso />} />
        <Route path="/pago-fallido" element={<PagoFallido />} />
        <Route path="/checkin" element={<CheckinKiosco />} />
        <Route path="/torneo/:torneoId" element={<TorneoVista />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/sedes" element={<SedesPublicas />} />
        <Route path="/unirse" element={<UnirsePage />} />
        <Route path="/invitar-admin-club/:token" element={<InvitarAdminClubPage />} />
        <Route path="/join" element={<Navigate to="/unirse" replace />} />
        <Route path="/sede/:sedeId" element={<SedePublica />} />
        <Route path="/mi-perfil" element={<MiPerfil />} />
        <Route path="/perfil/:userId" element={<PerfilPublico />} />
        <Route path="/jugador/:alias" element={<PerfilPublico />} />

        <Route path="/login" element={<AuthEntryRoute />} />
        <Route path="/sobre" element={<SobrePadbolMatch />} />
        <Route path="/contacto" element={<ContactoSumarClub />} />
        <Route path="/terminos" element={<TerminosCondiciones />} />
        <Route path="/privacidad" element={<PoliticaPrivacidad />} />

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
          path="/admin/padcoins/alertas"
          element={<Navigate to="/admin?tab=padcoins&section=alertas" replace />}
        />
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

        <Route path="*" element={<WildcardFallback />} />
    </Routes>
    </PerfilJugadorDatosMinimosGate>
  );
}

function AppShell() {
  const location = useLocation();
  const legalFooterPad = isLegalFooterGlobalBarVisiblePathname(location.pathname)
    ? LEGAL_FOOTER_GLOBAL_SPACER_PX
    : 0;

  /** Sin padding-top global en la columna: cada ruta usa `hubContentPaddingTopCss` y `--pm-app-header-stack-height` (hubLayout + index.css). */
  return (
    <>
      <div
        style={{
          flex: 1,
          width: '100%',
          minHeight: 0,
          paddingBottom: legalFooterPad,
          boxSizing: 'border-box',
        }}
      >
        <AppRoutes />
      </div>
      <LegalFooterBar />
      <ChatbotIASafe />
      <CookieConsentBanner />
      <PwaUpdateBanner />
    </>
  );
}

function App() {
  return (
    <Router>
      <HubNavLayoutProvider>
        <GlobalErrorBoundary>
          <AppLanguageGate>
            <Routes>
              <Route
                path="/scoreboard/join/:sedeId/:cancha/:equipo"
                element={(
                  <ErrorBoundary label="carga de jugador por QR">
                    <ScoreboardJoin />
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/scoreboard/join/:sedeId/:cancha"
                element={(
                  <ErrorBoundary label="carga de jugador por QR">
                    <ScoreboardJoin />
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/display/:sedeId/scoreboard/:partidoId"
                element={(
                  <ErrorBoundary label="la pantalla TV del scoreboard">
                    <ScoreboardDisplay />
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/display/:sedeId/cancha/:cancha"
                element={(
                  <ErrorBoundary label="la pantalla TV del scoreboard por cancha">
                    <ScoreboardCanchaDisplay />
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/scorebug/cancha/:sedeId/:cancha"
                element={(
                  <ErrorBoundary label="el scorebug OBS por cancha">
                    <ScoreboardScoreBugCanchaPage />
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/scorebug/:partidoId"
                element={(
                  <ErrorBoundary label="el scorebug OBS">
                    <ScoreboardScoreBugPage />
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/admin/scoreboard/:partidoId"
                element={(
                  <ProtectedRoute>
                    <ErrorBoundary label="el panel del árbitro">
                      <ScoreboardControl />
                    </ErrorBoundary>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="*"
                element={(
                  <div className="pm-app-shell-column">
                    <AppShell />
                  </div>
                )}
              />
            </Routes>
          </AppLanguageGate>
        </GlobalErrorBoundary>
      </HubNavLayoutProvider>
    </Router>
  );
}

export default App;
