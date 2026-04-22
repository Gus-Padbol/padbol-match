import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { handleAuthOnce } from '../utils/handleAuthOnce';
import { mensajeErrorAuthSupabase } from '../utils/authErrorsEs';
import { refreshJugadorPerfilFromSupabase } from '../utils/jugadorPerfil';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { APP_HEADER_LOGO } from '../components/AppUnifiedHeader';
import { useAuth } from '../context/AuthContext';
import { safeRedirectPath } from '../utils/safeRedirect';

export default function AccesoCuenta() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession, session, loading } = useAuth();
  const [modo, setModo] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const sesionYaRedirigidaRef = useRef(false);

  const afterLogin = useCallback(
    async (sessionArg) => {
      const s = sessionArg ?? null;
      if (!s?.user) return;
      if (sesionYaRedirigidaRef.current) return;
      sesionYaRedirigidaRef.current = true;
      const ue = s.user.email?.trim();
      if (ue) await refreshJugadorPerfilFromSupabase(ue);
      await refreshSession();
      const redirectParam = new URLSearchParams(location.search).get('redirect');
      let dest = '/';
      if (redirectParam) {
        try {
          dest = safeRedirectPath(decodeURIComponent(redirectParam));
        } catch {
          dest = '/';
        }
      }
      navigate(dest, { replace: true });
    },
    [navigate, refreshSession, location.search]
  );

  useEffect(() => {
    if (loading || !session?.user || sesionYaRedirigidaRef.current) return;
    const p = location.pathname;
    if (p !== '/login' && p !== '/auth') return;
    void afterLogin(session);
  }, [loading, session?.user?.id, afterLogin, location.pathname]);

  useEffect(() => {
    setErrorMsg('');
    setInfoMsg('');
  }, [modo]);

  const handleIngresar = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    if (busy) return;
    const em = email.trim().toLowerCase();
    if (!em) {
      setErrorMsg('Ingresá tu email.');
      return;
    }
    if (!password) {
      setErrorMsg('Ingresá tu contraseña.');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await handleAuthOnce({
        kind: 'signIn',
        email: em,
        password,
      });
      if (error) {
        setErrorMsg(mensajeErrorAuthSupabase(error.message));
        return;
      }
      const ue = data?.user?.email?.trim();
      if (!ue) {
        setErrorMsg('No se pudo iniciar sesión.');
        return;
      }
      await afterLogin(data?.session ?? null);
    } finally {
      setBusy(false);
    }
  };

  const handleRegistrar = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    if (busy) return;
    const em = email.trim().toLowerCase();
    if (!em) {
      setErrorMsg('Ingresá tu email.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== password2) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await handleAuthOnce({
        kind: 'signUp',
        email: em,
        password,
      });
      if (error) {
        setErrorMsg(mensajeErrorAuthSupabase(error.message));
        return;
      }
      if (data?.session?.user) {
        await afterLogin(data.session);
        return;
      }
      if (data?.user) {
        setInfoMsg('Si tu cuenta requiere confirmación, revisá tu correo. Después podés volver e ingresar.');
        setModo('login');
        return;
      }
      setErrorMsg('No se pudo crear la cuenta. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        padding: '64px 16px 80px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Acceso" />
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
        <h2 style={{ marginTop: 0, marginBottom: '18px', color: '#1e1b4b' }}>
          {modo === 'login' ? 'Acceso a tu cuenta' : 'Crear cuenta'}
        </h2>

        {modo === 'login' ? (
          <form onSubmit={handleIngresar}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              inputMode="email"
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: '14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                boxSizing: 'border-box',
              }}
            />
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
              disabled={busy}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg,#667eea,#764ba2)',
                color: 'white',
                fontWeight: 700,
                fontSize: '15px',
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegistrar}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              inputMode="email"
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: '14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                boxSizing: 'border-box',
              }}
            />
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: '14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                boxSizing: 'border-box',
              }}
            />
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Repetir contraseña
            </label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
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
              disabled={busy}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg,#667eea,#764ba2)',
                color: 'white',
                fontWeight: 700,
                fontSize: '15px',
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>
        )}

        {errorMsg ? (
          <p style={{ color: '#b91c1c', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>{errorMsg}</p>
        ) : null}
        {infoMsg ? (
          <p style={{ color: '#166534', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>{infoMsg}</p>
        ) : null}

        {modo === 'login' ? (
          <button
            type="button"
            onClick={() => setModo('register')}
            disabled={busy}
            style={{
              marginTop: '16px',
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontWeight: 700,
              fontSize: '15px',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            Crear cuenta
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setModo('login')}
            disabled={busy}
            style={{
              marginTop: '16px',
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontWeight: 700,
              fontSize: '15px',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            Ya tengo cuenta
          </button>
        )}

      </div>
      <BottomNav />
    </div>
  );
}
