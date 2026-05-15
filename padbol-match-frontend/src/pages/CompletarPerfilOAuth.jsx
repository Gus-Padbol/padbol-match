import React, { useState, useCallback, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import AppHeader from '../components/AppHeader';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX,
  HUB_LOGO_CLEARANCE_TOP_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { useAuth } from '../context/AuthContext';
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
  const location = useLocation();
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
  }, [userProfile?.id, userProfile?.genero, userProfile?.whatsapp, userProfile?.deportes_preferidos]);

  const validarPasoDatos = useCallback(() => {
    setErrorMsg('');
    const gen = String(genero || '').trim().toLowerCase();
    if (gen !== 'masculino' && gen !== 'femenino') {
      setErrorMsg('Selecciona género (Masculino o Femenino).');
      return false;
    }
    const waLoc = digitsOnly(waLocal);
    const waLoc2 = digitsOnly(waLocalConfirm);
    if (waLoc !== waLoc2) {
      setErrorMsg('Los números no coinciden.');
      return false;
    }
    if (!whatsappNacionalValido(waLoc)) {
      setErrorMsg('Número de WhatsApp inválido.');
      return false;
    }
    const waDigitsFull = buildFullWhatsDigits(waCodigo, waLoc);
    if (!whatsappDigitsValido(waDigitsFull)) {
      setErrorMsg('Número de WhatsApp inválido.');
      return false;
    }
    return true;
  }, [genero, waLocal, waLocalConfirm, waCodigo]);

  const irAlHubPrincipal = useCallback(() => {
    const from = location.state?.from;
    let dest = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/hub';
    if (dest === '/completar-perfil') dest = '/hub';
    navigate(dest, { replace: true });
  }, [location.state, navigate]);

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
          setErrorMsg('Tu sesión expiró. Vuelve a iniciar sesión.');
          return;
        }
        setBusy(true);
        try {
          const res = await fetch(`${API_BASE}/api/registro/email-perfil-libre`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            setErrorMsg(String(j?.error || 'No se pudo verificar el email.'));
            return;
          }
          if (!j?.disponible) {
            setEmailConflicto(true);
            setErrorMsg('Este email ya tiene una cuenta. ¿Quieres iniciar sesión?');
            return;
          }
          setPaso(1);
        } catch {
          setErrorMsg('No se pudo verificar el email. Intenta de nuevo.');
        } finally {
          setBusy(false);
        }
        return;
      }
      if (!validarPasoDatos()) return;
      const gen = String(genero || '').trim().toLowerCase();
      const waLoc = digitsOnly(waLocal);
      const waE164 = formatWhatsAppE164(waCodigo, waLoc);
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
        const depNorm = normalizeDeportesPreferidosArray(deportesPreferidos);
        if (userProfile?.id) {
          const { error } = await supabase
            .from('jugadores_perfil')
            .update({
              genero: gen,
              whatsapp: waE164,
              deportes_preferidos: depNorm,
              ...(full && !String(userProfile.nombre || '').trim() ? { nombre: nombreIns, apellido: apellidoIns } : {}),
            })
            .eq('id', userProfile.id);
          if (error) throw error;
        } else {
          const insertRow = {
            user_id: session.user.id,
            email: email || null,
            nombre: nombreIns,
            apellido: apellidoIns,
            genero: gen,
            whatsapp: waE164,
            alias: null,
            notificaciones_whatsapp: false,
            deportes_preferidos: depNorm,
          };
          const { error } = await supabase.from('jugadores_perfil').insert(insertRow).select().single();
          if (error) throw error;
        }
        try {
          window.dispatchEvent(new CustomEvent(PERFIL_CHANGE_EVENT));
        } catch {
          /* ignore */
        }
        await refreshSession();
        irAlHubPrincipal();
      } catch (err) {
        setErrorMsg(err?.message || 'No se pudo guardar el perfil.');
      } finally {
        setBusy(false);
      }
    },
    [
      session,
      session?.access_token,
      userProfile,
      paso,
      genero,
      waCodigo,
      waLocal,
      waLocalConfirm,
      deportesPreferidos,
      validarPasoDatos,
      refreshSession,
      irAlHubPrincipal,
    ]
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
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        boxSizing: 'border-box',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <AppHeader title="Completar perfil" showBack={false} contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
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
        <img
          src="/logo-padbol-match.png"
          alt="Padbol Match"
          style={{
            ...padbolLogoImgStyle,
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
          {paso === 0 ? 'Completa tu perfil' : '¿Qué deportes practicas?'}
        </h1>
        <p style={{ color: '#374151', fontSize: '14px', lineHeight: 1.45, textAlign: 'center', margin: '0 0 18px' }}>
          {paso === 0
            ? 'Completa tu perfil para reservar canchas, jugar torneos y encontrar compañeros de juego.'
            : 'Elige uno o más (opcional pero recomendado). Puedes cambiarlos después en Mi perfil.'}
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
            Género <span style={{ color: '#dc2626' }}>*</span>
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
            <option value="">— Elegir —</option>
            <option value="masculino">Masculino</option>
            <option value="femenino">Femenino</option>
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
                País
              </label>
              <select
                value={waCodigo}
                onChange={(e) => setWaCodigo(e.target.value)}
                disabled={busy}
                title="País / código"
                aria-label="País y código de área"
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
                Número
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={waLocal}
                onChange={(e) => setWaLocal(digitsOnly(e.target.value))}
                disabled={busy}
                placeholder="Ej: 2213032019"
                aria-label="Número de celular sin código de país"
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
                Confirmar número <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={waLocalConfirm}
                onChange={(e) => setWaLocalConfirm(digitsOnly(e.target.value))}
                disabled={busy}
                placeholder="Repite el número"
                aria-label="Confirmar número local"
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
                Elige los que apliquen. Si prefieres no decirlo ahora, deja todo sin marcar y pulsa «Guardar y continuar».
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
              Ir a iniciar sesión
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
              Atrás
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
            {busy ? 'Guardando…' : paso === 0 ? 'Continuar' : 'Guardar y continuar'}
          </button>
          <button
            type="button"
            onClick={irAlHubPrincipal}
            disabled={busy || loading || profileLoading}
            style={{
              ...btnOmitirStyle,
              cursor: busy || loading || profileLoading ? 'not-allowed' : 'pointer',
              opacity: busy || loading || profileLoading ? 0.5 : 1,
            }}
          >
            Omitir
          </button>
        </form>
      </div>
    </div>
  );
}
