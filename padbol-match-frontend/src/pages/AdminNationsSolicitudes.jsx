import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';

const API = process.env.REACT_APP_API_URL || '';

export default function AdminNationsSolicitudes() {
  const {slug = ''} = useParams();
  const {session, loading} = useAuth();
  const token = session?.access_token || null;
  const [access, setAccess] = useState(null); // true | false
  const [requests, setRequests] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState('');
  const [identity, setIdentity] = useState(false);
  const [guardian, setGuardian] = useState(false);
  const [evidence, setEvidence] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const epoch = useRef(0);
  const headers = useMemo(() => (token ? {Authorization: `Bearer ${token}`} : {}), [token]);

  const cargar = useCallback(async () => {
    if (!token) return;
    const ticket = ++epoch.current;
    setError(null);
    try {
      const acc = await fetch(`${API}/api/admin/nations-activation/events/${slug}/access`, {headers});
      if (ticket !== epoch.current) return;
      if (!acc.ok) { setAccess(false); return; }
      const accBody = await acc.json().catch(() => null);
      setAccess(Boolean(accBody?.canImport || accBody?.canConfigure || accBody?.access?.canConfigure));
      const [colReq, colPart] = await Promise.all([
        fetch(`${API}/api/admin/nations-activation/events/${slug}/profile-requests`, {headers}),
        fetch(`${API}/api/admin/nations-activation/events/${slug}`, {headers}),
      ]);
      if (ticket !== epoch.current) return;
      if (!colReq.ok || !colPart.ok) { setError('No pudimos cargar la cola.'); return; }
      const reqBody = await colReq.json().catch(() => null);
      const partBody = await colPart.json().catch(() => null);
      if (ticket !== epoch.current) return;
      setRequests(Array.isArray(reqBody?.requests) ? reqBody.requests : []);
      setParticipants(Array.isArray(partBody?.participants) ? partBody.participants : []);
    } catch {
      if (ticket === epoch.current) setError('Error de red. Reintentá.');
    }
  }, [slug, token, headers]);

  useEffect(() => { cargar(); }, [cargar]);

  const candidatos = useMemo(() => {
    if (!selected) return [];
    return participants.filter((p) => p.country === selected.declared_country && !p.linked);
  }, [participants, selected]);

  const resumen = selected
    ? `${selected.declared_name} (${selected.declared_country}) · ${selected.age_status} · persona: ${matched || 'sin seleccionar'}`
    : '';

  const decidir = async (decision) => {
    if (busy || !selected) return;
    setError(null);
    if (decision === 'aprobar') {
      if (evidence.trim().length < 20) { setError('La evidencia debe tener al menos 20 caracteres.'); return; }
      if (!identity) { setError('Marcá la verificación de identidad.'); return; }
      if (selected.age_status === 'desconocido') { setError('Edad desconocida: no se puede aprobar.'); return; }
      if (selected.age_status === 'menor' && !guardian) { setError('Menor: falta verificación central del responsable.'); return; }
      if (!matched) { setError('Elegí la persona existente del mismo país.'); return; }
    } else if (evidence.trim().length < 20) {
      setError('La nota de rechazo debe tener al menos 20 caracteres.'); return;
    }
    setBusy(true);
    const ticket = epoch.current;
    try {
      const res = await fetch(`${API}/api/admin/nations-activation/events/${slug}/profile-requests/${selected.id}/review`, {
        method: 'POST',
        headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify({
          decision,
          note: evidence.trim(),
          identity_verified: decision === 'aprobar' ? true : undefined,
          guardian_verified: decision === 'aprobar' && selected.age_status === 'menor' ? guardian : undefined,
          matched_participante_id: decision === 'aprobar' ? matched : undefined,
        }),
      });
      if (ticket !== epoch.current) return;
      if (res.status === 403) { setAccess(false); return; }
      if (res.status === 409) { setBusy(false); await cargar(); setError('La solicitud cambió de estado. Actualizamos la cola.'); return; }
      if (!res.ok) { setError('No pudimos registrar la decisión.'); return; }
      setSelected(null); setMatched(''); setEvidence(''); setIdentity(false); setGuardian(false);
      setBusy(false);            // liberar ANTES de recargar: cargar() incrementa el epoch
      await cargar();
    } catch {
      if (ticket === epoch.current) setError('Error de red. Reintentá.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="admin-nations"><p>Cargando…</p></main>;
  if (!session?.user) return <main className="admin-nations"><p>Iniciá sesión con una cuenta administradora.</p></main>;
  if (access === false) return <main className="admin-nations"><p role="alert">Sin permiso para revisar solicitudes.</p></main>;

  return (
    <main className="admin-nations">
      <h1>Solicitudes privadas de inscripción</h1>
      {error ? <p role="alert">{error}</p> : null}
      {!requests.length ? <p>No hay solicitudes pendientes.</p> : null}
      <ul>
        {requests.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => { setSelected(r); setMatched(''); }}>
              {r.declared_name} · {r.declared_country} · {r.age_status}
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <section>
          <h2>Revisar solicitud</h2>
          <p>Identidad declarada: <strong>{selected.declared_name}</strong> ({selected.declared_country})</p>
          <p>Edad declarada: {selected.age_status}</p>
          <label>Persona existente del mismo país
            <select value={matched} onChange={(e) => setMatched(e.target.value)}>
              <option value="">Seleccionar</option>
              {candidatos.map((p) => <option key={p.id} value={p.id}>{p.name || p.nombre || p.id}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={identity} onChange={(e) => setIdentity(e.target.checked)} /> Verifiqué la identidad</label>
          {selected.age_status === 'menor' ? (
            <label><input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} /> Verifiqué al responsable</label>
          ) : null}
          <label>Evidencia / nota (mínimo 20 caracteres)
            <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          </label>
          <p role="status">Resumen: {resumen}</p>
          <button type="button" disabled={busy} onClick={() => decidir('aprobar')}>Aprobar</button>
          <button type="button" disabled={busy} onClick={() => decidir('rechazar')}>Rechazar</button>
        </section>
      ) : null}
    </main>
  );
}
