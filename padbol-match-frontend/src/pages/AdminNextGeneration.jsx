import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { getApiBaseUrl } from '../utils/apiPublicBaseUrl';
import './AdminNextGeneration.css';

const BASE = `${getApiBaseUrl()}/api/admin/next-generation`;
const EMPTY_SESSION = { nombre: '', fecha_hora: '', coach: '', categoria: 'U14', cupo: 24, canchas: 1 };
const EMPTY_GROUP = { nombre: '', coach: '', categoria: 'U14' };

async function readJson(response) {
  try { return await response.json(); } catch (_error) { return {}; }
}

export default function AdminNextGeneration() {
  const { session } = useAuth();
  const role = useUserRole(session?.user || null);
  const [superSede, setSuperSede] = useState('');
  const sedeId = role.rol === 'super_admin' ? Number(superSede) || null : role.sedeId;
  const [jornadas, setJornadas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [inscripciones, setInscripciones] = useState([]);
  const [resumen, setResumen] = useState({ confirmado: 0, espera: 0, cancelado: 0 });
  const [sessionForm, setSessionForm] = useState(EMPTY_SESSION);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const token = session?.access_token;

  const call = useCallback(async (path, options = {}) => {
    if (!token) throw new Error('La sesión no está disponible.');
    const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${BASE}${path}`, { ...options, headers, cache: 'no-store' });
    const body = await readJson(response);
    if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
    return body;
  }, [token]);

  const reload = useCallback(async () => {
    if (!sedeId) return;
    setError('');
    try {
      const query = `?sede_id=${encodeURIComponent(sedeId)}`;
      const [sessionsBody, groupsBody] = await Promise.all([call(`/jornadas${query}`), call(`/grupos${query}`)]);
      setJornadas(sessionsBody.jornadas || []);
      setGrupos(groupsBody.grupos || []);
    } catch (loadError) { setError(loadError.message); }
  }, [call, sedeId]);

  useEffect(() => { reload(); }, [reload]);

  async function loadRegistrations(jornada) {
    setSelected(jornada);
    setError('');
    try {
      const body = await call(`/jornadas/${jornada.id}/inscripciones`);
      setInscripciones(body.inscripciones || []);
      setResumen(body.resumen || { confirmado: 0, espera: 0, cancelado: 0 });
    } catch (loadError) { setError(loadError.message); }
  }

  async function createSession(event) {
    event.preventDefault();
    setError(''); setFeedback('');
    try {
      await call(editingSessionId ? `/jornadas/${editingSessionId}` : '/jornadas', { method: editingSessionId ? 'PATCH' : 'POST', body: JSON.stringify(editingSessionId ? sessionForm : { ...sessionForm, sede_id: sedeId }) });
      setSessionForm(EMPTY_SESSION); setEditingSessionId(null); setFeedback(editingSessionId ? 'Jornada actualizada.' : 'Jornada creada en borrador.'); await reload();
    } catch (actionError) { setError(actionError.message); }
  }

  async function setSessionState(jornada, estado) {
    setError('');
    try { await call(`/jornadas/${jornada.id}`, { method: 'PATCH', body: JSON.stringify({ estado }) }); setFeedback(`Jornada ${estado}.`); await reload(); }
    catch (actionError) { setError(actionError.message); }
  }

  async function setAttendance(registration, asistencia) {
    try {
      await call(`/inscripciones/${registration.id}/asistencia`, { method: 'PATCH', body: JSON.stringify({ asistencia }) });
      await loadRegistrations(selected);
    } catch (actionError) { setError(actionError.message); }
  }

  async function createGroup(event) {
    event.preventDefault();
    try { await call('/grupos', { method: 'POST', body: JSON.stringify({ ...groupForm, sede_id: sedeId }) }); setGroupForm(EMPTY_GROUP); setFeedback('Grupo de continuidad creado.'); await reload(); }
    catch (actionError) { setError(actionError.message); }
  }

  async function setGroupState(group, estado) {
    try { await call(`/grupos/${group.id}`, { method: 'PATCH', body: JSON.stringify({ estado }) }); setFeedback(`Grupo ${estado}.`); await reload(); }
    catch (actionError) { setError(actionError.message); }
  }

  async function addToGroup(registration) {
    if (!selectedGroupId) return setError('Selecciona un grupo de continuidad.');
    try { await call(`/grupos/${selectedGroupId}/miembros/${registration.id}`, { method: 'PUT' }); setFeedback(`${registration.nombre} fue agregado al grupo.`); await reload(); }
    catch (actionError) { setError(actionError.message); }
  }

  function editSession(jornada) {
    setEditingSessionId(jornada.id);
    setSessionForm({ nombre: jornada.nombre, fecha_hora: String(jornada.fecha_hora || '').slice(0, 16), coach: jornada.coach, categoria: jornada.categoria, cupo: jornada.cupo, canchas: jornada.canchas });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const canOperate = useMemo(() => ['super_admin', 'admin_club', 'empleado'].includes(role.rol), [role.rol]);
  if (role.loading) return <main className="ng-admin"><p>Cargando permisos…</p></main>;
  if (!canOperate) return <main className="ng-admin"><h1>FIPA Next Generation</h1><p>No tienes permiso para operar este módulo.</p></main>;

  return (
    <main className="ng-admin">
      <Link to="/admin" className="ng-admin__back">← Volver al panel</Link>
      <header><p>FIPA NEXT GENERATION · OPERACIÓN DE SEDE</p><h1>Jornadas y continuidad</h1><span>Crea, publica y controla la asistencia sin salir del ámbito de tu sede.</span></header>
      {role.rol === 'super_admin' && <label className="ng-admin__sede">Sede a administrar<input inputMode="numeric" value={superSede} onChange={(event) => setSuperSede(event.target.value)} /></label>}
      <div aria-live="polite">{error && <p role="alert" className="ng-admin__error">{error}</p>}{feedback && <p className="ng-admin__success">{feedback}</p>}</div>
      {!sedeId ? <p>Selecciona una sede para comenzar.</p> : <>
        <section className="ng-admin__grid">
          <form onSubmit={createSession} className="ng-admin__panel"><h2>{editingSessionId ? 'Editar jornada' : 'Nueva jornada'}</h2>
            <label>Nombre<input required value={sessionForm.nombre} onChange={(e) => setSessionForm({ ...sessionForm, nombre: e.target.value })} /></label>
            <label>Fecha y hora<input required type="datetime-local" value={sessionForm.fecha_hora} onChange={(e) => setSessionForm({ ...sessionForm, fecha_hora: e.target.value })} /></label>
            <label>Coach<input required value={sessionForm.coach} onChange={(e) => setSessionForm({ ...sessionForm, coach: e.target.value })} /></label>
            <label>Categoría<select value={sessionForm.categoria} onChange={(e) => setSessionForm({ ...sessionForm, categoria: e.target.value })}><option>U14</option><option>U16</option><option>U18</option></select></label>
            <label>Cupo<input required type="number" min="1" max="500" value={sessionForm.cupo} onChange={(e) => setSessionForm({ ...sessionForm, cupo: Number(e.target.value) })} /></label>
            <label>Canchas<input required type="number" min="1" max="50" value={sessionForm.canchas} onChange={(e) => setSessionForm({ ...sessionForm, canchas: Number(e.target.value) })} /></label>
            <button type="submit">{editingSessionId ? 'Guardar cambios' : 'Crear borrador'}</button>
            {editingSessionId && <button type="button" onClick={() => { setEditingSessionId(null); setSessionForm(EMPTY_SESSION); }}>Cancelar edición</button>}
          </form>
          <form onSubmit={createGroup} className="ng-admin__panel"><h2>Grupo de continuidad</h2>
            <label>Nombre<input required value={groupForm.nombre} onChange={(e) => setGroupForm({ ...groupForm, nombre: e.target.value })} /></label>
            <label>Coach<input required value={groupForm.coach} onChange={(e) => setGroupForm({ ...groupForm, coach: e.target.value })} /></label>
            <label>Categoría<select value={groupForm.categoria} onChange={(e) => setGroupForm({ ...groupForm, categoria: e.target.value })}><option>U14</option><option>U16</option><option>U18</option></select></label>
            <button type="submit">Crear grupo</button>
            <ul>{grupos.map((group) => <li key={group.id}><strong>{group.nombre}</strong> · {group.categoria} · {group.coach} · {group.estado} {group.estado === 'activo' && <button type="button" onClick={() => setGroupState(group, 'cerrado')}>Cerrar</button>}</li>)}</ul>
          </form>
        </section>
        <section className="ng-admin__panel"><h2>Jornadas</h2><div className="ng-admin__cards">{jornadas.map((jornada) => <article key={jornada.id}><span>{jornada.categoria} · {jornada.estado}</span><h3>{jornada.nombre}</h3><p>{new Date(jornada.fecha_hora).toLocaleString()} · {jornada.coach}</p><p>Cupo {jornada.cupo} · {jornada.canchas} cancha(s)</p><div><button onClick={() => loadRegistrations(jornada)}>Participantes</button><button onClick={() => editSession(jornada)}>Editar</button>{jornada.estado === 'borrador' && <button onClick={() => setSessionState(jornada, 'publicada')}>Publicar</button>}{jornada.estado !== 'cerrada' && <button onClick={() => setSessionState(jornada, 'cerrada')}>Cerrar</button>}</div></article>)}</div></section>
        {selected && <section className="ng-admin__panel"><h2>Participantes · {selected.nombre}</h2><div className="ng-admin__summary"><b>{resumen.confirmado} confirmados</b><b>{resumen.espera} en espera</b><b>{resumen.cancelado} cancelados</b></div><label>Grupo de continuidad<select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}><option value="">Seleccionar grupo</option>{grupos.filter((group) => group.estado === 'activo' && group.categoria === selected.categoria).map((group) => <option key={group.id} value={group.id}>{group.nombre}</option>)}</select></label><div className="ng-admin__table">{inscripciones.map((registration) => <article key={registration.id}><div><strong>{registration.nombre}</strong><span>{registration.estado} · asistencia {registration.asistencia}</span></div><div><button onClick={() => setAttendance(registration, 'presente')}>Presente</button><button onClick={() => setAttendance(registration, 'ausente')}>Ausente</button>{registration.estado === 'confirmado' && <button onClick={() => addToGroup(registration)}>Agregar al grupo</button>}</div></article>)}</div></section>}
      </>}
    </main>
  );
}
