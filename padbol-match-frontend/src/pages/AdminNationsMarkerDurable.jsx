import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
  const headers = useMemo(() => ({...(token ? {Authorization: `Bearer ${token}`} : {}), 'Content-Type': 'application/json'}), [token]);
  const [context, setContext] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [teamId, setTeamId] = useState('');
  const [outId, setOutId] = useState('');
  const [inId, setInId] = useState('');
  const [revision, setRevision] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState('');
  const keys = useRef({
    start: newId(), pause: newId(), resume: newId(), close: newId(),
    sub: newId(), subEvent: newId(), pointA: newId(), pointB: newId(),
  });

  const load = useCallback(async () => {
    if (!scoreboardId || !token) return;
    setBusy(true);
    try {
      const ctxRes = await fetch(`${api}/api/nations/marker/${encodeURIComponent(scoreboardId)}/context`, {headers});
      const ctx = await ctxRes.json().catch(() => null);
      if (!ctxRes.ok) { setError(ctx?.code || 'CONTEXT_FAILED'); return; }
      setContext(ctx);
      const tid = teamId || String(ctx?.membership?.A ?? ctx?.teamIds?.[0] ?? '');
      if (tid && !teamId) setTeamId(tid);
      setEpoch(Number(ctx?.gamesEpoch ?? 0));
      if (!tid) { setRevision(0); setTrackingStatus(''); return; }
      const markerRes = await fetch(`${api}/api/nations/marker/${encodeURIComponent(scoreboardId)}?teamId=${encodeURIComponent(tid)}`, {headers});
      const marker = await markerRes.json().catch(() => null);
      if (markerRes.status === 409 && marker?.code === 'TRACKING_NOT_STARTED') {
        setRevision(0); setTrackingStatus('not_started'); return;
      }
      if (!markerRes.ok) { setError(marker?.code || `MARKER_${markerRes.status}`); return; }
      setRevision(Number(marker?.matchRevision ?? 0));
      setEpoch(Number(marker?.gamesEpoch ?? ctx?.gamesEpoch ?? 0));
      setTrackingStatus(String(marker?.trackingStatus ?? ctx?.trackingStatus ?? ''));
      setError('');
    } catch { setError('NETWORK_ERROR'); }
    finally { setBusy(false); }
  }, [api, headers, scoreboardId, teamId, token]);

  useEffect(() => { load(); }, [load]);

  const run = async (path, body, afterSuccess) => {
    if (busy || !token) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${api}/api/nations/marker/${encodeURIComponent(scoreboardId)}${path}`, {method: 'POST', headers, body: JSON.stringify(body)});
      const result = await res.json().catch(() => null);
      if (!res.ok) { const code = result?.code || `HTTP_${res.status}`; await load(); setError(code); return; }
      if (afterSuccess) afterSuccess();
      await load();
    } catch { setError('NETWORK_ERROR'); }
    finally { setBusy(false); }
  };
  const start = () => run('/start', {idempotencyKey: keys.current.start, payload: {}}, () => { keys.current.start = newId(); });
  const global = (type) => run('/global/commands', {
    type, idempotencyKey: keys.current[type], expectedRevision: revision, epoch,
  }, () => { keys.current[type] = newId(); });
  const substitute = () => {
    if (!teamId || !outId.trim() || !inId.trim()) { setError('TEAM_OUT_IN_REQUIRED'); return; }
    run(`/team/${encodeURIComponent(teamId)}/commands`, {
      type: 'substitution', eventId: keys.current.subEvent, idempotencyKey: keys.current.sub,
      expectedRevision: revision, epoch, outId: outId.trim(), inId: inId.trim(),
    }, () => { keys.current.sub = newId(); keys.current.subEvent = newId(); });
  };
  const scorePoint = async (side) => {
    if (busy || !token) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${api}/api/scoreboard/partidos/${encodeURIComponent(scoreboardId)}/punto/${side}`, {
        method: 'POST', headers, body: JSON.stringify({requestId: keys.current[side === 'A' ? 'pointA' : 'pointB'], epoch}),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) { const code = result?.code || `HTTP_${res.status}`; await load(); setError(code); return; }
      keys.current[side === 'A' ? 'pointA' : 'pointB'] = newId();
      await load();
    } catch { setError('NETWORK_ERROR'); }
    finally { setBusy(false); }
  };

  if (loading || roleLoading) return <main className="admin-nations"><p>Cargando…</p></main>;
  if (!session?.user) return <main className="admin-nations"><p>Inicia sesión con una cuenta staff.</p></main>;
  if (!STAFF.has(String(rol || '').toLowerCase())) return <main className="admin-nations"><p role="alert">Sin permiso para operar el marcador durable.</p></main>;

  return (
    <main className="admin-nations">
      <h1>Marcador durable Nations</h1>
      <p>Usa un marcador ya generado y activado en el panel legacy. Esta pantalla no genera ni activa canchas. Primero iniciá el reloj y la línea base durable; no uses el botón “Iniciar” legacy antes de este paso.</p>
      <p>Scoreboard: <code>{scoreboardId}</code> · rol: {rol} · revisión: {revision} · epoch: {epoch} · estado: {trackingStatus || '—'}</p>
      <p><Link to="/admin/nations-activacion">Volver a generación/activación legacy</Link></p>
      {error ? <p role="alert">{error}</p> : null}
      {busy ? <p role="status">Operación en curso…</p> : null}
      <button type="button" disabled={busy || !context?.canStart} onClick={start}>Iniciar reloj y línea base</button>
      <button type="button" disabled={busy} onClick={() => global('pause')}>Pausar</button>
      <button type="button" disabled={busy} onClick={() => global('resume')}>Reanudar</button>
      <button type="button" disabled={busy} onClick={() => global('close')}>Cerrar</button>
      <button type="button" disabled={busy} onClick={() => scorePoint('A')}>Punto A</button>
      <button type="button" disabled={busy} onClick={() => scorePoint('B')}>Punto B</button>
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
