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
 * Modal: sorteo de grupos — automático (animación o rápido) o manual (arrastrar a grupos), cabezas de serie y POST único.
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
  /** 'animacion' | 'rapido' | 'manual' */
  const [tipoSorteo, setTipoSorteo] = useState('animacion');
  /** Partición manual: `numGrupos` arrays de ids de equipo */
  const [gruposManuales, setGruposManuales] = useState([]);
  /** Como máximo una cabeza por grupo (solo resaltado UI; el POST sigue siendo `grupos`) */
  const [cabezaPorGrupo, setCabezaPorGrupo] = useState([]);

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
    setTipoSorteo('animacion');
  }, [open, defaultGruposCount]);

  useEffect(() => {
    if (!open || tipoSorteo !== 'manual') return;
    setGruposManuales(Array.from({ length: numGrupos }, () => []));
    setCabezaPorGrupo(Array.from({ length: numGrupos }, () => null));
    setPreview(null);
    setAnimacionSorteo(null);
  }, [open, tipoSorteo, numGrupos]);

  const unassignedManual = useMemo(() => {
    if (tipoSorteo !== 'manual') return [];
    const enGrupos = new Set(gruposManuales.flat());
    return confirmadosIds.filter((id) => !enGrupos.has(id));
  }, [tipoSorteo, gruposManuales, confirmadosIds]);

  const manualValid = useMemo(() => {
    if (tipoSorteo !== 'manual') return false;
    if (!Array.isArray(gruposManuales) || gruposManuales.length !== numGrupos) return false;
    const flat = gruposManuales.flat();
    if (flat.length !== confirmadosIds.length) return false;
    const s = new Set(flat);
    if (s.size !== flat.length) return false;
    for (const id of confirmadosIds) {
      if (!s.has(id)) return false;
    }
    if (!gruposManuales.every((g) => Array.isArray(g) && g.length >= 1)) return false;
    return true;
  }, [tipoSorteo, gruposManuales, confirmadosIds, numGrupos]);

  useEffect(() => {
    if (tipoSorteo !== 'manual') return;
    if (!Array.isArray(gruposManuales) || gruposManuales.length !== numGrupos) return;
    setCabezaPorGrupo((prev) =>
      Array.from({ length: numGrupos }, (_, gi) => {
        const cabezaId = gi < prev.length ? prev[gi] : null;
        if (cabezaId == null) return null;
        return gruposManuales[gi].includes(cabezaId) ? cabezaId : null;
      })
    );
  }, [tipoSorteo, gruposManuales, numGrupos]);

  const moverEquipoAGrupo = useCallback((equipoId, grupoDestino) => {
    setGruposManuales((prev) => {
      const next = prev.map((g) => g.filter((x) => x !== equipoId));
      if (grupoDestino === null || grupoDestino === undefined) {
        return next;
      }
      const gi = Number(grupoDestino);
      if (Number.isFinite(gi) && gi >= 0 && gi < next.length) {
        next[gi] = [...next[gi], equipoId];
      }
      return next;
    });
  }, []);

  const toggleCabezaManual = useCallback((grupoIndex, equipoId) => {
    setCabezaPorGrupo((prev) => {
      const next = [...prev];
      if (next[grupoIndex] === equipoId) next[grupoIndex] = null;
      else next[grupoIndex] = equipoId;
      return next;
    });
  }, []);

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
        setErrorMsg('Elige las cabezas de serie en orden (toca cada equipo).');
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

  const canConfirm =
    tipoSorteo === 'manual' ? manualValid && !confirmando : Boolean(preview) && !confirmando;

  const confirmar = async () => {
    if (tipoSorteo === 'manual') {
      if (!manualValid) return;
      await confirmarConGrupos(gruposManuales.map((g) => [...g]));
      return;
    }
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
          background: 'var(--bg-card)',
          borderRadius: '16px',
          maxWidth: tipoSorteo === 'manual' ? 'min(960px, 96vw)' : '520px',
          width: '100%',
          maxHeight: 'min(92vh, 720px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <h2 id="sorteo-grupos-titulo" style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
            Sorteo de grupos
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
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
                  setAnimacionSorteo(null);
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

              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                  Método de sorteo
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {[
                    {
                      id: 'animacion',
                      titulo: 'Automático con animación',
                      desc: 'Bolillas y sorteo en pantalla',
                    },
                    {
                      id: 'rapido',
                      titulo: 'Automático rápido',
                      desc: 'Vista previa al instante',
                    },
                    {
                      id: 'manual',
                      titulo: 'Sorteo manual',
                      desc: 'Arrastra equipos a cada grupo',
                    },
                  ].map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        setTipoSorteo(op.id);
                        setPreview(null);
                        setAnimacionSorteo(null);
                      }}
                      style={{
                        padding: '12px 10px',
                        borderRadius: '12px',
                        border: tipoSorteo === op.id ? '2px solid #E11B22' : '1px solid #cbd5e1',
                        background: tipoSorteo === op.id ? '#eef2ff' : '#f8fafc',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        minHeight: '72px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
                        {op.titulo}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{op.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {tipoSorteo !== 'manual' ? (
                <>
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
                        <span style={{ fontSize: '13px' }}>Manual (toca en orden)</span>
                      </label>
                      {modoCabezas === 'manual' ? (
                        <div style={{ marginTop: '10px' }}>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                            Elige hasta {Math.min(numCabezas, numGrupos)} equipos en orden (1.º → grupo A, 2.º → B…)
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
                                    border: active ? '2px solid #E11B22' : '1px solid #cbd5e1',
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
                              color: '#b91c1c',
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

                  {tipoSorteo === 'animacion' ? (
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
                      ⭐ Iniciar sorteo con animación
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={confirmando}
                      onClick={ejecutarSortearVistaPrevia}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '12px',
                        border: 'none',
                        background: confirmando ? '#94a3b8' : 'linear-gradient(135deg,#334155,#475569)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '14px',
                        cursor: confirmando ? 'not-allowed' : 'pointer',
                        marginBottom: '10px',
                      }}
                    >
                      Generar sorteo automático (rápido)
                    </button>
                  )}
                </>
              ) : (
                <div style={{ marginBottom: '14px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.45 }}>
                    Arrastra equipos a un grupo o usa el menú «Mover a…». Toca un equipo dentro del grupo para marcarlo
                    como cabeza de serie (dorado). Cada grupo debe tener al menos un equipo. Sin pendientes para confirmar.
                  </p>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const raw = e.dataTransfer.getData('text/plain');
                      const id = parseInt(raw, 10);
                      if (Number.isFinite(id)) moverEquipoAGrupo(id, null);
                    }}
                    style={{
                      minHeight: '56px',
                      marginBottom: '12px',
                      padding: '10px',
                      borderRadius: '12px',
                      border: '2px dashed #cbd5e1',
                      background: 'var(--bg-card)',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <strong style={{ color: '#334155' }}>Sin asignar</strong> — suelta aquí para quitar de un grupo (
                    {unassignedManual.length} equipo{unassignedManual.length === 1 ? '' : 's'})
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        flex: '1 1 200px',
                        minWidth: '180px',
                        maxWidth: '100%',
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#991b1b', marginBottom: '8px' }}>
                        Equipos sin grupo
                      </div>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {unassignedManual.map((eid) => {
                          const eq = confirmados.find((e) => e.id === eid);
                          return (
                            <li
                              key={eid}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', String(eid));
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '10px',
                                border: '1px solid var(--border)',
                                background: 'var(--bg-card)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                cursor: 'grab',
                              }}
                            >
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                                {eq ? labelEquipo(eq) : `Equipo #${eid}`}
                              </span>
                              <select
                                aria-label={`Asignar ${eq ? labelEquipo(eq) : eid} a grupo`}
                                defaultValue=""
                                onChange={(ev) => {
                                  const v = parseInt(ev.target.value, 10);
                                  ev.target.value = '';
                                  if (Number.isFinite(v)) moverEquipoAGrupo(eid, v);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  borderRadius: '8px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12px',
                                }}
                              >
                                <option value="">Mover a grupo…</option>
                                {Array.from({ length: numGrupos }, (_, gi) => (
                                  <option key={gi} value={gi}>
                                    Grupo {LETRAS[gi] || gi + 1}
                                  </option>
                                ))}
                              </select>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div
                      style={{
                        flex: '2 1 320px',
                        minWidth: '220px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: '10px',
                      }}
                    >
                      {gruposManuales.map((grupoIds, gi) => (
                        <div
                          key={gi}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const raw = e.dataTransfer.getData('text/plain');
                            const id = parseInt(raw, 10);
                            if (Number.isFinite(id)) moverEquipoAGrupo(id, gi);
                          }}
                          style={{
                            minHeight: '120px',
                            padding: '10px',
                            borderRadius: '12px',
                            border: '2px solid #c7d2fe',
                            background: '#f5f3ff',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#b91c1c', marginBottom: '8px' }}>
                            Grupo {LETRAS[gi] || gi + 1}
                          </div>
                          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {grupoIds.map((eid) => {
                              const eq = confirmados.find((e) => e.id === eid);
                              const esCabeza = cabezaPorGrupo[gi] === eid;
                              return (
                                <li key={eid}>
                                  <button
                                    type="button"
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/plain', String(eid));
                                      e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onClick={() => toggleCabezaManual(gi, eid)}
                                    style={{
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: '8px 10px',
                                      borderRadius: '10px',
                                      border: esCabeza ? '2px solid #ca8a04' : '1px solid var(--border)',
                                      background: esCabeza
                                        ? 'linear-gradient(135deg,#fef9c3,#fde68a)'
                                        : 'var(--bg-card)',
                                      fontSize: '12px',
                                      fontWeight: 700,
                                      color: '#1e293b',
                                      cursor: 'pointer',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    {esCabeza ? '★ ' : ''}
                                    {eq ? labelEquipo(eq) : `Equipo #${eid}`}
                                  </button>
                                  <select
                                    aria-label={`Mover ${eq ? labelEquipo(eq) : eid}`}
                                    defaultValue={String(gi)}
                                    onChange={(ev) => {
                                      const v = parseInt(ev.target.value, 10);
                                      ev.target.value = String(gi);
                                      if (Number.isFinite(v) && v !== gi) moverEquipoAGrupo(eid, v);
                                    }}
                                    style={{
                                      width: '100%',
                                      marginTop: '4px',
                                      padding: '4px 6px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      fontSize: '11px',
                                    }}
                                  >
                                    {Array.from({ length: numGrupos }, (_, j) => (
                                      <option key={j} value={j}>
                                        Grupo {LETRAS[j] || j + 1}
                                      </option>
                                    ))}
                                  </select>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                  {!manualValid && unassignedManual.length === 0 && gruposManuales.some((g) => g.length === 0) ? (
                    <p style={{ color: '#b45309', fontSize: '12px', fontWeight: 700, margin: '10px 0 0' }}>
                      Ningún grupo puede quedar vacío.
                    </p>
                  ) : null}
                  {unassignedManual.length > 0 ? (
                    <p style={{ color: '#b91c1c', fontSize: '12px', fontWeight: 700, margin: '10px 0 0' }}>
                      Faltan asignar {unassignedManual.length} equipo{unassignedManual.length === 1 ? '' : 's'}.
                    </p>
                  ) : null}
                </div>
              )}

              {tipoSorteo !== 'manual' && preview && preview.length ? (
                <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>Vista previa</div>
                  {preview.map((grupoIds, gi) => (
                    <div key={LETRAS[gi] || gi} style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>
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
            borderTop: '1px solid var(--border)',
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
              background: 'var(--bg-card)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => void confirmar()}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: canConfirm ? '#16a34a' : '#94a3b8',
              color: '#fff',
              fontWeight: 800,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
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
