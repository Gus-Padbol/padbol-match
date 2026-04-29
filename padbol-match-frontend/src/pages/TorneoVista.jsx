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
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import '../styles/TorneoVista.css';

const ADMIN_EMAILS = ['padbolinternacional@gmail.com', 'admin@padbol.com', 'sm@padbol.com', 'juanpablo@padbol.com'];

export default function TorneoVista() {
  const { torneoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
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
  const isAdmin = ADMIN_EMAILS.includes(currentEmail);
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
          posicion: Number(row.posicion) || 0,
          puntos: row.puntos,
          equipoNombre: eq ? nombreEquipoMostrado(eq) : `Equipo #${row.equipo_id}`,
          jugadorLineas: players.slice(0, 4).map((p) => jugadorEtiquetaConArroba(p)),
        };
      })
      .sort((a, b) => (a.posicion || 999) - (b.posicion || 999));
  }, [tablaPuntosRows, equipos]);

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

  const adminTorneoBar = torneo ? (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <button type="button" className="btn-agregar-jugadores" onClick={() => navigate(`/torneo/${torneoId}/equipos`)}>
          Equipos e inscripción
        </button>
      </div>
      {isAdmin && !['en_curso', 'finalizado'].includes(String(torneo.estado || '').toLowerCase()) && (
        <div className="torneo-acciones">
          {!todosEquiposCompletos ? (
            <p className="torneo-iniciar-aviso" style={{ margin: '8px 0 0', color: '#b45309', fontWeight: 600 }}>
              Faltan equipos completos para iniciar
            </p>
          ) : null}
          <button
            type="button"
            className="btn-iniciar-torneo"
            onClick={() => void iniciarTorneo()}
            disabled={iniciando || !todosEquiposCompletos}
          >
            {iniciando ? 'Iniciando...' : '🚀 Iniciar torneo'}
          </button>
        </div>
      )}
      {isAdmin &&
        String(torneo.estado || '').toLowerCase() === 'en_curso' &&
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
        <AppHeader title="Torneo" />
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
        <AppHeader title="Torneo" />
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
        <AppHeader title="Torneo" />
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
      <AppHeader title="Torneo" />
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
        clasificacionFinalFilas={clasificacionFinalFilas}
        adminTorneoBar={adminTorneoBar}
        stickyTop={hubContentPaddingTopCss(location.pathname)}
        showTorneoLogo
      />
      <BottomNav />
    </div>
  );
}
