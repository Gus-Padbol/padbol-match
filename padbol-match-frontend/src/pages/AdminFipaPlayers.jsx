import { getApiBaseUrl } from '../utils/apiPublicBaseUrl';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import './RecorridoExterno.css';

const API_BASE = getApiBaseUrl();

export default function AdminFipaPlayers() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [payload, setPayload] = useState({ jugadores: [], total: 0, resumen: {} });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState({});
  const [contactTypes, setContactTypes] = useState({});
  const [links, setLinks] = useState({});
  const [sending, setSending] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status) params.set('estado', status);
      const response = await fetch(`${API_BASE}/api/admin/fipa/jugadores?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos cargar los jugadores FIPA.');
      setPayload(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, session?.access_token, status]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  const summary = useMemo(() => payload.resumen || {}, [payload.resumen]);

  async function prepareInvitation(player) {
    const destination = String(contacts[player.id] || '').trim();
    const destinationType = contactTypes[player.id] || 'whatsapp';
    if (!destination) return setError('Indica el email o WhatsApp del jugador.');
    setSending((current) => ({ ...current, [player.id]: true }));
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/fipa/jugadores/${player.id}/invitacion`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ destino_tipo: destinationType, destino_valor: destination }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos preparar la invitación.');
      setLinks((current) => ({ ...current, [player.id]: data.enlace }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending((current) => ({ ...current, [player.id]: false }));
    }
  }

  return (
    <main className="external-history-page">
      <AppHeader title="Jugadores oficiales FIPA" />
      <div className="external-history-wrap" style={{ width: 'min(1180px,calc(100% - 28px))' }}>
        <button className="external-history-back" type="button" onClick={() => navigate('/admin?tab=solicitudes')}>← Volver al panel</button>
        <section className="external-history-hero">
          <span>Ranking oficial reclamable</span>
          <h1>{payload.total || 209} perfiles FIPA</h1>
          <p>Son nombres oficiales con puntos, no cuentas creadas. Carga un contacto y prepara un enlace para que cada jugador vincule su propia cuenta.</p>
        </section>

        <section className="external-history-message" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          <strong>Sin reclamar: {summary.no_reclamado || 0}</strong>
          <strong>Invitados: {summary.invitado || 0}</strong>
          <strong>En revisión: {summary.reclamacion_pendiente || 0}</strong>
          <strong>Vinculados: {summary.vinculado || 0}</strong>
        </section>

        <section className="external-history-message" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, país o continente" style={{ flex: '1 1 280px', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
            <option value="">Todos los estados</option>
            <option value="no_reclamado">Sin reclamar</option>
            <option value="invitado">Invitados</option>
            <option value="reclamacion_pendiente">En revisión</option>
            <option value="vinculado">Vinculados</option>
          </select>
        </section>

        {error ? <div className="external-history-message" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div> : null}
        <section className="external-history-status">
          {loading ? <p>Cargando…</p> : payload.jugadores.length === 0 ? <p>No hay jugadores para este filtro.</p> : payload.jugadores.map((player) => {
            const generatedLink = links[player.id];
            const linked = player.estado_vinculacion === 'vinculado';
            return (
              <article key={player.id}>
                <div>
                  <strong>#{player.ranking?.posicion || '—'} · {player.ranking?.puntos ?? '—'} puntos</strong>
                  <span>{player.pais} · {player.continente} · {player.estado_vinculacion.replaceAll('_', ' ')}</span>
                </div>
                <h3>{player.nombre_completo}</h3>
                {!linked ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(220px,1fr) auto', gap: 8, alignItems: 'center' }}>
                    <select value={contactTypes[player.id] || 'whatsapp'} onChange={(event) => setContactTypes((current) => ({ ...current, [player.id]: event.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                    </select>
                    <input value={contacts[player.id] || ''} onChange={(event) => setContacts((current) => ({ ...current, [player.id]: event.target.value }))} placeholder="Contacto privado" style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }} />
                    <button className="external-history-submit" style={{ width: 'auto' }} type="button" disabled={sending[player.id]} onClick={() => prepareInvitation(player)}>{sending[player.id] ? 'Preparando…' : 'Preparar invitación'}</button>
                  </div>
                ) : <p>La cuenta del jugador ya está vinculada con este perfil oficial.</p>}
                {generatedLink ? (
                  <div className="external-history-ai-result" style={{ marginTop: 12 }}>
                    <strong>Enlace listo para compartir manualmente</strong>
                    <p style={{ overflowWrap: 'anywhere' }}>{generatedLink}</p>
                    <button type="button" onClick={() => navigator.clipboard.writeText(generatedLink)}>Copiar enlace</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

