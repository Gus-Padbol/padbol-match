import { getApiBaseUrl } from '../utils/apiPublicBaseUrl';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import FipaSelfService from '../components/FipaSelfService';
import './FipaClaims.css';
import { useAuth } from '../context/AuthContext';
import './RecorridoExterno.css';
import { useTranslation } from 'react-i18next';

const API_BASE = getApiBaseUrl();
const PENDING_TOKEN = 'padbol-fipa-pending-invitation';
const pendingToken = () => { try { return window.sessionStorage.getItem(PENDING_TOKEN) || ''; } catch { return ''; } };

export default function FipaClaimInvitation() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const en = String(i18n.language || 'es').startsWith('en');
  const text = (es, english) => en ? english : es;
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const location = useLocation();
  const [selfService, setSelfService] = useState(false);
  const token = useMemo(() => selfService ? '' : String(new URLSearchParams(location.hash.slice(1)).get('token') || searchParams.get('token') || pendingToken() || '').trim(), [searchParams, location.hash, selfService]);
  const [player, setPlayer] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    if (!token) { setLoading(false); return () => { alive = false; }; }
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/fipa/invitaciones/validar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'La invitación no está disponible.');
        if (alive) { setPlayer(data.jugador); setExpiresAt(data.vence_at); }
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  async function acceptInvitation() {
    if (!session?.access_token) {
      try { window.sessionStorage.setItem(PENDING_TOKEN, token); } catch { /* The player can reopen their original invitation after signing in. */ }
      navigate('/login?login=1&redirect=%2Ffipa%2Freclamar');
      return;
    }
    setAccepting(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/fipa/invitaciones/aceptar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos vincular el perfil.');
      try { window.sessionStorage.removeItem(PENDING_TOKEN); } catch {}
      setAccepted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="external-history-page">
      <AppHeader title={text("Perfil oficial FIPA", "Official FIPA profile")} />
      <div className="external-history-wrap">
        <button className="external-history-back" type="button" onClick={() => navigate('/rankings')}>{text("← Ver ranking", "← View ranking")}</button>
        {token ? <button className="external-history-back" type="button" onClick={() => { try { window.sessionStorage.removeItem(PENDING_TOKEN); } catch {} setSelfService(true); setError(''); navigate('/fipa/reclamar', { replace: true }); }}>{text('Buscar mi perfil sin invitación', 'Find my profile without an invitation')}</button> : null}
        <section className="external-history-hero">
          <span>{text("Ranking oficial FIPA", "Official FIPA ranking")}</span>
          {!token ? <FipaSelfService accessToken={session?.access_token} navigate={navigate} en={en}/> : loading ? <h1>{text('Comprobando invitación…','Checking invitation…')}</h1> : accepted ? (
            <><h1>{text('Tu perfil quedó vinculado','Your profile is now linked')}</h1><p>{text('Conservas el nombre, la posición y los puntos oficiales FIPA. Desde ahora este registro aparece asociado a tu cuenta. La inscripción al torneo se confirma por separado.','Your official FIPA name, position and points are preserved and linked to your account. Tournament registration is confirmed separately.')}</p></>
          ) : player ? (
            <>
              <h1>{player.nombre_completo}</h1>
              <p>{player.pais} · {player.continente}. {text('Este perfil ya existe en el ranking oficial. Usa la cuenta con el correo que confirmaste al coordinador: al aceptar conservas tus puntos y tu posición, sin duplicarlos.','This profile already exists in the official ranking. Use the account email confirmed with your coordinator. Accepting preserves your points and position without duplicating them.')}</p>
              <p><strong>{player.puntos} {text('puntos oficiales · posición','official points · position')} {player.posicion}</strong></p>{expiresAt ? <small>Invitación disponible hasta {new Date(expiresAt).toLocaleDateString()}.</small> : null}
              <button className="external-history-submit" type="button" disabled={accepting} onClick={acceptInvitation}>{accepting ? text('Vinculando…','Linking…') : session ? text('Sí, este perfil es mío','Yes, this is my profile') : text('Ingresar y aceptar','Sign in and accept')}</button>
            </>
          ) : <><h1>{text('Invitación no disponible','Invitation unavailable')}</h1><p>Pide al coordinador tu enlace personal. Si todavía no tienes cuenta, créala con el correo que le indicaste, confirma el correo y luego abre nuevamente la invitación. Si ya tienes cuenta, usa esa misma.</p></>}
        </section>
        {error ? <div className="external-history-message" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div> : null}
      </div>
    </main>
  );
}

