import {useNationsOperatorText} from '../utils/nationsOperatorText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createNationsOperatorApi } from '../utils/nationsOperatorApi';
import { nationsCupScheduleInstant, nationsCupScheduleLocal } from '../utils/nationsCupScheduleTime';
import './NationsOperator.css';
import NationsContingencyScoreboard from '../components/scoreboard/NationsContingencyScoreboard';
export default function NationsOperatorDashboard() {
 const t=useNationsOperatorText();
  const {
    session
  } = useAuth();
  const token = session?.access_token || '';
 const isGiacomoContingency = String(session?.user?.email || '').trim().toLowerCase() === 'giacomo.caneschi23@gmail.com';
  const api = useMemo(() => createNationsOperatorApi(token), [token]);
  const [data, setData] = useState(null),
    [matchId, setMatchId] = useState(''),
    [court, setCourt] = useState(''),
    [manualSets, setManualSets] = useState([{a:'',b:''},{a:'',b:''},{a:'',b:''}]),
    [date, setDate] = useState(''),
    [duration, setDuration] = useState('60'),
    [lineups, setLineups] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [control, setControl] = useState(null);
  const generation = useRef(0),
    pending = useRef(false);
  useEffect(() => {
    const mine = ++generation.current,
      controller = new AbortController();
    setData(null);
    setControl(null);
    setError('');
    setNotice('');
    pending.current = false;
    setBusy(false);
    if (token) api.dashboard(controller.signal).then(result => {
      if (mine === generation.current) {
        setData(result);
        setMatchId(String(result.partidos?.[0]?.id || ''));
      }
    }).catch(e => {
      if (e.name !== 'AbortError' && mine === generation.current) setError(e.message);
    });
    return () => {
      generation.current = mine + 1;
      controller.abort();
    };
  }, [api, token]);
  const match = data?.partidos?.find(item => String(item.id) === matchId);
  const teams = useMemo(() => data?.equipos?.filter(team => [String(match?.equipo_a_id), String(match?.equipo_b_id)].includes(String(team.id))) || [], [data, match?.equipo_a_id, match?.equipo_b_id]);
  useEffect(() => {
    setControl(null);
    setCourt(String(match?.cancha_id || ''));
    setDate(nationsCupScheduleLocal(match?.fecha_hora, data?.timezone));
    const next = {};
    for (const team of teams) {
      const saved = data?.alineaciones?.find(row => String(row.partido_id) === matchId && String(row.equipo_id) === String(team.id));
      next[team.id] = {
        iniciales: saved?.iniciales || [],
        suplentes: saved?.suplentes || [],
        expected_revision: Number(saved?.revision || 0)
      };
    }
    setLineups(next);
  }, [matchId, data, teams, match]);
  async function execute(action) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setControl(null);
    const mine = generation.current;
    try {
      const result = await action();
      if (mine !== generation.current) return;
      if (result?.control_path) {
        if (!/^\/scoreboard\/control\/[A-Za-z0-9_-]+$/.test(result.control_path)) throw Error(t("Control privado no confirmado."));
        setControl({
          matchId,
          path: result.control_path
        });
        setNotice(t("Control privado preparado. S\xF3lo debe tenerlo el \xE1rbitro."));
      } else {
        const fresh = result?.partidos ? result : await api.dashboard();
        if (mine === generation.current) {
          setData(fresh);
          setNotice(t("Operaci\xF3n confirmada."));
        }
      }
    } catch (e) {
      if (mine === generation.current) setError(e.message);
    } finally {
      if (mine === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  const editable = match && ['pendiente', 'programado'].includes(match.estado) && !match?.scoreboards?.[0],
    board = match?.scoreboards?.[0];
  const savedLineupsReady = teams.length === 2 && teams.every(team => {
    const saved = data?.alineaciones?.find(row => String(row.partido_id) === matchId && String(row.equipo_id) === String(team.id));
    return saved && Array.isArray(saved.iniciales) && saved.iniciales.length === 2 && Array.isArray(saved.suplentes) && saved.suplentes.length <= 2;
  });
  const choose = (teamId, kind, id) => setLineups(old => {
    const current = old[teamId],
      other = kind === 'iniciales' ? 'suplentes' : 'iniciales',
      list = current[kind].includes(id) ? current[kind].filter(value => value !== id) : [...current[kind], id];
    return {
      ...old,
      [teamId]: {
        ...current,
        [kind]: list,
        [other]: current[other].filter(value => value !== id)
      }
    };
  });
  const updateManualSet = (index, side, value) => setManualSets(list => list.map((set, i) => i === index ? {...set, [side]: value} : set));
  const manualPayload = () => {
    const sets = manualSets.map(set => ({a:set.a === '' ? null : Number(set.a), b:set.b === '' ? null : Number(set.b)})).filter(set => set.a != null || set.b != null);
    if (sets.length < 2) throw new Error(t('Completa los games de los dos primeros sets.'));
    if (sets.some(set => !Number.isInteger(set.a) || !Number.isInteger(set.b) || set.a < 0 || set.b < 0 || set.a === set.b)) throw new Error(t('Cada set debe tener games completos y sin empate.'));
    const first = sets.slice(0,2), split = first.some(set => set.a > set.b) && first.some(set => set.b > set.a);
    if (sets.length === 3 && !split) throw new Error(t('El tercer set sólo se usa si los dos primeros quedaron 1–1.'));
    if (sets.length === 2) {
      if (!split && sets[0].a > sets[0].b && sets[1].a > sets[1].b) return {goles_a:2,goles_b:0,historial_sets:sets};
      if (!split && sets[0].b > sets[0].a && sets[1].b > sets[1].a) return {goles_a:0,goles_b:2,historial_sets:sets};
      throw new Error(t('El resultado debe cerrar 2–0 en dos sets.'));
    }
    const third = sets[2], groupPhase = Boolean(match?.grupo);
    if (groupPhase && Math.max(third.a, third.b) !== 10) throw new Error(t('El super tiebreak debe terminar 10–n.'));
    return {goles_a:sets.filter(set=>set.a>set.b).length,goles_b:sets.filter(set=>set.b>set.a).length,historial_sets:sets.map((set,index)=>index===2?(groupPhase?{a:set.a>set.b?1:0,b:set.b>set.a?1:0,type:'super_tiebreak',points_a:set.a,points_b:set.b}:set):set)};
  };
  return <main className="nations-operator"><header><p className="nations-operator__eyebrow">{t("Operaci\xF3n exclusiva del torneo")}</p><h1>{t("Nations Cup \xB7 N\xE1poles 2026")}</h1><p>{t("Acceso limitado al torneo 57. Las cuentas, sedes y rankings generales quedan fuera de este panel.")}</p></header>
 {!token ? <p role="alert">{t("Inicia sesi\xF3n con la cuenta habilitada por la organizaci\xF3n.")}</p> : !data && !error ? <p role="status">{t("Comprobando tu acceso al torneo\u2026")}</p> : null}
 {error && <p role="alert" className="nations-operator__error">{error}</p>}{notice && <p role="status">{notice}</p>}
 {data && <>
 {isGiacomoContingency ? <NationsContingencyScoreboard courts={data.canchas} /> : null}<div className="nations-operator__toolbar"><label>{t("Partido")}<select value={matchId} disabled={busy} onChange={e => setMatchId(e.target.value)}>{data.partidos.map(item => <option key={item.id} value={item.id}>{data.equipos.find(team => String(team.id) === String(item.equipo_a_id))?.nombre || t('Por definir')} — {data.equipos.find(team => String(team.id) === String(item.equipo_b_id))?.nombre || t('Por definir')} · {item.grupo || t('Eliminatoria')} · {t(item.estado)}</option>)}</select></label><button disabled={busy} onClick={() => execute(() => api.dashboard())}>{t("Actualizar estado")}</button></div>
      {data.partidos.find(p => String(p.id) === String(matchId))?.scoreboards?.length === 0 ? <section className="nations-operator__private"><h2>{t("Resultado manual")}</h2><p>{t("Sólo si el partido ya se jugó y tienes la planilla del partido. No inventes ni modifiques un resultado oficial sin planilla.")}</p>{[0,1,2].map(index=><div key={index}><strong>{index===2?t("Set 3 · TB10"):`${t("Set")} ${index+1}`}</strong><label>{t("Equipo A")}<input aria-label={`${index===2?t("Set 3 · TB10"):`${t("Set")} ${index+1}`} ${t("Equipo A")}`} type="number" min="0" value={manualSets[index].a} onChange={e=>updateManualSet(index,'a',e.target.value)} /></label><label>{t("Equipo B")}<input aria-label={`${index===2?t("Set 3 · TB10"):`${t("Set")} ${index+1}`} ${t("Equipo B")}`} type="number" min="0" value={manualSets[index].b} onChange={e=>updateManualSet(index,'b',e.target.value)} /></label></div>)}<button disabled={busy} onClick={() => {try{const body=manualPayload();execute(()=>api.manualResult(matchId,body));}catch(e){setError(e.message);}}}>{t("Cargar resultado desde planilla")}</button></section> : null}
 {match && <><section><h2>{teams.map(team => team.nombre).join(' — ')}</h2><p>{t("Estado:")} {t(match.estado)}. {t("Horarios en")} {data.timezone}. {t("El horario previsto nunca inicia el partido automáticamente.")}</p>
 <label>{t("Cancha")}<select disabled={busy} value={court} onChange={e => setCourt(e.target.value)}><option value="">{t("Seleccionar cancha")}</option>{data.canchas.map(item => <option key={item.id} value={item.id}>{item.nombre || `${t("Cancha")} ${item.orden}`}</option>)}</select></label>
 {editable && !board && <details><summary>{t("Programaci\xF3n del encuentro")}</summary><label>{t("Fecha y hora")}<input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} disabled={busy} /></label><label>{t("Duraci\xF3n prevista (minutos)")}<input type="number" min="1" max="720" value={duration} onChange={e => setDuration(e.target.value)} disabled={busy} /></label><button disabled={busy || !date || !court} onClick={() => execute(() => api.schedule({
              expected_revision: data.revision,
              request_id: crypto.randomUUID(),
              matches: [{
                partido_id: Number(matchId),
                court_id: Number(court),
                fecha_hora: nationsCupScheduleInstant(date, data.timezone),
                duration_minutes: Number(duration)
              }]
            }))}>{t("Guardar programaci\xF3n")}</button></details>}
 {board ? <div className="nations-operator__actions"><a href={`/scoreboard/${encodeURIComponent(board.id)}`} target="_blank" rel="noreferrer">{t("Abrir pantalla p\xFAblica")}</a><button disabled={busy} onClick={() => {
              if (window.confirm(t("Se crear\xE1 un control nuevo. El enlace anterior dejar\xE1 de funcionar. \xBFContinuar?"))) execute(() => api.control(matchId));
            }}>{t("Crear o renovar control privado")}</button><button disabled={busy} onClick={() => {
              if (window.confirm(t("El \xE1rbitro perder\xE1 el acceso con el enlace actual. \xBFRevocar?"))) execute(() => api.revokeControl(matchId));
            }}>{t("Revocar control del \xE1rbitro")}</button></div> : <div>{!savedLineupsReady ? <p role="status">{t("Guarda y confirma ambas alineaciones antes de preparar el marcador.")}</p> : null}<button disabled={busy || !editable || !court || !savedLineupsReady} onClick={() => execute(() => api.open(matchId, court))}>{t("Preparar marcador en la cancha elegida")}</button></div>}
 {control?.matchId === matchId && <aside className="nations-operator__private"><strong>{t("Enlace privado: s\xF3lo para el \xE1rbitro")}</strong><a href={control.path} target="_blank" rel="noreferrer" referrerPolicy="no-referrer">{t("Abrir control del \xE1rbitro")}</a><button onClick={async()=>{const mine=generation.current;try{await navigator.clipboard.writeText(window.location.origin+control.path);if(mine===generation.current)setNotice(t('Enlace privado copiado. Compártelo únicamente con el árbitro.'));}catch{if(mine===generation.current)setError(t('No se pudo copiar. Abre el control y copia su dirección.'));}}}>{t("Copiar enlace privado")}</button></aside>}
 </section>
 <section><h2>{t("Convocados y alineaciones")}</h2><p>{t("Antes de iniciar: 2 titulares y hasta 2 suplentes por selecci\xF3n. Guarda ambas alineaciones antes de preparar el marcador; durante el juego los cambios se realizan desde el control, al terminar un game impar.")}</p>{teams.map(team => <fieldset key={team.id} disabled={busy || !editable}><legend>{team.nombre}</legend>{team.jugadores.map(player => <div className="nations-operator__player" key={player.id}><span>{player.nombre}</span><label><input type="checkbox" checked={lineups[team.id]?.iniciales.includes(player.id) || false} onChange={() => choose(team.id, 'iniciales', player.id)} />{t("Titular")}</label><label><input type="checkbox" checked={lineups[team.id]?.suplentes.includes(player.id) || false} onChange={() => choose(team.id, 'suplentes', player.id)} />{t("Suplente")}</label></div>)}<button disabled={lineups[team.id]?.iniciales.length !== 2 || lineups[team.id]?.suplentes.length > 2} onClick={() => execute(() => api.lineup(matchId, team.id, lineups[team.id]))}>{t("Guardar alineaci\xF3n")}</button></fieldset>)}</section></>}
 <section><h2>{t("Ante un imprevisto")}</h2><ol><li>{t("Actualiza el estado antes de repetir una operaci\xF3n que no haya confirmado.")}</li><li>{t("Conserva el marcador existente: no crees otro para el mismo partido.")}</li><li>{t("Si un tel\xE9fono pierde conexi\xF3n, vuelve a abrir su enlace y comprueba el marcador antes de seguir.")}</li><li>{t("Si se comparti\xF3 un control con la persona equivocada, rev\xF3calo y emite uno nuevo.")}</li><li>{t("No modifiques resultados cerrados ni rankings desde este panel. Conserva la incidencia y contacta a la organizaci\xF3n.")}</li></ol></section></>}
 </main>;
}
