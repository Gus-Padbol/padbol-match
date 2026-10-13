import {pointsBaseForLevel} from '../../utils/pointsConfigApi';
import {calcularDistribucionPuntosTorneo} from '../../utils/torneoPuntosDistribucion';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeTranslation } from '../../i18n/tSafe';
import { mutateNationsCup, nationsCupRequestId, NATIONS_STANDINGS_RULES, readNationsCup, readNationsCupPublic, createNationsScoreboard, readNationsCupActa } from '../../utils/nationsCupApi';
import { nationsCupScheduleInstant, nationsCupScheduleLocal } from '../../utils/nationsCupScheduleTime';
import './NationsCupPanel.css';

const GROUPS = ['A','B','C'];
export default function NationsCupPanel({ apiBaseUrl, torneo, equipos = [], accessToken, onConfirmed, onState, management = false, navigate, refreshKey = '' }) {
  const { i18n } = useSafeTranslation();
  const en = String(i18n.language).startsWith('en');
  const text = (es, english) => en ? english : es;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [acta, setActa] = useState(null);
  const [zone, setZone] = useState('');
  const [revealAt,setRevealAt]=useState('');
  const [minRest, setMinRest] = useState('');
  const [thirdPlace, setThirdPlace] = useState(false);
  const [editingConfig, setEditingConfig] = useState(false);
  const [countries, setCountries] = useState({});
  const [assignments, setAssignments] = useState({});
  const [approved, setApproved] = useState(false);
  const [resolutions, setResolutions] = useState({});
  const [schedule, setSchedule] = useState({});
  const [schedulePhase, setSchedulePhase] = useState('all');
  const attempt = useRef(null);
  const alive = useRef(true);
  const loadSequence = useRef(0);
  const activeContext = useRef(null);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const context = useMemo(() => ({apiBaseUrl,torneoId:torneo.id,accessToken}), [apiBaseUrl,torneo.id,accessToken]);
  activeContext.current=context;
  const names = new Map([...(management?equipos:[]),...(data?.teams||[])].map(eq => [String(eq.id),eq.nombre]));
  const name = id => names.get(String(id)) || text('Equipo no identificado','Unidentified team');
  const editableMatch = match => ['pendiente','programado'].includes(match.estado);
  const phaseLabel = match => Number(match.bracket_round) === 3 && Number(match.bracket_position) === 2 ? text('Tercer puesto','Third place') : match.grupo ? `${text('Grupo','Group')} ${match.grupo}` : ({1:text('Cuartos de final','Quarterfinals'),2:text('Semifinales','Semifinals'),3:text('Final','Final')})[match.bracket_round] || text('Fase no confirmada','Unconfirmed phase');
  const sideLabel = (match, side) => {
    const id = side === 'a' ? match.equipo_a_id : match.equipo_b_id;
    if (id != null) return name(id);
    const position = Number(match.bracket_position);
    if (Number(match.bracket_round) === 2 && [1,2].includes(position)) return `${text('Ganador de cuarto','Winner of quarterfinal')} ${(position-1)*2+(side==='a'?1:2)}`;
    if (Number(match.bracket_round) === 3 && position === 2) return `${text('Perdedor de semifinal','Loser of semifinal')} ${side==='a'?1:2}`;
    if (Number(match.bracket_round) === 3 && position === 1) return `${text('Ganador de semifinal','Winner of semifinal')} ${side==='a'?1:2}`;
    return text('Equipo por definir','Team to be determined');
  };
  const ingest = useCallback(next => { setSchedule(previous=>Object.fromEntries(Object.entries(previous).filter(([id])=>next.matches.some(match=>String(match.id)===id&&['pendiente','programado'].includes(match.estado))))); setData(next); onStateRef.current?.(next); }, []);
  const load = useCallback(async signal => {
    const sequence=++loadSequence.current;
    setLoading(true);setError('');setNotice('');
    try { const next = await (management ? readNationsCup : readNationsCupPublic)({...context,signal}); if(alive.current&&sequence===loadSequence.current) ingest(next); }
    catch(err){if(alive.current&&sequence===loadSequence.current&&err.name !== 'AbortError'){setError(err.message);setData(null);onStateRef.current?.(null);}}
    finally{if(alive.current&&sequence===loadSequence.current)setLoading(false);}
  }, [context,ingest,management]);
  useEffect(() => {alive.current=true;const controller=new AbortController();load(controller.signal);return()=>{alive.current=false;controller.abort();};},[load,refreshKey]);
  useEffect(() => {setZone('');setRevealAt('');setMinRest('');setThirdPlace(false);setCountries({});setAssignments({});setSchedule({});setResolutions({});setApproved(false);setEditingConfig(false);setActa(null);attempt.current=null;},[torneo.id]);
  const execute = async (action,payload) => {
    if(busy || !data || loading)return;
    const key = JSON.stringify({action,payload,revision:data.revision});
    if(attempt.current?.key !== key)attempt.current={key,body:{...payload,expected_revision:data.revision,request_id:nationsCupRequestId()}};
    setBusy(true);setError('');setNotice('');
    try {
      const next=await mutateNationsCup(context,action,attempt.current.body);
      if(alive.current&&activeContext.current===context){ingest(next);if(action==='schedule')setSchedule({});if(action==='config')setEditingConfig(false);setActa(null);attempt.current=null;setNotice(text('Guardado y comprobado al volver a leer.','Saved and verified after reloading.'));await onConfirmed?.();}
    }catch(err){if(alive.current&&activeContext.current===context)setError(err.message);}
    finally{if(alive.current)setBusy(false);}
  };
  const cap = key => !loading && !busy && data?.capabilities?.[key] === true;
  const config = data?.config;
  const candidates=equipos.filter(eq=>eq.inscripcion_estado==='confirmado');
  const configure = event => {event.preventDefault(); const rest=String(minRest).trim();if(rest!==''&&(!Number.isSafeInteger(Number(rest))||Number(rest)<0||Number(rest)>1440)){setError(text('El descanso mínimo debe ser un entero entre cero y 1440 minutos.','Minimum rest must be an integer between zero and 1440 minutes.'));return;}try{execute('config',{config:{format:'nations_3x5',timezone:zone,...(revealAt?{reveal_at:nationsCupScheduleInstant(revealAt,zone)}:{}),rules:{standings:NATIONS_STANDINGS_RULES,placement_policy:'group_seed',third_place_match:thirdPlace,...(rest!==''?{minimum_rest_minutes:Number(rest)}:{})},country_by_team:countries}});}catch(err){setError(err.message);}};
  const draw = () => {
    const groups=GROUPS.map(label=>candidates.filter(eq=>assignments[String(eq.id)]===label).map(eq=>eq.id));
    if(candidates.length!==15 || groups.some(group=>group.length!==5)){setError(text('Asigna los quince equipos confirmados: cinco en cada grupo.','Assign fifteen confirmed teams: five per group.'));return;}
    execute('draw',{groups});
  };
  const tiePayload = () => (data?.ties || []).map(tie => ({scope:tie.scope,team_ids:tie.team_ids,ordered_team_ids:tie.team_ids.map((_,idx)=>Number(resolutions[tie.scope]?.order?.[idx])),reason:resolutions[tie.scope]?.reason || ''}));
  const advance = action => {
    if(action!=='resolveTies'&&data.ties.length){setError(text('Guarda las decisiones de desempate antes de avanzar o cerrar.','Save tie decisions before advancing or closing.'));return;}
    const tie_resolutions=action==='resolveTies'?tiePayload():[];
    if(tie_resolutions.some(tie=>!tie.reason.trim() || tie.ordered_team_ids.some(id=>!tie.team_ids.some(team=>String(team)===String(id))) || new Set(tie.ordered_team_ids).size!==tie.team_ids.length)){
      setError(text('Completa el orden explícito de cada empate y el motivo de la decisión.','Complete an explicit order and reason for every tie.'));return;
    }
    execute(action,{tie_resolutions});
  };
  const saveSchedule = event => {
    event.preventDefault();
    try{
      const matches=Object.entries(schedule).map(([id,row])=>({partido_id:Number(id),fecha_hora:nationsCupScheduleInstant(row.local,config.timezone),court_id:Number(row.court),duration_minutes:Number(row.duration)}));
      if(!matches.length || matches.some(row=>!Number.isSafeInteger(row.court_id) || row.court_id<=0 || !Number.isSafeInteger(row.duration_minutes) || row.duration_minutes<=0||row.duration_minutes>720))throw new Error(text('Completa fecha, cancha y duración de los partidos a guardar.','Complete date, court and duration for every scheduled match.'));
      execute('schedule',{matches});
    }catch(err){setError(err.message);}
  };
  const editSchedule = (match,key,value) => setSchedule(prev=>({...prev,[match.id]:{local:nationsCupScheduleLocal(match.fecha_hora,config.timezone),court:String(match.court_id || ''),duration:String(match.duration_minutes || ''),...prev[match.id],[key]:value}}));
  const openScoreboard = async match => {
    if (!cap('can_schedule')||!editableMatch(match))return;
    setBusy(true);setError('');
    try {const receipt=await createNationsScoreboard(context,match.id);if(alive.current)navigate?.(`/admin/scoreboard/${receipt.scoreboard_id}`);}
    catch(err){if(alive.current)setError(err.message);}finally{if(alive.current)setBusy(false);}
  };
  const prepareActa = async () => {
    if(busy||loading||!data||!management||data.capabilities.can_export!==true)return;
    setBusy(true);setError('');setActa(null);
    try {const draft=await readNationsCupActa(context,data.revision);if(alive.current&&activeContext.current===context)setActa(draft);}
    catch(err){if(alive.current&&activeContext.current===context)setError(err.message);}finally{if(alive.current)setBusy(false);}
  };
  const downloadActa = () => {
    if(!acta || acta.revision!==data?.revision)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(acta,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`nations-cup-${torneo.id}-revision-${acta.revision}-borrador.json`;link.click();URL.revokeObjectURL(url);
  };
  const pointPolicy=config?.points_policy_snapshot?.config;
  const pointBase=pointsBaseForLevel(pointPolicy,torneo.nivel_torneo);
  const pointRows=pointPolicy&&pointBase!==null?calcularDistribucionPuntosTorneo(pointBase,{cantidad_equipos:15},pointPolicy):[];
  const rules = config?.rules?.standings || [];
  const labels={points:text('Puntos','Points'),set_difference:text('Diferencia de sets','Set difference'),sets_for:text('Sets ganados','Sets won'),game_difference:text('Diferencia de games','Game difference'),games_for:text('Games ganados','Games won')};
  const statistics = (row,index,seeded=false) => <tr key={`${row.group||''}-${row.equipo_id}`}><td>{(seeded?row.seed:row.position)??'—'}</td><td>{name(row.equipo_id)}</td><td>{row.group||'—'}</td><td>{row.jugados ?? '—'}</td><td>{row.puntos ?? '—'}</td><td>{row.diferencia_sets ?? '—'}</td><td>{row.sets_favor ?? '—'}</td><td>{row.diferencia_games ?? '—'}</td><td>{row.games_favor ?? '—'}</td></tr>;
  const table = (rows,seeded=false) => <div className="nations-cup__table" tabIndex={0} role="region" aria-label={text('Tabla desplazable de Nations Cup','Scrollable Nations Cup table')}><p className="nations-cup__scroll-hint">{text('Desliza la tabla para ver todas las columnas. También puedes enfocarla y usar las flechas del teclado.','Scroll the table to view all columns. You can also focus it and use the keyboard arrows.')}</p><table><thead><tr>{[seeded?text('Siembra','Seed'):text('Posición en grupo','Group place'),text('Equipo','Team'),text('Grupo','Group'),'PJ','PTS','DS','SG','DG','GG'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row,index)=>statistics(row,index,seeded))}</tbody></table></div>;
  return <section className="nations-cup" aria-label="Nations Cup">
    <header><div><h2>Nations Cup · 15 → 8</h2><p>{config?.rules?.third_place_match ? text('Tres grupos de cinco. Dos primeros por grupo y dos mejores terceros. Cuartos, semifinales, tercer puesto y final: 38 partidos.','Three groups of five. Top two per group and two best third-placed teams. Quarterfinals, semifinals, third place and final: 38 matches.') : text('Tres grupos de cinco. Dos primeros por grupo y dos mejores terceros. Cuartos, semifinales y final: 37 partidos.','Three groups of five. Top two per group and two best third-placed teams. Quarterfinals, semifinals and final: 37 matches.')}</p></div><button type="button" disabled={busy||loading} onClick={()=>load()}>{text('Actualizar','Refresh')}</button></header>
    {loading?<p role="status">{text('Consultando el estado confirmado…','Loading confirmed state…')}</p>:null}
    {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    {!loading&&!data?<p>{text('No se confirmó el estado. Las acciones permanecen bloqueadas.','State could not be confirmed. Actions remain blocked.')}</p>:null}
    {data&&(!config||editingConfig)?<>
      <p>{text('Esta configuración es explícita y no modifica torneos habituales por consultar el panel. Revisa países, zona horaria y reglamento antes de aprobar.','Configuration is explicit: viewing this panel does not change existing tournaments. Review countries, time zone and rules before approving.')}</p>
      {data.capabilities.can_configure?<form onSubmit={configure}>
        <h3>{text('Configurar Nations Cup','Configure Nations Cup')}</h3>
        <label className="nations-cup__check"><input type="checkbox" checked={thirdPlace} onChange={event=>setThirdPlace(event.target.checked)}/>{text('Incluir partido por el tercer puesto (38 partidos)','Include a third-place match (38 matches)')}</label><p>{thirdPlace ? text('El tercer y cuarto puesto se decidirán entre los perdedores de las semifinales.','Third and fourth place will be decided between the semifinal losers.') : text('Sin partido por el tercer puesto: 37 partidos. Revisa esta elección antes de aprobar el reglamento.','Without a third-place match: 37 matches. Review this choice before approving the rules.')}</p>
        <label>{text('Zona horaria del evento (IANA)','Event time zone (IANA)')}<input value={zone} onChange={e=>setZone(e.target.value)} placeholder="Europe/Rome" required /></label><label>{text('Revelación pública (opcional, hora del evento)','Public reveal (optional, event local time)')}<input type="datetime-local" value={revealAt} onChange={event=>setRevealAt(event.target.value)}/></label><p>{text('Si se omite, se aplica el horario calculado por el servidor según la fecha del torneo y su anticipación configurada. No se presume la hora de la presentación.','If omitted, the server calculates the reveal from the tournament date and configured lead time. The presentation time is not presumed.')}</p>
        <label>{text('Descanso mínimo entre partidos (minutos, opcional)','Minimum rest between matches (minutes, optional)')}<input type="number" min="0" max="1440" value={minRest} onChange={e=>setMinRest(e.target.value)}/></label><p>{text('Regla propuesta, pendiente de aprobación explícita: puntos, diferencia de sets, sets ganados, diferencia de games y games ganados. Un empate restante necesita orden y motivo aprobados; nunca se decide por ID o nombre.','Proposed rule, requiring explicit approval: points, set difference, sets won, game difference and games won. Remaining ties require an approved order and reason, never an ID or name.')}</p>
        <p>{text('El país de cada equipo es una declaración del organizador; no acredita por sí sola nacionalidad de jugadores ni una plaza oficial FIPA.','The team country is declared by the organizer; it does not by itself verify player nationality or an official FIPA place.')}</p><p>{text('La clasificación final interna usará el grupo y la siembra aprobados. Esto no publica puntos oficiales FIPA.','Internal final placing uses approved group and seeding rules. This does not publish official FIPA points.')}</p>
        {candidates.map(eq=><label key={eq.id}>{eq.nombre} · {text('país ISO de dos letras','two-letter ISO country')}<input maxLength={2} pattern="[A-Z]{2}" required value={countries[String(eq.id)]||''} onChange={e=>setCountries(prev=>({...prev,[eq.id]:e.target.value.toUpperCase()}))}/></label>)}
        <button disabled={!cap('can_configure')||candidates.length!==15}>{text('Guardar configuración propuesta','Save proposed configuration')}</button>
        {candidates.length!==15?<p>{text('Se necesitan exactamente quince equipos con inscripción confirmada.','Exactly fifteen teams with confirmed registration are required.')}</p>:null}
      </form>:<p>{text('Tu acceso no permite configurar esta competición.','Your access does not allow configuring this competition.')}</p>}
    </>:null}
    {config?<>
      {!data.groups.length&&cap('can_configure')?<button type="button" onClick={()=>{setZone(config.timezone);setRevealAt(nationsCupScheduleLocal(config.reveal_at,config.timezone));setMinRest(config.rules?.minimum_rest_minutes??'');setThirdPlace(config.rules?.third_place_match===true);setCountries(config.country_by_team||{});setEditingConfig(true);setApproved(false);}}>{text('Editar configuración propuesta','Edit proposed configuration')}</button>:null}
      <p><strong>{text('Estado confirmado','Confirmed state')}:</strong> {({unconfigured:text('Sin configurar','Unconfigured'),configured:text('Configuración propuesta','Proposed configuration'),rules_approved:text('Reglamento aprobado','Rules approved'),groups:text('Fase de grupos','Group stage'),knockout:text('Eliminatorias','Knockout stage'),finalized:text('Finalizado','Finalized')})[data.status]||text('Consultar estado actualizado','Check updated state')} · {text('Zona horaria','Time zone')}: {config.timezone}</p>
      <p>{config.rules?.third_place_match ? text('Tercer puesto incluido: 38 partidos. El cierre exige también su resultado.','Third place included: 38 matches. Closure also requires its result.') : text('Tercer puesto no incluido: 37 partidos.','Third place not included: 37 matches.')}</p>
      {Number.isSafeInteger(config.rules?.minimum_rest_minutes)?<p>{text('Descanso mínimo aprobado (minutos):','Approved minimum rest (minutes):')} {config.rules.minimum_rest_minutes}</p>:null}
      <h3>{text('Reglamento y decisiones','Rules and decisions')}</h3><p>{data.rules_approved ? text('Aprobación del reglamento registrada.','Rule approval has been recorded.') : text('El reglamento todavía necesita aprobación explícita.','Rules still require explicit approval.')}</p><ol>{rules.map(rule=><li key={rule}>{labels[rule]||rule}</li>)}</ol>
      <p>{text('La inscripción y las convocatorias se gestionan por separado: planteles de cuatro a ocho; cada partido exige dos iniciales y dos suplentes por lado, siempre dos en cancha.','Registration and lineups are managed separately: rosters of four to eight; every match requires two starters and two substitutes per side, with two on court.')}</p>
      {data.capabilities.can_configure&&!data.rules_approved?<div><label className="nations-cup__check"><input type="checkbox" disabled={!cap('can_configure')} checked={approved} onChange={e=>setApproved(e.target.checked)}/>{text('Confirmo explícitamente el reglamento mostrado y la política de posiciones internas; no es homologación FIPA.','I explicitly approve the displayed rules and internal placing policy; this is not FIPA homologation.')}</label><button disabled={!approved||!cap('can_configure')} onClick={()=>execute('approveRules',{approved:true})}>{text('Aprobar reglamento','Approve rules')}</button></div>:null}
      <h3>{text('Política de reconocimiento interno del torneo','Tournament internal recognition policy')}</h3>
      {pointRows.length?<><p>{data.rules_approved?text('Base del nivel aprobada y conservada:','Approved and retained level base:'):text('Base del nivel de la propuesta:','Proposed level base:')} {pointBase}. {text('Cada posición recibe su porcentaje individual de esta base. No es un fondo a repartir y no publica ranking FIPA oficial.','Each place receives its individual percentage of this base. This is not a shared pool and does not publish official FIPA ranking.')}</p><div className="nations-cup__table" tabIndex={0} role="region" aria-label={text('Tabla desplazable de Nations Cup','Scrollable Nations Cup table')}><p className="nations-cup__scroll-hint">{text('Desliza la tabla para ver todas las columnas. También puedes enfocarla y usar las flechas del teclado.','Scroll the table to view all columns. You can also focus it and use the keyboard arrows.')}</p><table><thead><tr><th>{text('Posición','Place')}</th><th>%</th><th>{text('Puntos internos','Internal points')}</th></tr></thead><tbody>{pointRows.map(row=><tr key={row.posicion}><td>{row.posicion}</td><td>{row.porcentaje??'—'}</td><td>{row.puntos??'—'}</td></tr>)}</tbody></table></div></>:<p>{text('La política de reconocimiento todavía no está confirmada en este estado.','Recognition policy has not been confirmed in this state yet.')}</p>}
      <h3>{text('Sorteo persistente','Persisted draw')}</h3>
      {data.groups.length?data.groups.map(group=><div key={group.label}><h4>{text('Grupo','Group')} {group.label}</h4><ol>{group.team_ids.map(id=><li key={id}>{name(id)}</li>)}</ol></div>):<>
        <p>{text('Asigna grupos y confirma el sorteo. La elección es una propuesta hasta guardar y volver a leer.','Assign groups and confirm the draw. The selection remains a proposal until saved and reloaded.')}</p>
        {candidates.map(eq=><label key={eq.id}>{eq.nombre}<select disabled={!cap('can_draw')} value={assignments[String(eq.id)]||''} onChange={e=>setAssignments(prev=>({...prev,[eq.id]:e.target.value}))}><option value="">{text('Elegir grupo','Choose group')}</option>{GROUPS.map(group=><option key={group}>{group}</option>)}</select></label>)}
        <button disabled={!cap('can_draw')} onClick={draw}>{text('Confirmar sorteo de tres grupos','Confirm three-group draw')}</button>
      </>}
      {data.standings.map(group=><div key={group.group}><h3>{text('Posiciones del grupo','Group standings')} {group.group}</h3>{table(group.rows)}</div>)}
      {data.thirds.length?<><h3>{text('Comparación de terceros','Third-place comparison')}</h3>{table(data.thirds)}</>:null}
      <h3>{text('Ocho clasificados y siembra','Eight qualifiers and seeding')}</h3>
      {data.qualified.length?table(data.qualified,true):<p>{text('La clasificación aún no está confirmada.','Qualification has not been confirmed yet.')}</p>}
      {data.ties.map(tie=><fieldset key={tie.scope}><legend>{text('Empate pendiente','Unresolved tie')}: {tie.scope}</legend>{tie.team_ids.map((_,idx)=><label key={idx}>{text('Orden aprobado','Approved order')} {idx+1}<select disabled={!cap('can_resolve_ties')} value={resolutions[tie.scope]?.order?.[idx]||''} onChange={e=>setResolutions(prev=>({...prev,[tie.scope]:{...prev[tie.scope],order:{...prev[tie.scope]?.order,[idx]:e.target.value}}}))}><option value="">{text('Seleccionar equipo','Select team')}</option>{tie.team_ids.map(id=><option key={id} value={id}>{name(id)}</option>)}</select></label>)}<label>{text('Motivo de la decisión aprobada','Reason for the approved decision')}<textarea disabled={!cap('can_resolve_ties')} value={resolutions[tie.scope]?.reason||''} onChange={e=>setResolutions(prev=>({...prev,[tie.scope]:{...prev[tie.scope],reason:e.target.value}}))}/></label></fieldset>)}
      {data.ties.length?<button disabled={!cap('can_resolve_ties')} onClick={()=>advance('resolveTies')}>{text('Guardar decisiones de desempate','Save tie decisions')}</button>:null}
      <button disabled={!cap('can_advance')||data.ties.length>0} onClick={()=>advance('advance')}>{text('Confirmar avance de fase','Confirm phase advancement')}</button>
      <h3>{text('Partidos y programación','Matches and schedule')}</h3>
      {!data.matches.length?<p>{text('No hay partidos persistidos todavía.','No matches have been persisted yet.')}</p>:null}
      {data.matches.length>0?<label>{text('Filtrar programación por fase o grupo','Filter schedule by stage or group')}<select value={schedulePhase} onChange={event=>setSchedulePhase(event.target.value)}><option value="all">{text('Todas las fases','All stages')}</option>{GROUPS.map(group=><option key={group} value={`group:${group}`}>{text('Grupo','Group')} {group}</option>)}{[1,2,3].map(round=><option key={round} value={`round:${round}`}>{round===3&&config.rules?.third_place_match ? text('Final y tercer puesto','Final and third place') : phaseLabel({bracket_round:round})}</option>)}</select></label>:null}<form onSubmit={saveSchedule}>{data.matches.filter(match=>schedulePhase==='all'||schedulePhase===(match.grupo?`group:${match.grupo}`:`round:${match.bracket_round}`)).map(match=><fieldset key={match.id}><legend>{sideLabel(match,'a')} — {sideLabel(match,'b')}</legend><button type="button" disabled={!cap('can_schedule')||!editableMatch(match)||!match.fecha_hora||!match.cancha||!navigate} onClick={()=>openScoreboard(match)}>{text('Abrir marcador de este partido','Open this match scoreboard')}</button><p>{phaseLabel(match)} · {match.estado}</p><label>{text('Fecha y hora del evento','Event date and time')}<input type="datetime-local" disabled={!cap('can_schedule')||!editableMatch(match)} value={schedule[match.id]?.local??nationsCupScheduleLocal(match.fecha_hora,config.timezone)} onChange={e=>editSchedule(match,'local',e.target.value)}/></label><label>{text('Cancha','Court')}<select disabled={!cap('can_schedule')||!editableMatch(match)} value={schedule[match.id]?.court??String(match.court_id||'')} onChange={e=>editSchedule(match,'court',e.target.value)}><option value="">{text('Elegir cancha habilitada','Choose an enabled court')}</option>{(data.courts||[]).map(court=><option key={court.id} value={court.id}>{court.nombre}</option>)}</select></label><label>{text('Duración (minutos)','Duration (minutes)')}<input type="number" min="1" max="720" disabled={!cap('can_schedule')||!editableMatch(match)} value={schedule[match.id]?.duration??String(match.duration_minutes||'')} onChange={e=>editSchedule(match,'duration',e.target.value)}/></label></fieldset>)}<button disabled={!cap('can_schedule')||!Object.keys(schedule).length||(data.courts||[]).length===0}>{text('Guardar programación editada','Save edited schedule')}</button></form>
      {(data.courts||[]).length===0&&data.matches.length?<p>{text('No se confirmó un catálogo de canchas habilitadas; no se puede guardar programación.','No enabled court catalog was confirmed; schedule saving is unavailable.')}</p>:null}
      <h3>{text('Cierre e información de ranking','Closure and ranking information')}</h3><p>{text('El cierre registra posiciones y reconocimiento interno según los participantes convocados. El ranking oficial FIPA conserva su aprobación y publicación separadas.','Closure records placing and internal recognition based on declared participants. Official FIPA ranking retains its separate approval and publication.')}</p><button disabled={!cap('can_close')||data.ties.length>0} onClick={()=>advance('close')}>{text('Confirmar cierre del torneo','Confirm tournament closure')}</button>
      {management&&data.capabilities.can_export===true?<div><button disabled={busy||loading} onClick={prepareActa}>{text('Preparar acta borrador para revisión','Prepare draft record for review')}</button>{acta&&acta.revision===data.revision?<><p>{text('Borrador comprobado:','Verified draft:')} {acta.matches.length} {text('partidos','matches')}, {acta.placements.length} {text('posiciones','places')}, {new Set(acta.declared_participants.flatMap(row=>[...(row.convocados_a||[]),...(row.convocados_b||[])])).size} {text('participantes declarados únicos','unique declared participants')}. {text('Los puntos oficiales FIPA requieren revisión externa; no se publicaron automáticamente.','Official FIPA points require external review; they were not automatically published.')}</p><button onClick={downloadActa}>{text('Descargar acta borrador (JSON)','Download draft record (JSON)')}</button></>:null}</div>:null}
    </>:null}
  </section>;
}
