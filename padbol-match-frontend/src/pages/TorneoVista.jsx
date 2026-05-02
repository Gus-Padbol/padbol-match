import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import TorneoTabbedView, {
  jugadorEtiquetaConArroba,
  nombreEquipoMostrado,
  safeJugadores,
} from '../components/torneo/TorneoTabbedView';
import { HUB_CONTENT_PADDING_BOTTOM_PX, hubContentPaddingTopCss } from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { supabase } from '../supabaseClient';
import { computeIsAdminEnTorneo, computePuedeGestionarEquiposTorneo } from '../utils/torneoAdminAccess';
import { setAdminNavContext, readAdminNavContext } from '../utils/adminNavContext';
import '../styles/TorneoVista.css';

export default function TorneoVista() {
  const { torneoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { rol, sedeId: userSedeId, pais: userPaisRol } = useUserRole(currentCliente);
  const [torneo, setTorneo] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [sedesMap, setSedesMap] = useState({});
  const [partidos, setPartidos] = useState([]);
  const [tablaPuntosRows, setTablaPuntosRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [iniciando, setIniciando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  const currentEmail = (session?.user?.email || '').trim().toLowerCase();
  const sedeTorneo = torneo ? sedesMap[String(torneo.sede_id)] : null;
  const fromAdmin = Boolean(location.state?.fromAdmin);
  const adminGestionaEquiposContext = fromAdmin || readAdminNavContext();
  const isAdmin = useMemo(
    () =>
      computeIsAdminEnTorneo({
        email: currentEmail,
        torneo,
        sedeTorneo,
        rol,
        userSedeId,
        userPaisRol,
        fromAdmin,
      }),
    [currentEmail, torneo, sedeTorneo, rol, userSedeId, userPaisRol, fromAdmin]
  );
  const puedeGestionarEquiposTorneo = useMemo(
    () =>
      computePuedeGestionarEquiposTorneo({
        torneo,
        sedeTorneo,
        rol,
        userSedeId,
        userPaisRol,
        fromAdmin: adminGestionaEquiposContext,
      }),
    [torneo, sedeTorneo, rol, userSedeId, userPaisRol, adminGestionaEquiposContext]
  );
  const torneoNavState = useMemo(
    () => (fromAdmin || location.state ? { ...(location.state || {}), ...(fromAdmin ? { fromAdmin: true } : {}) } : null),
    [location.state, fromAdmin]
  );

  useEffect(() => {
    if (fromAdmin) setAdminNavContext(true);
  }, [fromAdmin]);
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

  const todosEquiposCompletos = equipos.length > 0 && equipos.every(equipoListoParaIniciar);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [torneoRes, equiposRes, partidosRes, sedesRes] = await Promise.all([
          fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}`),
          fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}/equipos`),
          fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}/partidos`),
          fetch('https://padbol-backend.onrender.com/api/sedes').catch(() => null),
        ]);

        if (!torneoRes.ok || !equiposRes.ok || !partidosRes.ok) {
          throw new Error('Error al cargar datos');
        }

        const torneoData = await torneoRes.json();
        const equiposData = await equiposRes.json();
        const partidosData = await partidosRes.json();
        let sedesData = [];
        if (sedesRes?.ok) {
          sedesData = await sedesRes.json();
        }

        const nextSedesMap = {};
        (sedesData || []).forEach((sede) => {
          nextSedesMap[String(sede.id)] = sede;
        });

        setTorneo(torneoData);
        setEquipos(equiposData);
        setPartidos(partidosData);
        setSedesMap(nextSedesMap);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [torneoId]);

  const tidNum = parseInt(String(torneoId), 10);
  useEffect(() => {
    if (!Number.isFinite(tidNum) || String(torneo?.estado || '').toLowerCase() !== 'finalizado') {
      setTablaPuntosRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('tabla_puntos')
        .select('equipo_id, posicion, puntos')
        .eq('torneo_id', tidNum)
        .order('posicion', { ascending: true });
      if (cancelled) return;
      if (err) {
        console.error('[TorneoVista] tabla_puntos', err);
        setTablaPuntosRows([]);
        return;
      }
      setTablaPuntosRows(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [tidNum, torneo?.estado]);

  const clasificacionFinalFilas = useMemo(() => {
    if (!tablaPuntosRows.length) return null;
    const eqById = {};
    equipos.forEach((e) => {
      eqById[e.id] = e;
    });
    return tablaPuntosRows
      .map((row) => {
        const eq = eqById[row.equipo_id];
        const players = eq ? safeJugadores(eq) : [];
        return {
          equipoId: eq?.id ?? row.equipo_id,
          posicion: Number(row.posicion) || 0,
          puntos: row.puntos,
          fotoEquipoUrl: String(eq?.foto_url || '').trim(),
          jugadores: players,
          equipoNombre: eq ? nombreEquipoMostrado(eq) : `Equipo #${row.equipo_id}`,
          jugadorLineas: players.slice(0, 4).map((p) => jugadorEtiquetaConArroba(p)),
        };
      })
      .sort((a, b) => (a.posicion || 999) - (b.posicion || 999));
  }, [tablaPuntosRows, equipos]);

  const iniciarTorneo = async () => {
    const avisoIncompleto = !todosEquiposCompletos
      ? 'Algunos equipos aún no están completos. '
      : '';
    if (
      !window.confirm(
        `${avisoIncompleto}¿Iniciar el torneo? Se cerrará la inscripción y el estado pasará a «en curso».`
      )
    ) {
      return;
    }
    setIniciando(true);
    try {
      const res = await fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'en_curso' }),
      });
      if (res.ok) {
        setTorneo((prev) => ({ ...prev, estado: 'en_curso' }));
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
    if (!window.confirm('¿Finalizar el torneo? Se calcularán las posiciones finales y se asignarán los puntos de ranking.'))
      return;
    setFinalizando(true);
    try {
      const res = await fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}/finalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setEquipos((prev) =>
          prev.map((eq) => {
            const found = (data.clasificacion || []).find((c) => c.equipo_id === eq.id);
            return found ? { ...eq, puntos_ranking: found.puntos } : eq;
          })
        );
        setTorneo((prev) => ({ ...prev, estado: 'finalizado' }));
      } else {
        alert(data.error || 'Error al finalizar el torneo');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setFinalizando(false);
    }
  };

  const estadoTorneoLower = String(torneo?.estado || '').toLowerCase();
  const adminGestionandoEnTorneo =
    isAdmin && (fromAdmin || readAdminNavContext());
  const inscripcionAbiertaParaJugador = ['inscripcion_abierta', 'abierto'].includes(estadoTorneoLower);
  const puedeMostrarIniciarTorneo =
    isAdmin && ['inscripcion_abierta', 'abierto'].includes(estadoTorneoLower);

  const miEquipoEnTorneo = useMemo(() => {
    const em = String(session?.user?.email || '').trim().toLowerCase();
    if (!em || !Array.isArray(equipos) || equipos.length === 0) return null;
    for (const eq of equipos) {
      const arr = Array.isArray(eq?.jugadores) ? eq.jugadores : [];
      if (arr.some((j) => String(j?.email || '').trim().toLowerCase() === em)) return eq;
    }
    return null;
  }, [equipos, session?.user?.email]);

  const adminTorneoBar = torneo ? (
    <div className="torneo-admin-bar-violeta" style={{ marginBottom: '12px' }}>
      {estadoTorneoLower !== 'finalizado' ? (
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <button
            type="button"
            className="btn-agregar-jugadores"
            onClick={() => navigate(`/torneo/${torneoId}/equipos`, torneoNavState ? { state: torneoNavState } : undefined)}
          >
            Equipos e inscripción
          </button>
        </div>
      ) : null}
      {puedeMostrarIniciarTorneo && (
        <div className="torneo-acciones torneo-acciones--sobre-violeta">
          {!todosEquiposCompletos ? (
            <p className="torneo-iniciar-aviso">
              Faltan equipos completos para iniciar. Podés iniciar igual para cerrar inscripción.
            </p>
          ) : null}
          <button
            type="button"
            className="btn-iniciar-torneo btn-iniciar-torneo--sobre-violeta"
            onClick={() => void iniciarTorneo()}
            disabled={iniciando}
          >
            {iniciando ? 'Iniciando...' : '🚀 Iniciar torneo'}
          </button>
        </div>
      )}
      {isAdmin &&
        ['en_curso', 'activo'].includes(String(torneo.estado || '').toLowerCase()) &&
        partidos.length > 0 &&
        partidos.every((p) => p.estado === 'finalizado') && (
          <div className="torneo-acciones">
            <button type="button" className="btn-finalizar-torneo" onClick={() => void finalizarTorneo()} disabled={finalizando}>
              {finalizando ? 'Finalizando...' : '🏆 Finalizar torneo'}
            </button>
          </div>
        )}
    </div>
  ) : null;

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          paddingTop: hubContentPaddingTopCss(location.pathname),
          paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
          boxSizing: 'border-box',
        }}
      >
        <AppHeader title="Torneo" showBack />
        <div className="loading">Cargando...</div>
        <BottomNav />
      </div>
    );
  }
  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          paddingTop: hubContentPaddingTopCss(location.pathname),
          paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
          boxSizing: 'border-box',
        }}
      >
        <AppHeader title="Torneo" showBack />
        <div className="error">Error: {error}</div>
        <BottomNav />
      </div>
    );
  }
  if (!torneo) {
    return (
      <div
        style={{
          minHeight: '100vh',
          paddingTop: hubContentPaddingTopCss(location.pathname),
          paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
          boxSizing: 'border-box',
        }}
      >
        <AppHeader title="Torneo" showBack />
        <div className="error">Torneo no encontrado</div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div
      className="torneo-vista-container"
      style={{
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
      }}
    >
      <AppHeader title="Torneo" showBack />
      <img
        src="/logo-padbol-match.png"
        alt="Padbol Match"
        style={{
          ...padbolLogoImgStyle,
          marginBottom: '10px',
        }}
      />
      {torneo && session?.user && inscripcionAbiertaParaJugador && !adminGestionandoEnTorneo ? (
        <div
          style={{
            margin: '0 12px 16px',
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #c7d2fe',
            boxShadow: '0 4px 14px rgba(99,102,241,0.15)',
          }}
        >
          {miEquipoEnTorneo ? (
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#166534', textAlign: 'center' }}>
              ✓ Ya estás inscripto — {nombreEquipoMostrado(miEquipoEnTorneo)}
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#475569', textAlign: 'center', lineHeight: 1.4 }}>
                Inscripción abierta. Creá un equipo o unite a uno existente.
              </p>
              <button
                type="button"
                className="btn-agregar-jugadores"
                onClick={() =>
                  navigate(`/torneo/${torneoId}/equipos`, torneoNavState ? { state: torneoNavState } : undefined)
                }
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '15px',
                  fontWeight: 800,
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff',
                }}
              >
                ➕ Inscribirme / Crear equipo
              </button>
            </>
          )}
        </div>
      ) : null}
      <TorneoTabbedView
        torneo={torneo}
        equipos={equipos}
        partidos={partidos}
        setPartidos={setPartidos}
        sedesMap={sedesMap}
        torneoId={torneoId}
        navigate={navigate}
        session={session}
        isAdmin={isAdmin}
        puedeGestionarEquiposTorneo={puedeGestionarEquiposTorneo}
        navigateState={torneoNavState}
        clasificacionFinalFilas={clasificacionFinalFilas}
        adminTorneoBar={adminTorneoBar}
        stickyTop={hubContentPaddingTopCss(location.pathname)}
        showTorneoLogo={false}
      />
      <BottomNav />
    </div>
  );
}
