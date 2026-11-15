import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link, useLocation, useParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useSafeTranslation} from '../i18n/tSafe';
import {consumePracticeControl, createNationsPracticeApi, practiceBoardId, practiceEventId, practiceRequestId} from '../utils/nationsPracticeApi';
import useNationsPracticeResource from '../hooks/useNationsPracticeResource';
import PracticeBoard from '../components/practice/PracticeBoard';
import {practiceCopy} from '../components/practice/practiceCopy';
import '../components/practice/PracticeNations.css';

function boardFrom(data) { return data?.board || data; }
function validBoard(data, boardId, eventId) {
  const board = boardFrom(data);
  if (!board || String(board.id) !== String(boardId) || String(board.torneo_id) !== String(eventId)) throw new Error('PRACTICE_WRONG_MATCH');
  return data;
}
function courtName(value, index, copy) { return `${copy.court} ${String(value ?? index + 1).replace(/^(?:cancha|court)\s*/i, '').trim()}`; }
function matchName(match, copy) {
  const a = match.equipo_a?.nombre || match.equipo_a_nombre || copy.teamA;
  const b = match.equipo_b?.nombre || match.equipo_b_nombre || copy.teamB;
  return `${a} · ${b}`;
}
function PageError({state, copy, refresh}) {
  const text = state === 'expired' ? copy.expired : state === 'forbidden' ? copy.forbidden : state === 'loading' ? copy.loading : copy.error;
  return <div className="np-message" role={state === 'loading' ? 'status' : 'alert'}><p>{text}</p>{state !== 'loading' && <button className="np-button" onClick={refresh}>{copy.retry}</button>}</div>;
}

/** The three route modes share one public source. Only control mode consumes a capability. */
export default function NationsPracticePage({mode = 'entry', api: suppliedApi}) {
  const {eventId, boardId} = useParams();
  const location = useLocation();
  const {session} = useAuth();
  const {language} = useSafeTranslation();
  const copy = practiceCopy(language);
  const api = useMemo(() => suppliedApi || createNationsPracticeApi(), [suppliedApi]);
  const control = mode === 'control';
  const validIds = useMemo(() => {
    try { practiceEventId(eventId); if (mode !== 'entry') practiceBoardId(boardId); return true; } catch { return false; }
  }, [eventId, boardId, mode]);
  const [credential, setCredential] = useState(() => ({boardId, token: control && validIds ? consumePracticeControl(boardId) : null}));
  useEffect(() => { setCredential({boardId, token: control && validIds ? consumePracticeControl(boardId) : null}); }, [boardId, control, validIds]);
  useEffect(() => { if (!control && new URLSearchParams(window.location.hash.slice(1)).has('control')) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`); }, [control]);
  const token = control && credential.boardId === boardId ? credential.token : null;
  const eventScope = useMemo(() => ({eventId, api}), [eventId, api]);
  const loadEvent = useCallback(signal => api.event(eventId, signal), [api, eventId]);
  const event = useNationsPracticeResource({scope: eventScope, load: loadEvent, enabled: validIds, interval: 15000});
  const scope = useMemo(() => ({eventId, boardId, token, control, api}), [eventId, boardId, token, control, api]);
  const loadBoard = useCallback(async signal => validBoard(control ? await api.control(boardId, token, signal) : await api.board(boardId, signal), boardId, eventId), [api, boardId, eventId, token, control]);
  const resource = useNationsPracticeResource({scope, load: loadBoard, enabled: validIds && mode !== 'entry' && (!control || Boolean(token))});
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(null), [notice, setNotice] = useState('');
  const [resetOpen, setResetOpen] = useState(false), [format, setFormat] = useState('groups');
  const active = useRef(scope), commandLock = useRef(null), commandController = useRef(null);
  active.current = scope;
  useEffect(() => {
    setBusy(false); setPending(null); setNotice(''); setResetOpen(false); commandLock.current = null;
    return () => commandController.current?.abort();
  }, [scope]);
  const data = resource.data;
  const board = boardFrom(data);
  const revision = Number(data?.revision ?? board?.practice_revision ?? board?.revision);
  async function command(kind, extra = {}, retryBody = null) {
    if (!token || commandLock.current || (!Number.isSafeInteger(revision) || revision < 0) || !board) return;
    const ownScope = scope;
    let body;
    try { body = retryBody || {kind, expectedRevision: revision, requestId: practiceRequestId(), ...extra}; } catch { setNotice(copy.commandError); return; }
    commandLock.current = ownScope; setBusy(true); setNotice('');
    const controller = new AbortController(); commandController.current = controller;
    const deadline = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await api.command(boardId, token, body, controller.signal);
      validBoard(result, boardId, eventId);
      if (active.current !== ownScope) return;
      setPending(null); setResetOpen(false);
      resource.publish({...data, ...result});
    } catch (error) {
      if (active.current !== ownScope) return;
      if (error.status === 409) { setPending(null); setNotice(copy.conflict); resource.refresh(); }
      else if (!error.status || error.status >= 500) { setPending(body); setNotice(copy.uncertain); resource.refresh(); }
      else { setPending(null); setNotice(error.status === 401 || error.status === 403 ? copy.forbidden : copy.commandError); resource.refresh(); }
    } finally {
      clearTimeout(deadline);
      if (active.current === ownScope) { commandLock.current = null; setBusy(false); }
    }
  }
  const canAct = resource.status === 'ready' && !resource.refreshing && !busy && !pending && Number.isSafeInteger(revision) && revision >= 0;
  const inProgress = board?.estado === 'en_curso';
  const paused = Boolean(board?.cronometro_pausado);
  const matches = event.data?.matches || [];
  const basePath = `/practica/nations/${encodeURIComponent(eventId)}`;
  return <main className="np-page" dir={['ar','fa','he'].some(code => String(language).startsWith(code)) ? 'rtl' : undefined}>
    <div className="np-shell"><header className="np-header"><img className="np-brand" src="/brand/padbol-match-logo-oficial.svg" alt="Padbol Match"/><h1>{copy.title}</h1><p>{copy.note}</p></header>
      {!validIds ? <PageError state="expired" copy={copy} refresh={() => {}}/> : mode === 'entry' ? <>
        <h2 className="np-entry-title">{copy.choose}</h2><p className="np-account">{copy.viewerLogin}</p>
        {!event.data ? <PageError state={event.status} copy={copy} refresh={event.refresh}/> : <div className="np-courts">{matches.map((match, index) => <article className="np-court-card" key={match.scoreboard_id}><span className="np-eyebrow">{courtName(match.cancha, index, copy)}</span><h2>{matchName(match, copy)}</h2><Link className="np-button np-button--gold" to={`${basePath}/partidos/${match.scoreboard_id}`}>{copy.view}</Link><Link className="np-text-link" to={`/scoreboard/${match.scoreboard_id}`} target="_blank" rel="noreferrer">{copy.tv}</Link></article>)}</div>}
      </> : <>
        <nav className="np-navigation" aria-label={copy.choose}><Link className="np-text-link" to={basePath}>← {copy.back}</Link>{!control && <div className="np-court-tabs">{matches.map((match, index) => <Link key={match.scoreboard_id} className={`np-court-tab ${match.scoreboard_id === boardId ? 'is-selected' : ''}`} aria-current={match.scoreboard_id === boardId ? 'page' : undefined} to={`${basePath}/partidos/${match.scoreboard_id}`}>{courtName(match.cancha, index, copy)}</Link>)}</div>}</nav>
        <h2 className="np-mode">{control ? copy.referee : copy.spectator}{board?.cancha ? ` · ${courtName(board.cancha, 0, copy)}` : ''}</h2>
        {!control && <p className="np-account">{session?.user ? copy.account : <>{copy.guest} <Link to={`/login?redirect=${encodeURIComponent(location.pathname)}`}>{copy.login}</Link></>}</p>}
        {control && !token ? <p className="np-message" role="alert">{copy.missingControl}</p> : !board ? <PageError state={resource.status} copy={copy} refresh={resource.refresh}/> : <>
          {!control && resource.status !== 'ready' && <button className="np-button" onClick={resource.refresh}>{copy.retry}</button>}
          <PracticeBoard board={board} status={resource.status} copy={copy}/>
          {control && <section className="np-controls" aria-label={copy.referee}>
            {notice && <div className="np-message" role="alert"><p>{notice}</p>{pending && <button className="np-button" disabled={busy} onClick={() => command(pending.kind, {}, pending)}>{copy.retrySame}</button>}</div>}
            {resource.refreshing && <p role="status">{copy.refreshing}</p>}
            {resource.status !== 'ready' && <button className="np-button" disabled={busy} onClick={resource.refresh}>{copy.retry}</button>}
            {board.estado === 'pendiente' ? <button className="np-button np-button--gold np-start" disabled={!canAct} onClick={() => command('start')}>{copy.start}</button> : <div className="np-point-buttons"><button className="np-button np-point np-point--a" disabled={!canAct || !inProgress || paused} onClick={() => command('point', {team:'A'})}>{copy.addA}</button><button className="np-button np-point np-point--b" disabled={!canAct || !inProgress || paused} onClick={() => command('point', {team:'B'})}>{copy.addB}</button></div>}
            <div className="np-action-row"><button className="np-button" disabled={!canAct || !inProgress} onClick={() => command(paused ? 'resume' : 'pause')}>{paused ? copy.resume : copy.pause}</button><button className="np-button" disabled={!canAct || board.estado === 'pendiente'} onClick={() => command('undo')}>{copy.undo}</button></div>
            <Substitutions data={data} revision={revision} copy={copy} disabled={!canAct} onCommand={command}/>
            <button className="np-text-button" disabled={!canAct} onClick={() => setResetOpen(true)}>{copy.reset}</button>
            {resetOpen && <div className="np-reset" role="alertdialog" aria-label={copy.resetConfirm}><p>{copy.resetConfirm}</p><label>{copy.format}<select value={format} onChange={e => setFormat(e.target.value)}><option value="groups">{copy.groups}</option><option value="knockout">{copy.knockout}</option></select></label><div className="np-action-row"><button className="np-button" disabled={busy} onClick={() => setResetOpen(false)}>{copy.cancel}</button><button className="np-button np-button--gold" disabled={!canAct} onClick={() => command('reset', {format})}>{copy.resetNow}</button></div></div>}
          </section>}
        </>}
      </>}
      <footer className="np-footer">{copy.note}</footer>
    </div>
  </main>;
}

function Substitutions({data, revision, copy, disabled, onCommand}) {
  const [team, setTeam] = useState('A'), [two, setTwo] = useState(false), [values, setValues] = useState(['','','','']);
  useEffect(() => { setValues(['','','','']); setTwo(false); }, [revision, team]);
  const players = Array.isArray(data?.lineups?.[team]) ? data.lineups[team] : [];
  const active = players.filter(player => player.on_court === true), bench = players.filter(player => player.on_court === false);
  const allowed = data?.substitution_window?.allowed === true;
  const count = two ? 2 : 1;
  const valid = values.slice(0,count * 2).every(Boolean) && new Set([values[0], ...(two ? [values[2]] : [])]).size === count && new Set([values[1], ...(two ? [values[3]] : [])]).size === count;
  const change = (index, value) => setValues(old => old.map((v,i) => i === index ? value : v));
  return <details className="np-substitutions"><summary>{copy.changes}</summary><p>{copy.changeHint}</p><label>{copy.team}<select value={team} onChange={e => setTeam(e.target.value)}><option value="A">{copy.teamA}</option><option value="B">{copy.teamB}</option></select></label>
    {[0, ...(two ? [1] : [])].map(index => <div className="np-action-row" key={index}><label>{copy.out} {index + 1}<select value={values[index*2]} disabled={disabled || !allowed} onChange={e => change(index*2,e.target.value)}><option value="">{copy.select}</option>{active.map(player => <option key={player.id} value={player.id}>{player.name || player.nombre}</option>)}</select></label><label>{copy.in} {index + 1}<select value={values[index*2+1]} disabled={disabled || !allowed} onChange={e => change(index*2+1,e.target.value)}><option value="">{copy.select}</option>{bench.map(player => <option key={player.id} value={player.id}>{player.name || player.nombre}</option>)}</select></label></div>)}
    <label className="np-checkbox"><input type="checkbox" checked={two} disabled={disabled || !allowed || active.length < 2 || bench.length < 2} onChange={e => setTwo(e.target.checked)}/>{copy.two}</label><button className="np-button" disabled={disabled || !allowed || !valid} onClick={() => onCommand('substitution', {team, swaps: Array.from({length:count},(_,index) => ({outId:values[index*2],inId:values[index*2+1]}))})}>{copy.apply}</button>
  </details>;
}
