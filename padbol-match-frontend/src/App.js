import React, { useState, useEffect, useCallback } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  Navigate,
  useSearchParams,
} from 'react-router-dom';
import './App.css';
import ReservaForm from './pages/ReservaForm';
import AdminDashboard from './pages/AdminDashboard';
import TorneoCrear from './pages/TorneoCrear';
import JugadoresCargar from './pages/JugadoresCargar';
import FormEquipos from './pages/FormEquipos';
import MiPerfil from './pages/MiPerfil';
import TorneoVista from './pages/TorneoVista';
import Rankings from './pages/Rankings';
import TorneosPublicos from './pages/TorneosPublicos';
import SedePublica from './pages/SedePublica';
import SedesPublicas from './pages/SedesPublicas';
import PagoExitoso from './pages/PagoExitoso';
import PagoFallido from './pages/PagoFallido';
import { supabase } from './supabaseClient';
import useUserRole from './hooks/useUserRole';
import EquipoVista from './pages/EquipoVista';
import UserHome from './pages/UserHome';
import HomePublic from './pages/HomePublic';
import { APP_HEADER_LOGO } from './components/AppUnifiedHeader';
import { getOrCreateUsuarioBasico } from './utils/usuarioBasico';
import { refreshJugadorPerfilFromSupabase } from './utils/jugadorPerfil';

const ADMIN_EMAILS = [
  'padbolinternacional@gmail.com',
  'admin@padbol.com',
  'sm@padbol.com',
  'juanpablo@padbol.com',
];

function safeRedirectPath(raw) {
  if (!raw || typeof raw !== 'string') return '/home';
  const t = raw.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return '/home';
  return t;
}

function LoginPage({ setCurrentCliente }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const afterLogin = useCallback(
    (user) => {
      setCurrentCliente(user);
      localStorage.setItem('currentCliente', JSON.stringify(user));
      const next = safeRedirectPath(searchParams.get('redirect'));
      navigate(next, { replace: true });
    },
    [navigate, searchParams, setCurrentCliente]
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        padding: '24px 16px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <img src="/logo-padbol-match.png" alt="Padbol Match" style={APP_HEADER_LOGO} />
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'rgba(255,255,255,0.98)',
          borderRadius: '16px',
          padding: '28px 24px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: '18px', color: '#1e1b4b' }}>Iniciar sesión</h2>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErrorMsg('');

            const { data, error } = await supabase.auth.signInWithPassword({
              email: loginEmail,
              password: loginPassword,
            });

            if (error) {
              setErrorMsg('Email o contraseña incorrectos');
              return;
            }

            const { data: cliente } = await supabase
              .from('clientes')
              .select('nombre, whatsapp, foto')
              .eq('email', data.user.email)
              .maybeSingle();

            const user = {
              email: data.user.email,
              nombre: cliente?.nombre || data.user.email.split('@')[0],
              whatsapp: cliente?.whatsapp || '',
              foto: cliente?.foto || null,
            };

            afterLogin(user);
          }}
        >
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            Email
          </label>
          <input
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              marginBottom: '14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              boxSizing: 'border-box',
            }}
          />
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            Contraseña
          </label>
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              marginBottom: '18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg,#667eea,#764ba2)',
              color: 'white',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            Entrar
          </button>
        </form>

        {errorMsg ? (
          <p style={{ color: '#b91c1c', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>{errorMsg}</p>
        ) : null}

        <button
          type="button"
          onClick={() => navigate('/home')}
          style={{
            marginTop: '20px',
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            color: '#475569',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Volver al inicio
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const navigate = useNavigate();

  const [currentCliente, setCurrentCliente] = useState(() => {
    const saved = localStorage.getItem('currentCliente');
    return saved ? JSON.parse(saved) : null;
  });

  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    getOrCreateUsuarioBasico();
  }, []);

  const { rol, sedeId, loading: roleLoading } = useUserRole(currentCliente);

  const canAccessAdmin = () => {
    const email = (currentCliente?.email || '').trim().toLowerCase();
    if (ADMIN_EMAILS.includes(email)) return true;
    return ['super_admin', 'admin_nacional', 'admin_club'].includes(rol);
  };

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    try {
      localStorage.removeItem('currentCliente');
    } catch {
      /* ignore */
    }
    setCurrentCliente(null);
    navigate('/home', { replace: true });
  }, [navigate]);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const email = session.user.email;

        const { data: cliente } = await supabase
          .from('clientes')
          .select('nombre, whatsapp, foto')
          .eq('email', email)
          .maybeSingle();

        const user = {
          email,
          nombre: cliente?.nombre || email.split('@')[0],
          whatsapp: cliente?.whatsapp || '',
          foto: cliente?.foto || null,
        };

        setCurrentCliente(user);
        localStorage.setItem('currentCliente', JSON.stringify(user));
        await refreshJugadorPerfilFromSupabase(email);
      }

      setAuthReady(true);
    };

    init();
  }, []);

  if (!authReady) {
    return (
      <div style={{ color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Cargando sesión...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage setCurrentCliente={setCurrentCliente} />} />
      <Route
        path="/"
        element={
          currentCliente ? (
            <UserHome currentCliente={currentCliente} onLogout={handleLogout} />
          ) : (
            <Navigate to="/home" replace />
          )
        }
      />
      <Route path="/home" element={<HomePublic />} />
      <Route path="/reservar" element={<ReservaForm currentCliente={currentCliente} />} />
      <Route path="/torneos" element={<TorneosPublicos onLogout={currentCliente ? handleLogout : undefined} />} />
      <Route path="/torneo/crear" element={<TorneoCrear />} />
      <Route path="/torneo/:id/jugadores" element={<JugadoresCargar />} />
      <Route path="/torneo/:id/equipos/:equipoId" element={<EquipoVista onLogout={currentCliente ? handleLogout : undefined} />} />
      <Route path="/torneo/:id/equipos" element={<FormEquipos onLogout={currentCliente ? handleLogout : undefined} />} />
      <Route path="/pago-exitoso" element={<PagoExitoso currentCliente={currentCliente} />} />
      <Route path="/pago-fallido" element={<PagoFallido currentCliente={currentCliente} />} />
      <Route path="/torneo/:torneoId" element={<TorneoVista />} />
      <Route path="/rankings" element={<Rankings currentCliente={currentCliente} onLogout={currentCliente ? handleLogout : undefined} />} />
      <Route path="/sedes" element={<SedesPublicas currentCliente={currentCliente} onLogout={currentCliente ? handleLogout : undefined} />} />
      <Route path="/sede/:sedeId" element={<SedePublica currentCliente={currentCliente} />} />
      <Route
        path="/perfil"
        element={
          <MiPerfil
            currentCliente={currentCliente}
            onLogout={currentCliente ? handleLogout : undefined}
            onClienteActualizado={(u) => {
              setCurrentCliente(u);
              try {
                localStorage.setItem('currentCliente', JSON.stringify(u));
              } catch {
                /* ignore */
              }
            }}
          />
        }
      />
      <Route
        path="/admin"
        element={
          roleLoading ? (
            <div style={{ color: 'white', padding: 24, textAlign: 'center' }}>Cargando permisos…</div>
          ) : canAccessAdmin() ? (
            <AdminDashboard rol={rol} sedeId={sedeId} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="*" element={<AppContent />} />
      </Routes>
    </Router>
  );
}

export default App;
