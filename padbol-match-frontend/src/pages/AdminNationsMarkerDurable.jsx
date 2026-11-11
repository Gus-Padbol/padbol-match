import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import {getApiBaseUrl} from '../utils/apiPublicBaseUrl';

const STAFF = new Set(['super_admin', 'admin_club', 'admin_sede']);
const newId = () => (typeof window !== 'undefined' && window.crypto?.randomUUID ? window.crypto.randomUUID() : `qa-${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** Panel staff mínimo para operar el marcador durable ya generado/activado. */
export default function AdminNationsMarkerDurable() {
  const {scoreboardId = ''} = useParams();
  const {session, loading} = useAuth();
  const currentCliente = useMemo(() => (session?.user ? {id: session.user.id, email: session.user.email, accessToken: session.access_token} : null), [session]);
  const {rol, loading: roleLoading} = useUserRole(currentCliente);
  const api = getApiBaseUrl();
  const token = session?.access_token || '';
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [outId, setOutId] = useState('');
  const [inId, setInId] = useState('');
  const [revision, setRevision] = useState(0);

  const headers = useMemo(() => ({... (token ? {Authorization: `Bearer ${token}`} : {}), 'Content-Type': 'application/json'}), [token]);
  const load = useCallback(async () => {
    if (!scoreboardId || !token) return;
    setError(''); setBusy(true);
    try {
      const res = await fetch(`${api}/api/nations/marker/${encodeURIComponent(scoreboardId)}/context`, {headers});
      const body = await res.json().catch(() => null);
      if (!res.ok) { setError(body?.code || 'CONTEXT_FAILED'); return; }
      setContext(body);
      setRevision(0);
    } catch { setError('NETWORK_ERROR'); }
    finally { setBusy(false); }
  }, [api, headers, scoreboardId, token]);

  useEffect(() => { load(); }, [load]);
  const command = async (path, body) => {
    if (busy || !token) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${api}/api/nations/marker/${encodeURIComponent(scoreboardId)}${path}`, {method: 'POST', headers, body: JSON.stringify(body)});
      const result = await res.json().catch(() => null);
      if (!res.ok) { setError(result?.code || `HTTP_${res.status}`); return; }
      await load();
    } catch { setError('NETWORK_ERROR'); }
    finally { setBusy(false); }
  };
  const start = () => command('/start', {idempotencyKey: newId(), payload: {}});
  const global = (type) => command('/global/commands', {type, idempotencyKey: newId(), expectedRevision: revision});
  const substitute = () => {
    if (!teamId || !outId.trim() || !inId.trim()) { setError('TEAM_OUT_IN_REQUIRED'); return; }
    command(`/team/${encodeURIComponent(teamId)}/commands`, {
      type: 'substitution', eventId: newId(), idempotencyKey: newId(),
      expectedRevision: revision, outId: outId.trim(), inId: inId.trim(),
    });
  };

  if (loading || roleLoading) return <main className="admin-nations"><p>Cargando…</p></main>;
  if (!session?.user) return <main className="admin-nations"><p>Inicia sesión con una cuenta staff.</p></main>;
  if (!STAFF.has(String(rol || '').toLowerCase())) return <main className="admin-nations"><p role="alert">Sin permiso para operar el marcador durable.</p></main>;

  return (
    <main className="admin-nations">
      <h1>Marcador durable Nations</h1>
      <p>Usa un marcador ya generado y activado en el panel legacy. Esta pantalla no genera ni activa canchas.</p>
      <p>Scoreboard: <code>{scoreboardId}</code> · rol: {rol} · revisión: {revision}</p>
      <p><Link to="/admin/nations-activacion">Volver a generación/activación legacy</Link></p>
      {error ? <p role="alert">{error}</p> : null}
      {busy ? <p role="status">Operación en curso…</p> : null}
      <button type="button" disabled={busy || !context?.canStart} onClick={start}>Iniciar marcador durable</button>
      <button type="button" disabled={busy} onClick={() => global('pause')}>Pausar</button>
      <button type="button" disabled={busy} onClick={() => global('resume')}>Reanudar</button>
      <button type="button" disabled={busy} onClick={() => global('close')}>Cerrar</button>
      <section>
        <h2>Cambio</h2>
        <label>Equipo
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Seleccionar</option>
            {(context?.teamIds || []).map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        <label>Sale <input value={outId} onChange={(e) => setOutId(e.target.value)} placeholder="ID de jugador activo" /></label>
        <label>Entra <input value={inId} onChange={(e) => setInId(e.target.value)} placeholder="ID de suplente" /></label>
        <button type="button" disabled={busy} onClick={substitute}>Registrar cambio</button>
      </section>
      <section>
        <h2>Contexto</h2>
        <pre style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{context ? JSON.stringify(context, null, 2) : 'Sin contexto'}</pre>
      </section>
    </main>
  );
}
