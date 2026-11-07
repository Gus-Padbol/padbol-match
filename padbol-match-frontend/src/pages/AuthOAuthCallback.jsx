import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, AUTH_CALLBACK_FLOW } from '../supabaseClient';
import { navigateAfterAuth } from '../utils/authCallbackFlow';
import { useAuth } from '../context/AuthContext';
import { resolvePostLoginNavigatePath } from '../utils/reservaReturnUrl';
import { flushPendingOAuthLegalAcceptance, hasPendingOAuthLegalAcceptance } from '../utils/legalDocuments';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { resolveRoleAwarePostLoginPath } from '../utils/postLoginDestination';
import { usuarioEnRecuperacion, limpiarRecuperacion, suscribirRecuperacion } from '../utils/passwordRecoverySignal';

export function resolveOAuthPostLoginPath(destination, needsProfileCompletion) {
  const dest = String(destination || '/');
  const isFipaLibrary = dest.split('?')[0] === '/fipa/documentos';
  return needsProfileCompletion && !isFipaLibrary
    ? `/completar-perfil?redirect=${encodeURIComponent(dest)}`
    : dest;
}

/**
 * Destino de `redirectTo` tras Google / Facebook OAuth (PKCE).
 * Intercambia el `code` de la URL al montar (vía `detectSessionInUrl` en supabaseClient) y redirige al hub.
 * Completar perfil (WhatsApp, género) se pide solo al reservar, armar partido o inscribirse a torneo.
 */
export default function AuthOAuthCallback() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const navigatedRef = useRef(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [legalError, setLegalError] = useState(false);
  const [callbackError, setCallbackError] = useState(null);
  const [callbackLocation] = useState(() => ({search:window.location.search,hash:window.location.hash}));
  // `type=recovery` en la URL NO es prueba: solo la señal PASSWORD_RECOVERY habilita el form.
  const [recovery, setRecovery] = useState(() => Boolean(usuarioEnRecuperacion()));
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [repetirPassword, setRepetirPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState(null);
  const [recoveryDone, setRecoveryDone] = useState(false);
  const [recoverySaving, setRecoverySaving] = useState(false);
  const { t } = useTranslation();

  // Supabase avisa PASSWORD_RECOVERY al consumir el enlace; el hash puede haberse limpiado ya.
  useEffect(() => suscribirRecuperacion(() => { setRecovery(true); setRecoveryError(null); }), []);

  const guardarPassword = async (event) => {
    event.preventDefault();
    if (recoverySaving) return;
    setRecoveryError(null);
    if (String(nuevaPassword).length < 8) { setRecoveryError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (nuevaPassword !== repetirPassword) { setRecoveryError('Las contraseñas no coinciden.'); return; }
    setRecoverySaving(true);
    try {
      // Debe existir sesión Y ser la MISMA identidad que emitió PASSWORD_RECOVERY.
      const actual = await supabase.auth.getSession().catch(() => null);
      const actualId = actual?.data?.session?.user?.id ? String(actual.data.session.user.id) : null;
      const senalId = usuarioEnRecuperacion();
      if (!actualId || !senalId || actualId !== senalId) {
        setRecoveryError('Este enlace venció o ya fue utilizado. Pedí uno nuevo desde “Olvidé mi contraseña”.');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
      if (error) { setRecoveryError('No pudimos guardar la contraseña. Pedí un enlace nuevo e intentá otra vez.'); return; }
      limpiarRecuperacion();
      setNuevaPassword(''); setRepetirPassword(''); setRecoveryDone(true);
    } catch {
      setRecoveryError('No pudimos guardar la contraseña. Pedí un enlace nuevo e intentá otra vez.');
    } finally { setRecoverySaving(false); }
  };

  useEffect(() => {
    if (recovery) return;
    if (loading) return;
    let cancelled = false;
    let retryTimer;
    const needsProfile = hasPendingOAuthLegalAcceptance();
    const callbackParams = new URLSearchParams(callbackLocation.search);
    const hashParams = new URLSearchParams(callbackLocation.hash.replace(/^#/, ''));
    const providerError = callbackParams.get('error') || hashParams.get('error')
      || callbackParams.get('error_code') || hashParams.get('error_code');
    if (providerError) {
      setCallbackError('invalid_link');
      return undefined;
    }

    const complete = async (activeSession) => {
      try {
        await flushPendingOAuthLegalAcceptance();
      } catch {
        if (!cancelled) setLegalError(true);
        return;
      }
      const requested = resolvePostLoginNavigatePath(callbackLocation.search);
      const destination = await resolveRoleAwarePostLoginPath(requested, activeSession);
      if (cancelled || navigatedRef.current) return;
      navigatedRef.current = true;
      navigateAfterAuth(resolveOAuthPostLoginPath(destination, needsProfile), {flowType:AUTH_CALLBACK_FLOW,navigate});
    };
    const getSession = async () => {
      try {
        const result = await supabase.auth.getSession();
        return result?.data?.session || null;
      } catch { return null; }
    };
    const go = async () => {
      const activeSession = session?.user ? session : await getSession();
      if (cancelled || navigatedRef.current) return;
      if (activeSession?.user) { await complete(activeSession); return; }
      retryTimer = window.setTimeout(async () => {
        const retriedSession = await getSession();
        if (cancelled || navigatedRef.current) return;
        if (retriedSession?.user) { await complete(retriedSession); return; }
        setCallbackError('missing_session');
      }, 400);
    };
    void go();
    return () => { cancelled = true; window.clearTimeout(retryTimer); };
  }, [callbackLocation, loading, navigate, recovery, retryNonce, session]);

  const errorEnlaceInmediato = (() => {
    const q = new URLSearchParams(callbackLocation.search);
    const h = new URLSearchParams(callbackLocation.hash.replace(/^#/, ''));
    return Boolean(q.get('error') || h.get('error') || q.get('error_code') || h.get('error_code'));
  })();

  if (recovery && (callbackError || errorEnlaceInmediato)) {
    return <main style={{minHeight:'50vh',display:'grid',placeItems:'center',padding:24}}>
      <section role="alert" style={{maxWidth:480,color:'var(--text-primary)'}}>
        <h1 style={{fontSize:'1.35rem'}}>El enlace no es válido</h1>
        <p>Venció o ya fue utilizado. Pedí uno nuevo desde “Olvidé mi contraseña”.</p>
        <Link to={`/login?redirect=${encodeURIComponent(resolvePostLoginNavigatePath(callbackLocation.search))}`}>Volver a ingresar</Link>
      </section>
    </main>;
  }

  if (recovery) {
    return (
      <main style={{minHeight:'50vh',display:'grid',placeItems:'center',padding:24}}>
        <form onSubmit={guardarPassword} style={{maxWidth:460,width:'100%',color:'var(--text-primary)'}}>
          <h1 style={{fontSize:'1.35rem'}}>Establecer una contraseña</h1>
          {recoveryDone ? (
            <>
              <p role="status">Tu contraseña quedó guardada. Ya podés ingresar con tu email.</p>
              <Link to={`/login?redirect=${encodeURIComponent(resolvePostLoginNavigatePath(callbackLocation.search))}`}>Ir a ingresar</Link>
            </>
          ) : (
            <>
              <p>Abrí el enlace en el mismo navegador donde lo pediste. Elegí una contraseña nueva.</p>
              {recoveryError ? <p role="alert" style={{color:'#b91c1c'}}>{recoveryError}</p> : null}
              <label style={{display:'block',marginTop:12}}>Contraseña nueva
                <input type="password" autoComplete="new-password" value={nuevaPassword} onChange={(e)=>setNuevaPassword(e.target.value)} style={{display:'block',width:'100%',marginTop:4}} />
              </label>
              <label style={{display:'block',marginTop:12}}>Repetir contraseña
                <input type="password" autoComplete="new-password" value={repetirPassword} onChange={(e)=>setRepetirPassword(e.target.value)} style={{display:'block',width:'100%',marginTop:4}} />
              </label>
              <button type="submit" disabled={recoverySaving} style={{marginTop:16}}>{recoverySaving ? 'Guardando…' : 'Guardar contraseña'}</button>
            </>
          )}
        </form>
      </main>
    );
  }

  if (callbackError) {
    const returnPath = resolvePostLoginNavigatePath(callbackLocation.search);
    return <main style={{minHeight:'50vh',display:'grid',placeItems:'center',padding:24}}>
      <section role="alert" style={{maxWidth:480,color:'var(--text-primary)'}}>
        <h1 style={{fontSize:'1.35rem'}}>No pudimos completar el acceso</h1>
        <p>{callbackError==='invalid_link' ? 'El enlace no es válido, venció o ya fue utilizado.' : 'Este enlace no pudo abrir tu sesión.'}</p>
        <p>Abrí el enlace más reciente en el mismo navegador donde solicitaste el acceso. Si no funciona, volvé a pedir uno nuevo.</p>
        <Link to={`/login?redirect=${encodeURIComponent(returnPath)}`}>Volver a ingresar</Link>
      </section>
    </main>;
  }

  if (legalError) {
    return (
      <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, color: 'var(--text-primary)', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.35rem' }}>{t('auth.oauthLegalRecordingTitle')}</h1>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {t('auth.oauthLegalRecordingError')}
          </p>
          <p>
            <Link to="/terminos">{t('legal.terminos')}</Link>{' · '}
            <Link to="/privacidad">{t('legal.privacidad')}</Link>
          </p>
          <button
            type="button"
            onClick={() => {
              setLegalError(false);
              setRetryNonce((value) => value + 1);
            }}
          >
            {t('general.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        color: 'var(--text-secondary)',
        fontWeight: 600,
        fontSize: '15px',
      }}
    >
      Conectando con tu cuenta…
    </div>
  );
}
