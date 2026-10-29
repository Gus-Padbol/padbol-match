import { getApiBaseUrl } from '../utils/apiPublicBaseUrl';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import './RecorridoExterno.css';
import { useTranslation } from 'react-i18next';

const API_BASE = getApiBaseUrl();

export default function FipaClaimInvitation() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const en = String(i18n.language || 'es').startsWith('en');
  const text = (es, english) => en ? english : es;
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const location = useLocation();
  const token = useMemo(() => String(new URLSearchParams(location.hash.slice(1)).get('token') || searchParams.get('token') || '').trim(), [searchParams, location.hash]);
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
      navigate(`/login?next=${encodeURIComponent(`/fipa/reclamar#token=${token}`)}`);
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
        <section className="external-history-hero">
          <span>{text("Ranking oficial FIPA", "Official FIPA ranking")}</span>
          {!token ? <><h1>{text('Vincular mis puntos FIPA','Link my FIPA points')}</h1><ol><li>{text('Crea tu cuenta personal o usa la que ya tienes. Confirma tu correo.','Create your personal account or use your existing one. Confirm your email.')}</li><li>{text('Indica al coordinador de tu delegación tu nombre del ranking, país y correo de la cuenta. El coordinador verifica tu identidad.','Give your delegation coordinator your ranking name, country and account email. Your coordinator verifies your identity.')}</li><li>{text('Abre el enlace personal que recibas, inicia sesión con ese correo y confirma que el perfil es tuyo. Conservas tus puntos y posición sin duplicarlos.','Open your personal invitation, sign in with that email and confirm the profile is yours. Your points and position are preserved without duplication.')}</li></ol><p>{text('La vinculación del ranking no sustituye la inscripción al torneo. Puedes crear tu cuenta mientras el coordinador prepara tu enlace.','Ranking linking does not replace tournament registration. You can create your account while the coordinator prepares your invitation.')}</p><button type="button" className="external-history-submit" onClick={()=>navigate('/login')}>{text('Ingresar o crear mi cuenta','Sign in or create my account')}</button></> : loading ? <h1>{text('Comprobando invitación…','Checking invitation…')}</h1> : accepted ? (
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

