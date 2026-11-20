import {useNationsOperatorText} from '../utils/nationsOperatorText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createNationsOperatorApi } from '../utils/nationsOperatorApi';
import { nationsCupScheduleInstant, nationsCupScheduleLocal } from '../utils/nationsCupScheduleTime';
import './NationsOperator.css';
export default function NationsOperatorDashboard() {
 const t=useNationsOperatorText();
  const {
    session
  } = useAuth();
  const token = session?.access_token || '';
  const api = useMemo(() => createNationsOperatorApi(token), [token]);
  const [data, setData] = useState(null),
    [matchId, setMatchId] = useState(''),
    [court, setCourt] = useState(''),
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
  const editable = match && ['pendiente', 'programado'].includes(match.estado),
    board = match?.scoreboards?.[0];
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
  return <main className="nations-operator"><header><p className="nations-operator__eyebrow">{t("Operaci\xF3n exclusiva del torneo")}</p><h1>{t("Nations Cup \xB7 N\xE1poles 2026")}</h1><p>{t("Acceso limitado al torneo 57. Las cuentas, sedes y rankings generales quedan fuera de este panel.")}</p></header>
 {!token ? <p role="alert">{t("Inicia sesi\xF3n con la cuenta habilitada por la organizaci\xF3n.")}</p> : !data && !error ? <p role="status">{t("Comprobando tu acceso al torneo\u2026")}</p> : null}
 {error && <p role="alert" className="nations-operator__error">{error}</p>}{notice && <p role="status">{notice}</p>}
 {data && <><div className="nations-operator__toolbar"><label>{t("Partido")}<select value={matchId} disabled={busy} onChange={e => setMatchId(e.target.value)}>{data.partidos.map(item => <option key={item.id} value={item.id}>{data.equipos.find(team => String(team.id) === String(item.equipo_a_id))?.nombre || t('Por definir')} — {data.equipos.find(team => String(team.id) === String(item.equipo_b_id))?.nombre || t('Por definir')} · {item.grupo || t('Eliminatoria')} · {t(item.estado)}</option>)}</select></label><button disabled={busy} onClick={() => execute(() => api.dashboard())}>{t("Actualizar estado")}</button></div>
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
            }}>{t("Revocar control del \xE1rbitro")}</button></div> : <button disabled={busy || !editable || !court} onClick={() => execute(() => api.open(matchId, court))}>{t("Preparar marcador en la cancha elegida")}</button>}
 {control?.matchId === matchId && <aside className="nations-operator__private"><strong>{t("Enlace privado: s\xF3lo para el \xE1rbitro")}</strong><a href={control.path} target="_blank" rel="noreferrer" referrerPolicy="no-referrer">{t("Abrir control del \xE1rbitro")}</a><button onClick={async()=>{const mine=generation.current;try{await navigator.clipboard.writeText(window.location.origin+control.path);if(mine===generation.current)setNotice(t('Enlace privado copiado. Compártelo únicamente con el árbitro.'));}catch{if(mine===generation.current)setError(t('No se pudo copiar. Abre el control y copia su dirección.'));}}}>{t("Copiar enlace privado")}</button></aside>}
 </section>
 <section><h2>{t("Convocados y alineaciones")}</h2><p>{t("Antes de abrir el marcador: 2 titulares y hasta 2 suplentes por selecci\xF3n. Durante el juego los cambios se realizan desde el control, al terminar un game impar.")}</p>{teams.map(team => <fieldset key={team.id} disabled={busy || !editable}><legend>{team.nombre}</legend>{team.jugadores.map(player => <div className="nations-operator__player" key={player.id}><span>{player.nombre}</span><label><input type="checkbox" checked={lineups[team.id]?.iniciales.includes(player.id) || false} onChange={() => choose(team.id, 'iniciales', player.id)} />{t("Titular")}</label><label><input type="checkbox" checked={lineups[team.id]?.suplentes.includes(player.id) || false} onChange={() => choose(team.id, 'suplentes', player.id)} />{t("Suplente")}</label></div>)}<button disabled={lineups[team.id]?.iniciales.length !== 2 || lineups[team.id]?.suplentes.length > 2} onClick={() => execute(() => api.lineup(matchId, team.id, lineups[team.id]))}>{t("Guardar alineaci\xF3n")}</button></fieldset>)}</section></>}
 <section><h2>{t("Ante un imprevisto")}</h2><ol><li>{t("Actualiza el estado antes de repetir una operaci\xF3n que no haya confirmado.")}</li><li>{t("Conserva el marcador existente: no crees otro para el mismo partido.")}</li><li>{t("Si un tel\xE9fono pierde conexi\xF3n, vuelve a abrir su enlace y comprueba el marcador antes de seguir.")}</li><li>{t("Si se comparti\xF3 un control con la persona equivocada, rev\xF3calo y emite uno nuevo.")}</li><li>{t("No modifiques resultados cerrados ni rankings desde este panel. Conserva la incidencia y contacta a la organizaci\xF3n.")}</li></ol></section></>}
 </main>;
}
