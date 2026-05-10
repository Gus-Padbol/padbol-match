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
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { useAuth } from '../context/AuthContext';
import TelefonoPaisCodigoRow from '../components/TelefonoPaisCodigoRow';
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
import { nombreRealDesdePerfilOauth } from '../utils/displayName';

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
  const [waConfirm, setWaConfirm] = useState('');
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
    }
  }, [userProfile?.id, userProfile?.genero, userProfile?.whatsapp]);

  const lineaNombre = nombreRealDesdePerfilOauth(userProfile, session) || session?.user?.email || '';
  const primerNombreSaludo = lineaNombre.includes('@')
    ? ''
    : String(lineaNombre.split(/\s+/).filter(Boolean)[0] || '').trim();

  const handleGuardar = useCallback(
    async (e) => {
      e.preventDefault();
      setErrorMsg('');
      if (!session?.user?.id) return;
      const gen = String(genero || '').trim().toLowerCase();
      if (gen !== 'masculino' && gen !== 'femenino' && gen !== 'otro' && gen !== 'open') {
        setErrorMsg('Seleccioná género (Masculino, Femenino, Otro u Open).');
        return;
      }
      const waLoc = digitsOnly(waLocal);
      const waLoc2 = digitsOnly(waConfirm);
      if (!whatsappNacionalValido(waLoc)) {
        setErrorMsg('Ingresá un WhatsApp válido (número local, mínimo 10 dígitos, sin repetir el código de país).');
        return;
      }
      if (waLoc !== waLoc2) {
        setErrorMsg('Los números de WhatsApp no coinciden.');
        return;
      }
      const waDigitsFull = buildFullWhatsDigits(waCodigo, waLoc);
      if (!whatsappDigitsValido(waDigitsFull)) {
        setErrorMsg('Completá un WhatsApp válido.');
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
            alias: '',
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
    [session, userProfile, genero, waCodigo, waLocal, waConfirm, refreshSession, location.state, navigate]
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <AppHeader title="Completar perfil" showBack={false} contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
      <div style={{ width: '100%', maxWidth: '400px', marginTop: HUB_LOGO_CLEARANCE_TOP_PX }}>
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
          {primerNombreSaludo ? (
            <>
              Hola, {primerNombreSaludo}. Necesitamos tu <strong>WhatsApp</strong> y <strong>género</strong> para continuar
              (Google no los envía).
            </>
          ) : (
            <>
              Necesitamos tu <strong>WhatsApp</strong> y <strong>género</strong> para continuar.
            </>
          )}
        </p>
        <form
          onSubmit={(ev) => void handleGuardar(ev)}
          style={{
            background: 'rgba(255,255,255,0.98)',
            borderRadius: '14px',
            padding: '20px 18px',
            boxSizing: 'border-box',
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
            <option value="otro">Otro</option>
            <option value="open">Open</option>
          </select>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '6px',
            }}
          >
            WhatsApp <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <div style={{ marginBottom: '8px' }}>
            <TelefonoPaisCodigoRow
              codigoValue={waCodigo}
              onCodigoChange={setWaCodigo}
              localValue={waLocal}
              onLocalChange={(v) => setWaLocal(digitsOnly(v))}
              disabled={busy}
              placeholderLocal="Ej: 9112345678"
              selectStyle={{
                width: '100%',
                maxWidth: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxSizing: 'border-box',
                fontSize: '16px',
                background: '#ffffff',
                minWidth: 120,
              }}
              inputStyle={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxSizing: 'border-box',
                fontSize: '16px',
                background: '#ffffff',
              }}
            />
          </div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '6px',
            }}
          >
            Confirmar WhatsApp <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="tel"
            inputMode="numeric"
            value={waConfirm}
            onChange={(e) => setWaConfirm(digitsOnly(e.target.value))}
            placeholder="Repite el mismo número local"
            disabled={busy}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '16px',
              boxSizing: 'border-box',
            }}
          />
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
