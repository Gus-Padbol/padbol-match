import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { supabase } from '../supabaseClient';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_CONTENT_PADDING_TOP_PX,
} from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import { formatNivelTorneo, formatTipoTorneo } from '../utils/torneoFormatters';
import '../styles/TorneoVista.css';

// "2026-02-26" → "26 Feb 2026"
function formatFecha(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

const ADMIN_EMAILS = ['padbolinternacional@gmail.com', 'admin@padbol.com', 'sm@padbol.com', 'juanpablo@padbol.com'];

export default function TorneoVista() {
  const { torneoId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [torneo, setTorneo] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPartido, setSelectedPartido] = useState(null);
  const [resultado, setResultado] = useState({ set1: '', set2: '', set3: '' });
  const [iniciando, setIniciando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [showJugadoresInscriptos, setShowJugadoresInscriptos] = useState(false);
  const [loadingJugadoresInscriptos, setLoadingJugadoresInscriptos] = useState(false);
  const [jugadoresInscriptos, setJugadoresInscriptos] = useState([]);

  const currentEmail = (session?.user?.email || '').trim().toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(currentEmail);
  const isSuperAdmin = currentEmail === 'padbolinternacional@gmail.com';
  const adminGestionView = isAdmin || isSuperAdmin;
  const estadoTorneo = String(torneo?.estado || '').trim().toLowerCase();
  const mostrarTablaYPartidos = ['activo', 'en_curso', 'abierto', 'finalizado'].includes(estadoTorneo);

  const esUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

  const cargarJugadoresInscriptos = async () => {
    setLoadingJugadoresInscriptos(true);
    try {
      const { data: equiposRows, error: equiposError } = await supabase
        .from('equipos')
        .select('id, jugadores')
        .eq('torneo_id', torneoId);
      if (equiposError) throw equiposError;

      const jugadoresBase = [];
      (equiposRows || []).forEach((equipo) => {
        const arr = Array.isArray(equipo?.jugadores) ? equipo.jugadores : [];
        arr.forEach((j) => {
          if (!j) return;
          const email = String(j?.email || '').trim().toLowerCase();
          const userId = String(j?.id || '').trim();
          jugadoresBase.push({
            key: userId || email || String(j?.nombre || '').trim(),
            user_id: esUuid(userId) ? userId : '',
            email,
            nombre: String(j?.nombre || '').trim(),
          });
        });
      });

      const userIds = [...new Set(jugadoresBase.map((j) => j.user_id).filter(Boolean))];
      const emails = [...new Set(jugadoresBase.map((j) => j.email).filter(Boolean))];

      let perfiles = [];
      if (userIds.length > 0) {
        const { data: perfilesById, error: errById } = await supabase
          .from('jugadores_perfil')
          .select('user_id, email, alias, nombre, nivel, ciudad, localidad, foto_url')
          .in('user_id', userIds);
        if (errById) throw errById;
        perfiles = [...perfiles, ...(perfilesById || [])];
      }
      if (emails.length > 0) {
        const { data: perfilesByEmail, error: errByEmail } = await supabase
          .from('jugadores_perfil')
          .select('user_id, email, alias, nombre, nivel, ciudad, localidad, foto_url')
          .in('email', emails);
        if (errByEmail) throw errByEmail;
        perfiles = [...perfiles, ...(perfilesByEmail || [])];
      }

      const perfilByUserId = new Map();
      const perfilByEmail = new Map();
      perfiles.forEach((p) => {
        const uid = String(p?.user_id || '').trim();
        const email = String(p?.email || '').trim().toLowerCase();
        if (uid) perfilByUserId.set(uid, p);
        if (email) perfilByEmail.set(email, p);
      });

      const seen = new Set();
      const jugadores = jugadoresBase
        .map((base) => {
          const perfil = (base.user_id && perfilByUserId.get(base.user_id))
            || (base.email && perfilByEmail.get(base.email))
            || null;
          const nombreFinal = String(perfil?.alias || perfil?.nombre || base.nombre || 'Jugador').trim();
          const categoria = String(perfil?.nivel || 'Sin definir').trim() || 'Sin definir';
          const sede = String(perfil?.ciudad || perfil?.localidad || 'Sin definir').trim() || 'Sin definir';
          const foto = String(perfil?.foto_url || '').trim();
          const key = `${base.user_id || ''}|${base.email || ''}|${nombreFinal.toLowerCase()}`;
          return { key, nombreFinal, categoria, sede, foto };
        })
        .filter((j) => {
          if (!j.key || seen.has(j.key)) return false;
          seen.add(j.key);
          return true;
        });

      setJugadoresInscriptos(jugadores);
    } catch (err) {
      console.error('[TorneoVista] Error cargando jugadores inscriptos:', err);
      alert('No se pudieron cargar los jugadores inscriptos');
      setJugadoresInscriptos([]);
    } finally {
      setLoadingJugadoresInscriptos(false);
    }
  };

  const toggleJugadoresInscriptos = async () => {
    const next = !showJugadoresInscriptos;
    setShowJugadoresInscriptos(next);
    if (next) await cargarJugadoresInscriptos();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [torneoRes, equiposRes, partidosRes] = await Promise.all([
          fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}`),
          fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}/equipos`),
          fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}/partidos`)
        ]);

        if (!torneoRes.ok || !equiposRes.ok || !partidosRes.ok) {
          throw new Error('Error al cargar datos');
        }

        const torneoData = await torneoRes.json();
        const equiposData = await equiposRes.json();
        const partidosData = await partidosRes.json();

        setTorneo(torneoData);
        setEquipos(equiposData);
        setPartidos(partidosData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [torneoId]);

  // Calculates W/L/pts/sets/games stats for a given set of equipos + partidos.
  // Works for the full torneo or a single group slice.
  const calcularStats = (equiposList, partidosList) => {
    const stats = {};
    equiposList.forEach(eq => {
      stats[eq.id] = { jj: 0, g: 0, p: 0, pts: 0, sg: 0, sp: 0, gg: 0, gp: 0 };
    });
    partidosList.forEach(partido => {
      if (partido.estado !== 'finalizado' || !partido.resultado) return;
      const res = typeof partido.resultado === 'string' ? JSON.parse(partido.resultado) : partido.resultado;
      const sets = [res.set1, res.set2, res.set3].filter(s => s);
      let sgA = 0, sgB = 0, ggA = 0, ggB = 0;
      sets.forEach(set => {
        const [a, b] = set.split('-').map(Number);
        ggA += a; ggB += b;
        if (a > b) sgA++; else sgB++;
      });
      const eqA = stats[partido.equipo_a_id];
      const eqB = stats[partido.equipo_b_id];
      if (!eqA || !eqB) return;
      eqA.jj++; eqB.jj++;
      eqA.sg += sgA; eqA.sp += sgB; eqA.gg += ggA; eqA.gp += ggB;
      eqB.sg += sgB; eqB.sp += sgA; eqB.gg += ggB; eqB.gp += ggA;
      if (sgA > sgB) { eqA.g++; eqB.p++; eqA.pts += 3; }
      else           { eqB.g++; eqA.p++; eqB.pts += 3; }
    });
    return stats;
  };

  // Builds a sorted tabla de posiciones from a subset of equipos + partidos.
  const buildTabla = (equiposList, partidosList) => {
    const stats = calcularStats(equiposList, partidosList);
    return equiposList.map(eq => ({
      id: eq.id,
      nombre: eq.nombre,
      jugadores: eq.jugadores || [],
      puntos_ranking: eq.puntos_ranking || 0,
      jj:  stats[eq.id].jj,
      g:   stats[eq.id].g,
      p:   stats[eq.id].p,
      pts: stats[eq.id].pts,
      sg:  stats[eq.id].sg,
      sp:  stats[eq.id].sp,
      gg:  stats[eq.id].gg,
      gp:  stats[eq.id].gp,
      djuegos: (stats[eq.id].gg - stats[eq.id].gp) || 0,
      dif:     (stats[eq.id].sg - stats[eq.id].sp) || 0,
    })).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if ((b.sg - b.sp) !== (a.sg - a.sp)) return (b.sg - b.sp) - (a.sg - a.sp);
      if ((b.gg - b.gp) !== (a.gg - a.gp)) return (b.gg - b.gp) - (a.gg - a.gp);
      return 0;
    });
  };

  // Derive equipo → grupo: prefer equipo.grupo (set by backend), fallback to partidos
  const equipoGrupoMap = {};
  equipos.forEach(eq => { if (eq.grupo) equipoGrupoMap[eq.id] = eq.grupo; });
  partidos.forEach(p => {
    if (p.grupo) {
      if (p.equipo_a_id && !equipoGrupoMap[p.equipo_a_id]) equipoGrupoMap[p.equipo_a_id] = p.grupo;
      if (p.equipo_b_id && !equipoGrupoMap[p.equipo_b_id]) equipoGrupoMap[p.equipo_b_id] = p.grupo;
    }
  });

  const esGruposKnockout = torneo?.tipo_torneo === 'grupos_knockout';
  const grupos = esGruposKnockout
    ? [...new Set(Object.values(equipoGrupoMap))].sort()
    : [];

  // For non-grupo layout (or as fallback)
  const tablaPosiciones = buildTabla(equipos, partidos);

  const countJugadoresEquipo = (eq) => {
    const j = eq?.jugadores;
    if (Array.isArray(j)) return j.length;
    if (typeof j === 'string' && j.trim()) {
      return j
        .split(' + ')
        .map((s) => s.trim())
        .filter(Boolean).length;
    }
    return 0;
  };

  const jugadorEquipoListoParaTorneo = (raw) => {
    const p = typeof raw === 'object' && raw != null ? raw : { nombre: raw, email: '' };
    if (p.estado === 'pendiente') return false;
    if (String(p.email || '').trim()) return true;
    if (p.id != null && p.id !== '') return true;
    return false;
  };

  const equipoListoParaIniciar = (eq) => {
    const cupo = Number(eq.cupo_maximo || 2);
    const arr = Array.isArray(eq?.jugadores) ? eq.jugadores : [];
    if (arr.length < cupo) return false;
    return arr.every(jugadorEquipoListoParaTorneo);
  };

  const todosEquiposCompletos =
    equipos.length > 0 && equipos.every(equipoListoParaIniciar);

  const abrirModal = (partido) => {
    if (partido.estado === 'finalizado') {
      alert('Este partido ya está finalizado');
      return;
    }
    setSelectedPartido(partido);
    setResultado({ set1: '', set2: '', set3: '' });
    setShowModal(true);
  };

  const guardarResultado = async () => {
    if (!selectedPartido) return;

    const sets = [resultado.set1, resultado.set2, resultado.set3].filter(s => s.trim());
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
          resultado: JSON.stringify(resultado)
        })
      });

      if (res.ok) {
        setPartidos(partidos.map(p => 
          p.id === selectedPartido.id 
            ? { ...p, estado: 'finalizado', resultado: JSON.stringify(resultado) }
            : p
        ));
        setShowModal(false);
        setSelectedPartido(null);
      }
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    }
  };

  const iniciarTorneo = async () => {
    if (!todosEquiposCompletos) {
      alert('Faltan equipos completos para iniciar');
      return;
    }
    if (!window.confirm('¿Iniciar el torneo? El estado cambiará a "en curso".')) return;
    setIniciando(true);
    try {
      const res = await fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'en_curso' })
      });
      if (res.ok) {
        setTorneo(prev => ({ ...prev, estado: 'en_curso' }));
      } else {
        alert('Error al iniciar el torneo');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIniciando(false);
    }
  };

  const finalizarTorneo = async () => {
    if (!window.confirm('¿Finalizar el torneo? Se calcularán las posiciones finales y se asignarán los puntos de ranking.')) return;
    setFinalizando(true);
    try {
      const res = await fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setEquipos(prev => prev.map(eq => {
          const found = (data.clasificacion || []).find(c => c.equipo_id === eq.id);
          return found ? { ...eq, puntos_ranking: found.puntos } : eq;
        }));
        setTorneo(prev => ({ ...prev, estado: 'finalizado' }));
      } else {
        alert(data.error || 'Error al finalizar el torneo');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setFinalizando(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', paddingTop: `${HUB_CONTENT_PADDING_TOP_PX}px`, paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`, boxSizing: 'border-box' }}>
        <AppHeader title="Torneo" />
        <div className="loading">Cargando...</div>
        <BottomNav />
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ minHeight: '100vh', paddingTop: `${HUB_CONTENT_PADDING_TOP_PX}px`, paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`, boxSizing: 'border-box' }}>
        <AppHeader title="Torneo" />
        <div className="error">Error: {error}</div>
        <BottomNav />
      </div>
    );
  }
  if (!torneo) {
    return (
      <div style={{ minHeight: '100vh', paddingTop: `${HUB_CONTENT_PADDING_TOP_PX}px`, paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`, boxSizing: 'border-box' }}>
        <AppHeader title="Torneo" />
        <div className="error">Torneo no encontrado</div>
        <BottomNav />
      </div>
    );
  }

  if (torneo.estado === 'finalizado') {
    const top3   = tablaPosiciones.slice(0, 3);
    const rest   = tablaPosiciones.slice(3, 10);
    const first  = top3[0];
    const second = top3[1];
    const third  = top3[2];

    const PodiumCard = ({ eq, medal }) => (
      <div className="podium-card">
        <div className="podium-medal">{medal}</div>
        <div className="podium-team-name">{eq.nombre}</div>
        {eq.jugadores.length > 0 && (
          <div className="podium-players">{eq.jugadores.map(j => j.nombre).join(' · ')}</div>
        )}
        <div className="podium-points">{eq.puntos_ranking} <span>pts</span></div>
      </div>
    );

    return (
      <div className="torneo-vista-container" style={{ paddingTop: `${HUB_CONTENT_PADDING_TOP_PX}px`, paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px` }}>
        <AppHeader title="Torneo" />

        <div className="finalizado-header">
          <div className="finalizado-trophy">🏆</div>
          <h1 className="finalizado-titulo">¡Torneo Finalizado!</h1>
          <p className="finalizado-nombre">{torneo.nombre}</p>
          <p className="finalizado-info">
            {formatNivelTorneo(torneo.nivel_torneo)} • {formatTipoTorneo(torneo.tipo_torneo)} • {formatFecha(torneo.fecha_inicio)} a {formatFecha(torneo.fecha_fin)}
          </p>
        </div>

        <div className="podium-wrapper">
          {second && (
            <div className="podium-slot">
              <PodiumCard eq={second} medal="🥈" />
              <div className="podium-block podium-block-2">2</div>
            </div>
          )}
          {first && (
            <div className="podium-slot">
              <PodiumCard eq={first} medal="🥇" />
              <div className="podium-block podium-block-1">1</div>
            </div>
          )}
          {third && (
            <div className="podium-slot">
              <PodiumCard eq={third} medal="🥉" />
              <div className="podium-block podium-block-3">3</div>
            </div>
          )}
        </div>

        {rest.length > 0 && (
          <div className="clasificacion-resto">
            <h3>Clasificación final</h3>
            {rest.map((eq, idx) => (
              <div key={eq.id} className="clasificacion-item">
                <span className="clasificacion-pos">{idx + 4}</span>
                <div className="clasificacion-info">
                  <span className="clasificacion-nombre">{eq.nombre}</span>
                  {eq.jugadores.length > 0 && (
                    <span className="clasificacion-players">{eq.jugadores.map(j => j.nombre).join(' · ')}</span>
                  )}
                </div>
                <span className="clasificacion-pts">{eq.puntos_ranking} pts</span>
              </div>
            ))}
          </div>
        )}
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="torneo-vista-container" style={{ paddingTop: `${HUB_CONTENT_PADDING_TOP_PX}px`, paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px` }}>
      <AppHeader title="Torneo" />

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', marginBottom: '10px' }}>
        <img
          src="/logo-padbol-match.png"
          alt="Padbol Match"
          style={{ width: '60px', height: 'auto', objectFit: 'contain' }}
        />
      </div>
      <div className="torneo-header" style={{ marginTop: '16px' }}>
        <h1>🏆 {torneo.nombre}</h1>
        <p>{formatNivelTorneo(torneo.nivel_torneo)} • {formatTipoTorneo(torneo.tipo_torneo)} • {formatFecha(torneo.fecha_inicio)} a {formatFecha(torneo.fecha_fin)}</p>
        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {!adminGestionView ? (
            <button
              type="button"
              className="btn-agregar-jugadores"
              onClick={() => navigate(`/torneo/${torneoId}/equipos`)}
            >
              Equipos e inscripción
            </button>
          ) : null}
        </div>
        {adminGestionView ? (
          <div className="torneo-acciones">
            <button className="btn-agregar-jugadores" onClick={toggleJugadoresInscriptos}>
              👥 Jugadores inscriptos
            </button>
            <div style={{ width: '100%', marginTop: '10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px' }}>
              <h3 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '14px' }}>Equipos inscriptos</h3>
              {equipos.length === 0 ? (
                <p style={{ margin: 0, color: '#64748b' }}>No hay equipos inscriptos todavía.</p>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {equipos.map((eq) => (
                    <div key={eq.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '8px 10px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{eq.nombre || `Equipo #${eq.id}`}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {(Array.isArray(eq.jugadores) && eq.jugadores.length > 0)
                            ? eq.jugadores.map((j) => j?.nombre || j?.alias || 'Jugador').join(' · ')
                            : 'Sin jugadores'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          Estado: {String(eq?.estado || 'pendiente')}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-agregar-jugadores"
                        onClick={() => navigate(`/equipo/${eq.id}`)}
                        style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}
                      >
                        Gestionar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {showJugadoresInscriptos && (
              <div style={{ width: '100%', marginTop: '10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px' }}>
                {loadingJugadoresInscriptos ? (
                  <p style={{ margin: 0, color: '#64748b' }}>Cargando jugadores...</p>
                ) : jugadoresInscriptos.length === 0 ? (
                  <p style={{ margin: 0, color: '#64748b' }}>No hay jugadores inscriptos todavía.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {jugadoresInscriptos.map((j) => (
                      <div key={j.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '8px 10px' }}>
                        {j.foto ? (
                          <img src={j.foto} alt={j.nombreFinal} style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', background: '#e2e8f0' }} />
                        ) : (
                          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👤</div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{j.nombreFinal}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            Categoría: {j.categoria} · Sede: {j.sede}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
        {isAdmin && !['en_curso', 'finalizado'].includes((torneo.estado || '').toLowerCase()) && (
          <div className="torneo-acciones">
            {!todosEquiposCompletos ? (
              <p className="torneo-iniciar-aviso" style={{ margin: '8px 0 0', color: '#b45309', fontWeight: 600 }}>
                Faltan equipos completos para iniciar
              </p>
            ) : null}
            <button
              className="btn-iniciar-torneo"
              onClick={iniciarTorneo}
              disabled={iniciando || !todosEquiposCompletos}
            >
              {iniciando ? 'Iniciando...' : '🚀 Iniciar torneo'}
            </button>
          </div>
        )}
        {isAdmin && torneo.estado === 'en_curso' && partidos.length > 0 && partidos.every(p => p.estado === 'finalizado') && (
          <div className="torneo-acciones">
            <button className="btn-finalizar-torneo" onClick={finalizarTorneo} disabled={finalizando}>
              {finalizando ? 'Finalizando...' : '🏆 Finalizar torneo'}
            </button>
          </div>
        )}
      </div>

      {/* ── Reusable tabla component ── */}
      {mostrarTablaYPartidos ? (() => {
        const TablaPosicionesTable = ({ tabla }) => (
          <table className="tabla-posiciones">
            <thead>
              <tr>
                <th>#</th><th>EQUIPO</th><th>JJ</th><th>G</th><th>P</th>
                <th>PTS</th><th>SG</th><th>SP</th><th>GG</th><th>GP</th>
                <th>DJUEGOS</th><th>DIF</th>
              </tr>
            </thead>
            <tbody>
              {tabla.map((eq, idx) => (
                <tr key={eq.id}>
                  <td>{idx + 1}</td>
                  <td className="equipo-nombre">
                    {eq.nombre}
                    {eq.jugadores.length > 0 && (
                      <span className="jugadores-nombres">{eq.jugadores.map(j => j.nombre).join(' · ')}</span>
                    )}
                  </td>
                  <td>{eq.jj}</td><td>{eq.g}</td><td>{eq.p}</td>
                  <td className="pts">{eq.pts}</td>
                  <td>{eq.sg}</td><td>{eq.sp}</td><td>{eq.gg}</td><td>{eq.gp}</td>
                  <td className={eq.djuegos > 0 ? 'positivo' : eq.djuegos < 0 ? 'negativo' : ''}>
                    {eq.djuegos > 0 ? '+' : ''}{eq.djuegos}
                  </td>
                  <td className={eq.dif > 0 ? 'positivo' : eq.dif < 0 ? 'negativo' : ''}>
                    {eq.dif > 0 ? '+' : ''}{eq.dif}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

        const PartidosList = ({ lista }) => (
          lista.length === 0 ? <p className="sin-partidos">Sin partidos aún</p> : (
            <div className="lista-partidos">
              {lista.map(partido => {
                const eqA = equipos.find(e => e.id === partido.equipo_a_id);
                const eqB = equipos.find(e => e.id === partido.equipo_b_id);
                return (
                  <div key={partido.id} className="partido-item" onClick={() => abrirModal(partido)}>
                    <div className="partido-content">
                      <span className="equipo-a">
                        {eqA?.nombre || 'Equipo A'}
                        {eqA?.jugadores?.length > 0 && (
                          <span className="jugadores-nombres">{eqA.jugadores.map(j => j.nombre).join(' · ')}</span>
                        )}
                      </span>
                      <span className="vs">vs</span>
                      <span className="equipo-b">
                        {eqB?.nombre || 'Equipo B'}
                        {eqB?.jugadores?.length > 0 && (
                          <span className="jugadores-nombres">{eqB.jugadores.map(j => j.nombre).join(' · ')}</span>
                        )}
                      </span>
                    </div>
                    <span className={`estado ${partido.estado}`}>
                      {partido.estado === 'finalizado' ? '✅ Finalizado' : '⏳ Pendiente'}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        );

        // ── grupos_knockout: one section per group ──
        if (esGruposKnockout && grupos.length > 0) {
          return (
            <div className="grupos-container">
              {grupos.map(grupo => {
                const grupoEquipos  = equipos.filter(eq => equipoGrupoMap[eq.id] === grupo);
                const grupoPartidos = partidos.filter(p => p.grupo === grupo);
                const tablaGrupo    = buildTabla(grupoEquipos, grupoPartidos);
                // Partidos without a grupo (knockout phase) shown separately below all groups
                return (
                  <div key={grupo} className="grupo-section">
                    <div className="grupo-header">Grupo {grupo}</div>
                    <div className="contenedor-dos-columnas">
                      <div className="tabla-posiciones-box">
                        <h2>📊 Posiciones</h2>
                        <TablaPosicionesTable tabla={tablaGrupo} />
                      </div>
                      <div className="partidos-box">
                        <h2>📋 Partidos</h2>
                        <PartidosList lista={grupoPartidos} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Knockout phase partidos (no grupo assigned) */}
              {partidos.some(p => !p.grupo) && (
                <div className="grupo-section">
                  <div className="grupo-header grupo-header-knockout">⚔️ Fase Eliminatoria</div>
                  <div className="partidos-box" style={{ background: 'white', borderRadius: '16px', padding: '25px' }}>
                    <PartidosList lista={partidos.filter(p => !p.grupo)} />
                  </div>
                </div>
              )}
            </div>
          );
        }

        // ── Default: single tabla + partidos ──
        return (
          <div className="contenedor-dos-columnas">
            <div className="tabla-posiciones-box">
              <h2>📊 Tabla de Posiciones</h2>
              <TablaPosicionesTable tabla={tablaPosiciones} />
            </div>
            <div className="partidos-box">
              <h2>📋 Partidos</h2>
              <PartidosList lista={partidos} />
            </div>
          </div>
        );
      })() : null}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Cargar Resultado</h3>
            {selectedPartido && (() => {
              const mA = equipos.find(e => e.id === selectedPartido.equipo_a_id);
              const mB = equipos.find(e => e.id === selectedPartido.equipo_b_id);
              const nombresA = mA?.jugadores?.map(j => j.nombre).join(', ');
              const nombresB = mB?.jugadores?.map(j => j.nombre).join(', ');
              return (
                <p>
                  {mA?.nombre}{nombresA && <span className="modal-jugadores"> ({nombresA})</span>}
                  {' vs '}
                  {mB?.nombre}{nombresB && <span className="modal-jugadores"> ({nombresB})</span>}
                </p>
              );
            })()}
            
            <div className="form-sets">
              <div className="input-group">
                <label>Set 1 (ej: 6-4)</label>
                <input
                  type="text"
                  placeholder="6-4"
                  value={resultado.set1}
                  onChange={e => setResultado({ ...resultado, set1: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label>Set 2 (ej: 7-5)</label>
                <input
                  type="text"
                  placeholder="7-5"
                  value={resultado.set2}
                  onChange={e => setResultado({ ...resultado, set2: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label>Set 3 (opcional)</label>
                <input
                  type="text"
                  placeholder="6-2"
                  value={resultado.set3}
                  onChange={e => setResultado({ ...resultado, set3: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-buttons">
              <button className="btn-guardar" onClick={guardarResultado}>Guardar</button>
              <button className="btn-cancelar" onClick={() => setShowModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}