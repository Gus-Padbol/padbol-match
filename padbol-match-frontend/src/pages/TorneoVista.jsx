import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import TorneoTabbedView, {
  jugadorEtiquetaConArroba,
  nombreEquipoMostrado,
  safeJugadores,
} from '../components/torneo/TorneoTabbedView';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { padbolLogoImgStyle } from '../constants/padbolLogoStyle';
import { useAuth } from '../context/AuthContext';
import { authUrlWithRedirect } from '../utils/authLoginRedirect';
import useUserRole from '../hooks/useUserRole';
import { supabase } from '../supabaseClient';
import { computeIsAdminEnTorneo, computePuedeGestionarEquiposTorneo } from '../utils/torneoAdminAccess';
import { clearAdminNavContext, setAdminNavContext } from '../utils/adminNavContext';
import '../styles/TorneoVista.css';

const API_BASE_URL = 'https://padbol-backend.onrender.com';

export default function TorneoVista() {
  const { torneoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const [modalInscribirseOpen, setModalInscribirseOpen] = useState(false);
  const [listaEsperaEnrolled, setListaEsperaEnrolled] = useState(false);
  const [listaEsperaChecked, setListaEsperaChecked] = useState(false);
  const [listaEsperaMsg, setListaEsperaMsg] = useState('');
  const [abrirInscripcionLoading, setAbrirInscripcionLoading] = useState(false);
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
  /** Barra violeta y permisos de edición en pestañas: solo con `state.fromAdmin` (no basta ser admin del club sin venir del panel). */
  const isAdminGestionEnEstaVista = isAdmin && fromAdmin;
  const puedeGestionarEquiposTorneo = useMemo(
    () =>
      computePuedeGestionarEquiposTorneo({
        torneo,
        sedeTorneo,
        rol,
        userSedeId,
        userPaisRol,
        fromAdmin: location.state?.fromAdmin === true,
      }),
    [torneo, sedeTorneo, rol, userSedeId, userPaisRol, location.state?.fromAdmin]
  );
  const torneoNavState = useMemo(
    () => (fromAdmin || location.state ? { ...(location.state || {}), ...(fromAdmin ? { fromAdmin: true } : {}) } : null),
    [location.state, fromAdmin]
  );
  /** No reenviar `fromAdmin` a enlaces de la vista pública (perfiles, equipos en solo lectura). */
  const torneoNavStateParaTabbed = fromAdmin ? torneoNavState : null;

  useEffect(() => {
    if (location.state?.fromAdmin === true) setAdminNavContext(true);
  }, [location.state?.fromAdmin]);
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
          fetch(`${API_BASE_URL}/api/torneos/${torneoId}`),
          fetch(`${API_BASE_URL}/api/torneos/${torneoId}/equipos`),
          fetch(`${API_BASE_URL}/api/torneos/${torneoId}/partidos`),
          fetch(`${API_BASE_URL}/api/sedes`).catch(() => null),
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

  useEffect(() => {
    setListaEsperaChecked(false);
    setListaEsperaEnrolled(false);
    setListaEsperaMsg('');
  }, [torneoId]);

  useEffect(() => {
    const st = String(torneo?.estado || '').toLowerCase();
    if (!session?.access_token || !torneoId || (st !== 'planificacion' && st !== 'proximo')) {
      setListaEsperaChecked(true);
      if (st !== 'planificacion' && st !== 'proximo') setListaEsperaEnrolled(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/torneos/${torneoId}/lista-espera/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        setListaEsperaEnrolled(Boolean(j?.enrolled));
      } catch {
        if (!cancelled) setListaEsperaEnrolled(false);
      } finally {
        if (!cancelled) setListaEsperaChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [torneoId, torneo?.estado, session?.access_token]);

  const abrirInscripcionDesdeAdmin = async () => {
    if (!window.confirm('¿Confirmar apertura de inscripción?')) return;
    setAbrirInscripcionLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch(`${API_BASE_URL}/api/torneos/${torneoId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ estado: 'abierto' }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const row = Array.isArray(data) ? data[0] : data;
        setTorneo((prev) => ({ ...prev, estado: row?.estado ?? 'abierto' }));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || 'No se pudo abrir la inscripción');
      }
    } catch (e) {
      alert(e?.message || 'Error de red');
    } finally {
      setAbrirInscripcionLoading(false);
    }
  };

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
      const res = await fetch(`${API_BASE_URL}/api/torneos/${torneoId}`, {
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
      const res = await fetch(`${API_BASE_URL}/api/torneos/${torneoId}/finalizar`, {
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
  /** Solo `state.fromAdmin`: el flag de sesión no debe ocultar inscripción a quien entra desde el hub. */
  const modoAdminExplicitoEnVista = fromAdmin;
  const esListaEsperaTorneo =
    estadoTorneoLower === 'planificacion' || estadoTorneoLower === 'proximo';
  const esInscripcionAbiertaJugador =
    estadoTorneoLower === 'abierto' || estadoTorneoLower === 'inscripcion_abierta';
  const mostrarBannerJugadorTorneo =
    !modoAdminExplicitoEnVista &&
    estadoTorneoLower !== 'finalizado' &&
    (esListaEsperaTorneo || esInscripcionAbiertaJugador);
  const puedeMostrarIniciarTorneo =
    isAdmin && ['inscripcion_abierta', 'abierto'].includes(estadoTorneoLower);
  const puedeMostrarAbrirInscripcionAdmin = isAdmin && esListaEsperaTorneo;

  const miEquipoEnTorneo = useMemo(() => {
    if (!session?.user || !Array.isArray(equipos) || equipos.length === 0) return null;
    const uid = session.user.id;
    const userEmail = String(session.user.email || '').trim().toLowerCase();
    for (const equipo of equipos) {
      const arr = Array.isArray(equipo?.jugadores) ? equipo.jugadores : [];
      const yaInscripto = arr.some((j) => {
        const jid = j?.id != null && String(j.id).trim() !== '' ? String(j.id) : null;
        if (jid != null && uid != null && jid === String(uid)) return true;
        const je = String(j?.email || '').trim().toLowerCase();
        return userEmail && je === userEmail;
      });
      if (yaInscripto) return equipo;
    }
    return null;
  }, [equipos, session?.user?.id, session?.user?.email]);

  const anotarmeListaEspera = useCallback(async () => {
    if (!session?.user) {
      navigate(authUrlWithRedirect(`/torneo/${torneoId}`));
      return;
    }
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/torneos/${torneoId}/lista-espera`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setListaEsperaEnrolled(true);
        setListaEsperaMsg(
          j?.already ? '' : '¡Listo! Te avisamos por WhatsApp cuando abra la inscripción.'
        );
      } else {
        alert(j?.error || 'No se pudo anotar en lista de espera');
      }
    } catch (e) {
      alert(e?.message || 'Error de red');
    }
  }, [session?.user, session?.access_token, torneoId, navigate]);

  const bannerInscripcionJugador = useMemo(() => {
    if (!torneo || !mostrarBannerJugadorTorneo) return null;

    if (session?.user && miEquipoEnTorneo && esInscripcionAbiertaJugador) {
      return (
        <div className="torneo-inscripcion-jugador-banner">
          <p className="torneo-inscripcion-jugador-banner__texto">
            ✓ Ya estás inscripto — {nombreEquipoMostrado(miEquipoEnTorneo)}
          </p>
        </div>
      );
    }

    if (esListaEsperaTorneo) {
      return (
        <div className="torneo-inscripcion-jugador-banner">
          <p className="torneo-inscripcion-jugador-banner__sub">
            La inscripción aún no está abierta. Dejá tus datos y te avisamos por WhatsApp.
          </p>
          {listaEsperaMsg ? (
            <p className="torneo-inscripcion-jugador-banner__texto" style={{ marginTop: '10px' }}>
              {listaEsperaMsg}
            </p>
          ) : null}
          {listaEsperaEnrolled ? (
            <p className="torneo-inscripcion-jugador-banner__texto" style={{ marginTop: '12px' }}>
              Ya estás en lista de espera ✓
            </p>
          ) : (
            <button
              type="button"
              className="torneo-inscripcion-jugador-banner__cta btn-agregar-jugadores"
              onClick={() => void anotarmeListaEspera()}
              disabled={session?.user && !listaEsperaChecked}
            >
              Anotarme en lista de espera
            </button>
          )}
        </div>
      );
    }

    if (esInscripcionAbiertaJugador) {
      return (
        <div className="torneo-inscripcion-jugador-banner">
          <p className="torneo-inscripcion-jugador-banner__sub">
            Inscripción abierta. Elegí cómo querés participar.
          </p>
          <button
            type="button"
            className="torneo-inscripcion-jugador-banner__cta torneo-btn-inscribirse-verde"
            onClick={() => {
              if (!session?.user) {
                navigate(authUrlWithRedirect(`/torneo/${torneoId}`));
                return;
              }
              setModalInscribirseOpen(true);
            }}
          >
            Inscribirse
          </button>
        </div>
      );
    }

    return null;
  }, [
    torneo,
    session?.user,
    session?.access_token,
    mostrarBannerJugadorTorneo,
    esListaEsperaTorneo,
    esInscripcionAbiertaJugador,
    miEquipoEnTorneo,
    listaEsperaEnrolled,
    listaEsperaChecked,
    listaEsperaMsg,
    torneoId,
    navigate,
    anotarmeListaEspera,
  ]);

  /** Solo admin que entró desde el panel (`fromAdmin`): no jugadores ni admin en ruta pública. */
  const adminBarFilaEquiposGestión =
    isAdminGestionEnEstaVista && estadoTorneoLower !== 'finalizado' ? (
      <div style={{ textAlign: 'center', marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
        {puedeMostrarAbrirInscripcionAdmin ? (
          <button
            type="button"
            className="btn-agregar-jugadores"
            style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)', color: '#fff', fontWeight: 800 }}
            onClick={() => void abrirInscripcionDesdeAdmin()}
            disabled={abrirInscripcionLoading}
          >
            {abrirInscripcionLoading ? 'Abriendo…' : '📣 Abrir inscripción'}
          </button>
        ) : null}
        <button
          type="button"
          className="btn-agregar-jugadores"
          onClick={() => navigate(`/torneo/${torneoId}/equipos`, torneoNavState ? { state: torneoNavState } : undefined)}
        >
          Equipos e inscripción
        </button>
      </div>
    ) : null;
  const adminBarIniciarTorneo = isAdminGestionEnEstaVista && puedeMostrarIniciarTorneo ? (
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
  ) : null;
  const adminBarFinalizarTorneo =
    isAdminGestionEnEstaVista &&
    ['en_curso', 'activo'].includes(String(torneo?.estado || '').toLowerCase()) &&
    partidos.length > 0 &&
    partidos.every((p) => p.estado === 'finalizado') ? (
      <div className="torneo-acciones">
        <button type="button" className="btn-finalizar-torneo" onClick={() => void finalizarTorneo()} disabled={finalizando}>
          {finalizando ? 'Finalizando...' : '🏆 Finalizar torneo'}
        </button>
      </div>
    ) : null;
  const adminTorneoBar =
    torneo && isAdminGestionEnEstaVista && (adminBarFilaEquiposGestión || adminBarIniciarTorneo || adminBarFinalizarTorneo) ? (
      <div className="torneo-admin-bar-violeta" style={{ marginBottom: '12px' }}>
        {adminBarFilaEquiposGestión}
        {adminBarIniciarTorneo}
        {adminBarFinalizarTorneo}
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
        <AppHeader title="Torneo" showBack contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
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
        <AppHeader title="Torneo" showBack contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
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
        <AppHeader title="Torneo" showBack contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
        <div className="error">Torneo no encontrado</div>
        <BottomNav />
      </div>
    );
  }

  return (
    <>
      {modalInscribirseOpen ? (
        <div
          className="torneo-modal-participacion-overlay"
          role="presentation"
          onClick={() => setModalInscribirseOpen(false)}
        >
          <div
            className="torneo-modal-participacion-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="torneo-participacion-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="torneo-participacion-titulo" className="torneo-modal-participacion-titulo">
              ¿Cómo querés participar?
            </h2>
            <button
              type="button"
              className="torneo-modal-participacion-opcion torneo-modal-participacion-opcion--primaria"
              onClick={() => {
                setModalInscribirseOpen(false);
                clearAdminNavContext();
                navigate(`/torneo/${torneoId}/equipos?crear=1`, { state: { fromAdmin: false } });
              }}
            >
              <span className="torneo-modal-participacion-opcion__titulo">Tengo equipo completo</span>
              <span className="torneo-modal-participacion-opcion__sub">Ya tenemos todos los integrantes</span>
            </button>
            <button
              type="button"
              className="torneo-modal-participacion-opcion torneo-modal-participacion-opcion--secundaria"
              onClick={() => {
                setModalInscribirseOpen(false);
                clearAdminNavContext();
                navigate(`/torneo/${torneoId}/equipos`, { state: { fromAdmin: false } });
              }}
            >
              <span className="torneo-modal-participacion-opcion__titulo">Busco compañero/s</span>
              <span className="torneo-modal-participacion-opcion__sub">Me anoto solo y busco con quién jugar</span>
            </button>
            <button type="button" className="torneo-modal-participacion-cerrar" onClick={() => setModalInscribirseOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    <div
      className="torneo-vista-container"
      style={{
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
      }}
    >
      <AppHeader title="Torneo" showBack contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
      <img
        src="/logo-padbol-match.png"
        alt="Padbol Match"
        style={{
          ...padbolLogoImgStyle,
          marginBottom: '10px',
        }}
      />
      <TorneoTabbedView
        torneo={torneo}
        equipos={equipos}
        partidos={partidos}
        setPartidos={setPartidos}
        sedesMap={sedesMap}
        torneoId={torneoId}
        navigate={navigate}
        session={session}
        isAdmin={isAdminGestionEnEstaVista}
        puedeGestionarEquiposTorneo={puedeGestionarEquiposTorneo}
        navigateState={torneoNavStateParaTabbed}
        clasificacionFinalFilas={clasificacionFinalFilas}
        adminTorneoBar={adminTorneoBar}
        bannerAntesTabs={bannerInscripcionJugador}
        stickyTop={hubContentPaddingTopCss(location.pathname)}
        showTorneoLogo={false}
      />
      <BottomNav />
    </div>
    </>
  );
}
