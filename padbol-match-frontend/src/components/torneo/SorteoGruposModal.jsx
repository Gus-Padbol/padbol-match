import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SorteoAnimado from './SorteoAnimado';

function labelEquipo(eq) {
  return String(eq?.nombre || '').trim() || `Equipo #${eq?.id ?? '?'}`;
}

function jugadorListo(p) {
  if (!p || String(p.estado || '').toLowerCase() === 'pendiente') return false;
  if (String(p.email || '').trim()) return true;
  if (p.id != null && p.id !== '') return true;
  return false;
}

/** Igual que en TorneoTabbedView: API puede devolver `jugadores` como JSON string. */
function jugadoresArrayEquipo(eq) {
  let j = eq?.jugadores;
  if (typeof j === 'string') {
    try {
      j = JSON.parse(j);
    } catch {
      j = [];
    }
  }
  return Array.isArray(j) ? j : [];
}

/** Equipos con cupo completo y sin jugadores pendientes (misma idea que inicio de torneo). */
export function equiposConfirmadosParaSorteo(equipos) {
  const out = [];
  for (const eq of equipos || []) {
    const cupo = Number(eq?.cupo_maximo || 2);
    const arr = jugadoresArrayEquipo(eq);
    if (arr.length < cupo) continue;
    if (!arr.every(jugadorListo)) continue;
    out.push(eq);
  }
  return out;
}

function shuffleInPlace(arr) {
  const a = arr;
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param {number[]} confirmedIds
 * @param {number} numGrupos
 * @param {number[]} cabezaIdsOrden
 * @returns {{ grupos: number[][], secuencia: { id: number, groupIndex: number }[], idsCabezas: number[] }}
 */
export function construirGruposSorteoConOrden(confirmedIds, numGrupos, cabezaIdsOrden) {
  const grupos = Array.from({ length: numGrupos }, () => []);
  const seen = new Set();
  const cabezas = (cabezaIdsOrden || []).filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  for (let i = 0; i < cabezas.length && i < numGrupos; i += 1) {
    grupos[i].push(cabezas[i]);
  }
  const cabSet = new Set(cabezas);
  const rest = confirmedIds.filter((id) => !cabSet.has(id));
  shuffleInPlace(rest);
  const secuencia = [];
  let idx = 0;
  for (const id of rest) {
    const gi = idx % numGrupos;
    grupos[gi].push(id);
    secuencia.push({ id, groupIndex: gi });
    idx += 1;
  }
  return { grupos, secuencia, idsCabezas: cabezas };
}

/** @param {number[]} confirmedIds @param {number} numGrupos @param {number[]} cabezaIdsOrden  */
export function construirGruposSorteo(confirmedIds, numGrupos, cabezaIdsOrden) {
  return construirGruposSorteoConOrden(confirmedIds, numGrupos, cabezaIdsOrden).grupos;
}

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Modal: sorteo manual de grupos con cabezas de serie y vista previa.
 */
export default function SorteoGruposModal({
  open,
  onClose,
  torneo,
  equipos,
  apiBaseUrl,
  accessToken,
  onConfirmed,
}) {
  const [numGrupos, setNumGrupos] = useState(2);
  const [numCabezas, setNumCabezas] = useState(0);
  const [modoCabezas, setModoCabezas] = useState('ranking');
  const [ordenManualCabezas, setOrdenManualCabezas] = useState([]);
  const [preview, setPreview] = useState(null);
  const [animacionSorteo, setAnimacionSorteo] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const confirmados = useMemo(() => equiposConfirmadosParaSorteo(equipos), [equipos]);
  const confirmadosIds = useMemo(
    () => confirmados.map((e) => e.id).sort((a, b) => a - b),
    [confirmados]
  );

  const maxGrupos = useMemo(() => Math.max(2, Math.min(16, confirmadosIds.length || 2)), [confirmadosIds.length]);

  const defaultGruposCount = useMemo(() => {
    const n = confirmadosIds.length;
    if (n < 2) return 2;
    const ep = parseInt(String(torneo?.equipos_por_grupo || ''), 10);
    if (Number.isFinite(ep) && ep > 0) {
      const g = Math.ceil(n / ep);
      return Math.max(2, Math.min(maxGrupos, g));
    }
    const g = Math.max(2, Math.round(n / 4));
    return Math.max(2, Math.min(maxGrupos, g));
  }, [confirmadosIds.length, maxGrupos, torneo?.equipos_por_grupo]);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setAnimacionSorteo(null);
    setErrorMsg('');
    setOrdenManualCabezas([]);
    setNumGrupos(defaultGruposCount);
    setNumCabezas(0);
    setModoCabezas('ranking');
  }, [open, defaultGruposCount]);

  const rankingIds = useMemo(() => {
    const copy = [...confirmados];
    copy.sort((a, b) => (Number(b.puntos_totales) || 0) - (Number(a.puntos_totales) || 0));
    return copy.map((e) => e.id);
  }, [confirmados]);

  const cabezaIdsParaSortear = useMemo(() => {
    const cap = Math.min(numCabezas, numGrupos, confirmadosIds.length);
    if (cap <= 0) return [];
    if (modoCabezas === 'ranking') return rankingIds.slice(0, cap);
    return ordenManualCabezas.slice(0, cap);
  }, [modoCabezas, numCabezas, numGrupos, confirmadosIds.length, rankingIds, ordenManualCabezas]);

  const validarAntesSorteo = useCallback(() => {
    setErrorMsg('');
    if (confirmadosIds.length < 2) {
      setErrorMsg('Se necesitan al menos 2 equipos confirmados.');
      return false;
    }
    if (numGrupos < 2 || numGrupos > maxGrupos) {
      setErrorMsg('Cantidad de grupos inválida.');
      return false;
    }
    if (modoCabezas === 'manual') {
      if (ordenManualCabezas.length < Math.min(numCabezas, numGrupos)) {
        setErrorMsg('Elegí las cabezas de serie en orden (tocá cada equipo).');
        return false;
      }
    }
    return true;
  }, [
    confirmadosIds.length,
    numGrupos,
    maxGrupos,
    modoCabezas,
    ordenManualCabezas.length,
    numCabezas,
    ordenManualCabezas,
    cabezaIdsParaSortear,
  ]);

  const iniciarSorteoAnimado = useCallback(() => {
    if (!validarAntesSorteo()) return;
    const { grupos, secuencia, idsCabezas } = construirGruposSorteoConOrden(
      confirmadosIds,
      numGrupos,
      cabezaIdsParaSortear
    );
    setPreview(grupos);
    setAnimacionSorteo({ grupos, secuencia, idsCabezas });
  }, [validarAntesSorteo, confirmadosIds, numGrupos, cabezaIdsParaSortear]);

  const ejecutarSortearVistaPrevia = useCallback(() => {
    if (!validarAntesSorteo()) return;
    setPreview(construirGruposSorteo(confirmadosIds, numGrupos, cabezaIdsParaSortear));
  }, [validarAntesSorteo, confirmadosIds, numGrupos, cabezaIdsParaSortear]);

  const toggleOrdenManualCabeza = useCallback(
    (id) => {
      setOrdenManualCabezas((prev) => {
        const i = prev.indexOf(id);
        if (i >= 0) return prev.filter((x) => x !== id);
        const cap = Math.min(numCabezas, numGrupos);
        if (prev.length >= cap) return prev;
        return [...prev, id];
      });
    },
    [numCabezas, numGrupos]
  );

  const confirmarConGrupos = async (gruposPayload) => {
    if (!gruposPayload || !torneo?.id || !apiBaseUrl) return;
    setErrorMsg('');
    setConfirmando(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/torneos/${torneo.id}/sorteo`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ grupos: gruposPayload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'No se pudo guardar el sorteo');
        return;
      }
      onConfirmed?.(data);
      onClose?.();
      setPreview(null);
      setAnimacionSorteo(null);
    } catch (e) {
      setErrorMsg(e?.message || 'Error de red');
    } finally {
      setConfirmando(false);
    }
  };

  const confirmar = async () => {
    if (!preview) return;
    await confirmarConGrupos(preview);
  };

  if (!open) return null;

  return (
    <>
    {animacionSorteo ? (
      <SorteoAnimado
        open
        torneoNombre={String(torneo?.nombre || '').trim() || `Torneo #${torneo?.id}`}
        equipos={equipos}
        idsCabezas={animacionSorteo.idsCabezas}
        numGrupos={numGrupos}
        secuencia={animacionSorteo.secuencia}
        gruposFinales={animacionSorteo.grupos}
        onComplete={(grupos) => void confirmarConGrupos(grupos)}
        onCancel={() => setAnimacionSorteo(null)}
        playSound
      />
    ) : null}
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4000,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sorteo-grupos-titulo"
        style={{
          background: '#fff',
          borderRadius: '16px',
          maxWidth: '520px',
          width: '100%',
          maxHeight: 'min(92vh, 720px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 id="sorteo-grupos-titulo" style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
            Sorteo de grupos
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>
            {String(torneo?.nombre || '').trim() || `Torneo #${torneo?.id}`}
          </p>
        </div>

        <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
            Equipos confirmados ({confirmados.length})
          </p>
          <ul style={{ margin: '0 0 14px', paddingLeft: '18px', fontSize: '13px', color: '#475569', maxHeight: '120px', overflowY: 'auto' }}>
            {confirmados.map((eq) => (
              <li key={eq.id} style={{ marginBottom: '4px' }}>
                {labelEquipo(eq)}
                <span style={{ color: '#94a3b8' }}> · pts {Number(eq.puntos_totales) || 0}</span>
              </li>
            ))}
          </ul>

          {confirmados.length < 2 ? (
            <p style={{ color: '#b91c1c', fontWeight: 700, fontSize: '14px' }}>Hacen falta al menos 2 equipos completos.</p>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Cantidad de grupos
              </label>
              <select
                value={numGrupos}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setNumGrupos(v);
                  setPreview(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  marginBottom: '12px',
                  fontSize: '14px',
                }}
              >
                {Array.from({ length: maxGrupos - 1 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n} grupos
                  </option>
                ))}
              </select>

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Cabezas de serie (uno por grupo, hasta {Math.min(numGrupos, confirmados.length)})
              </label>
              <select
                value={numCabezas}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setNumCabezas(v);
                  setOrdenManualCabezas([]);
                  setPreview(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  marginBottom: '12px',
                  fontSize: '14px',
                }}
              >
                {Array.from({ length: Math.min(numGrupos, confirmados.length) + 1 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? 'Sin cabezas (todo aleatorio)' : `${n} cabeza${n > 1 ? 's' : ''}`}
                  </option>
                ))}
              </select>

              {numCabezas > 0 ? (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Modo cabezas</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="modoCab"
                      checked={modoCabezas === 'ranking'}
                      onChange={() => {
                        setModoCabezas('ranking');
                        setPreview(null);
                      }}
                    />
                    <span style={{ fontSize: '13px' }}>Por ranking (puntos_totales en el torneo)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="modoCab"
                      checked={modoCabezas === 'manual'}
                      onChange={() => {
                        setModoCabezas('manual');
                        setOrdenManualCabezas([]);
                        setPreview(null);
                      }}
                    />
                    <span style={{ fontSize: '13px' }}>Manual (tocá en orden)</span>
                  </label>
                  {modoCabezas === 'manual' ? (
                    <div style={{ marginTop: '10px' }}>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px' }}>
                        Elegí hasta {Math.min(numCabezas, numGrupos)} equipos en orden (1.º → grupo A, 2.º → B…)
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {confirmados.map((eq) => {
                          const active = ordenManualCabezas.includes(eq.id);
                          const pos = ordenManualCabezas.indexOf(eq.id);
                          return (
                            <button
                              key={eq.id}
                              type="button"
                              onClick={() => {
                                toggleOrdenManualCabeza(eq.id);
                                setPreview(null);
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '999px',
                                border: active ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                                background: active ? '#eef2ff' : '#f8fafc',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: '#1e293b',
                              }}
                            >
                              {active ? `${pos + 1}. ` : ''}
                              {labelEquipo(eq)}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOrdenManualCabezas([]);
                          setPreview(null);
                        }}
                        style={{
                          marginTop: '8px',
                          fontSize: '12px',
                          color: '#4f46e5',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        Limpiar orden manual
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                disabled={confirmando}
                onClick={iniciarSorteoAnimado}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: confirmando ? '#94a3b8' : 'linear-gradient(135deg,#0f172a,#1e3a5f)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '15px',
                  cursor: confirmando ? 'not-allowed' : 'pointer',
                  marginBottom: '10px',
                  boxShadow: confirmando ? 'none' : '0 4px 20px rgba(201, 162, 39, 0.25)',
                }}
              >
                ⭐ Iniciar sorteo
              </button>
              <button
                type="button"
                disabled={confirmando}
                onClick={ejecutarSortearVistaPrevia}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: confirmando ? 'not-allowed' : 'pointer',
                  marginBottom: '14px',
                }}
              >
                Vista previa sin animación
              </button>

              {preview && preview.length ? (
                <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>Vista previa</div>
                  {preview.map((grupoIds, gi) => (
                    <div key={LETRAS[gi] || gi} style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#3730a3', marginBottom: '4px' }}>
                        Grupo {LETRAS[gi] || gi + 1}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#334155' }}>
                        {grupoIds.map((eid) => {
                          const eq = confirmados.find((e) => e.id === eid) || equipos.find((e) => e.id === eid);
                          return <li key={eid}>{eq ? labelEquipo(eq) : `Equipo #${eid}`}</li>;
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}

              {errorMsg ? (
                <p style={{ color: '#b91c1c', fontWeight: 700, fontSize: '13px', margin: '0 0 10px' }}>{errorMsg}</p>
              ) : null}
            </>
          )}
        </div>

        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!preview || confirmando}
            onClick={() => void confirmar()}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: preview && !confirmando ? '#16a34a' : '#94a3b8',
              color: '#fff',
              fontWeight: 800,
              cursor: preview && !confirmando ? 'pointer' : 'not-allowed',
            }}
          >
            {confirmando ? 'Guardando…' : 'Confirmar sorteo'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
