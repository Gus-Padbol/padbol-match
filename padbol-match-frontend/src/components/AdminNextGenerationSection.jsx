import React, { useCallback, useEffect, useState } from 'react';

const API_BASE = '';
const LABELS = { confirmada: 'Confirmada', en_espera: 'Lista de espera', cancelada: 'Cancelada', recibida: 'Recibida', pendiente: 'Pendiente', en_evaluacion: 'En evaluación', aprobada: 'Aprobada', rechazada: 'Rechazada', borrador: 'Borrador', programada: 'Programada', activa: 'Activa', cerrada: 'Cerrada' };
const card = { padding: 16, border: '1px solid var(--border-color)', borderRadius: 12 };
const input = { minHeight: 40, borderRadius: 8, border: '1px solid var(--border-color)', padding: '0 10px' };
const tabButton = (active) => ({
  minHeight: 46,
  padding: '0 18px',
  borderRadius: 12,
  border: active ? '1px solid #ef233c' : '1px solid #475569',
  background: active ? 'linear-gradient(135deg,#ef233c,#c1122f)' : '#334155',
  color: '#fff',
  fontWeight: 800,
  boxShadow: active ? '0 8px 22px rgba(239,35,60,.25)' : 'none',
  cursor: 'pointer',
});
const testRecord = (row = {}) => Boolean(row.is_test || row.es_prueba || /\[limpiar\]|\bprueba\s*\d*\b|\btest\s*\d*\b/i.test([row.contacto_nombre, row.sede_club, row.nombre, row.nombre_publico, row.contacto_email].filter(Boolean).join(' ')));
const venueName = (row) => row.sede?.sede_club || row.sede?.nombre || row.sede_club || 'Sin sede';
const sessionName = (row) => row.nombre_publico || row.jornada?.nombre_publico || row.jornada?.nombre || 'Sin jornada';
const categoryName = (row) => row.categoria || row.jornada?.categoria || row.participantes?.[0]?.categoria || 'Sin categoría';
const emptySession = { sede_id: '', nombre_publico: '', ciudad: '', pais: '', categoria: '', comienza_at: '', termina_at: '', cupo: 16, estado: 'borrador' };
const localDateTime = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';

export default function AdminNextGenerationSection({ accessToken, isSuperAdmin = false }) {
  const [data, setData] = useState({ summary: {}, inscripciones: [], sedes: [], sessions: [] });
  const [canonicalSedes, setCanonicalSedes] = useState([]);
  const [tab, setTab] = useState('participants');
  const [filters, setFilters] = useState({ text: '', state: 'all', country: 'all', venue: 'all' });
  const [showTests, setShowTests] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [sessionForm, setSessionForm] = useState(emptySession);
  const [editingSessionId, setEditingSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/next-generation/overview`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'No se pudo cargar Next Generation.');
      setData({
        ...body,
        inscripciones: body.participants || body.inscripciones || [],
        sedes: body.venueApplications || body.sedes || [],
        sessions: body.sessions || body.jornadas || body.sesiones || [],
      });
    } catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch('/api/sedes', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
      .then((response) => response.json()).then((body) => setCanonicalSedes(Array.isArray(body) ? body : (body?.sedes || []))).catch(() => setCanonicalSedes([]));
  }, [accessToken, isSuperAdmin]);

  async function action(path, method = 'POST', payload) {
    setSaving(true); setError('');
    try {
      const response = await fetch(path, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'No se pudo guardar el cambio.');
      await load();
      return true;
    } catch (reason) { setError(reason.message); return false; }
    finally { setSaving(false); }
  }

  async function saveSession(event) {
    event.preventDefault();
    const payload = {
      ...sessionForm,
      cupo: Number(sessionForm.cupo),
      comienza_at: sessionForm.comienza_at ? new Date(sessionForm.comienza_at).toISOString() : '',
      termina_at: sessionForm.termina_at ? new Date(sessionForm.termina_at).toISOString() : null,
    };
    if (!isSuperAdmin) delete payload.sede_id;
    const saved = await action(editingSessionId ? `/api/admin/next-generation/sessions/${encodeURIComponent(editingSessionId)}` : '/api/admin/next-generation/sessions', editingSessionId ? 'PATCH' : 'POST', payload);
    if (saved) { setSessionForm(emptySession); setEditingSessionId(''); }
  }

  function editSession(row) {
    setEditingSessionId(row.id);
    setSessionForm({
      sede_id: row.sede_id || '', nombre_publico: row.nombre_publico || '', ciudad: row.ciudad || '', pais: row.pais || '',
      categoria: row.categoria || '', comienza_at: localDateTime(row.comienza_at), termina_at: localDateTime(row.termina_at),
      cupo: row.cupo || 1, estado: row.estado || 'borrador',
    });
  }

  const rawRows = tab === 'participants' ? data.inscripciones : tab === 'venues' ? data.sedes : data.sessions;
  const productionRows = rawRows.filter((row) => !testRecord(row));
  const rows = showTests ? rawRows : productionRows;
  const testCount = rawRows.length - productionRows.length;
  const countries = [...new Set(rows.map((row) => row.pais || row.sede?.pais || row.jornada?.pais).filter(Boolean))].sort();
  const rowVenueName = (row) => tab === 'sessions'
    ? (canonicalSedes.find((item) => String(item.id) === String(row.sede_id))?.nombre || 'Sede asignada')
    : venueName(row);
  const venues = [...new Set(rows.map(rowVenueName).filter((name) => name !== 'Sin sede'))].sort();
  const visible = rows.filter((row) => {
    const haystack = [row.contacto_nombre, row.contacto_email, row.sede_club, row.nombre, sessionName(row), venueName(row), categoryName(row)].join(' ').toLowerCase();
    const rowCountry = row.pais || row.sede?.pais || row.jornada?.pais;
    return (filters.state === 'all' || (row.estado || row.status) === filters.state)
      && (filters.country === 'all' || rowCountry === filters.country)
      && (filters.venue === 'all' || rowVenueName(row) === filters.venue)
      && (!filters.text.trim() || haystack.includes(filters.text.trim().toLowerCase()));
  });
  const counts = { total: productionRows.length, confirmed: productionRows.filter((row) => row.estado === 'confirmada').length, waitlist: productionRows.filter((row) => row.estado === 'en_espera').length, cancelled: productionRows.filter((row) => row.estado === 'cancelada').length };
  const changeFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const assignmentFor = (row) => assignments[row.id] || {
    sede_id: row.sede_id || row.sede?.canonical_sede_id || row.sede?.id || '',
    sesion_id: row.sesion_id || row.jornada?.id || '',
    categoria: row.categoria || row.jornada?.categoria || row.participantes?.[0]?.categoria || '',
  };
  const changeAssignment = (row, key, value) => setAssignments((current) => ({ ...current, [row.id]: { ...assignmentFor(row), ...(current[row.id] || {}), [key]: value } }));

  return <section aria-label="Gestión operativa Next Generation">
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div><h2 style={{ marginBottom: 4 }}>Next Generation</h2><p style={{ margin: 0, color: 'var(--text-secondary)' }}>Organiza participantes, jornadas, cupos y postulaciones de sedes.</p></div>
      <div style={{ display: 'grid', justifyItems: 'end', gap: 5 }}>
        <button type="button" onClick={load} disabled={loading} title="Vuelve a consultar la información más reciente" style={{ minHeight: 42, padding: '0 16px', borderRadius: 10, border: '1px solid #64748b', background: '#334155', color: '#fff', fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>{loading ? 'Actualizando datos…' : '↻ Actualizar datos'}</button>
        <small style={{ color: 'var(--text-secondary)' }}>Recarga los cambios más recientes.</small>
      </div>
    </header>
    {error ? <p role="alert" style={{ color: '#ef4444', fontWeight: 700 }}>{error}</p> : null}
    <div role="tablist" aria-label="Áreas de Next Generation" style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
      <button role="tab" aria-selected={tab === 'participants'} onClick={() => setTab('participants')} type="button" style={tabButton(tab === 'participants')}>Participantes e inscripciones</button>
      <button role="tab" aria-selected={tab === 'venues'} onClick={() => setTab('venues')} type="button" style={tabButton(tab === 'venues')}>Sedes y postulaciones</button>
      <button role="tab" aria-selected={tab === 'sessions'} onClick={() => setTab('sessions')} type="button" style={tabButton(tab === 'sessions')}>Jornadas y cupos</button>
    </div>

    {tab === 'participants' ? <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, margin: '20px 0' }}>
        {[['Inscripciones', counts.total], ['Confirmadas', counts.confirmed], ['Lista de espera', counts.waitlist], ['Canceladas', counts.cancelled]].map(([label, value]) => <article key={label} style={card}><span>{label}</span><strong style={{ display: 'block', fontSize: 26 }}>{value}</strong></article>)}
      </div>
      <p style={{ color: 'var(--text-secondary)' }}>Aquí se organiza la participación deportiva. Las conversaciones y respuestas continúan en Atención / CRM.</p>
    </> : tab === 'venues' ? <div style={{ ...card, margin: '20px 0' }}><strong>{productionRows.length}</strong> postulación(es) de sede para evaluar y vincular.</div> : <SessionEditor sessionForm={sessionForm} setSessionForm={setSessionForm} editingSessionId={editingSessionId} setEditingSessionId={setEditingSessionId} canonicalSedes={canonicalSedes} isSuperAdmin={isSuperAdmin} saving={saving} onSubmit={saveSession} />}

    <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
      <input aria-label="Buscar en Next Generation" type="search" placeholder={tab === 'participants' ? 'Buscar participante, jornada o sede' : tab === 'venues' ? 'Buscar sede, ciudad o responsable' : 'Buscar jornada, sede o categoría'} value={filters.text} onChange={(event) => changeFilter('text', event.target.value)} style={{ ...input, minWidth: 270, flex: 1 }} />
      <select aria-label="Filtrar estado" value={filters.state} onChange={(event) => changeFilter('state', event.target.value)} style={input}><option value="all">Todos los estados</option>{tab === 'participants' ? <><option value="confirmada">Confirmadas</option><option value="en_espera">Lista de espera</option><option value="cancelada">Canceladas</option></> : tab === 'venues' ? <><option value="recibida">Recibidas</option><option value="en_evaluacion">En evaluación</option><option value="aprobada">Aprobadas</option><option value="rechazada">Rechazadas</option></> : <><option value="borrador">Borrador</option><option value="programada">Programadas</option><option value="activa">Activas</option><option value="cerrada">Cerradas</option><option value="cancelada">Canceladas</option></>}</select>
      {isSuperAdmin ? <><select aria-label="Filtrar país" value={filters.country} onChange={(event) => changeFilter('country', event.target.value)} disabled={!countries.length} style={{ ...input, opacity: countries.length ? 1 : 0.65 }}><option value="all">{countries.length ? 'Todos los países' : 'Todavía no hay países'}</option>{countries.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filtrar sede" value={filters.venue} onChange={(event) => changeFilter('venue', event.target.value)} disabled={!venues.length} style={{ ...input, opacity: venues.length ? 1 : 0.65 }}><option value="all">{venues.length ? 'Todas las sedes' : 'Todavía no hay sedes'}</option>{venues.map((item) => <option key={item}>{item}</option>)}</select></> : null}
    </div>
    {testCount ? <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginBottom: 16 }}><input type="checkbox" checked={showTests} onChange={(event) => setShowTests(event.target.checked)} />Mostrar {testCount} registro(s) de prueba</label> : null}
    {!loading && !visible.length ? <p>No hay {tab === 'participants' ? 'inscripciones' : tab === 'venues' ? 'postulaciones' : 'jornadas'} para estos filtros.</p> : null}

    <div style={{ display: 'grid', gap: 12 }}>
      {tab === 'participants' ? visible.map((row) => {
        const assignment = assignmentFor(row);
        return <article key={row.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><strong>{row.contacto_nombre || row.participantes?.[0]?.nombre || 'Participante sin nombre'}</strong><span>{LABELS[row.estado] || row.estado || 'Pendiente'}</span></div>
          <p>{row.pais || row.sede?.pais || row.jornada?.pais || 'País sin asignar'} · {venueName(row)} · {sessionName(row)} · {categoryName(row)}</p>
          <small>{row.participantes?.length || 1} participante(s){row.jornada?.cupo ? ` · Cupo: ${row.jornada.cupo}` : ''}{row.posicion_espera ? ` · Posición ${row.posicion_espera}` : ''} · ID {String(row.id).slice(0, 8)}</small>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {isSuperAdmin ? <select aria-label={`Sede para ${row.contacto_nombre || row.id}`} value={assignment.sede_id} onChange={(event) => changeAssignment(row, 'sede_id', event.target.value)} disabled={saving} style={input}><option value="">Asignar sede</option>{canonicalSedes.map((item) => <option key={item.id} value={item.id}>{item.nombre || `Sede ${item.id}`}</option>)}</select> : null}
            <select aria-label={`Jornada para ${row.contacto_nombre || row.id}`} value={assignment.sesion_id} onChange={(event) => {
              const selected = data.sessions.find((item) => String(item.id) === event.target.value);
              setAssignments((current) => ({ ...current, [row.id]: { ...assignmentFor(row), ...(current[row.id] || {}), sesion_id: event.target.value, sede_id: selected?.sede_id || assignment.sede_id, categoria: selected?.categoria || assignment.categoria } }));
            }} disabled={saving} style={input}><option value="">Asignar jornada</option>{data.sessions.map((item) => <option key={item.id} value={item.id}>{item.nombre_publico || item.nombre} · {item.categoria || 'Sin categoría'} · {item.cupo ?? '—'} cupos</option>)}</select>
            <input aria-label={`Categoría para ${row.contacto_nombre || row.id}`} value={assignment.categoria} onChange={(event) => changeAssignment(row, 'categoria', event.target.value)} placeholder="Categoría" disabled={saving} style={{ ...input, width: 125 }} />
            <button type="button" disabled={saving || !assignment.sede_id || !assignment.sesion_id || !assignment.categoria} onClick={() => action(`/api/admin/next-generation/registrations/${encodeURIComponent(row.id)}/assignment`, 'PATCH', assignment)}>Guardar asignación</button>
            <button type="button" disabled={saving || !assignment.sesion_id} onClick={() => action(`/api/admin/next-generation/registrations/${encodeURIComponent(row.id)}/confirm`)}>Confirmar</button>
            <button type="button" disabled={saving} onClick={() => action(`/api/admin/next-generation/registrations/${encodeURIComponent(row.id)}/waitlist`)}>Lista de espera</button>
            <button type="button" disabled={saving} onClick={() => action(`/api/admin/next-generation/registrations/${encodeURIComponent(row.id)}/cancel`, 'POST', { reason: 'Cancelada desde el panel' })}>Cancelar</button>
          </div>
        </article>;
      }) : tab === 'venues' ? visible.map((row) => <article key={row.id} style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>{row.sede_club || row.nombre || 'Sede sin nombre'}</strong><span>{LABELS[row.estado || row.status] || row.estado || row.status || 'Pendiente'}</span></div>
        <p>{row.ciudad || 'Ciudad sin informar'} · {row.pais || 'País sin informar'}</p>
        {isSuperAdmin ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label={`Sede oficial para ${row.sede_club || row.id}`} value={row.canonical_sede_id || ''} onChange={(event) => action(`/api/admin/next-generation/venues/${encodeURIComponent(row.id)}`, 'PATCH', { canonical_sede_id: event.target.value || null })} disabled={saving} style={input}><option value="">Vincular sede oficial</option>{canonicalSedes.map((item) => <option key={item.id} value={item.id}>{item.nombre || `Sede ${item.id}`}</option>)}</select>
          <button type="button" disabled={saving} onClick={() => action(`/api/admin/next-generation/venues/${encodeURIComponent(row.id)}`, 'PATCH', { estado: 'en_evaluacion' })}>Evaluar</button>
          <button type="button" disabled={saving || !row.canonical_sede_id} onClick={() => action(`/api/admin/next-generation/venues/${encodeURIComponent(row.id)}`, 'PATCH', { estado: 'aprobada' })}>Aprobar</button>
          <button type="button" disabled={saving} onClick={() => action(`/api/admin/next-generation/venues/${encodeURIComponent(row.id)}`, 'PATCH', { estado: 'rechazada' })}>Rechazar</button>
        </div> : <small>La evaluación institucional corresponde al equipo central.</small>}
      </article>) : visible.map((row) => {
        const venue = canonicalSedes.find((item) => String(item.id) === String(row.sede_id));
        const confirmed = data.inscripciones.filter((item) => String(item.sesion_id) === String(row.id) && item.estado === 'confirmada').length;
        return <article key={row.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><strong>{row.nombre_publico || 'Jornada sin nombre'}</strong><span>{LABELS[row.estado] || row.estado}</span></div>
          <p>{venue?.nombre || row.ciudad || 'Sede asignada'} · {row.categoria || 'Sin categoría'} · {row.comienza_at ? new Date(row.comienza_at).toLocaleString() : 'Fecha sin definir'}</p>
          <p><strong>{confirmed}/{row.cupo || 0}</strong> cupos confirmados · {Math.max(0, Number(row.cupo || 0) - confirmed)} disponibles</p>
          <button type="button" onClick={() => editSession(row)} disabled={saving}>Editar jornada y cupo</button>
        </article>;
      })}
    </div>
  </section>;
}

function SessionEditor({ sessionForm, setSessionForm, editingSessionId, setEditingSessionId, canonicalSedes, isSuperAdmin, saving, onSubmit }) {
  const change = (key, value) => setSessionForm((current) => ({ ...current, [key]: value }));
  return <form onSubmit={onSubmit} style={{ ...card, margin: '20px 0', display: 'grid', gap: 12 }}>
    <div><h3 style={{ margin: 0 }}>{editingSessionId ? 'Editar jornada' : 'Crear una jornada'}</h3><p style={{ marginBottom: 0, color: 'var(--text-secondary)' }}>Define la categoría, fecha y cantidad máxima de participantes.</p></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
      {isSuperAdmin ? <label>Sede<select aria-label="Sede de la jornada" value={sessionForm.sede_id} onChange={(event) => change('sede_id', event.target.value)} required style={{ ...input, display: 'block', width: '100%' }}><option value="">Seleccionar sede</option>{canonicalSedes.map((item) => <option key={item.id} value={item.id}>{item.nombre || `Sede ${item.id}`}</option>)}</select></label> : <p style={{ margin: 0 }}>La jornada se creará para tu sede.</p>}
      <label>Nombre<input aria-label="Nombre de la jornada" value={sessionForm.nombre_publico} onChange={(event) => change('nombre_publico', event.target.value)} required placeholder="Ej. Jornada U14 · Madrid" style={{ ...input, display: 'block', width: '100%' }} /></label>
      <label>Categoría<input aria-label="Categoría de la jornada" value={sessionForm.categoria} onChange={(event) => change('categoria', event.target.value)} required placeholder="Ej. U14" style={{ ...input, display: 'block', width: '100%' }} /></label>
      <label>Ciudad<input aria-label="Ciudad de la jornada" value={sessionForm.ciudad} onChange={(event) => change('ciudad', event.target.value)} placeholder="Ej. Madrid" style={{ ...input, display: 'block', width: '100%' }} /></label>
      <label>País<input aria-label="País de la jornada" value={sessionForm.pais} onChange={(event) => change('pais', event.target.value)} placeholder="Ej. España" style={{ ...input, display: 'block', width: '100%' }} /></label>
      <label>Cupo<input aria-label="Cupo de la jornada" type="number" min="1" value={sessionForm.cupo} onChange={(event) => change('cupo', event.target.value)} required style={{ ...input, display: 'block', width: '100%' }} /></label>
      <label>Comienza<input aria-label="Inicio de la jornada" type="datetime-local" value={sessionForm.comienza_at} onChange={(event) => change('comienza_at', event.target.value)} required style={{ ...input, display: 'block', width: '100%' }} /></label>
      <label>Finaliza<input aria-label="Fin de la jornada" type="datetime-local" value={sessionForm.termina_at} onChange={(event) => change('termina_at', event.target.value)} style={{ ...input, display: 'block', width: '100%' }} /></label>
      <label>Estado<select aria-label="Estado de la jornada" value={sessionForm.estado} onChange={(event) => change('estado', event.target.value)} style={{ ...input, display: 'block', width: '100%' }}><option value="borrador">Borrador</option><option value="programada">Programada</option><option value="activa">Activa</option><option value="cerrada">Cerrada</option><option value="cancelada">Cancelada</option></select></label>
    </div>
    <div style={{ display: 'flex', gap: 8 }}><button type="submit" disabled={saving || (isSuperAdmin && !sessionForm.sede_id)}>{saving ? 'Guardando…' : editingSessionId ? 'Guardar cambios' : 'Crear jornada'}</button>{editingSessionId ? <button type="button" onClick={() => { setSessionForm(emptySession); setEditingSessionId(''); }}>Cancelar edición</button> : null}</div>
  </form>;
}
