import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useNavigationType, Link } from 'react-router-dom';
import './AccesoCuenta.css';
import { handleAuthOnce } from '../utils/handleAuthOnce';
import { mensajeErrorAuthSupabase } from '../utils/authErrorsEs';
import { refreshJugadorPerfilFromSupabase } from '../utils/jugadorPerfil';
import AppHeader from '../components/AppHeader';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX,
  HUB_LOGO_CLEARANCE_TOP_PX,
  hubAccesoContentPaddingTopCss,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import {
  RESERVA_RETURN_STORAGE_KEY,
  resolvePostLoginNavigatePath,
  peekReservaLoginGateMessage,
  clearReservaLoginGateMessage,
} from '../utils/reservaReturnUrl';
import TelefonoPaisCodigoRow from '../components/TelefonoPaisCodigoRow';
import {
  digitsOnly,
  formatWhatsAppE164,
  whatsappNacionalValido,
  whatsappDigitsValido,
  buildFullWhatsDigits,
} from '../utils/authIdentidad';

/** Misma clave que en FormEquipos: invitación a equipo con `?equipo=` antes del login. */
const PENDING_TORNEO_INVITE_LS = 'padbol_invite_torneo_equipo_return';

/** Logo Google multicolor (inline; marca registrada de Google LLC). */
function GoogleMarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.86 11.86 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function PasswordEyeIcon({ revealed }) {
  const svgProps = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
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

/**
 * Estado en `<Link to="/login" />` desde la landing: misma SPA pero sin “historial útil” para Volver.
 * Debe coincidir con `LandingPage.jsx`.
 */
const LOGIN_NAV_HIDE_VOLVER = 'padbolHideLoginBack';

/** `?modo=registro` | `?modo=register` | `?registro=1` abre el formulario de alta en `/login`. */
function readModoDesdeSearch(search) {
  try {
    const q = String(search || '').replace(/^\?/, '');
    const sp = new URLSearchParams(q);
    const m = sp.get('modo');
    if (m === 'registro' || m === 'register' || sp.get('registro') === '1') return 'register';
  } catch {
    /* ignore */
  }
  return 'login';
}

export default function AccesoCuenta() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { refreshSession, session, loading } = useAuth();

  const [modo, setModo] = useState(() => readModoDesdeSearch(location.search));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPassword2, setShowRegPassword2] = useState(false);
  const [regNombre, setRegNombre] = useState('');
  const [regApellido, setRegApellido] = useState('');
  const [regGenero, setRegGenero] = useState('');
  const [regNotificacionesWhatsapp, setRegNotificacionesWhatsapp] = useState(false);
  const [regWaCodigoPais, setRegWaCodigoPais] = useState('+54');
  const [regWaLocal, setRegWaLocal] = useState('');
  const [regWaLocalConfirm, setRegWaLocalConfirm] = useState('');
  const [aceptoTerminosPrivacidad, setAceptoTerminosPrivacidad] = useState(false);
  const sesionYaRedirigidaRef = useRef(false);

  /** Volver solo tras navegación interna (push/replace), no en carga directa ni desde la landing. */
  const muestreBotonVolverAcceso = useMemo(() => {
    if (location.state?.[LOGIN_NAV_HIDE_VOLVER]) return false;
    return navigationType === 'PUSH' || navigationType === 'REPLACE';
  }, [location.state, navigationType]);

  const handleAccesoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleGoogleLogin = useCallback(async () => {
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error('Error Google OAuth:', error.message);
      setErrorMsg('No se pudo iniciar sesión con Google. Intenta de nuevo.');
    }
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
      const destinoTrasLogin = resolvePostLoginNavigatePath(location.search);
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
      navigate(destinoTrasLogin, { replace: true });
    },
    [navigate, refreshSession, location.search]
  );

  useEffect(() => {
    setModo(readModoDesdeSearch(location.search));
  }, [location.search]);

  useEffect(() => {
    if (loading || !session?.user || sesionYaRedirigidaRef.current) return;
    const p = location.pathname;
    if (p !== '/login' && p !== '/auth') return;
    void afterLogin(session);
  }, [loading, session?.user?.id, afterLogin, location.pathname]);

  useEffect(() => {
    setErrorMsg('');
    setInfoMsg(peekReservaLoginGateMessage() || '');
    setShowLoginPassword(false);
    setShowRegPassword(false);
    setShowRegPassword2(false);
    setRegNombre('');
    setRegApellido('');
    setRegGenero('');
    setRegNotificacionesWhatsapp(false);
    setRegWaCodigoPais('+54');
    setRegWaLocal('');
    setRegWaLocalConfirm('');
    setAceptoTerminosPrivacidad(false);
  }, [modo]);

  const handleIngresar = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg(peekReservaLoginGateMessage() || '');
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
    setInfoMsg(peekReservaLoginGateMessage() || '');
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
    const nom = String(regNombre || '').trim();
    const ap = String(regApellido || '').trim();
    const gen = String(regGenero || '').trim();
    if (!nom) {
      setErrorMsg('Completa tu nombre.');
      return;
    }
    if (!ap) {
      setErrorMsg('Completa tu apellido.');
      return;
    }
    if (gen !== 'masculino' && gen !== 'femenino') {
      setErrorMsg('Selecciona género (Masculino o Femenino).');
      return;
    }
    const waLoc = digitsOnly(regWaLocal);
    const waLoc2 = digitsOnly(regWaLocalConfirm);
    if (waLoc !== waLoc2) {
      setErrorMsg('Los números no coinciden.');
      return;
    }
    if (!whatsappNacionalValido(waLoc)) {
      setErrorMsg('Número de WhatsApp inválido.');
      return;
    }
    const waDigitsFull = buildFullWhatsDigits(regWaCodigoPais, waLoc);
    if (!whatsappDigitsValido(waDigitsFull)) {
      setErrorMsg('Número de WhatsApp inválido.');
      return;
    }
    if (!aceptoTerminosPrivacidad) {
      setErrorMsg('Debes aceptar los Términos y Condiciones y la Política de Privacidad.');
      return;
    }
    const waE164 = formatWhatsAppE164(regWaCodigoPais, waLoc);
    setBusy(true);
    try {
      const { data, error } = await handleAuthOnce({
        kind: 'signUp',
        email: em,
        password,
        options: {
          data: {
            nombre: nom,
            apellido: ap,
            genero: gen,
            notificaciones_whatsapp: regNotificacionesWhatsapp,
            whatsapp: waE164,
          },
        },
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

  const accesoPaddingTop = hubAccesoContentPaddingTopCss(location.pathname);
  const accesoPaddingBottomPx = Math.min(32, HUB_CONTENT_PADDING_BOTTOM_PX);

  return (
    <div
      className="acceso-cuenta-page"
      style={{
        minHeight: 'auto',
        width: '100%',
        maxWidth: '100%',
        background: 'var(--bg-page)',
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
      <AppHeader
        title="Acceso"
        showBack={muestreBotonVolverAcceso}
        onBack={handleAccesoBack}
        contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX}
      />
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
            marginTop: HUB_LOGO_CLEARANCE_TOP_PX,
            marginBottom: '4px',
          }}
        />
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          minWidth: 0,
          padding: '0 24px',
          boxSizing: 'border-box',
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: '18px',
            color: 'var(--text-primary)',
            fontSize: '1.35rem',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {modo === 'login' ? 'Iniciar Sesión' : 'Crear cuenta'}
        </h2>

        <div style={{ marginBottom: '18px' }}>
          <button
            type="button"
            onClick={() => void handleGoogleLogin()}
            disabled={busy}
            style={{
              width: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '15px',
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              opacity: busy ? 0.65 : 1,
            }}
          >
            <GoogleMarkIcon />
            Continuar con Google
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginTop: '16px',
              marginBottom: '2px',
            }}
            aria-hidden
          >
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}>
              — o —
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
        </div>

        {modo === 'login' ? (
          <form onSubmit={handleIngresar}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
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
                border: '1px solid var(--border)',
                boxSizing: 'border-box',
                fontSize: '16px',
                background: 'var(--bg-card)',
              }}
            />
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
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
                  border: '1px solid var(--border)',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  background: 'var(--bg-card)',
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
                  color: 'var(--text-secondary)',
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
                background: 'var(--accent)',
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
                color: 'var(--accent)',
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
          <form
            onSubmit={handleRegistrar}
            style={{ minWidth: 0, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}
          >
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Nombre <span style={{ color: '#fecaca' }}>*</span>
            </label>
            <input
              className="acceso-cuenta-input"
              value={regNombre}
              onChange={(e) => setRegNombre(e.target.value)}
              type="text"
              autoComplete="given-name"
              placeholder="Ej: Juan"
              style={{
                width: '100%',
                padding: '14px',
                marginBottom: '14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                boxSizing: 'border-box',
                fontSize: '16px',
                background: 'var(--bg-card)',
              }}
            />
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Apellido <span style={{ color: '#fecaca' }}>*</span>
            </label>
            <input
              className="acceso-cuenta-input"
              value={regApellido}
              onChange={(e) => setRegApellido(e.target.value)}
              type="text"
              autoComplete="family-name"
              placeholder="Ej: Pérez"
              style={{
                width: '100%',
                padding: '14px',
                marginBottom: '14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                boxSizing: 'border-box',
                fontSize: '16px',
                background: 'var(--bg-card)',
              }}
            />
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Género <span style={{ color: '#fecaca' }}>*</span>
            </label>
            <select
              className="acceso-cuenta-input"
              value={regGenero}
              onChange={(e) => setRegGenero(e.target.value)}
              style={{
                width: '100%',
                padding: '14px',
                marginBottom: '14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                boxSizing: 'border-box',
                fontSize: '16px',
                background: 'var(--bg-card)',
              }}
            >
              <option value="">— Elegir —</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
            </select>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '16px',
                cursor: busy ? 'default' : 'pointer',
                color: 'var(--text-primary)',
                fontSize: '14px',
                lineHeight: 1.45,
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={regNotificacionesWhatsapp}
                onChange={(e) => setRegNotificacionesWhatsapp(e.target.checked)}
                disabled={busy}
                style={{ marginTop: '3px', width: '18px', height: '18px', flexShrink: 0, cursor: busy ? 'default' : 'pointer' }}
              />
              <span>
                Quiero recibir novedades de torneos y promociones por WhatsApp{' '}
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px' }}>(opcional)</span>
              </span>
            </label>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
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
                border: '1px solid var(--border)',
                boxSizing: 'border-box',
                fontSize: '16px',
                background: 'var(--bg-card)',
              }}
            />
            <div style={{ marginBottom: '14px', width: '100%', minWidth: 0, maxWidth: '100%' }}>
              <TelefonoPaisCodigoRow
                sectionHeading={
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
                    WhatsApp <span style={{ color: '#fecaca' }}>*</span>
                  </span>
                }
                labelStyle={{ color: 'rgba(255,255,255,0.92)' }}
                codigoValue={regWaCodigoPais}
                onCodigoChange={setRegWaCodigoPais}
                localValue={regWaLocal}
                onLocalChange={(v) => setRegWaLocal(digitsOnly(v))}
                confirmLocalValue={regWaLocalConfirm}
                onConfirmLocalChange={(v) => setRegWaLocalConfirm(digitsOnly(v))}
                confirmRequired
                requiredAsteriskStyle={{ color: '#fecaca' }}
                disabled={busy}
                selectStyle={{
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '16px',
                  background: 'var(--bg-card)',
                }}
                inputStyle={{
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '16px',
                  background: 'var(--bg-card)',
                }}
              />
            </div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
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
                  border: '1px solid var(--border)',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  background: 'var(--bg-card)',
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
                  color: 'var(--text-secondary)',
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
                color: 'var(--text-primary)',
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
                  border: '1px solid var(--border)',
                  boxSizing: 'border-box',
                  fontSize: '16px',
                  background: 'var(--bg-card)',
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
                  color: 'var(--text-secondary)',
                  lineHeight: 0,
                  borderRadius: '8px',
                }}
              >
                <PasswordEyeIcon revealed={showRegPassword2} />
              </button>
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '16px',
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={aceptoTerminosPrivacidad}
                onChange={(e) => {
                  setAceptoTerminosPrivacidad(e.target.checked);
                  if (e.target.checked) setErrorMsg('');
                }}
                disabled={busy}
                style={{ marginTop: '4px', width: 18, height: 18, flexShrink: 0 }}
              />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                Acepto los{' '}
                <Link to="/terminos" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                  Términos y Condiciones
                </Link>{' '}
                y la{' '}
                <Link to="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                  Política de Privacidad
                </Link>{' '}
                <span style={{ color: '#fecaca' }}>*</span>
              </span>
            </label>
            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                padding: '16px 12px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--accent)',
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
          <p style={{ color: '#b91c1c', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>{errorMsg}</p>
        ) : null}
        {infoMsg ? (
          <p style={{ color: '#15803d', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>{infoMsg}</p>
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
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
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
