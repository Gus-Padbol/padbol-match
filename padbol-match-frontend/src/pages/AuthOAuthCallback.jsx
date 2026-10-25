import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { resolvePostLoginNavigatePath } from '../utils/reservaReturnUrl';
import { flushPendingOAuthLegalAcceptance, hasPendingOAuthLegalAcceptance } from '../utils/legalDocuments';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { resolveRoleAwarePostLoginPath } from '../utils/postLoginDestination';

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
  const { t } = useTranslation();

  useEffect(() => {
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
      navigate(resolveOAuthPostLoginPath(destination, needsProfile), {replace:true});
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
  }, [callbackLocation, loading, navigate, retryNonce, session]);

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
