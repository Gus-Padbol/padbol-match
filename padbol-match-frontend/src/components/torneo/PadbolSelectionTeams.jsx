import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeTranslation } from '../../i18n/tSafe';
import { confirmSelectionRegistration, createSelectionTeam, listSelectionTeams, readSelectionTeam, requestSelectionMembership, saveSelectionRoster } from '../../utils/padbolSelectionApi';
import { selectionPlayerId, selectionRosterPlayers, selectionTeamReady } from '../../utils/padbolSelectionRoster';
import './PadbolSelection.css';

function RosterEditor({ apiBaseUrl, torneoId, equipoId, userId, onChanged, en }) {
  const [data, setData] = useState(null);
  const [ids, setIds] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const live = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    let cancelled = false; live.current = true;
    readSelectionTeam({ apiBaseUrl, torneoId, equipoId }).then(dto => {
      if (cancelled) return; setData(dto); setIds(dto.jugadores.map(selectionPlayerId));
    }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; live.current = false; };
  }, [apiBaseUrl, torneoId, equipoId]);
  const editable = data?.can_manage === true;
  const toggle = id => { setIds(prev => prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id]); setNotice(''); };
  const search = async () => {
    if (data?.can_add_profiles !== true || query.trim().length < 2) return;
    setError('');
    try {
      const { getAuthHeaders } = await import('../../utils/scoreboardApi');
      const headers = await getAuthHeaders(); if (!headers.Authorization) throw new Error(en ? 'Sign in to search registered profiles.' : 'Inicia sesión para buscar perfiles registrados.');
      const response = await fetch(`${String(apiBaseUrl).replace(/\/+$/, '')}/api/jugadores/buscar?q=${encodeURIComponent(query.trim())}`, { headers });
      const json = await response.json().catch(() => null);
      const rows = Array.isArray(json) ? json : json?.jugadores;
      if (!response.ok || !Array.isArray(rows)) throw new Error(en ? 'The profile search could not be confirmed.' : 'No se pudo confirmar la búsqueda de perfiles.');
      if (live.current) setCandidates(rows.filter(player => selectionPlayerId(player)));
    } catch (err) { if (live.current) setError(err.message); }
  };
  const save = async event => {
    event.preventDefault();
    if (!editable || busy.current) return;
    if (!ids.includes(String(data.creador_id).toLowerCase()) || ids.length < 1 || ids.length > data.cupo_maximo) {
      setError(en ? 'Keep the captain and respect the roster capacity.' : 'Conserva al capitán y respeta el cupo del plantel.'); return;
    }
    busy.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const args = { apiBaseUrl, torneoId, equipoId };
      const saved = await saveSelectionRoster({ ...args, user_ids: ids, expected_revision: data.plantel_revision });
      const confirmed = await readSelectionTeam(args);
      if (confirmed.plantel_revision !== saved.plantel_revision || confirmed.jugadores.map(selectionPlayerId).sort().join() !== [...ids].sort().join()) throw new Error(en ? 'Reload the roster: the saved players could not be confirmed.' : 'Recarga el plantel: no se pudieron confirmar los jugadores guardados.');
      if (!live.current) return;
      setData(confirmed); setIds(confirmed.jugadores.map(selectionPlayerId)); setNotice(en ? 'Roster saved and verified.' : 'Plantel guardado y verificado.'); onChanged();
    } catch (err) { if (live.current) setError(err.message); }
    finally { busy.current = false; if (live.current) setSaving(false); }
  };
  const confirm = async () => {
    if (!editable || !data.can_confirm || busy.current) return;
    if (data.jugadores.map(selectionPlayerId).sort().join() !== [...ids].sort().join()) { setError(en ? 'Save the roster before confirming registration.' : 'Guarda el plantel antes de confirmar la inscripción.'); return; }
    busy.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const args = { apiBaseUrl, torneoId, equipoId };
      await confirmSelectionRegistration({ ...args, expected_revision: data.plantel_revision });
      const confirmed = await readSelectionTeam(args);
      if (confirmed.inscripcion_estado !== 'confirmado') throw new Error(en ? 'Registration could not be verified.' : 'No se pudo verificar la inscripción.');
      if (!live.current) return;
      setData(confirmed); setNotice(en ? 'Registration confirmed without payment.' : 'Inscripción confirmada sin pago.'); onChanged();
    } catch (err) { if (live.current) setError(err.message); }
    finally { busy.current = false; if (live.current) setSaving(false); }
  };
  const choices = new Map();
  [...(data?.jugadores || []), ...(data?.solicitudes || []), ...candidates].forEach(player => { const id = selectionPlayerId(player); if (id) choices.set(id, player); });
  return <form className="padbol-selection-team" onSubmit={save} aria-label={en ? 'Manage registered roster' : 'Gestionar plantel registrado'}>
    <h3>{en ? 'Registered roster' : 'Plantel registrado'}</h3>
    <p>{en ? 'The captain accepts requests from registered players. An authorized administrator can select existing profiles. The roster is separate from the four players declared for each match.' : 'El capitán acepta solicitudes de jugadores registrados. Un administrador autorizado puede seleccionar perfiles existentes. El plantel es independiente de los cuatro presentados de cada partido.'}</p>
    {data ? <fieldset disabled={!editable || saving}>{[...choices].map(([id, player]) => <label key={id}>
      <span><input type="checkbox" checked={ids.includes(id)} disabled={id === String(data.creador_id).toLowerCase()} onChange={() => toggle(id)} /> {player.nombre || (en ? 'Registered player' : 'Jugador registrado')}{id === String(data.creador_id).toLowerCase() ? (en ? ' · Captain' : ' · Capitán') : ''}</span>
    </label>)}</fieldset> : !error ? <p>{en ? 'Loading authoritative roster…' : 'Cargando plantel confirmado…'}</p> : null}
    {editable && data.can_add_profiles === true ? <div className="padbol-selection-actions"><label>{en ? 'Find registered profile' : 'Buscar perfil registrado'}<input value={query} onChange={event => setQuery(event.target.value)} disabled={saving} /></label><button type="button" onClick={search} disabled={saving || query.trim().length < 2}>{en ? 'Search' : 'Buscar'}</button></div> : null}
    {editable ? <button type="submit" disabled={saving}>{saving ? (en ? 'Saving…' : 'Guardando…') : (en ? 'Save roster' : 'Guardar plantel')}</button> : null}
    {data?.inscripcion_estado === 'confirmado' ? <p>{en ? 'Tournament registration confirmed.' : 'Inscripción al torneo confirmada.'}</p> : data ? <p>{en ? 'Tournament registration is not yet confirmed.' : 'La inscripción al torneo todavía no está confirmada.'}</p> : null}
    {editable && data.can_confirm && data.inscripcion_estado !== 'confirmado' ? <button type="button" disabled={saving} onClick={confirm}>{en ? 'Confirm free registration' : 'Confirmar inscripción sin costo'}</button> : null}
    {error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
  </form>;
}
export default function PadbolSelectionTeams({ apiBaseUrl, torneo, userId, profileReady = false, onCompleteProfile, onSignIn }) {
  const { i18n } = useSafeTranslation(); const en = String(i18n?.language || '').startsWith('en');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listConfirmed, setListConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [nombre, setNombre] = useState(''); const [cupo, setCupo] = useState(8); const [abierto, setAbierto] = useState(true);
  const [saving, setSaving] = useState(false); const [selected, setSelected] = useState(null);
  const live = useRef(true); const busy = useRef(false); const loadGeneration = useRef(0);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    if (!userId) { setLoading(false); return; }
    setLoading(true); setListConfirmed(false); setError('');
    try {
      const rows = await listSelectionTeams({ apiBaseUrl, torneoId: torneo.id });
      if (live.current && generation === loadGeneration.current) { setTeams(rows); setListConfirmed(true); }
    } catch (err) { if (live.current && generation === loadGeneration.current) setError(err.message); }
    finally { if (live.current && generation === loadGeneration.current) setLoading(false); }
  }, [apiBaseUrl, torneo.id, userId]);
  useEffect(() => { live.current = true; void load(); return () => { live.current = false; loadGeneration.current++; }; }, [load]);
  const own = teams.find(team => String(team.creador_id) === String(userId) || selectionRosterPlayers(team.jugadores).some(player => selectionPlayerId(player) === String(userId).toLowerCase()));
  const registrationOpen = ['planificacion', 'proximo', 'abierto', 'inscripcion_abierta'].includes(String(torneo.estado));
  const create = async event => {
    event.preventDefault();
    if (!listConfirmed || !userId || own || !profileReady || !registrationOpen || busy.current) return;
    busy.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const result = await createSelectionTeam({ apiBaseUrl, torneoId: torneo.id, nombre, cupo_maximo: Number(cupo), equipo_abierto: abierto });
      if (!live.current) return;
      setSelected(result.equipo_id); setNotice(en ? 'Team created. Complete its confirmed roster before playing.' : 'Equipo creado. Completa el plantel confirmado antes de jugar.'); await load();
    } catch (err) { if (live.current) setError(err.message); }
    finally { busy.current = false; if (live.current) setSaving(false); }
  };
  const request = async team => {
    if (!listConfirmed || !userId || own || !profileReady || !registrationOpen || busy.current || team.equipo_abierto !== true) return;
    busy.current = true; setSaving(true); setError(''); setNotice('');
    try {
      await requestSelectionMembership({ apiBaseUrl, torneoId: torneo.id, equipoId: team.id });
      if (!live.current) return;
      setNotice(en ? 'Request recorded. The captain must accept it; you are not yet a confirmed roster member.' : 'Solicitud registrada. El capitán debe aceptarla; todavía no formas parte del plantel confirmado.'); await load();
    } catch (err) { if (live.current) setError(err.message); }
    finally { busy.current = false; if (live.current) setSaving(false); }
  };
  return <section className="padbol-selection" aria-label={en ? 'Selection roster registration' : 'Inscripción de planteles de selección'}>
    <h2>{en ? 'Selection roster (up to eight)' : 'Plantel de selección (hasta ocho)'}</h2>
    <p>{en ? 'At least four confirmed players are needed; filling all eight places is optional. Each match declares exactly two starting players and two substitutes. Only two play on court at a time, with changes in odd-numbered games.' : 'Se necesitan al menos cuatro jugadores confirmados; completar las ocho plazas es opcional. En cada partido se presentan exactamente dos iniciales y dos suplentes. Siempre juegan dos en cancha, con alternancia en los games impares.'}</p>
    {!userId ? <button type="button" onClick={onSignIn}>{en ? 'Sign in' : 'Iniciar sesión'}</button> : !profileReady ? <button type="button" onClick={onCompleteProfile}>{en ? 'Complete your profile before registering' : 'Completar perfil antes de inscribirse'}</button> : null}
    {listConfirmed && userId && profileReady && !own && registrationOpen && !loading ? <form onSubmit={create} aria-label={en ? 'Create selection team' : 'Crear equipo de selección'}>
      <fieldset disabled={saving}><label>{en ? 'Team name' : 'Nombre del equipo'}<input required maxLength={120} value={nombre} onChange={event => setNombre(event.target.value)} /></label>
      <label>{en ? 'Maximum roster capacity' : 'Cupo máximo del plantel'}<select value={cupo} onChange={event => setCupo(Number(event.target.value))}>{[4,5,6,7,8].map(value => <option value={value} key={value}>{value}</option>)}</select></label>
      <label><span><input type="checkbox" checked={abierto} onChange={event => setAbierto(event.target.checked)} /> {en ? 'Accept joining requests' : 'Aceptar solicitudes para integrar el plantel'}</span></label></fieldset>
      {!abierto ? <p>{en ? 'A closed roster requires an authorized administrator to add existing profiles.' : 'Un plantel cerrado requiere que un administrador autorizado incorpore perfiles existentes.'}</p> : null}
      <button type="submit" disabled={saving}>{en ? 'Create my team' : 'Crear mi equipo'}</button>
    </form> : null}
    <div className="padbol-selection-actions"><button type="button" onClick={load} disabled={loading || saving || !userId}>{en ? 'Reload teams' : 'Recargar equipos'}</button></div>
    {loading ? <p role="status">{en ? 'Loading teams…' : 'Cargando equipos…'}</p> : null}
    {error ? <p role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    {!loading && !error && userId && !teams.length ? <p>{en ? 'No teams are registered yet.' : 'Todavía no hay equipos registrados.'}</p> : null}
    <div className="padbol-selection-grid">{teams.map(team => <article className="padbol-selection-team" key={team.id}>
      <h3>{team.nombre}</h3><p>{team.inscripcion_estado === 'confirmado' ? (en ? 'Registration confirmed' : 'Inscripción confirmada') : (en ? 'Registration pending' : 'Inscripción pendiente')}</p><p>{selectionRosterPlayers(team.jugadores).length} / {team.cupo_maximo} {en ? 'roster places' : 'plazas del plantel'}</p>
      <p>{selectionTeamReady(team, torneo) ? (en ? 'At least four confirmed players. The match lineup still needs to be declared.' : 'Al menos cuatro jugadores confirmados. Falta declarar la alineación de cada partido.') : (en ? 'Roster still forming: at least four confirmed players are required.' : 'Plantel en formación: se requieren al menos cuatro jugadores confirmados.')}</p>
      <ul>{selectionRosterPlayers(team.jugadores).map(player => <li key={selectionPlayerId(player)}>{player.nombre || (en ? 'Registered player' : 'Jugador registrado')}</li>)}</ul>
      {team.can_manage === true ? <button type="button" onClick={() => setSelected(team.id)} disabled={saving}>{en ? 'Manage roster' : 'Gestionar plantel'}</button> : null}
      {!own && userId && profileReady && registrationOpen && team.equipo_abierto === true ? <button type="button" onClick={() => request(team)} disabled={!listConfirmed || saving || selectionRosterPlayers(team.jugadores).length >= team.cupo_maximo}>{en ? 'Request a roster place' : 'Solicitar lugar en el plantel'}</button> : null}
    </article>)}</div>
    {selected && userId ? <RosterEditor key={`${torneo.id}:${selected}`} apiBaseUrl={apiBaseUrl} torneoId={torneo.id} equipoId={selected} userId={userId} onChanged={load} en={en} /> : null}
    <p>{en ? 'Roster confirmation and match lineups do not award official FIPA points or authorize payments.' : 'Confirmar el plantel y declarar alineaciones no adjudica puntos oficiales FIPA ni autoriza pagos.'}</p>
  </section>;
}
