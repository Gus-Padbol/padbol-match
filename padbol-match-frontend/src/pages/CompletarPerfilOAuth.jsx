import React, { useState, useCallback, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import AppHeader from '../components/AppHeader';
import {
  HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX,
  HUB_LOGO_CLEARANCE_TOP_PX,
  hubContentPaddingTopCss,
  hubMainPaddingBottomCss,
} from '../constants/hubLayout';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import PadbolBrandLogo from '../components/PadbolBrandLogo';
import { useAuth } from '../context/AuthContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import {
  digitsOnly,
  formatWhatsAppE164,
  whatsappNacionalValido,
  whatsappDigitsValido,
  buildFullWhatsDigits,
  splitStoredWhatsapp,
} from '../utils/authIdentidad';
import { PERFIL_CHANGE_EVENT } from '../utils/jugadorPerfil';
import { perfilJugadorDatosMinimosCompletos } from '../utils/perfilJugadorMinimo';
import DeportesPreferidosChips from '../components/DeportesPreferidosChips';
import { normalizeDeportesPreferidosArray } from '../constants/deportesPreferidos';
import { mensajeErrorJugadoresPerfilDuplicado } from '../utils/authErrorsEs';
import { fetchWhatsappDisponibleRegistro } from '../utils/registroWhatsappApi';
import { upsertJugadorPerfilPorSesion } from '../utils/upsertJugadorPerfil';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

const OPCIONES_TELEFONO = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];

const btnPrimarioStyle = {
  width: '100%',
  padding: '14px',
  borderRadius: '10px',
  border: 'none',
  background: '#E11B22',
  color: '#fff',
  fontWeight: 700,
  fontSize: '16px',
  cursor: 'pointer',
};

const btnSecundarioStyle = {
  width: '100%',
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid #E0E0E0',
  background: 'var(--bg-card)',
  color: '#6B6B6B',
  fontWeight: 700,
  fontSize: '15px',
  cursor: 'pointer',
};

/** Estilo del botón terciario «Omitir»: texto gris pequeño, sin borde ni fondo. */
const btnOmitirStyle = {
  display: 'block',
  width: '100%',
  marginTop: '10px',
  padding: '6px 8px',
  border: 'none',
  background: 'transparent',
  color: '#94a3b8',
  fontWeight: 500,
  fontSize: '13px',
  lineHeight: 1.35,
  cursor: 'pointer',
  textAlign: 'center',
};

function capitalizar(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export default function CompletarPerfilOAuth() {
  const { t } = useTranslation();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const navigate = useNavigate();
  const { session, userProfile, profileLoading, loading, refreshSession } = useAuth();
  const [genero, setGenero] = useState('');
  const [waCodigo, setWaCodigo] = useState('+54');
  const [waLocal, setWaLocal] = useState('');
  const [waLocalConfirm, setWaLocalConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [emailConflicto, setEmailConflicto] = useState(false);
  /** 0 = género + WhatsApp; 1 = deportes preferidos (opcional). */
  const [paso, setPaso] = useState(0);
  const [deportesPreferidos, setDeportesPreferidos] = useState([]);

  useEffect(() => {
    if (!userProfile) return;
    if (String(userProfile.genero || '').trim()) {
      setGenero(String(userProfile.genero).trim());
    }
    const rawWa = String(userProfile.whatsapp || '').trim();
    if (rawWa) {
      const { codigo, local } = splitStoredWhatsapp(rawWa);
      setWaCodigo(codigo);
      setWaLocal(local);
      setWaLocalConfirm('');
    }
    if (Array.isArray(userProfile.deportes_preferidos)) {
      setDeportesPreferidos(normalizeDeportesPreferidosArray(userProfile.deportes_preferidos));
    } else {
      setDeportesPreferidos([]);
    }
  }, [userProfile]);

  const validarPasoDatos = useCallback(() => {
    setErrorMsg('');
    const gen = String(genero || '').trim().toLowerCase();
    if (gen !== 'masculino' && gen !== 'femenino') {
      setErrorMsg(t('auth.selectGender'));
      return false;
    }
    const waLoc = digitsOnly(waLocal);
    const waLoc2 = digitsOnly(waLocalConfirm);
    if (waLoc !== waLoc2) {
      setErrorMsg(t('auth.phoneMismatch'));
      return false;
    }
    if (!whatsappNacionalValido(waLoc)) {
      setErrorMsg(t('auth.invalidWhatsapp'));
      return false;
    }
    const waDigitsFull = buildFullWhatsDigits(waCodigo, waLoc);
    if (!whatsappDigitsValido(waDigitsFull)) {
      setErrorMsg(t('auth.invalidWhatsapp'));
      return false;
    }
    return true;
  }, [genero, waLocal, waLocalConfirm, waCodigo, t]);

  const irAlHubPrincipal = useCallback(() => {
    const from = location.state?.from;
    let dest = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/hub';
    if (dest === '/completar-perfil') dest = '/hub';
    navigate(dest, { replace: true });
  }, [location.state, navigate]);

  const guardarPerfilYContinuar = useCallback(
    async (deportesSel) => {
      if (!session?.user?.id) return;
      if (!validarPasoDatos()) return;
      const gen = String(genero || '').trim().toLowerCase();
      const waLoc = digitsOnly(waLocal);
      const waE164 = formatWhatsAppE164(waCodigo, waLoc);
      const token = session?.access_token;
      if (!token) {
        setErrorMsg(t('profileCompletion.sessionExpired'));
        return;
      }
      try {
        const { disponible } = await fetchWhatsappDisponibleRegistro(waE164, token);
        if (!disponible) {
          setErrorMsg(t('auth.phoneAlreadyRegistered'));
          return;
        }
      } catch {
        setErrorMsg(t('auth.phoneValidationFailed'));
        return;
      }

      const email = String(session.user.email || '').trim();
      const meta = session.user.user_metadata || {};
      const full = String(meta.full_name || meta.name || '').trim();
      const parts = full.split(/\s+/).filter(Boolean);
      const emailLocal = email.includes('@') ? email.split('@')[0] : '';
      const nombreIns =
        (parts[0] ? capitalizar(parts[0]) : '') ||
        capitalizar(String(meta.nombre || '').trim()) ||
        (emailLocal ? capitalizar(emailLocal) : '') ||
        'Jugador';
      const apellidoIns =
        parts.length > 1
          ? parts.slice(1).join(' ')
          : String(meta.apellido || '').trim() || null;

      setBusy(true);
      try {
        const depNorm = normalizeDeportesPreferidosArray(deportesSel);
        const nombreGuardar =
          userProfile && String(userProfile.nombre || '').trim()
            ? userProfile.nombre
            : nombreIns;
        const { error } = await upsertJugadorPerfilPorSesion({
          userId: session.user.id,
          email,
          row: {
            nombre: nombreGuardar,
            apellido: apellidoIns,
            genero: gen,
            whatsapp: waE164,
            alias: userProfile?.alias ?? null,
            notificaciones_whatsapp: userProfile?.notificaciones_whatsapp ?? false,
            deportes_preferidos: depNorm,
          },
        });
        if (error) throw error;
        try {
          window.dispatchEvent(new CustomEvent(PERFIL_CHANGE_EVENT));
        } catch {
          /* ignore */
        }
        await refreshSession();
        irAlHubPrincipal();
      } catch (err) {
        const duplicateMessage = mensajeErrorJugadoresPerfilDuplicado(err);
        setErrorMsg(
          duplicateMessage
            ? t('profileCompletion.duplicateData')
            : t('profileCompletion.saveFailed')
        );
      } finally {
        setBusy(false);
      }
    },
    [
      session,
      userProfile,
      genero,
      waCodigo,
      waLocal,
      validarPasoDatos,
      refreshSession,
      irAlHubPrincipal,
      t,
    ]
  );

  const handleGuardar = useCallback(
    async (e) => {
      e.preventDefault();
      setErrorMsg('');
      setEmailConflicto(false);
      if (!session?.user?.id) return;
      if (paso === 0) {
        if (!validarPasoDatos()) return;
        const token = session?.access_token;
        if (!token) {
          setErrorMsg(t('profileCompletion.sessionExpired'));
          return;
        }
        setBusy(true);
        try {
          const res = await fetch(`${API_BASE}/api/registro/email-perfil-libre`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            setErrorMsg(t('profileCompletion.emailCheckFailed'));
            return;
          }
          if (!j?.disponible) {
            setEmailConflicto(true);
            setErrorMsg(t('profileCompletion.emailInUse'));
            return;
          }
          setPaso(1);
        } catch {
          setErrorMsg(t('profileCompletion.emailCheckRetry'));
        } finally {
          setBusy(false);
        }
        return;
      }
      await guardarPerfilYContinuar(deportesPreferidos);
    },
    [session, paso, deportesPreferidos, validarPasoDatos, guardarPerfilYContinuar, t]
  );

  const handleOmitirDeportes = useCallback(
    async (e) => {
      e.preventDefault();
      setErrorMsg('');
      setEmailConflicto(false);
      if (paso !== 1) return;
      await guardarPerfilYContinuar([]);
    },
    [paso, guardarPerfilYContinuar]
  );

  if (!loading && !profileLoading && session?.user && perfilJugadorDatosMinimosCompletos(userProfile)) {
    return <Navigate to="/hub" replace />;
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        maxWidth: '100%',
        background: 'var(--bg-card)',
        paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
        boxSizing: 'border-box',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <AppHeader title={t('auth.completeProfile')} showBack={false} contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          marginTop: HUB_LOGO_CLEARANCE_TOP_PX,
          boxSizing: 'border-box',
          overflow: 'visible',
        }}
      >
        <PadbolBrandLogo
          style={{
            display: 'block',
            margin: '0 auto 16px',
          }}
        />
        <h1
          style={{
            color: 'var(--text-primary)',
            fontSize: '1.25rem',
            fontWeight: 700,
            textAlign: 'center',
            margin: '0 0 8px',
          }}
        >
          {paso === 0 ? t('profileCompletion.title') : t('profileCompletion.sportsTitle')}
        </h1>
        <p style={{ color: '#374151', fontSize: '14px', lineHeight: 1.45, textAlign: 'center', margin: '0 0 18px' }}>
          {paso === 0
            ? t('profileCompletion.intro')
            : t('profileCompletion.sportsIntro')}
        </p>
        <form
          onSubmit={(ev) => void handleGuardar(ev)}
          style={{
            background: 'var(--bg-card)',
            borderRadius: '14px',
            padding: '20px 18px',
            boxSizing: 'border-box',
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'visible',
            boxShadow: '0 4px 24px rgba(15, 23, 42, 0.08)',
            border: '1px solid rgba(15, 23, 42, 0.06)',
          }}
        >
          {paso === 0 ? (
            <>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '6px',
            }}
          >
            {t('auth.gender')} <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <select
            value={genero}
            onChange={(e) => setGenero(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '16px',
              boxSizing: 'border-box',
            }}
          >
            <option value="">{t('auth.choose')}</option>
            <option value="masculino">{t('auth.male')}</option>
            <option value="femenino">{t('auth.female')}</option>
          </select>
          <div
            style={{
              marginBottom: '16px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              overflow: 'visible',
              display: 'block',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              WhatsApp <span style={{ color: '#dc2626' }}>*</span>
            </div>
            <div
              style={{
                width: '100%',
                maxWidth: '100%',
                marginBottom: '14px',
                boxSizing: 'border-box',
                overflow: 'visible',
                display: 'block',
              }}
            >
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {t('profileCompletion.country')}
              </label>
              <select
                value={waCodigo}
                onChange={(e) => setWaCodigo(e.target.value)}
                disabled={busy}
                title={t('profileCompletion.countryCodeTitle')}
                aria-label={t('profileCompletion.countryCodeAria')}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  maxWidth: '100%',
                  display: 'block',
                  background: 'var(--bg-card)',
                }}
              >
                {OPCIONES_TELEFONO.map((p) => (
                  <option key={`${p.nombre}-${p.codigo}`} value={p.codigo} title={p.nombre}>
                    {p.bandera} {p.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{
                width: '100%',
                maxWidth: '100%',
                marginBottom: '14px',
                boxSizing: 'border-box',
                overflow: 'visible',
                display: 'block',
              }}
            >
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {t('profileCompletion.number')}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={waLocal}
                onChange={(e) => setWaLocal(digitsOnly(e.target.value))}
                disabled={busy}
                placeholder={t('profileCompletion.numberPlaceholder')}
                aria-label={t('profileCompletion.numberAria')}
                autoComplete="tel-national"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  maxWidth: '100%',
                  display: 'block',
                  background: 'var(--bg-card)',
                }}
              />
            </div>
            <div
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                overflow: 'visible',
                display: 'block',
              }}
            >
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                {t('profileCompletion.confirmNumber')} <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={waLocalConfirm}
                onChange={(e) => setWaLocalConfirm(digitsOnly(e.target.value))}
                disabled={busy}
                placeholder={t('profileCompletion.confirmNumberPlaceholder')}
                aria-label={t('profileCompletion.confirmNumberAria')}
                autoComplete="off"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  maxWidth: '100%',
                  display: 'block',
                  background: 'var(--bg-card)',
                }}
              />
            </div>
          </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 12px', lineHeight: 1.45 }}>
                {t('profileCompletion.sportsHelp')}
              </p>
              <DeportesPreferidosChips
                value={deportesPreferidos}
                onChange={setDeportesPreferidos}
                disabled={busy || loading || profileLoading}
              />
            </>
          )}
          {errorMsg ? (
            <p style={{ color: '#b91c1c', fontSize: '14px', margin: '12px 0' }}>{errorMsg}</p>
          ) : null}
          {emailConflicto ? (
            <button
              type="button"
              onClick={() => navigate('/auth', { replace: false })}
              style={{
                ...btnSecundarioStyle,
                marginBottom: '10px',
                cursor: 'pointer',
              }}
            >
              {t('auth.goToLogin')}
            </button>
          ) : null}
          {paso === 1 ? (
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setEmailConflicto(false);
                setPaso(0);
              }}
              disabled={busy || loading || profileLoading}
              style={{
                ...btnSecundarioStyle,
                marginBottom: '10px',
                cursor: busy || loading || profileLoading ? 'not-allowed' : 'pointer',
                opacity: busy || loading || profileLoading ? 0.7 : 1,
              }}
            >
              {t('profileCompletion.back')}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={busy || loading || profileLoading}
            style={{
              ...btnPrimarioStyle,
              cursor: busy || loading || profileLoading ? 'wait' : 'pointer',
              opacity: busy || loading || profileLoading ? 0.85 : 1,
            }}
          >
            {busy ? t('profileCompletion.saving') : paso === 0 ? t('profileCompletion.continue') : t('profileCompletion.saveContinue')}
          </button>
          {paso === 1 ? (
            <button
              type="button"
              onClick={handleOmitirDeportes}
              disabled={busy || loading || profileLoading}
              style={{
                ...btnOmitirStyle,
                cursor: busy || loading || profileLoading ? 'not-allowed' : 'pointer',
                opacity: busy || loading || profileLoading ? 0.5 : 1,
              }}
            >
              {t('profileCompletion.skip')}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
