import { getApiBaseUrl } from '../utils/apiPublicBaseUrl';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import './RecorridoExterno.css';

const API_BASE = getApiBaseUrl();

export default function FipaClaimInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const token = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams]);
  const [player, setPlayer] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
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
      navigate(`/login?next=${encodeURIComponent(`/fipa/reclamar?token=${token}`)}`);
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
      <AppHeader title="Perfil oficial FIPA" />
      <div className="external-history-wrap">
        <button className="external-history-back" type="button" onClick={() => navigate('/rankings')}>← Ver ranking</button>
        <section className="external-history-hero">
          <span>Invitación oficial</span>
          {loading ? <h1>Comprobando invitación…</h1> : accepted ? (
            <><h1>Tu perfil quedó vinculado</h1><p>Conservas el nombre, la posición y los puntos oficiales FIPA. Desde ahora este historial aparece asociado a tu cuenta.</p></>
          ) : player ? (
            <>
              <h1>{player.nombre_completo}</h1>
              <p>{player.pais} · {player.continente}. Este perfil ya existe en el ranking oficial; al aceptar solo lo vinculamos con tu cuenta de Padbol Match.</p>
              {expiresAt ? <small>Invitación disponible hasta {new Date(expiresAt).toLocaleDateString()}.</small> : null}
              <button className="external-history-submit" type="button" disabled={accepting} onClick={acceptInvitation}>{accepting ? 'Vinculando…' : session ? 'Sí, este perfil es mío' : 'Ingresar y aceptar'}</button>
            </>
          ) : <><h1>Invitación no disponible</h1><p>El enlace puede haber vencido, ya haberse usado o no ser válido.</p></>}
        </section>
        {error ? <div className="external-history-message" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div> : null}
      </div>
    </main>
  );
}

