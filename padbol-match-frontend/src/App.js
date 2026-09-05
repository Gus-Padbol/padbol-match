import React, { useMemo, useEffect, useState, Suspense, lazy } from 'react';
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

import useUserRole from './hooks/useUserRole';
import ProtectedRoute from './components/ProtectedRoute';
import PerfilJugadorDatosMinimosGate from './components/PerfilJugadorDatosMinimosGate';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import ErrorBoundary from './components/ErrorBoundary';
import AppLanguageGate from './components/AppLanguageGate';
import ChatbotIASafe from './components/ChatbotIASafe';
import LegalFooterBar from './components/LegalFooterBar';
import CookieConsentBanner from './components/CookieConsentBanner';
import PwaUpdateBanner from './components/PwaUpdateBanner';
import {
  isLegalFooterGlobalBarVisiblePathname,
  LEGAL_FOOTER_GLOBAL_SPACER_PX,
} from './constants/hubLayout';
import { buildMiPerfilRegistroUrl } from './utils/miPerfilRegistroUrl';
import { useAuth } from './context/AuthContext';
import { HubNavLayoutProvider } from './context/HubNavLayoutContext';
import { getDisplayName } from './utils/displayName';
import { scheduleHubEntryScrollReset } from './utils/hubEntryScrollReset';
import { useSafeTranslation } from './i18n/tSafe';
import {
  userCanAccessAdminPanel,
  normalizeUserRole,
} from './utils/adminPanelRoles';

/** Cada recorrido grande carga su código cuando la ruta lo necesita. */
const ReservaForm = lazy(() => import('./pages/ReservaForm'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const TorneoCrear = lazy(() => import('./pages/TorneoCrear'));
const FormEquipos = lazy(() => import('./pages/FormEquipos'));
const MiPerfil = lazy(() => import('./pages/MiPerfil'));
const RecorridoExterno = lazy(() => import('./pages/RecorridoExterno'));
const AdminRecorridosExternos = lazy(() => import('./pages/AdminRecorridosExternos'));
const PerfilPublico = lazy(() => import('./PerfilPublico'));
const TorneoVista = lazy(() => import('./pages/TorneoVista'));
const Rankings = lazy(() => import('./pages/Rankings'));
const TorneosPublicos = lazy(() => import('./pages/TorneosPublicos'));
const SedePublica = lazy(() => import('./pages/SedePublica'));
const UnirsePage = lazy(() => import('./pages/UnirsePage'));
const SedesPublicas = lazy(() => import('./pages/SedesPublicas'));
const EquipoPerfil = lazy(() => import('./pages/EquipoPerfil'));
const PagoExitoso = lazy(() => import('./pages/PagoExitoso'));
const PagoFallido = lazy(() => import('./pages/PagoFallido'));
const CheckinKiosco = lazy(() => import('./pages/CheckinKiosco'));
const Jugar = lazy(() => import('./pages/Jugar'));
const Competir = lazy(() => import('./pages/Competir'));
const PartidosAbiertos = lazy(() => import('./pages/PartidosAbiertos'));
const NotificacionesPage = lazy(() => import('./pages/NotificacionesPage'));
const ArmarPartido = lazy(() => import('./pages/ArmarPartido'));
const ClasesPage = lazy(() => import('./pages/ClasesPage'));
const ClaseDetallePage = lazy(() => import('./pages/ClaseDetallePage'));
const EquipoVista = lazy(() => import('./pages/EquipoVista'));
const UserHome = lazy(() => import('./pages/UserHome'));
const SobrePadbolMatch = lazy(() => import('./pages/SobrePadbolMatch'));
const ContactoSumarClub = lazy(() => import('./pages/ContactoSumarClub'));
const AccesoCuenta = lazy(() => import('./pages/AccesoCuenta'));
const TerminosCondiciones = lazy(() => import('./pages/TerminosCondiciones'));
const PoliticaPrivacidad = lazy(() => import('./pages/PoliticaPrivacidad'));
const EliminarCuenta = lazy(() => import('./pages/EliminarCuenta'));
const CompletarPerfilOAuth = lazy(() => import('./pages/CompletarPerfilOAuth'));
const AuthOAuthCallback = lazy(() => import('./pages/AuthOAuthCallback'));
const NuevaSede = lazy(() => import('./components/NuevaSede'));
const InvitarAdminClubPage = lazy(() => import('./pages/InvitarAdminClubPage'));
const ScoreboardDisplay = lazy(() => import('./pages/ScoreboardDisplay'));
const ScoreboardCanchaDisplay = lazy(() => import('./pages/ScoreboardCanchaDisplay'));
const ScoreboardControl = lazy(() => import('./pages/ScoreboardControl'));
const ScoreboardJoin = lazy(() => import('./pages/ScoreboardJoin'));
const ScoreboardScoreBugPage = lazy(() => import('./pages/ScoreboardScoreBugPage'));
const ScoreboardScoreBugCanchaPage = lazy(() => import('./pages/ScoreboardScoreBugCanchaPage'));
const PublicSitePage = lazy(() => import('./pages/publicSite/PublicSitePage'));
const AdminVenueLandingPage = lazy(() => import('./pages/adminLanding/AdminVenueLandingPage'));
const VenuePlansPage = lazy(() => import('./pages/adminLanding/VenuePlansPage'));
const SupportTicketsPage = lazy(() => import('./pages/SupportTicketsPage'));

function RouteLoadingScreen() {
  const { t } = useSafeTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-page, #070b14)',
        color: 'var(--text-primary, rgba(248,250,252,0.85))',
        fontWeight: 600,
      }}
    >
      {t('general.loading')}
    </div>
  );
}

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

/** La raíz siempre abre la presentación pública; la app queda en sus rutas internas. */
function RootHomeRoute() {
  return <Navigate to="/plataforma" replace />;
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
  const [roleGateTimedOut, setRoleGateTimedOut] = useState(false);

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

  const { rol, sedeId, loading: roleLoading, error: roleError } = useUserRole(currentCliente);
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

  // Última red de seguridad: el panel nunca debe quedar con un spinner infinito,
  // incluso si el navegador bloquea una promesa de autenticación o de red.
  useEffect(() => {
    setRoleGateTimedOut(false);
    if (!roleLoading) return undefined;
    const timeoutId = window.setTimeout(() => setRoleGateTimedOut(true), 15_000);
    return () => window.clearTimeout(timeoutId);
  }, [roleLoading, currentCliente?.email]);

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

  if (stillResolvingRole && !roleGateTimedOut) {
    return spinner;
  }

  if (canAccessAdmin && rolPanel) {
    return (
      <ErrorBoundary label="el panel de administración">
        <AdminDashboard rol={rolPanel} sedeId={sedeId} handleLogout={signOutAndClear} />
      </ErrorBoundary>
    );
  }

  if (roleError || roleGateTimedOut) {
    return (
      <div
        style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.95)', boxSizing: 'border-box',
        }}
      >
        <strong style={{ fontSize: '20px' }}>No pudimos cargar el panel</strong>
        <p style={{ maxWidth: 420, margin: 0, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
          La sesión está activa, pero la verificación de permisos no respondió a tiempo. Probá nuevamente.
        </p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '12px 18px', border: 0, borderRadius: 10, background: '#e11b22', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Reintentar
        </button>
        <button type="button" onClick={() => navigate('/')} style={{ padding: '8px 14px', border: 0, background: 'transparent', color: 'rgba(255,255,255,0.78)', cursor: 'pointer' }}>
          Volver a la app
        </button>
      </div>
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
        <Route
          path="/soporte"
          element={<ProtectedRoute><SupportTicketsPage /></ProtectedRoute>}
        />
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
        <Route path="/mi-perfil/recorrido" element={<ProtectedRoute><RecorridoExterno /></ProtectedRoute>} />
        <Route path="/perfil/:userId" element={<PerfilPublico />} />
        <Route path="/jugador/:alias" element={<PerfilPublico />} />

        <Route path="/login" element={<AuthEntryRoute />} />
        <Route path="/sobre" element={<SobrePadbolMatch />} />
        <Route path="/contacto" element={<ContactoSumarClub />} />
        <Route path="/terminos" element={<TerminosCondiciones />} />
        <Route path="/privacidad" element={<PoliticaPrivacidad />} />
        <Route path="/eliminar-cuenta" element={<EliminarCuenta />} />

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
        <Route path="/admin/recorridos-externos" element={<ProtectedRoute><AdminRecorridosExternos /></ProtectedRoute>} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboardGate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/soporte"
          element={<ProtectedRoute><SupportTicketsPage adminMode /></ProtectedRoute>}
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
  const normalizedPath = String(location.pathname || '/').replace(/\/+$/, '') || '/';
  const publicLayoutOwnsChatbot = normalizedPath === '/plataforma' || normalizedPath === '/planes';
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
      {!publicLayoutOwnsChatbot ? <ChatbotIASafe /> : null}
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
            <Suspense fallback={<RouteLoadingScreen />}>
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
                path="/plataforma"
                element={(
                  <ErrorBoundary label="la web pública">
                    <Suspense
                      fallback={<RouteLoadingScreen />}
                    >
                      <PublicSitePage />
                    </Suspense>
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/administradores"
                element={(
                  <ErrorBoundary label="la landing para sedes">
                    <AdminVenueLandingPage />
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/planes"
                element={(
                  <ErrorBoundary label="los planes para sedes">
                    <VenuePlansPage />
                  </ErrorBoundary>
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
            </Suspense>
          </AppLanguageGate>
        </GlobalErrorBoundary>
      </HubNavLayoutProvider>
    </Router>
  );
}

export default App;
