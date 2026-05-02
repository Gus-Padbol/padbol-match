import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AccesoCuenta.css';
import { handleAuthOnce } from '../utils/handleAuthOnce';
import { mensajeErrorAuthSupabase } from '../utils/authErrorsEs';
import { refreshJugadorPerfilFromSupabase } from '../utils/jugadorPerfil';
import AppHeader from '../components/AppHeader';
import {
  HUB_APP_HEADER_HEIGHT_PX,
  HUB_CONTENT_PADDING_BOTTOM_PX,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { useAuth } from '../context/AuthContext';
import { RESERVA_RETURN_STORAGE_KEY } from '../utils/reservaReturnUrl';

/** Misma clave que en FormEquipos: invitación a equipo con `?equipo=` antes del login. */
const PENDING_TORNEO_INVITE_LS = 'padbol_invite_torneo_equipo_return';

function PasswordEyeIcon({ revealed }) {
  const svgProps = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: '#64748b',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  if (revealed) {
    return (
      <svg {...svgProps}>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg {...svgProps}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

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
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPassword2, setShowRegPassword2] = useState(false);
  const sesionYaRedirigidaRef = useRef(false);

  const handleAccesoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  /** WebKit dispara `animationstart` al autocompletar (ver AccesoCuenta.css); evita que el layout quede desplazado. */
  useEffect(() => {
    const onAnimationStart = (ev) => {
      if (ev.animationName !== 'pm-acceso-autofill') return;
      const t = ev.target;
      if (!(t instanceof HTMLElement) || !t.classList.contains('acceso-cuenta-input')) return;
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0 });
      });
    };
    window.addEventListener('animationstart', onAnimationStart, true);
    return () => window.removeEventListener('animationstart', onAnimationStart, true);
  }, []);

  const afterLogin = useCallback(
    async (sessionArg) => {
      const s = sessionArg ?? null;
      if (!s?.user) return;
      if (sesionYaRedirigidaRef.current) return;
      sesionYaRedirigidaRef.current = true;
      const ue = s.user.email?.trim();
      if (ue) await refreshJugadorPerfilFromSupabase(ue);
      await refreshSession();
      try {
        localStorage.removeItem(RESERVA_RETURN_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      try {
        localStorage.removeItem(PENDING_TORNEO_INVITE_LS);
      } catch {
        /* ignore */
      }
      // Siempre al hub: nunca /admin ni otras rutas tras login (incl. si venía de redirect o panel).
      navigate('/', { replace: true });
    },
    [navigate, refreshSession]
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
    setShowLoginPassword(false);
    setShowRegPassword(false);
    setShowRegPassword2(false);
  }, [modo]);

  const handleIngresar = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    if (busy) return;
    const em = email.trim().toLowerCase();
    if (!em) {
      setErrorMsg('Ingresa tu email.');
      return;
    }
    if (!password) {
      setErrorMsg('Ingresa tu contraseña.');
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
      setErrorMsg('Ingresa tu email.');
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
        setInfoMsg('Si tu cuenta requiere confirmación, revisa tu correo. Luego puedes volver a ingresar.');
        setModo('login');
        return;
      }
      setErrorMsg('No se pudo crear la cuenta. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const accesoPaddingTop = `calc(${HUB_APP_HEADER_HEIGHT_PX + 16}px + env(safe-area-inset-top, 0px))`;
  const accesoPaddingBottomPx = Math.min(32, HUB_CONTENT_PADDING_BOTTOM_PX);

  return (
    <div
      style={{
        minHeight: 'auto',
        width: '100%',
        maxWidth: '100%',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        paddingTop: accesoPaddingTop,
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: `${accesoPaddingBottomPx}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title="Acceso" showBack onBack={handleAccesoBack} />
      <div
        style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <img
          src="/logo-padbol-match.png"
          alt="Padbol Match"
          style={{
            ...padbolLogoImgStyle,
            marginBottom: '4px',
          }}
        />
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '0 24px',
          boxSizing: 'border-box',
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: '18px',
            color: '#ffffff',
            fontSize: '1.35rem',
            textAlign: 'center',
          }}
        >
          {modo === 'login' ? 'Iniciar Sesión' : 'Crear cuenta'}
        </h2>

        {modo === 'login' ? (
          <form onSubmit={handleIngresar}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.92)',
                marginBottom: '6px',
              }}
            >
              Email
            </label>
            <input
              className="acceso-cuenta-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              inputMode="email"
              style={{
                width: '100%',
                padding: '14px',
                marginBottom: '14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxSizing: 'border-box',
                fontSize: '16px',
                background: '#ffffff',
              }}
            />
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.92)',
                marginBottom: '6px',
              }}
            >
              Contraseña
            </label>
            <div style={{ position: 'relative', marginBottom: '18px' }}>
              <input
                className="acceso-cuenta-input"
                type={showLoginPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '14px 48px 14px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  background: '#ffffff',
                }}
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword((v) => !v)}
                aria-label={showLoginPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  lineHeight: 0,
                  borderRadius: '8px',
                }}
              >
                <PasswordEyeIcon revealed={showLoginPassword} />
              </button>
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                padding: '16px 12px',
                borderRadius: '10px',
                border: 'none',
                background: '#dc2626',
                color: 'white',
                fontWeight: 700,
                fontSize: '18px',
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
            <button
              type="button"
              onClick={() => setModo('register')}
              disabled={busy}
              style={{
                marginTop: '14px',
                width: '100%',
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: '#fed7aa',
                fontSize: '15px',
                fontWeight: 600,
                cursor: busy ? 'default' : 'pointer',
                textAlign: 'center',
              }}
            >
              ¿No tienes cuenta? Regístrate
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegistrar}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.92)',
                marginBottom: '6px',
              }}
            >
              Email
            </label>
            <input
              className="acceso-cuenta-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              inputMode="email"
              style={{
                width: '100%',
                padding: '14px',
                marginBottom: '14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxSizing: 'border-box',
                fontSize: '16px',
                background: '#ffffff',
              }}
            />
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.92)',
                marginBottom: '6px',
              }}
            >
              Contraseña
            </label>
            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <input
                className="acceso-cuenta-input"
                type={showRegPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '14px 48px 14px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  background: '#ffffff',
                }}
              />
              <button
                type="button"
                onClick={() => setShowRegPassword((v) => !v)}
                aria-label={showRegPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  lineHeight: 0,
                  borderRadius: '8px',
                }}
              >
                <PasswordEyeIcon revealed={showRegPassword} />
              </button>
            </div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.92)',
                marginBottom: '6px',
              }}
            >
              Repetir contraseña
            </label>
            <div style={{ position: 'relative', marginBottom: '18px' }}>
              <input
                className="acceso-cuenta-input"
                type={showRegPassword2 ? 'text' : 'password'}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '14px 48px 14px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  background: '#ffffff',
                }}
              />
              <button
                type="button"
                onClick={() => setShowRegPassword2((v) => !v)}
                aria-label={showRegPassword2 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  lineHeight: 0,
                  borderRadius: '8px',
                }}
              >
                <PasswordEyeIcon revealed={showRegPassword2} />
              </button>
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                padding: '16px 12px',
                borderRadius: '10px',
                border: 'none',
                background: '#dc2626',
                color: 'white',
                fontWeight: 700,
                fontSize: '18px',
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>
        )}

        {errorMsg ? (
          <p style={{ color: '#fecaca', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>{errorMsg}</p>
        ) : null}
        {infoMsg ? (
          <p style={{ color: '#bbf7d0', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>{infoMsg}</p>
        ) : null}

        {modo !== 'login' ? (
          <button
            type="button"
            onClick={() => setModo('login')}
            disabled={busy}
            style={{
              marginTop: '16px',
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.45)',
              background: 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.95)',
              fontWeight: 700,
              fontSize: '15px',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            Ya tengo cuenta
          </button>
        ) : null}

      </div>
    </div>
  );
}
