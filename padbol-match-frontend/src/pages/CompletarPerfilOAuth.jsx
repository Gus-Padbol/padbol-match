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

const OPCIONES_TELEFONO = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];

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
  }, [userProfile?.id, userProfile?.genero, userProfile?.whatsapp]);

  const handleGuardar = useCallback(
    async (e) => {
      e.preventDefault();
      setErrorMsg('');
      if (!session?.user?.id) return;
      const gen = String(genero || '').trim().toLowerCase();
      if (gen !== 'masculino' && gen !== 'femenino') {
        setErrorMsg('Seleccioná género (Masculino o Femenino).');
        return;
      }
      const waLoc = digitsOnly(waLocal);
      const waLoc2 = digitsOnly(waLocalConfirm);
      if (waLoc !== waLoc2) {
        setErrorMsg('Los números no coinciden.');
        return;
      }
      if (!whatsappNacionalValido(waLoc)) {
        setErrorMsg('Número de WhatsApp inválido.');
        return;
      }
      const waDigitsFull = buildFullWhatsDigits(waCodigo, waLoc);
      if (!whatsappDigitsValido(waDigitsFull)) {
        setErrorMsg('Número de WhatsApp inválido.');
        return;
      }
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
        if (userProfile?.id) {
          const { error } = await supabase
            .from('jugadores_perfil')
            .update({
              genero: gen,
              whatsapp: waE164,
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
        const from = location.state?.from;
        let dest = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/hub';
        if (dest === '/completar-perfil') dest = '/hub';
        navigate(dest, { replace: true });
      } catch (err) {
        setErrorMsg(err?.message || 'No se pudo guardar el perfil.');
      } finally {
        setBusy(false);
      }
    },
    [session, userProfile, genero, waCodigo, waLocal, waLocalConfirm, refreshSession, location.state, navigate]
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
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
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
            color: '#fff',
            fontSize: '1.25rem',
            fontWeight: 700,
            textAlign: 'center',
            margin: '0 0 8px',
          }}
        >
          Completá tu perfil
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', lineHeight: 1.45, textAlign: 'center', margin: '0 0 18px' }}>
          Completá tu perfil para reservar canchas, jugar torneos y encontrar compañeros de juego.
        </p>
        <form
          onSubmit={(ev) => void handleGuardar(ev)}
          style={{
            background: 'rgba(255,255,255,0.98)',
            borderRadius: '14px',
            padding: '20px 18px',
            boxSizing: 'border-box',
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'visible',
          }}
        >
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
                  background: '#ffffff',
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
                  background: '#ffffff',
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
                placeholder="Repetí el número"
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
                  background: '#ffffff',
                }}
              />
            </div>
          </div>
          {errorMsg ? (
            <p style={{ color: '#b91c1c', fontSize: '14px', margin: '0 0 12px' }}>{errorMsg}</p>
          ) : null}
          <button
            type="submit"
            disabled={busy || loading || profileLoading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              fontWeight: 700,
              fontSize: '16px',
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.85 : 1,
            }}
          >
            {busy ? 'Guardando…' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
