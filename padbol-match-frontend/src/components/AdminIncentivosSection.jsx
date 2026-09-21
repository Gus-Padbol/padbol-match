import { getApiBaseUrl } from '../utils/apiPublicBaseUrl';
import React, { useEffect, useMemo, useState } from 'react';
import './AdminIncentivosSection.css';

const API_DEFAULT = getApiBaseUrl();
const RULES_VERSION = 'activity-v4-four-goals-scoreboard-half';
const APPROVED_RULES = Object.freeze({
  torneos_integrales_minimos: 1,
  parejas_confirmadas_por_torneo_minimas: 8,
  jugadores_distintos_por_torneo_minimos: 16,
  partidos_marcador_porcentaje_minimo: 50,
  reservas_completadas_minimas: 10,
  jugadores_vinculados_activos_minimos: 10,
});
const GOALS = [
  ['torneos_integrales', 'Torneo con ocho parejas', 'Finalizar al menos un torneo Padbol con ocho parejas confirmadas.', 'Torneos válidos'],
  ['marcador', 'Resultados y marcador digital', 'Registrar todos los resultados y usar el marcador digital en al menos el 50% de los partidos jugados.', 'Torneos que cumplen'],
  ['reservas', 'Reservas verificadas', 'Completar diez reservas reales con usuarios verificados.', 'Reservas válidas'],
  ['jugadores_activos', 'Jugadores vinculados activos', 'Tener diez jugadores vinculados con actividad en el mes. Los resultados manuales también cuentan.', 'Jugadores activos'],
];
const STATES = {
  completed: 'Cumplido', pending: 'Pendiente', unavailable: 'Dato no disponible',
  pending_configuration: 'Configuración pendiente',
};
const count = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const venueId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0 ? String(value) : '';
const thisMonth = () => new Date().toISOString().slice(0, 7);
const monthLabel = month => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('es', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const money = (value, currency = 'USD') => count(value) == null ? 'No disponible' : `${currency} ${value.toLocaleString('es', { maximumFractionDigits: 2 })}`;

async function requestJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'No se pudo consultar el informe. Intenta de nuevo.');
  return json;
}

function criterion(evaluation, key) {
  const detail = evaluation?.detalle_criterios?.[key];
  const current = count(detail?.current), target = count(detail?.target);
  const state = !detail ? 'unavailable'
    : detail.configured === false ? 'pending_configuration'
      : current == null || target == null || !STATES[detail.state] ? 'unavailable' : detail.state;
  return { current, target, state };
}

function ObjectiveRow({ goal, evaluation }) {
  const [key, title, description, unit] = goal;
  const { current, target, state } = criterion(evaluation, key);
  const progress = current != null && target > 0 ? Math.min(100, Math.round(current / target * 100)) : null;
  return (
    <li className={`incentive-objective incentive-objective--${state}`} aria-label={title}>
      <div className="incentive-objective__topline"><strong>{title}</strong><span>{STATES[state]}</span></div>
      <p>{description}</p>
      <div className="incentive-objective__values">
        <span>{unit}: {current ?? 'No disponible'}</span>
        <span>Meta: {target ?? 'Sin definir'}</span>
      </div>
      {progress != null ? <div className="incentive-objective__track" aria-label={`${title}: ${progress}%`}><span style={{ width: `${progress}%` }} /></div> : null}
    </li>
  );
}

function benefitSummary(report) {
  const evaluation = report.evaluation, status = report.commercial_status;
  const details = GOALS.map(([key]) => criterion(evaluation, key));
  const available = details.every(row => row.state !== 'unavailable');
  const complete = available && evaluation?.configuracion_completa === true && evaluation?.cumplido === true
    && details.every(row => row.state === 'completed');
  if (status?.venue_scope !== 'padbol_only') return { title: 'Cotización pendiente', detail: 'La tarifa de esta sede todavía no está definida.' };
  if (!available) return { title: 'Beneficio pendiente de verificar', detail: 'Faltan datos para confirmar el cumplimiento del mes.' };
  if (status.phase === 'included' && status.projected_monthly_usd === 0) return { title: `${money(0, status.currency)} proyectados`, detail: 'Mes incluido en el beneficio inicial.' };
  if (status.phase === 'objectives_met_projected' && complete && count(status.projected_monthly_usd) != null) {
    return { title: `${money(status.projected_monthly_usd, status.currency)} proyectados`, detail: 'Los cuatro objetivos están cumplidos: 50% adicional proyectado.' };
  }
  if (status.phase === 'objectives_in_progress' && evaluation?.cumplido === false && count(status.reference_monthly_usd) != null) {
    return { title: `${money(status.reference_monthly_usd, status.currency)} de referencia`, detail: 'El 50% adicional requiere cumplir los cuatro objetivos del mes.' };
  }
  if (status.phase === 'not_started') return { title: 'Programa sin iniciar', detail: 'El período consultado es anterior al inicio del programa.' };
  if (status.phase === 'start_pending') return { title: 'Inicio pendiente', detail: 'Todavía falta registrar la fecha de inicio.' };
  return { title: 'Beneficio pendiente de verificar', detail: 'La configuración o los datos del mes todavía están pendientes.' };
}

function TournamentEvidence({ evidence }) {
  if (!Array.isArray(evidence) || !evidence.length) return <p className="incentive-dashboard__history">El informe no incluye detalle de torneos finalizados para este período.</p>;
  const fraction = (actual, target) => count(actual) == null || count(target) == null ? 'No disponible' : `${actual} / ${target}`;
  return (
    <div className="incentive-tournament-table">
      <table>
        <caption>Detalle de los torneos finalizados</caption>
        <thead><tr><th>Torneo</th><th>Parejas confirmadas</th><th>Resultados registrados</th><th>Marcador digital</th><th>Estado del objetivo</th></tr></thead>
        <tbody>{evidence.map((row, index) => <tr key={`${row.torneo_id}-${index}`}>
          <th scope="row">Torneo {row.torneo_id ?? 'sin identificar'}</th>
          <td>{count(row.parejas_confirmadas) ?? 'No disponible'}</td>
          <td>{fraction(row.partidos_jugados_resultado_registrado, row.partidos_requeridos)}<small>{row.todos_resultados_registrados === true ? 'Todos registrados' : row.todos_resultados_registrados === false ? 'Faltan resultados válidos' : 'Sin verificar'}</small></td>
          <td>{fraction(row.partidos_jugados_sincronizados, row.partidos_marcador_requeridos)}<small>Partidos con marcador validado / requeridos</small></td>
          <td>{row.marcador_completo === true ? 'Cumplido' : row.marcador_completo === false ? 'Pendiente' : 'Sin verificar'}</td>
        </tr>)}</tbody>
      </table>
      <p>Se requiere marcador en al menos la mitad de los partidos jugados, redondeando hacia arriba. Cada torneo se comprueba por separado.</p>
    </div>
  );
}

export default function AdminIncentivosSection({ apiBaseUrl = API_DEFAULT, accessToken, sedes = [], sedeId = null, isSuperAdmin = false, canSelectSede = false }) {
  const available = useMemo(() => (sedes || []).filter(row => venueId(row?.id)), [sedes]);
  const maySelect = isSuperAdmin || canSelectSede;
  const [chosenId, setChosenId] = useState(null);
  const selectedId = maySelect ? chosenId ?? (venueId(sedeId) || venueId(available[0]?.id)) : venueId(sedeId);
  const [month, setMonth] = useState(thisMonth);
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month <= thisMonth() ? `${month}-01` : '';
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [confirmedRules, setConfirmedRules] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);
  // Keying the result by the complete request context hides stale data before
  // effects run, including when role, venue, period or authentication changes.
  const requestKey = useMemo(() => ({ selectedId, period, accessToken, apiBaseUrl, revision }), [selectedId, period, accessToken, apiBaseUrl, revision]);
  const current = result?.key === requestKey ? result : null;
  const report = current?.kind === 'ready' ? current.report : null;
  const program = current?.program;
  const loading = Boolean(accessToken && selectedId && period && !current);

  useEffect(() => {
    setConfirmedRules(false);
    if (!accessToken || !selectedId || !period) return undefined;
    const controller = new AbortController();
    let active = true;
    const finish = data => { if (active) setResult({ key: requestKey, ...data }); };
    async function load() {
      try {
        const payload = await requestJson(`${apiBaseUrl}/api/admin/incentivos?sede_id=${encodeURIComponent(selectedId)}`, accessToken, { signal: controller.signal });
        if (!active) return;
        if (payload?.policy?.rulesVersion !== RULES_VERSION) { finish({ kind: 'outdated' }); return; }
        if (!Array.isArray(payload.programs)) throw new Error('La respuesta del informe no está disponible.');
        const nextProgram = payload.programs.find(row => venueId(row?.sede_id) === selectedId);
        if (!nextProgram) {
          if (payload.programs.length) throw new Error('No se recibió el informe de la sede seleccionada.');
          finish({ kind: 'empty', supportsV4: true }); return;
        }
        if (nextProgram.reglas_version !== RULES_VERSION || nextProgram.legacy_configuration === true) {
          finish({ kind: 'outdated', program: nextProgram, supportsV4: true }); return;
        }
        let nextReport = nextProgram.current_progress;
        if (period !== `${thisMonth()}-01`) {
          nextReport = await requestJson(`${apiBaseUrl}/api/admin/incentivos/${encodeURIComponent(selectedId)}/evaluar`, accessToken, { method: 'POST', body: JSON.stringify({ periodo: period }), signal: controller.signal });
        }
        if (!nextReport) throw new Error('No se pudieron verificar los datos de este mes. Intenta actualizar el informe.');
        if (nextReport.evaluation?.rules_version !== RULES_VERSION || nextReport.requires_rules_migration === true) {
          finish({ kind: 'outdated', program: nextProgram, supportsV4: true }); return;
        }
        if (nextReport.period !== period) throw new Error('El servidor devolvió otro período. Actualiza el informe para consultar el mes elegido.');
        finish({ kind: 'ready', program: nextProgram, supportsV4: true, report: nextReport, receivedAt: new Date() });
      } catch (error) {
        if (error.name !== 'AbortError') finish({ kind: 'error', error: error.message });
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [accessToken, apiBaseUrl, selectedId, period, requestKey]);

  const canConfigure = isSuperAdmin && current?.supportsV4 && (!program || program.estado === 'borrador');
  const saveRules = async () => {
    if (!canConfigure || !confirmedRules || saving) return;
    const context = { selectedId, accessToken, apiBaseUrl };
    setSaving(true); setActionNotice(null);
    try {
      await requestJson(`${apiBaseUrl}/api/admin/incentivos/${encodeURIComponent(selectedId)}${program ? '' : '/activar'}`, accessToken, {
        method: program ? 'PATCH' : 'POST',
        body: JSON.stringify({ reglas_version: RULES_VERSION, configuracion: APPROVED_RULES }),
      });
      setActionNotice({ context, text: 'Los cuatro objetivos se guardaron en un borrador. No se activaron cobros.' });
      setRevision(value => value + 1);
    } catch (error) { setActionNotice({ context, text: error.message, error: true }); }
    finally { setSaving(false); setConfirmedRules(false); }
  };
  const notice = actionNotice?.context.selectedId === selectedId && actionNotice?.context.accessToken === accessToken && actionNotice?.context.apiBaseUrl === apiBaseUrl ? actionNotice : null;
  const details = report ? GOALS.map(([key]) => criterion(report.evaluation, key)) : [];
  const allAvailable = details.length === 4 && details.every(row => ['completed', 'pending'].includes(row.state));
  const completed = details.filter(row => row.state === 'completed').length;
  const benefit = report ? benefitSummary(report) : null;

  return <section className="section incentive-dashboard" data-testid="admin-incentivos-section">
    <header className="incentive-dashboard__header">
      <div><p className="incentive-dashboard__eyebrow">BENEFICIO PADBOL</p><h2>Informe mensual de tu sede</h2><p>Consulta la actividad registrada, el estado de cada objetivo y el beneficio estimado del mes.</p></div>
      <div className="incentive-dashboard__billing-note"><strong>Beneficio estimado</strong><span>Este informe no confirma un descuento aplicado ni genera cobros.</span></div>
    </header>
    <div className="incentive-dashboard__filters">
      {maySelect ? <label>Sede<select value={selectedId} disabled={saving} onChange={event => { setChosenId(event.target.value); setActionNotice(null); }}><option value="">Elegir sede</option>{available.map(venue => <option key={venue.id} value={String(venue.id)}>{venue.nombre}</option>)}</select></label> : null}
      <label>Mes del informe<input type="month" value={month} max={thisMonth()} disabled={saving} onChange={event => setMonth(event.target.value)} /></label>
      <button type="button" disabled={loading || saving || !selectedId || !period || !accessToken} onClick={() => setRevision(value => value + 1)}>Actualizar informe</button>
    </div>
    {period ? <p className="incentive-dashboard__period">Período consultado: <strong>{monthLabel(month)}</strong> · calendario UTC</p> : null}
    {notice ? <p role={notice.error ? 'alert' : 'status'} className={`incentive-dashboard__alert incentive-dashboard__alert--${notice.error ? 'error' : 'success'}`}>{notice.text}</p> : null}
    {!accessToken ? <p>Inicia sesión para consultar el informe de tu sede.</p> : !selectedId ? <p>Selecciona una sede.</p> : !period ? <p>Elige un mes válido, hasta el mes actual.</p> : loading ? <p role="status">Consultando el mes…</p> : current?.kind === 'error' ? <p role="alert" className="incentive-dashboard__alert incentive-dashboard__alert--error">{current.error}</p> : current?.kind === 'outdated' ? <div role="status" className="incentive-dashboard__empty"><strong>Actualización de objetivos pendiente</strong><p>El informe de cuatro objetivos todavía no está disponible para esta sede. Los registros anteriores no se usan para calcular este beneficio.</p></div> : current?.kind === 'empty' ? <div className="incentive-dashboard__empty"><strong>Programa pendiente de configuración</strong><p>Todavía no hay un programa asociado a esta sede. El informe se mostrará cuando esté configurado.</p></div> : null}
    {report ? <>
      <div className="incentive-month-grid">
        <article><span>Objetivos del mes</span><strong>{allAvailable ? `${completed} de 4 cumplidos` : 'Cumplimiento no disponible'}</strong><small>Las cuatro metas se cumplen juntas para obtener el 50% adicional.</small></article>
        <article><span>Beneficio del mes</span><strong>{benefit.title}</strong><small>{benefit.detail}</small></article>
      </div>
      <div className="incentive-dashboard__objectives"><h3>Actividad por objetivo</h3><ul>{GOALS.map(goal => <ObjectiveRow key={goal[0]} goal={goal} evaluation={report.evaluation} />)}</ul><p className="incentive-dashboard__history">Las mismas parejas y los mismos jugadores pueden participar en meses siguientes.</p></div>
      <TournamentEvidence evidence={report.evidence} />
      <p className="incentive-dashboard__history">Consulta actualizada el {current.receivedAt.toLocaleString('es')}. Los meses anteriores se recalculan con los registros disponibles; no son informes cerrados.</p>
    </> : null}
    {canConfigure ? <details className="incentive-dashboard__configuration">
      <summary>{program ? 'Configurar los objetivos del borrador' : 'Crear un borrador del programa'}</summary>
      <p>Un torneo con ocho parejas, todos sus resultados registrados y al menos el 50% de partidos con marcador, diez reservas verificadas y diez jugadores vinculados activos.</p>
      <label className="incentive-dashboard__confirmation"><input type="checkbox" checked={confirmedRules} disabled={saving} onChange={event => setConfirmedRules(event.target.checked)} />Confirmo estos cuatro objetivos mensuales para el borrador.</label>
      <button type="button" onClick={saveRules} disabled={saving || !confirmedRules}>{program ? 'Guardar objetivos del borrador' : 'Crear borrador sin activar cobros'}</button>
    </details> : null}
  </section>;
}
