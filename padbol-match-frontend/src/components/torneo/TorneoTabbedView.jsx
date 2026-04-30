import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatNivelTorneo, formatTipoTorneo } from '../../utils/torneoFormatters';
import { formatAliasConArroba, nombreCompletoJugadorPerfil } from '../../utils/jugadorPerfil';
import '../../styles/TorneoVista.css';

const PADBOL_CONFETTI_COLORS = ['#FFD700', '#C0C0C0', '#CC0000', '#FFFFFF'];

/** Confetti nativo: divs fijos que caen y se eliminan al terminar la animación. */
function launchNativePadbolConfetti(isMobile) {
  console.log('[TorneoTabbedView] launchNativePadbolConfetti start', { isMobile, t: Date.now() });
  if (typeof document === 'undefined') return () => {};
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      console.log('[TorneoTabbedView] launchNativePadbolConfetti skipped (prefers-reduced-motion)');
      return () => {};
    }
  } catch {
    /* ignore */
  }

  const count = isMobile ? 40 : 80;
  const root = document.createElement('div');
  root.className = 'torneo-confetti-root';
  root.setAttribute('aria-hidden', 'true');
  document.body.appendChild(root);

  const cleanupBits = () => {
    if (root.parentNode) root.remove();
  };

  for (let i = 0; i < count; i += 1) {
    const bit = document.createElement('div');
    bit.className = 'torneo-confetti-bit';
    const size = 6 + Math.random() * 4;
    const duration = 2 + Math.random() * 2;
    const delay = Math.random() * 2;
    bit.style.width = `${size}px`;
    bit.style.height = `${size}px`;
    bit.style.left = `${Math.random() * 100}vw`;
    bit.style.backgroundColor = PADBOL_CONFETTI_COLORS[i % PADBOL_CONFETTI_COLORS.length];
    bit.style.animationDuration = `${duration}s`;
    bit.style.animationDelay = `${delay}s`;
    bit.style.setProperty('--confetti-drift', `${(Math.random() - 0.5) * 200}px`);
    bit.style.setProperty('--confetti-rot', `${(Math.random() * 8 - 4) * 90}deg`);
    bit.addEventListener(
      'animationend',
      () => {
        if (bit.parentNode === root) bit.remove();
      },
      { once: true }
    );
    root.appendChild(bit);
  }

  const safetyTimer = window.setTimeout(cleanupBits, 6500);

  return () => {
    window.clearTimeout(safetyTimer);
    cleanupBits();
  };
}

function formatFecha(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${parseInt(d, 10)} ${meses[parseInt(m, 10) - 1]} ${y}`;
}

function slugJugador(raw) {
  return encodeURIComponent(
    String(raw || 'jugador')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
  );
}

export function safeJugadores(eq) {
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

/** Visible en listados: @alias si hay alias; si no, nombre completo (nombre + apellido). */
export function jugadorEtiquetaConArroba(p) {
  const a = String(p?.alias || '').trim();
  if (a) return formatAliasConArroba(a);
  const full = nombreCompletoJugadorPerfil(p);
  if (full) return full;
  return String(p?.nombre || 'Jugador').trim() || 'Jugador';
}

/** Nombre del equipo o pareja de etiquetas de jugadores (mismo criterio que {@link jugadorEtiquetaConArroba}). */
export function nombreEquipoMostrado(eq) {
  const n = String(eq?.nombre || '').trim();
  if (n) return n;
  const j = safeJugadores(eq);
  const labels = j.slice(0, 2).map((player) => jugadorEtiquetaConArroba(player));
  if (labels.length >= 2) return `${labels[0]} & ${labels[1]}`;
  if (labels.length === 1) return labels[0];
  return `Equipo #${eq?.id ?? '—'}`;
}

function esUsuarioCapitanDeEquipo(equipo, session) {
  if (!equipo || !session?.user) return false;
  const uid = String(session.user.id || '').trim();
  if (uid && String(equipo.creador_id || '').trim() === uid) return true;
  const em = String(session.user.email || '').trim().toLowerCase();
  const ce = String(equipo.creador_email || '').trim().toLowerCase();
  if (em && ce && ce === em) return true;
  return false;
}

function calcularStats(equiposList, partidosList) {
  const stats = {};
  equiposList.forEach((eq) => {
    stats[eq.id] = { jj: 0, g: 0, p: 0, pts: 0, sg: 0, sp: 0, gg: 0, gp: 0 };
  });
  partidosList.forEach((partido) => {
    if (partido.estado !== 'finalizado' || !partido.resultado) return;
    const res = typeof partido.resultado === 'string' ? JSON.parse(partido.resultado) : partido.resultado;
    const sets = [res.set1, res.set2, res.set3].filter(Boolean);
    let sgA = 0;
    let sgB = 0;
    let ggA = 0;
    let ggB = 0;
    sets.forEach((set) => {
      const [a, b] = set.split('-').map(Number);
      ggA += a;
      ggB += b;
      if (a > b) sgA += 1;
      else sgB += 1;
    });
    const eqA = stats[partido.equipo_a_id];
    const eqB = stats[partido.equipo_b_id];
    if (!eqA || !eqB) return;
    eqA.jj += 1;
    eqB.jj += 1;
    eqA.sg += sgA;
    eqA.sp += sgB;
    eqA.gg += ggA;
    eqA.gp += ggB;
    eqB.sg += sgB;
    eqB.sp += sgA;
    eqB.gg += ggB;
    eqB.gp += ggA;
    if (sgA > sgB) {
      eqA.g += 1;
      eqB.p += 1;
      eqA.pts += 3;
    } else {
      eqB.g += 1;
      eqA.p += 1;
      eqB.pts += 3;
    }
  });
  return stats;
}

export function buildTablaPosiciones(equiposList, partidosList) {
  const stats = calcularStats(equiposList, partidosList);
  return equiposList
    .map((eq) => ({
      id: eq.id,
      nombre: eq.nombre,
      jugadores: safeJugadores(eq),
      puntos_ranking: eq.puntos_ranking || 0,
      jj: stats[eq.id].jj,
      g: stats[eq.id].g,
      p: stats[eq.id].p,
      pts: stats[eq.id].pts,
      sg: stats[eq.id].sg,
      sp: stats[eq.id].sp,
      gg: stats[eq.id].gg,
      gp: stats[eq.id].gp,
      djuegos: (stats[eq.id].gg - stats[eq.id].gp) || 0,
      dif: (stats[eq.id].sg - stats[eq.id].sp) || 0,
    }))
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.sg - b.sp !== a.sg - a.sp) return b.sg - b.sp - (a.sg - a.sp);
      if (b.gg - b.gp !== a.gg - a.gp) return b.gg - b.gp - (a.gg - a.gp);
      return 0;
    });
}

function parseResultadoSets(partido) {
  if (!partido?.resultado) return [];
  const res = typeof partido.resultado === 'string' ? JSON.parse(partido.resultado) : partido.resultado;
  return [res.set1, res.set2, res.set3].filter((s) => s && String(s).trim());
}

function contarSetsGanados(partido) {
  const sets = parseResultadoSets(partido);
  let a = 0;
  let b = 0;
  sets.forEach((set) => {
    const [x, y] = String(set).split('-').map(Number);
    if (x > y) a += 1;
    else if (y > x) b += 1;
  });
  return { sgA: a, sgB: b };
}

function equipoPorId(equipos, id) {
  return equipos.find((e) => e.id === id);
}

function defaultTabId(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'finalizado') return 'resultados';
  if (e === 'en_curso' || e === 'activo') return 'fixture';
  return 'equipos';
}

function trunc12(s) {
  const t = String(s || '');
  if (t.length <= 12) return t;
  return `${t.slice(0, 12)}…`;
}

const TAB_BTN = {
  border: 'none',
  background: 'transparent',
  padding: '10px 12px',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.04em',
  color: '#64748b',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  borderBottom: '3px solid transparent',
  marginBottom: '-1px',
};

/**
 * Vista con pestañas: Equipos, Grupos, Fixture, Llave, Resultados (si finalizado).
 */
export default function TorneoTabbedView({
  torneo,
  equipos,
  partidos,
  setPartidos,
  sedesMap = {},
  torneoId,
  navigate,
  session,
  isAdmin = false,
  /** Filas desde `tabla_puntos` + equipos (misma forma que FormEquipos). */
  clasificacionFinalFilas = null,
  /** Contenido extra bajo la lista de equipos (inscripción en FormEquipos). */
  equiposTabFooter = null,
  /** Bloque admin (iniciar/finalizar, etc.) encima de las pestañas. */
  adminTorneoBar = null,
  stickyTop = '110px',
  showTorneoLogo = true,
  /** Tope del logo PADBOL Match (px): ancho y alto máx., centrado, sin recorte. */
  logoMinHeightPx = 60,
}) {
  const [activeTab, setActiveTab] = useState(() => defaultTabId(torneo?.estado));
  const resultadosConfettiPlayedRef = useRef(false);
  const [modalEquipo, setModalEquipo] = useState(null);
  const [showModalResultado, setShowModalResultado] = useState(false);
  const [selectedPartido, setSelectedPartido] = useState(null);
  const [resultado, setResultado] = useState({ set1: '', set2: '', set3: '' });

  const estadoLower = String(torneo?.estado || '').toLowerCase();
  const esFinalizado = estadoLower === 'finalizado';
  const esGruposKnockout = torneo?.tipo_torneo === 'grupos_knockout';
  const esKnockoutPuro = torneo?.tipo_torneo === 'knockout';
  const muestraTabLlave = esGruposKnockout || esKnockoutPuro;

  const equipoGrupoMap = useMemo(() => {
    const m = {};
    equipos.forEach((eq) => {
      if (eq.grupo) m[eq.id] = eq.grupo;
    });
    partidos.forEach((p) => {
      if (p.grupo) {
        if (p.equipo_a_id && !m[p.equipo_a_id]) m[p.equipo_a_id] = p.grupo;
        if (p.equipo_b_id && !m[p.equipo_b_id]) m[p.equipo_b_id] = p.grupo;
      }
    });
    return m;
  }, [equipos, partidos]);

  const grupos = useMemo(() => {
    if (!esGruposKnockout) return [];
    return [...new Set(Object.values(equipoGrupoMap))].sort();
  }, [esGruposKnockout, equipoGrupoMap]);

  const partidosOrdenados = useMemo(() => {
    return [...partidos].sort((a, b) => {
      const ta = a.fecha_hora ? new Date(a.fecha_hora).getTime() : 0;
      const tb = b.fecha_hora ? new Date(b.fecha_hora).getTime() : 0;
      return ta - tb;
    });
  }, [partidos]);

  const partidosLlave = useMemo(() => {
    if (esKnockoutPuro) return partidos;
    return partidos.filter((p) => p.grupo == null || p.grupo === '');
  }, [partidos, esKnockoutPuro]);

  const hayLlaveConPartidos = partidosLlave.length > 0;

  useEffect(() => {
    setActiveTab(defaultTabId(torneo?.estado));
  }, [torneo?.estado, torneo?.id]);

  const sedeTorneo = sedesMap[String(torneo?.sede_id)];
  const sedeUbicacion = [sedeTorneo?.ciudad, sedeTorneo?.pais].filter(Boolean).join(', ');
  const sedeTexto = sedeTorneo
    ? `📍 ${sedeTorneo.nombre}${sedeUbicacion ? ` · ${sedeUbicacion}` : ''}`
    : null;

  const abrirModalResultado = useCallback(
    (partido) => {
      if (!isAdmin) return;
      if (partido.estado === 'finalizado') return;
      setSelectedPartido(partido);
      setResultado({ set1: '', set2: '', set3: '' });
      setShowModalResultado(true);
    },
    [isAdmin]
  );

  const guardarResultado = async () => {
    if (!selectedPartido) return;
    const sets = [resultado.set1, resultado.set2, resultado.set3].filter((s) => s.trim());
    if (sets.length < 2) {
      alert('Mínimo 2 sets requeridos');
      return;
    }
    try {
      const res = await fetch(`https://padbol-backend.onrender.com/api/partidos/${selectedPartido.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'finalizado',
          resultado: JSON.stringify(resultado),
        }),
      });
      if (res.ok) {
        setPartidos((prev) =>
          prev.map((p) =>
            p.id === selectedPartido.id ? { ...p, estado: 'finalizado', resultado: JSON.stringify(resultado) } : p
          )
        );
        setShowModalResultado(false);
        setSelectedPartido(null);
      }
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    }
  };

  const resultadosFilas = useMemo(() => {
    if (clasificacionFinalFilas && clasificacionFinalFilas.length > 0) return clasificacionFinalFilas;
    if (!esFinalizado) return [];
    const sorted = [...equipos].sort((a, b) => (Number(b.puntos_ranking) || 0) - (Number(a.puntos_ranking) || 0));
    return sorted.map((eq, i) => ({
      posicion: i + 1,
      puntos: eq.puntos_ranking ?? 0,
      equipoNombre: nombreEquipoMostrado(eq),
      jugadorLineas: safeJugadores(eq).slice(0, 4).map((p) => jugadorEtiquetaConArroba(p)),
    }));
  }, [clasificacionFinalFilas, esFinalizado, equipos]);

  /** Podio olímpico 2° · 1° · 3°; siempre 3 huecos, con placeholder si falta fila. */
  const podioSlotsCompletos = useMemo(() => {
    const byPos = {};
    resultadosFilas.forEach((f) => {
      if (f.posicion >= 1 && f.posicion <= 3) byPos[f.posicion] = f;
    });
    const orden = [2, 1, 3];
    return orden.map((pos) => {
      const fila = byPos[pos];
      if (fila) return { ...fila, sinEquipo: false };
      return {
        posicion: pos,
        equipoNombre: '',
        jugadorLineas: [],
        puntos: null,
        sinEquipo: true,
      };
    });
  }, [resultadosFilas]);

  /** Posiciones 4–10 siempre; huecos vacíos con — */
  const clasificacionFinalFilasCompletas = useMemo(() => {
    const byPos = {};
    resultadosFilas.forEach((f) => {
      if (f.posicion >= 4 && f.posicion <= 10) byPos[f.posicion] = f;
    });
    const rows = [];
    for (let pos = 4; pos <= 10; pos += 1) {
      const f = byPos[pos];
      if (f) rows.push({ ...f, vacio: false });
      else rows.push({ posicion: pos, equipoNombre: '', jugadorLineas: [], puntos: null, vacio: true });
    }
    return rows;
  }, [resultadosFilas]);

  useEffect(() => {
    if (activeTab !== 'resultados' || !esFinalizado) {
      resultadosConfettiPlayedRef.current = false;
      return;
    }
    if (resultadosConfettiPlayedRef.current) return;
    resultadosConfettiPlayedRef.current = true;

    const isMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia('(max-width: 768px)').matches || window.innerWidth < 768);
    return launchNativePadbolConfetti(isMobile);
  }, [activeTab, esFinalizado]);

  const tabs = useMemo(() => {
    const t = [
      { id: 'equipos', label: 'EQUIPOS' },
      { id: 'grupos', label: 'GRUPOS' },
      { id: 'fixture', label: 'FIXTURE' },
    ];
    if (muestraTabLlave) t.push({ id: 'llave', label: 'LLAVE' });
    if (esFinalizado) t.push({ id: 'resultados', label: 'RESULTADOS' });
    return t;
  }, [muestraTabLlave, esFinalizado]);

  const rondasLlave = useMemo(() => {
    const list = [...partidosLlave].sort((a, b) => {
      const ra = Number(a.ronda) || 1;
      const rb = Number(b.ronda) || 1;
      if (ra !== rb) return ra - rb;
      return (a.id || 0) - (b.id || 0);
    });
    const byRonda = {};
    list.forEach((p) => {
      const r = Number(p.ronda) || 1;
      if (!byRonda[r]) byRonda[r] = [];
      byRonda[r].push(p);
    });
    return Object.keys(byRonda)
      .map(Number)
      .sort((a, b) => a - b)
      .map((r) => ({ ronda: r, partidos: byRonda[r] }));
  }, [partidosLlave]);

  const renderTabEquipos = () => (
    <div style={{ padding: '4px 0 20px' }}>
      {equipos.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>No hay equipos inscriptos.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {equipos.map((equipo) => {
            const jugadores = safeJugadores(equipo);
            const titulo = nombreEquipoMostrado(equipo);
            const capOk = esUsuarioCapitanDeEquipo(equipo, session);
            return (
              <div
                key={equipo.id}
                style={{
                  background: '#fff',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ fontWeight: 900, fontSize: '16px', color: '#0f172a', marginBottom: '10px', flex: 1, minWidth: 0 }}>
                    {titulo}
                  </div>
                  {capOk ? (
                    <button
                      type="button"
                      className="btn-agregar-jugadores"
                      onClick={() => navigate(`/equipo/${equipo.id}`)}
                      style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}
                    >
                      Gestionar
                    </button>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {jugadores.length === 0 ? (
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>Sin jugadores</span>
                  ) : (
                    jugadores.map((p, idx) => {
                      const label = jugadorEtiquetaConArroba(p);
                      const aliasRuta = String(p?.alias || p?.nombre || 'jugador').trim();
                      const initial = String(label.replace(/^@/, '') || '?')
                        .charAt(0)
                        .toUpperCase();
                      const foto = String(p?.foto_url || '').trim();
                      return (
                        <button
                          key={`${equipo.id}-j-${idx}`}
                          type="button"
                          onClick={() => navigate(`/jugador/${slugJugador(aliasRuta)}`)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: '4px 0',
                            textAlign: 'left',
                          }}
                        >
                          {foto ? (
                            <img
                              src={foto}
                              alt=""
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                flexShrink: 0,
                                border: '1px solid #e2e8f0',
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                color: 'white',
                                fontSize: '11px',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {initial}
                            </span>
                          )}
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#2563eb', textDecoration: 'underline' }}>
                            {label}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {equiposTabFooter}
    </div>
  );

  const renderGrupoTable = (grupoLabel, tablaRows, onNombreClick) => (
    <div style={{ marginBottom: '22px' }}>
      <div style={{ fontWeight: 900, fontSize: '15px', color: '#0f172a', marginBottom: '8px' }}>Grupo {grupoLabel}</div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
          <thead>
            <tr style={{ background: '#f8fafc', color: '#475569' }}>
              {['EQUIPO', 'PJ', 'PG', 'PP', 'SF', 'SC', 'PTS'].map((h) => (
                <th key={h} style={{ padding: '8px 6px', textAlign: h === 'EQUIPO' ? 'left' : 'center', fontWeight: 800 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tablaRows.map((row, idx) => {
              const nombreCorto = trunc12(nombreEquipoMostrado({ ...row, nombre: row.nombre }));
              const clasifica = idx < 2;
              return (
                <tr
                  key={row.id}
                  style={{
                    borderTop: '1px solid #f1f5f9',
                    background: clasifica ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px 6px', fontWeight: 700, maxWidth: 140 }}>
                    <button
                      type="button"
                      onClick={() => onNombreClick(row)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: '#0f172a',
                        fontWeight: 700,
                        padding: 0,
                        textAlign: 'left',
                        maxWidth: 130,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                      title={nombreEquipoMostrado({ ...row, nombre: row.nombre })}
                    >
                      {nombreCorto}
                    </button>
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>{row.jj}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>{row.g}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>{row.p}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>{row.sg}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>{row.sp}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 900, color: '#4f46e5' }}>{row.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTabGrupos = () => {
    const openEq = (row) => setModalEquipo(equipos.find((e) => e.id === row.id) || row);
    if (esGruposKnockout && grupos.length > 0) {
      return (
        <div style={{ padding: '8px 0' }}>
          {grupos.map((grupo) => {
            const grupoEquipos = equipos.filter((eq) => equipoGrupoMap[eq.id] === grupo);
            const grupoPartidos = partidos.filter((p) => p.grupo === grupo);
            const tablaGrupo = buildTablaPosiciones(grupoEquipos, grupoPartidos);
            return <div key={grupo}>{renderGrupoTable(grupo, tablaGrupo, openEq)}</div>;
          })}
        </div>
      );
    }
    const tabla = buildTablaPosiciones(equipos, partidos);
    return (
      <div style={{ padding: '8px 0' }}>
        {renderGrupoTable('General', tabla, openEq)}
      </div>
    );
  };

  const renderFixtureLine = (partido) => {
    const eqA = equipoPorId(equipos, partido.equipo_a_id);
    const eqB = equipoPorId(equipos, partido.equipo_b_id);
    const na = nombreEquipoMostrado(eqA || {});
    const nb = nombreEquipoMostrado(eqB || {});
    const pendiente = partido.estado !== 'finalizado';
    const fh = partido.fecha_hora
      ? new Date(partido.fecha_hora).toLocaleString('es-AR', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : '—';
    if (pendiente) {
      return (
        <div
          key={partido.id}
          className="partido-item"
          style={{ cursor: isAdmin ? 'pointer' : 'default' }}
          onClick={isAdmin ? () => abrirModalResultado(partido) : undefined}
          role={isAdmin ? 'button' : undefined}
        >
          <div className="partido-content" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>
              {na} <span className="vs">vs</span> {nb}
            </span>
            <span style={{ fontSize: '13px', color: '#64748b' }}>— {fh}</span>
          </div>
          <span className={`estado ${partido.estado}`}>⏳ Pendiente</span>
        </div>
      );
    }
    const sets = parseResultadoSets(partido);
    const textoSets = sets.join(', ');
    const { sgA, sgB } = contarSetsGanados(partido);
    const ganaA = sgA > sgB;
    return (
      <div
        key={partido.id}
        className="partido-item"
        style={{ cursor: isAdmin ? 'pointer' : 'default' }}
        onClick={isAdmin ? () => abrirModalResultado(partido) : undefined}
      >
        <div className="partido-content" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', width: '100%' }}>
            <span className="equipo-a" style={{ fontWeight: ganaA ? 900 : 600, color: ganaA ? '#15803d' : '#334155' }}>
              {na}
              {ganaA ? ' ✓' : ''}
            </span>
            <span className="vs">vs</span>
            <span className="equipo-b" style={{ fontWeight: !ganaA ? 900 : 600, color: !ganaA ? '#15803d' : '#334155' }}>
              {nb}
              {!ganaA ? ' ✓' : ''}
            </span>
          </div>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {textoSets} · {fh}
          </span>
        </div>
        <span className={`estado ${partido.estado}`}>✅</span>
      </div>
    );
  };

  const renderTabFixture = () => (
    <div className="partidos-box" style={{ marginTop: '8px', background: 'white', borderRadius: '16px', padding: '16px' }}>
      {partidosOrdenados.length === 0 ? (
        <p className="sin-partidos">Sin partidos</p>
      ) : (
        <div className="lista-partidos">{partidosOrdenados.map(renderFixtureLine)}</div>
      )}
    </div>
  );

  const renderTabLlave = () => {
    if (!muestraTabLlave) return null;
    if (!hayLlaveConPartidos) {
      const msg = esKnockoutPuro
        ? 'Aún no hay partidos de eliminatoria cargados.'
        : 'La llave se completa al finalizar la fase de grupos';
      return (
        <div
          style={{
            padding: '24px 16px',
            background: '#fff',
            borderRadius: '14px',
            textAlign: 'center',
            color: '#64748b',
            fontWeight: 600,
            lineHeight: 1.5,
            border: '1px solid #e2e8f0',
          }}
        >
          {msg}
        </div>
      );
    }
    return (
      <div style={{ overflowX: 'auto', padding: '8px 0' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', minWidth: 'min-content' }}>
          {rondasLlave.map(({ ronda, partidos: plist }) => (
            <div key={ronda} style={{ flex: '0 0 auto', width: 200 }}>
              <div style={{ fontWeight: 900, fontSize: '12px', color: '#64748b', marginBottom: '10px', textAlign: 'center' }}>
                Ronda {ronda}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {plist.map((partido) => {
                  const eqA = equipoPorId(equipos, partido.equipo_a_id);
                  const eqB = equipoPorId(equipos, partido.equipo_b_id);
                  const na = nombreEquipoMostrado(eqA || {});
                  const nb = nombreEquipoMostrado(eqB || {});
                  const fin = partido.estado === 'finalizado';
                  const { sgA, sgB } = fin ? contarSetsGanados(partido) : { sgA: 0, sgB: 0 };
                  const ganaA = fin && sgA > sgB;
                  const ganaB = fin && sgB > sgA;
                  const setsTxt = fin ? parseResultadoSets(partido).join(', ') : '—';
                  return (
                    <div
                      key={partido.id}
                      style={{
                        background: '#fff',
                        borderRadius: '12px',
                        padding: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ fontWeight: ganaA ? 900 : 600, color: ganaA ? '#15803d' : '#334155' }}>{na}</div>
                      <div style={{ textAlign: 'center', color: '#94a3b8', margin: '4px 0' }}>vs</div>
                      <div style={{ fontWeight: ganaB ? 900 : 600, color: ganaB ? '#15803d' : '#334155' }}>{nb}</div>
                      {fin ? <div style={{ marginTop: '8px', color: '#64748b', fontWeight: 600 }}>{setsTxt}</div> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTabResultados = () => (
    <div style={{ padding: '8px 0 20px' }}>
      <div className="podium-wrapper" style={{ marginBottom: '20px' }}>
        {podioSlotsCompletos.map((fila) => {
          const med = fila.posicion === 1 ? '🥇' : fila.posicion === 2 ? '🥈' : '🥉';
          const pedestalClass =
            fila.posicion === 1 ? 'podium-pedestal--1' : fila.posicion === 2 ? 'podium-pedestal--2' : 'podium-pedestal--3';
          const slotClass =
            fila.posicion === 1 ? 'podium-slot--first' : fila.posicion === 2 ? 'podium-slot--second' : 'podium-slot--third';
          const sinEquipo = Boolean(fila.sinEquipo);
          return (
            <div key={fila.posicion} className={`podium-slot ${slotClass}`}>
              <div className="podium-card">
                <div className={`podium-team-name${sinEquipo ? ' podium-team-name--sin-definir' : ''}`}>
                  {sinEquipo ? 'Sin definir' : fila.equipoNombre}
                </div>
                {!sinEquipo && fila.jugadorLineas?.length > 0 ? (
                  <div className="podium-players">{fila.jugadorLineas.join(' · ')}</div>
                ) : null}
                <div className="podium-points">
                  {sinEquipo || fila.puntos == null || fila.puntos === '' ? '—' : (
                    <>
                      {fila.puntos} <span>pts</span>
                    </>
                  )}
                </div>
              </div>
              <div className={`podium-pedestal ${pedestalClass}`} aria-hidden>
                <span className="podium-medal">{med}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="clasificacion-final-box">
        <h3 className="clasificacion-final-titulo">Clasificación final</h3>
        <div className="clasificacion-final-lista">
          {clasificacionFinalFilasCompletas.map((f) => {
            const vacio = Boolean(f.vacio);
            const jugTxt =
              !vacio && Array.isArray(f.jugadorLineas) && f.jugadorLineas.length ? f.jugadorLineas.join(' · ') : '—';
            const nombre = vacio || !String(f.equipoNombre || '').trim() ? '—' : f.equipoNombre;
            const ptsTxt =
              vacio || f.puntos == null || f.puntos === '' || Number.isNaN(Number(f.puntos))
                ? '—'
                : `${Number(f.puntos)} pts`;
            return (
              <div key={f.posicion} className="clasificacion-final-fila">
                <span className="clasificacion-final-pos">{f.posicion}</span>
                <span className={`clasificacion-final-equipo${vacio ? ' clasificacion-final-mute' : ''}`}>{nombre}</span>
                <span className={`clasificacion-final-jug${vacio ? ' clasificacion-final-mute' : ''}`}>{jugTxt}</span>
                <span className={`clasificacion-final-pts${vacio ? ' clasificacion-final-mute' : ''}`}>{ptsTxt}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderPanel = () => {
    switch (activeTab) {
      case 'equipos':
        return renderTabEquipos();
      case 'grupos':
        return renderTabGrupos();
      case 'fixture':
        return renderTabFixture();
      case 'llave':
        return renderTabLlave();
      case 'resultados':
        return esFinalizado ? renderTabResultados() : null;
      default:
        return null;
    }
  };

  const modalJugadores = modalEquipo ? safeJugadores(modalEquipo) : [];

  return (
    <>
      {showTorneoLogo ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '8px',
            marginBottom: '8px',
            width: '100%',
          }}
        >
          <img
            src="/logo-padbol-match.png"
            alt="Padbol Match"
            style={{
              maxHeight: `${logoMinHeightPx}px`,
              maxWidth: `${logoMinHeightPx}px`,
              height: 'auto',
              width: 'auto',
              objectFit: 'contain',
              objectPosition: 'center',
              display: 'block',
            }}
          />
        </div>
      ) : null}

      <div className="torneo-header" style={{ marginTop: showTorneoLogo ? 0 : '8px', marginBottom: '12px', padding: '20px' }}>
        <h1 style={{ fontSize: 'clamp(1.15rem, 4vw, 1.75rem)' }}>🏆 {torneo?.nombre}</h1>
        {sedeTexto ? <p>{sedeTexto}</p> : null}
        <p>
          {formatNivelTorneo(torneo?.nivel_torneo)} • {formatTipoTorneo(torneo?.tipo_torneo)} • {formatFecha(torneo?.fecha_inicio)}{' '}
          a {formatFecha(torneo?.fecha_fin)}
        </p>
      </div>

      {adminTorneoBar}

      <div
        className="torneo-tabs-sticky"
        style={{
          position: 'sticky',
          top: stickyTop,
          zIndex: 20,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(8px)',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '14px',
          boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', padding: '4px 6px', borderBottom: '1px solid #e2e8f0' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...TAB_BTN,
                color: activeTab === tab.id ? '#4f46e5' : '#64748b',
                borderBottomColor: activeTab === tab.id ? '#4f46e5' : 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ minHeight: '120px' }}>{renderPanel()}</div>

      {modalEquipo ? (
        <div className="modal-overlay" onClick={() => setModalEquipo(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3>{nombreEquipoMostrado(modalEquipo)}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              {modalJugadores.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setModalEquipo(null);
                    navigate(`/jugador/${slugJugador(String(p?.alias || p?.nombre || 'jugador'))}`);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '8px',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{jugadorEtiquetaConArroba(p)}</span>
                </button>
              ))}
            </div>
            <div className="modal-buttons" style={{ marginTop: '16px' }}>
              <button type="button" className="btn-cancelar" onClick={() => setModalEquipo(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showModalResultado && selectedPartido ? (
        <div className="modal-overlay" onClick={() => setShowModalResultado(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Cargar resultado</h3>
            {(() => {
              const mA = equipoPorId(equipos, selectedPartido.equipo_a_id);
              const mB = equipoPorId(equipos, selectedPartido.equipo_b_id);
              return (
                <p>
                  {nombreEquipoMostrado(mA || {})} vs {nombreEquipoMostrado(mB || {})}
                </p>
              );
            })()}
            <div className="form-sets">
              <div className="input-group">
                <label>Set 1</label>
                <input
                  type="text"
                  placeholder="6-4"
                  value={resultado.set1}
                  onChange={(e) => setResultado({ ...resultado, set1: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label>Set 2</label>
                <input
                  type="text"
                  value={resultado.set2}
                  onChange={(e) => setResultado({ ...resultado, set2: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label>Set 3 (opcional)</label>
                <input
                  type="text"
                  value={resultado.set3}
                  onChange={(e) => setResultado({ ...resultado, set3: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-buttons">
              <button type="button" className="btn-guardar" onClick={() => void guardarResultado()}>
                Guardar
              </button>
              <button type="button" className="btn-cancelar" onClick={() => setShowModalResultado(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
