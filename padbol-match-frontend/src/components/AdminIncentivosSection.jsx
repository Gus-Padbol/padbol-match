import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API_DEFAULT = 'https://padbol-backend.onrender.com';
const RULE_LABELS = {
  torneos_integrales: 'Torneo integral finalizado en Padbol Match',
  jugadores_registrados: 'Jugadores identificados e inscriptos en Padbol Match',
  marcador: 'Partidos finalizados con el marcador de Padbol Match',
  reservas: 'Reservas gestionadas en la plataforma',
  jugadores_activos: 'Jugadores activos vinculados a la sede',
  padcoins: 'Movimientos reales de PadCoins',
};
const RULE_FIELDS = [
  ['torneos_minimos', 'Torneos integrales', 'torneos_validos'],
  ['jugadores_registrados_minimos', 'Jugadores registrados por torneo', 'jugadores_registrados_torneos'],
  ['partidos_marcador_minimos', 'Partidos con marcador', 'partidos_marcador_finalizados'],
  ['reservas_minimas', 'Reservas válidas', 'reservas_validas'],
  ['jugadores_activos_minimos', 'Jugadores activos', 'jugadores_activos'],
  ['movimientos_padcoins_minimos', 'Movimientos de PadCoins', 'movimientos_padcoins'],
];

async function requestJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || 'No se pudo completar la operación');
  return json;
}

export default function AdminIncentivosSection({
  apiBaseUrl = API_DEFAULT,
  accessToken,
  sedes = [],
  sedeId = null,
  isSuperAdmin = false,
  canSelectSede = false,
}) {
  const available = useMemo(() => (sedes || []).filter((row) => row?.id != null), [sedes]);
  const [selectedId, setSelectedId] = useState(() => String(sedeId || available[0]?.id || ''));
  const [program, setProgram] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [ruleDraft, setRuleDraft] = useState({});

  useEffect(() => {
    if (sedeId != null && sedeId !== '') setSelectedId(String(sedeId));
    else if (!selectedId && available[0]?.id != null) setSelectedId(String(available[0].id));
  }, [available, sedeId, selectedId]);

  const load = useCallback(async () => {
    if (!accessToken || !selectedId) return;
    setLoading(true);
    setError('');
    try {
      const rows = await requestJson(`${apiBaseUrl}/api/admin/incentivos?sede_id=${encodeURIComponent(selectedId)}`, accessToken);
      const nextProgram = Array.isArray(rows) ? rows[0] || null : null;
      setProgram(nextProgram);
      setRuleDraft(nextProgram?.configuracion || {});
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBaseUrl, selectedId]);

  useEffect(() => { void load(); }, [load]);

  const activate = async () => {
    setLoading(true); setError(''); setMessage('');
    try {
      await requestJson(`${apiBaseUrl}/api/admin/incentivos/${selectedId}/activar`, accessToken, {
        method: 'POST', body: JSON.stringify({ meses_base: 6 }),
      });
      setMessage('Programa activado: seis meses iniciales y renovación mensual sin tope.');
      await load();
    } catch (operationError) { setError(operationError.message); }
    finally { setLoading(false); }
  };

  const evaluate = async () => {
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await requestJson(`${apiBaseUrl}/api/admin/incentivos/${selectedId}/evaluar`, accessToken, {
        method: 'POST', body: JSON.stringify({}),
      });
      setPreview(result);
      setMessage(result.evaluation?.cumplido
        ? 'Objetivo del mes alcanzado. El crédito se consolida al cierre del período.'
        : 'Progreso actualizado. Lo incompleto no se traslada al mes siguiente.');
      await load();
    } catch (operationError) { setError(operationError.message); }
    finally { setLoading(false); }
  };

  const saveRules = async () => {
    setLoading(true); setError(''); setMessage('');
    try {
      await requestJson(`${apiBaseUrl}/api/admin/incentivos/${selectedId}`, accessToken, {
        method: 'PATCH', body: JSON.stringify({ configuracion: ruleDraft }),
      });
      setMessage('Reglas mensuales actualizadas. Se aplicarán de forma visible en la próxima evaluación.');
      await load();
    } catch (operationError) { setError(operationError.message); }
    finally { setLoading(false); }
  };

  const rules = program?.configuracion || {};
  const evaluation = preview?.evaluation;
  const progress = program?.progreso || [];

  return (
    <div className="section" data-testid="admin-incentivos-section">
      <h2 style={{ marginBottom: 6 }}>Programa Pro renovable</h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 760, lineHeight: 1.5 }}>
        La sede comienza con seis meses sin cargo. Después puede continuar sin pagar indefinidamente si completa todos los objetivos mensuales dentro de Padbol Match. Cada mes se mide por separado; si no cumple, la racha vuelve a cero y el progreso parcial vence.
      </p>

      {(isSuperAdmin || canSelectSede) ? (
        <label style={{ display: 'grid', gap: 6, maxWidth: 480, fontWeight: 800 }}>
          Sede
          <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setPreview(null); }} style={{ padding: 10, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
            <option value="">Elegir sede</option>
            {available.map((venue) => <option key={venue.id} value={venue.id}>{venue.nombre}</option>)}
          </select>
        </label>
      ) : null}

      {error ? <p role="alert" style={{ color: '#dc2626', fontWeight: 800 }}>{error}</p> : null}
      {message ? <p role="status" style={{ color: '#15803d', fontWeight: 800 }}>{message}</p> : null}
      {loading ? <p>Cargando…</p> : !selectedId ? <p>Seleccioná una sede.</p> : !program ? (
        <div style={{ marginTop: 18, padding: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
          <p>Esta sede todavía no participa del programa.</p>
          {isSuperAdmin ? <button type="button" onClick={activate} style={{ padding: '10px 15px', border: 0, borderRadius: 9, background: 'var(--accent)', color: '#fff', fontWeight: 800 }}>Activar 6 meses + renovación</button> : null}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, margin: '18px 0' }}>
            <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 11 }}><strong>Beneficio vigente</strong><div style={{ fontSize: 22, marginTop: 5 }}>Hasta {program.beneficio_hasta || '—'}</div></div>
            <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 11 }}><strong>Meses ganados</strong><div style={{ fontSize: 22, marginTop: 5 }}>{program.meses_desbloqueados || 0}</div></div>
            <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 11 }}><strong>Racha actual</strong><div style={{ fontSize: 22, marginTop: 5 }}>{program.racha_actual || 0} meses</div></div>
          </div>
          <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)' }}>
            <h3 style={{ marginTop: 0 }}>Reglas mensuales claras</h3>
            <ul style={{ lineHeight: 1.7 }}>
              <li>{rules.torneos_minimos ?? 1} torneo finalizado íntegramente en Padbol Match.</li>
              <li>{rules.jugadores_registrados_minimos ?? 8} jugadores registrados e identificados.</li>
              <li>{rules.partidos_marcador_minimos ?? 3} partidos finalizados con el marcador.</li>
              <li>{rules.reservas_minimas ?? 10} reservas válidas gestionadas.</li>
              <li>{rules.jugadores_activos_minimos ?? 10} jugadores activos vinculados.</li>
              <li>{rules.movimientos_padcoins_minimos ?? 5} movimientos reales de PadCoins.</li>
            </ul>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No cuentan torneos cargados como resultado manual, equipos sin confirmar, jugadores sin usuario, partidos sin marcador ni actividad duplicada. Los meses ya disfrutados no se reclaman; simplemente deja de extenderse el beneficio.</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cuando vence el beneficio, la sede puede contratar Pro o continuar en Starter. En Starter conserva su cuenta y sus datos, no genera deuda y no se realiza ningún cobro automático.</p>
            {isSuperAdmin ? (
              <details style={{ margin: '14px 0' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Configurar mínimos</summary>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, margin: '12px 0' }}>
                  {RULE_FIELDS.map(([ruleKey, label]) => (
                    <label key={ruleKey} style={{ display: 'grid', gap: 5, fontWeight: 700 }}>
                      {label}
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={ruleDraft[ruleKey] ?? rules[ruleKey] ?? ''}
                        onChange={(event) => setRuleDraft((current) => ({ ...current, [ruleKey]: event.target.value }))}
                        style={{ padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                      />
                    </label>
                  ))}
                </div>
                <button type="button" onClick={saveRules} disabled={loading} style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--bg-input)', color: 'var(--text-primary)', fontWeight: 800 }}>Guardar reglas</button>
              </details>
            ) : null}
            <button type="button" onClick={evaluate} disabled={loading} style={{ padding: '10px 15px', border: 0, borderRadius: 9, background: 'var(--accent)', color: '#fff', fontWeight: 800 }}>Actualizar progreso del mes</button>
          </div>
          {evaluation ? (
            <div style={{ marginTop: 16 }}>
              <h3>Progreso actual</h3>
              <ul>{Object.entries(evaluation.criterios || {}).map(([key, ok]) => {
                const fallbackField = {
                  torneos_integrales: ['torneos_minimos', '', 'torneos_validos'],
                  jugadores_registrados: ['jugadores_registrados_minimos', '', 'jugadores_registrados_torneos'],
                  marcador: ['partidos_marcador_minimos', '', 'partidos_marcador_finalizados'],
                  reservas: ['reservas_minimas', '', 'reservas_validas'],
                  jugadores_activos: ['jugadores_activos_minimos', '', 'jugadores_activos'],
                  padcoins: ['movimientos_padcoins_minimos', '', 'movimientos_padcoins'],
                }[key];
                const [ruleKey, , metricKey] = fallbackField || [];
                const currentValue = preview?.metrics?.[metricKey] ?? 0;
                const targetValue = evaluation.rules?.[ruleKey] ?? 0;
                return <li key={key} style={{ color: ok ? '#15803d' : 'var(--text-secondary)' }}>{ok ? '✓' : '○'} {RULE_LABELS[key] || key}: {currentValue}/{targetValue}</li>;
              })}</ul>
            </div>
          ) : null}
          {progress.length ? <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>Última evaluación cerrada: {progress[0].periodo} · {progress[0].estado === 'cumplido' ? 'mes otorgado' : 'no cumplido'}.</p> : null}
        </>
      )}
    </div>
  );
}
