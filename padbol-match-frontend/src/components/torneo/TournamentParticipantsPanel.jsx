import TournamentAccreditationPanel from './TournamentAccreditationPanel';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeTranslation } from '../../i18n/tSafe';
import { readTournamentParticipants, registerTournamentParticipants, tournamentParticipantRequest } from '../../utils/tournamentParticipantsApi';

export default function TournamentParticipantsPanel({ apiBaseUrl, torneoId, authenticated, authIdentityKey, onSignIn, onSaved }) {
  const { i18n } = useSafeTranslation();
  const en = String(i18n?.resolvedLanguage || i18n?.language || '').startsWith('en');
  const text = (es, english) => en ? english : es;
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [rows, setRows] = useState([]);
  const [includeCaptain, setIncludeCaptain] = useState(null);
  const [review, setReview] = useState(false);
  const [completionNames, setCompletionNames] = useState({});
  const epoch = useRef(0);
  const pending = useRef(false);
  const requests = useRef(new Map());
  const rowCounter = useRef(0);
  const createRow = (kind = 'plaza_pendiente') => ({ key: ++rowCounter.current, kind, name: '', participantId: '' });
  const refresh = useCallback(async (mine = epoch.current) => {
    const fresh = await readTournamentParticipants(apiBaseUrl, torneoId);
    if (mine === epoch.current) setCatalog(fresh);
    return fresh;
  }, [apiBaseUrl, torneoId]);

  useEffect(() => {
    epoch.current += 1;
    const mine = epoch.current;
    setCatalog(null); setError(''); setMessage(''); setName(''); setRows([]); setIncludeCaptain(null); setReview(false); setCompletionNames({});
    pending.current = false; setBusy(false); requests.current.clear();
    if (authenticated) {
      readTournamentParticipants(apiBaseUrl, torneoId).then(fresh => {
        if (mine !== epoch.current) return;
        setCatalog(fresh);
        const count = Math.max(0, fresh.limits.min_jugadores - (fresh.can_manage ? 0 : 1));
        setRows(Array.from({ length: count }, () => ({ key: ++rowCounter.current, kind: fresh.can_manage ? 'generico' : 'plaza_pendiente', name: '', participantId: '' })));
      }).catch(e => { if (mine === epoch.current) setError(e.message); });
    }
    return () => { epoch.current += 1; };
  }, [apiBaseUrl, torneoId, authenticated, authIdentityKey]);

  function requestId(key) {
    if (!requests.current.has(key)) requests.current.set(key, crypto.randomUUID());
    return requests.current.get(key);
  }

  async function perform(action, success, check) {
    if (pending.current) return;
    pending.current = true;
    const mine = epoch.current;
    setBusy(true); setError(''); setMessage('');
    let saved = false;
    try {
      const result = await action();
      saved = true;
      if (mine !== epoch.current) return;
      const fresh = await refresh(mine);
      if (mine !== epoch.current) return;
      if (check && !check(fresh, result)) throw new Error(text('El servidor aceptó la operación, pero no pudimos comprobarla al volver a consultar. No la repitas: recarga y revisa el estado.', 'The server accepted the operation, but the refreshed state could not be confirmed. Do not repeat it: refresh and check its status.'));
      setMessage(success);
      if (result.equipo?.id) {
        setName(''); setRows([]); setReview(false); requests.current.delete('registration');
        onSaved?.(result.equipo.id);
      }
    } catch (e) {
      if (mine === epoch.current) setError(saved ? text('La operación fue aceptada, pero falta comprobar su estado actualizado. Recarga antes de volver a guardar.', 'The operation was accepted, but its updated state has not been confirmed. Refresh before saving again.') : e.message);
    } finally {
      if (mine === epoch.current) { pending.current = false; setBusy(false); }
    }
  }

  function changed(nextRows) {
    setRows(nextRows); setReview(false); requests.current.delete('registration'); setMessage('');
  }

  if (!authenticated) return <section className="tournament-participants" aria-label={text('Inscribir un equipo', 'Register a team')}>
    <h2>{text('Inscribe tu equipo sin esperar invitaciones', 'Register your team without waiting for invitations')}</h2>
    <p>{text('Puedes registrar el equipo y completar a tus compañeros después. Quien aún no tiene cuenta puede participar sin quedar acreditado para el ranking oficial.', 'Register your team and complete your teammates later. A player without an account can participate without official ranking accreditation.')}</p>
    <button type="button" onClick={onSignIn}>{text('Iniciar sesión para inscribir', 'Sign in to register')}</button>
  </section>;

  if (!catalog) return <section className="tournament-participants" aria-label={text('Inscripción y participantes', 'Registration and participants')}>
    {error ? <><p role="alert">{error}</p><button type="button" onClick={() => { const mine = epoch.current; setError(''); void refresh(mine).catch(e => { if (mine === epoch.current) setError(e.message); }); }}>{text('Volver a consultar', 'Try again')}</button></> : <p role="status">{text('Consultando inscripciones…', 'Loading registrations…')}</p>}
  </section>;

  const captainIncluded = catalog.can_manage ? (includeCaptain ?? false) : true;
  const total = rows.length + (captainIncluded ? 1 : 0);
  const eligibleOptions = catalog.participants.filter(p => p.tipo_identidad !== 'plaza_pendiente' && !(captainIncluded && p.is_current_actor));
  const validRows = rows.every(r => r.kind === 'plaza_pendiente' || (r.kind === 'generico' ? r.name.trim() : r.participantId));
  const canReview = !busy && name.trim() && total > 0 && total <= catalog.limits.max_jugadores && validRows;
  const payload = () => ({ request_id: requestId('registration'), nombre: name.trim(), incluir_capitan: captainIncluded, participantes: rows.map(r => r.kind === 'existente' ? { participante_id: r.participantId } : { tipo_identidad: r.kind, ...(r.name.trim() ? { nombre: r.name.trim() } : {}) }) });
  const identityLabel = p => p.tipo_identidad === 'plaza_pendiente' ? text('Plaza por completar', 'Unfilled place') : p.estado_vinculacion === 'vinculado' ? text('Perfil vinculado', 'Linked profile') : text('Participante sin cuenta vinculada', 'Participant without a linked account');

  return <section className="tournament-participants" aria-label={text('Inscripción y participantes', 'Registration and participants')}>
    <h2>{catalog.can_manage ? text('Equipos y participantes', 'Teams and participants') : text('Inscribe tu equipo sin esperar invitaciones', 'Register your team without waiting for invitations')}</h2>
    <p>{text('La inscripción, el plantel para jugar y la acreditación para ranking se revisan por separado. Registrar un participante no crea una cuenta ni le otorga puntos oficiales.', 'Registration, playing roster and ranking accreditation are reviewed separately. Registering a participant does not create an account or grant official points.')}</p>
    {catalog.can_register ? <fieldset disabled={busy}>
      <legend>{text('Registrar un equipo', 'Register a team')}</legend>
      <label htmlFor="participant-team-name">{text('Nombre del equipo', 'Team name')}</label>
      <input id="participant-team-name" maxLength={80} value={name} onChange={e => { setName(e.target.value); setReview(false); requests.current.delete('registration'); }} />
      {catalog.can_manage ? <label className="participant-check"><input type="checkbox" checked={captainIncluded} disabled={!captainIncluded && total >= catalog.limits.max_jugadores} onChange={e => { setIncludeCaptain(e.target.checked); setReview(false); requests.current.delete('registration'); }} />{text('También participo como capitán', 'I also play as captain')}</label> : <p>{text('Tú quedas como capitán. No necesitas esperar la aceptación de tu compañero.', 'You are the captain. You do not need to wait for your teammate to accept.')}</p>}
      <p>{text(`Para jugar se necesitan al menos ${catalog.limits.min_jugadores} participantes identificados; el plantel admite hasta ${catalog.limits.max_jugadores}. Puedes registrar plazas pendientes.`, `Playing requires at least ${catalog.limits.min_jugadores} identified participants; the roster allows up to ${catalog.limits.max_jugadores}. You can register unfilled places.`)}</p>
      {rows.map((r, index) => <div className="participant-entry" key={r.key}>
        <label htmlFor={`participant-kind-${r.key}`}>{text(`Participante ${index + 1}`, `Participant ${index + 1}`)}</label>
        <select id={`participant-kind-${r.key}`} value={r.kind} onChange={e => changed(rows.map(x => x.key === r.key ? { ...x, kind: e.target.value, participantId: '', name: '' } : x))}>
          <option value="generico">{text('Agregar sin cuenta', 'Add without an account')}</option>
          <option value="plaza_pendiente">{text('Completar más adelante', 'Complete later')}</option>
          {eligibleOptions.length ? <option value="existente">{text('Elegir participante disponible', 'Choose available participant')}</option> : null}
        </select>
        {r.kind === 'existente' ? <><label htmlFor={`participant-existing-${r.key}`}>{text('Participante disponible', 'Available participant')}</label><select id={`participant-existing-${r.key}`} value={r.participantId} onChange={e => changed(rows.map(x => x.key === r.key ? { ...x, participantId: e.target.value } : x))}>
          <option value="">{text('Seleccionar', 'Select')}</option>{eligibleOptions.map(p => <option key={p.id} value={p.id} disabled={rows.some(x => x.key !== r.key && x.participantId === p.id)}>{p.nombre}</option>)}
        </select></> : r.kind === 'generico' ? <><label htmlFor={`participant-name-${r.key}`}>{text('Nombre para el torneo', 'Tournament display name')}</label><input id={`participant-name-${r.key}`} value={r.name} maxLength={160} onChange={e => changed(rows.map(x => x.key === r.key ? { ...x, name: e.target.value } : x))} /></> : <p>{text('Esta plaza no habilita a jugar hasta completar el nombre del participante.', 'This place cannot play until its participant is identified.')}</p>}
        <button type="button" onClick={() => changed(rows.filter(x => x.key !== r.key))}>{text('Quitar plaza', 'Remove place')}</button>
      </div>)}
      <button type="button" disabled={total >= catalog.limits.max_jugadores} onClick={() => changed([...rows, createRow(catalog.can_manage ? 'generico' : 'plaza_pendiente')])}>{text('Agregar participante o plaza', 'Add participant or place')}</button>
      {review ? <div className="participant-review" role="group" aria-label={text('Confirmar inscripción', 'Confirm registration')}>
        <strong>{name.trim()}</strong><p>{text(`${total} plazas registradas. El equipo puede quedar pendiente de completar para jugar. Esto no acredita ranking oficial.`, `${total} registered places. The team may still need completing before playing. This does not grant official ranking accreditation.`)}</p>
        <button type="button" onClick={() => void perform(() => registerTournamentParticipants(apiBaseUrl, torneoId, payload()), text('Inscripción guardada y comprobada. Puedes completar el plantel después.', 'Registration saved and confirmed. You can complete the roster later.'), (fresh, result) => fresh.teams.some(team => String(team.id) === String(result.equipo.id)))}>{text('Confirmar y registrar equipo', 'Confirm and register team')}</button>
        <button type="button" onClick={() => setReview(false)}>{text('Volver a editar', 'Back to editing')}</button>
      </div> : <button type="button" disabled={!canReview} onClick={() => setReview(true)}>{text('Revisar inscripción', 'Review registration')}</button>}
    </fieldset> : <p>{text('La inscripción está cerrada. Puedes consultar los equipos y sus estados.', 'Registration is closed. You can view teams and their status.')}</p>}
    <h3>{text('Inscripciones y planteles', 'Registrations and rosters')}</h3>
    {!catalog.teams.length ? <p>{text('Todavía no hay equipos inscritos.', 'No teams have registered yet.')}</p> : catalog.teams.map(team => <details className="participant-team" key={team.id}>
      <summary>{team.nombre} — {team.habilitacion_deportiva?.habilitado ? text('Plantel completo para jugar', 'Playing roster complete') : text('Plantel por completar', 'Roster to complete')}</summary>
      <p>{text('Inscripción registrada', 'Registration recorded')} · {team.habilitacion_deportiva?.habilitado ? text('Mínimo de participantes completo', 'Minimum roster complete') : text(`Faltan ${team.habilitacion_deportiva?.faltantes ?? '—'} participantes identificados`, `${team.habilitacion_deportiva?.faltantes ?? '—'} identified participants still needed`)}</p>
      <ul>{(team.participants || []).map(p => <li key={p.id}>
        <strong>{p.nombre || text('Plaza pendiente', 'Unfilled place')}</strong><span>{identityLabel(p)} · {p.ranking_oficial_elegible === true ? text('Elegible para ranking oficial', 'Eligible for official ranking') : text('Sin acreditación para ranking oficial', 'Not accredited for official ranking')}</span>
        {p.can_edit && p.tipo_identidad === 'plaza_pendiente' ? <div><label htmlFor={`complete-participant-${p.id}`}>{text('Completar nombre del participante', 'Complete participant name')}</label><input id={`complete-participant-${p.id}`} maxLength={160} value={completionNames[p.id] || ''} disabled={busy} onChange={e => setCompletionNames({ ...completionNames, [p.id]: e.target.value })} /><button type="button" disabled={busy || !completionNames[p.id]?.trim()} onClick={() => void perform(() => tournamentParticipantRequest(apiBaseUrl, torneoId, `/participantes/${p.id}`, { request_id: requestId(`complete:${p.id}:${completionNames[p.id]}`), nombre: completionNames[p.id].trim(), tipo_identidad: 'generico' }, 'PATCH'), text('Participante completado; su ranking continúa sin acreditar.', 'Participant completed; ranking remains unaccredited.'), fresh => fresh.participants.some(item => item.id === p.id && item.tipo_identidad === 'generico' && item.nombre === completionNames[p.id].trim()))}>{text('Guardar participante', 'Save participant')}</button></div> : null}
        {p.can_claim ? <button type="button" disabled={busy} onClick={() => void perform(() => tournamentParticipantRequest(apiBaseUrl, torneoId, `/participantes/${p.id}/vinculacion`, { request_id: requestId(`claim:${p.id}`) }), text('Solicitud enviada al club. La vinculación no acredita puntos por sí sola.', 'Request sent to the club. Linking does not grant points by itself.'), (fresh, result) => result.solicitud?.participante_id === p.id && fresh.link_requests?.some(item => item.id === result.solicitud.id && item.participante_id === p.id && item.estado === result.solicitud.estado))}>{text('Solicitar vinculación a mi perfil', 'Request link to my profile')}</button> : null}
      </li>)}</ul>
    </details>)}
    {catalog.can_manage && catalog.link_requests?.some(r => r.estado === 'pendiente') ? <section aria-label={text('Vinculaciones por revisar', 'Link requests to review')}><h3>{text('Vinculaciones por revisar', 'Link requests to review')}</h3><p>{text('Comprueba la identidad antes de aprobar. Vincular un perfil no acredita ranking ni asigna puntos anteriores.', 'Check identity before approving. Linking a profile does not grant ranking accreditation or previous points.')}</p>{catalog.link_requests.filter(r => r.estado === 'pendiente').map(r => <div className="participant-entry" key={r.id}><strong>{r.nombre_solicitante}</strong><span>{catalog.participants.find(p => p.id === r.participante_id)?.nombre || text('Participante del torneo', 'Tournament participant')}</span>{['aprobar', 'rechazar'].map(decision => <button key={decision} type="button" disabled={busy} onClick={() => void perform(() => tournamentParticipantRequest(apiBaseUrl, torneoId, `/vinculaciones/${r.id}/resolver`, { request_id: requestId(`resolve:${r.id}:${decision}`), decision }), text('Decisión guardada. La acreditación deportiva sigue siendo independiente.', 'Decision saved. Sports accreditation remains independent.'), fresh => fresh.link_requests?.some(item => item.id === r.id && item.estado === (decision === 'aprobar' ? 'aprobado' : 'rechazado')))}>{decision === 'aprobar' ? text('Aprobar vinculación', 'Approve link') : text('Rechazar solicitud', 'Reject request')}</button>)}</div>)}</section> : null}
    <TournamentAccreditationPanel key={`${torneoId}:${authIdentityKey || ''}`} catalog={catalog} busy={busy} text={text} perform={perform} requestId={requestId} request={(path, body) => tournamentParticipantRequest(apiBaseUrl, torneoId, path, body)} />
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    <button type="button" disabled={busy} onClick={() => { const mine = epoch.current; setError(''); void refresh(mine).catch(e => { if (mine === epoch.current) setError(e.message); }); }}>{text('Actualizar estado', 'Refresh status')}</button>
  </section>;
}
