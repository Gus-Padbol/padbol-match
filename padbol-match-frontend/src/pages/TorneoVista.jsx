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
  HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX,
  hubContentPaddingTopWithLogoClearanceCss,
  hubInstagramColumnWrapStyle,
  hubMainPaddingBottomCss,
} from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { authUrlWithRedirect } from '../utils/authLoginRedirect';
import useUserRole from '../hooks/useUserRole';
import { supabase } from '../supabaseClient';
import { estadoTorneoNormalizado } from '../utils/torneoEstadoFiltroPills';
import { torneoFechaInicioEsPasadaCalendario } from '../utils/torneoFechaInicioArt';
import {
  TORNEO_RESERVA_LUGAR_BTN,
  TORNEO_RESERVA_LUGAR_CONFIRM_POST,
  TORNEO_RESERVA_LUGAR_SUB_BANNER,
  TORNEO_RESERVA_LUGAR_YA_INSCRITO,
} from '../utils/torneoReservaLugarCopy';
import {
  computeIsAdminEnTorneo,
  computePuedeGestionarEquiposTorneo,
  pathnameIsAdminRoute,
  puedeExportarJugadoresTorneoExcel,
} from '../utils/torneoAdminAccess';
import { clearAdminNavContext } from '../utils/adminNavContext';
import { useSponsor } from '../hooks/useSponsor';
import {
  fetchJugadoresPerfilPorJugadores,
  buildJugadorPerfilLookupMaps,
  normalizeJugadorEmail,
} from '../utils/jugadorNombreTorneo';
import { torneoPermiteNuevasInscripciones } from '../utils/torneoInscripcionPago';
import {
  ordenarBuscaDuplaPorCompatibilidad,
  tierCompatibilidadNivelBuscaDupla,
  etiquetaCompatibilidadBuscaDupla,
  etiquetaLateralidadBuscaDupla,
  indiceCategoriaNivelBuscaDupla,
} from '../utils/buscaDuplaMatchmaking';
import '../styles/TorneoVista.css';

const apiBaseUrlTorneo = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

function whatsappWebHref(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  return `https://wa.me/${d}`;
}

export default function TorneoVista() {
  const { torneoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const { session, userProfile, loading: authLoading } = useAuth();
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
  const [buscaDuplaList, setBuscaDuplaList] = useState([]);
  const [buscaDuplaEnrolled, setBuscaDuplaEnrolled] = useState(false);
  const [buscaDuplaInvRecibidas, setBuscaDuplaInvRecibidas] = useState([]);
  const [buscaDuplaInvEnviadas, setBuscaDuplaInvEnviadas] = useState([]);
  const [buscaDuplaLoading, setBuscaDuplaLoading] = useState(false);
  const [buscaDuplaBusy, setBuscaDuplaBusy] = useState(false);

  const currentEmail = (session?.user?.email || '').trim().toLowerCase();
  const authUserId = useMemo(
    () => (session?.user?.id != null && session.user.id !== '' ? String(session.user.id) : null),
    [session?.user?.id]
  );
  const sedeTorneo = torneo ? sedesMap[String(torneo.sede_id)] : null;

  const torneoIdNum = useMemo(() => {
    const n = parseInt(String(torneoId), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [torneoId]);

  const sedeIdParaSponsor = useMemo(() => {
    if (torneo?.sede_id == null) return null;
    const n = Number(torneo.sede_id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [torneo?.sede_id]);

  const sponsorTorneoEnabled = !loading && Boolean(torneo);
  const { sponsor: sponsorPresentadoRaw } = useSponsor(sedeIdParaSponsor, torneoIdNum, {
    enabled: sponsorTorneoEnabled,
  });

  const presentadoPorSponsor = useMemo(() => {
    if (!sponsorPresentadoRaw || !String(sponsorPresentadoRaw.nombre || '').trim()) return null;
    return {
      nombre: String(sponsorPresentadoRaw.nombre).trim(),
      logo_url: sponsorPresentadoRaw.logo_url ? String(sponsorPresentadoRaw.logo_url).trim() : '',
      url_destino:
        sponsorPresentadoRaw.url_destino != null ? String(sponsorPresentadoRaw.url_destino).trim() : '',
    };
  }, [sponsorPresentadoRaw]);

  const jugadoresParaLookupVista = useMemo(() => {
    const out = [];
    for (const eq of equipos || []) {
      const arr = Array.isArray(eq?.jugadores) ? eq.jugadores : [];
      out.push(...arr);
    }
    return out;
  }, [equipos]);

  const perfilFetchKeyVista = useMemo(
    () =>
      jugadoresParaLookupVista
        .map((p) => normalizeJugadorEmail(p))
        .filter(Boolean)
        .sort()
        .join(';'),
    [jugadoresParaLookupVista]
  );

  const [perfilMapsVista, setPerfilMapsVista] = useState(() => buildJugadorPerfilLookupMaps([]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!jugadoresParaLookupVista.length) {
        if (!cancelled) setPerfilMapsVista(buildJugadorPerfilLookupMaps([]));
        return;
      }
      const rows = await fetchJugadoresPerfilPorJugadores(jugadoresParaLookupVista);
      if (cancelled) return;
      setPerfilMapsVista(buildJugadorPerfilLookupMaps(rows));
    })();
    return () => {
      cancelled = true;
    };
  }, [perfilFetchKeyVista]);

  const nombreTorneoCtxVista = useMemo(
    () => ({
      perfilByEmailLower: perfilMapsVista.perfilByEmailLower,
      jugadoresTorneo: [],
      authSessionEmail: session?.user?.email ?? null,
      perfilSesion: userProfile,
      authSession: session,
      authUserId,
    }),
    [perfilMapsVista, session, userProfile, authUserId]
  );
  const fromAdmin = location.state?.fromAdmin === true;
  const enRutaAdminTorneo = pathnameIsAdminRoute(location.pathname);
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
        enRutaAdmin: enRutaAdminTorneo,
      }),
    [currentEmail, torneo, sedeTorneo, rol, userSedeId, userPaisRol, fromAdmin, enRutaAdminTorneo]
  );
  /** Barra violeta y permisos de edición en pestañas: solo con `state.fromAdmin === true`. */
  const isAdminGestionEnEstaVista = isAdmin && fromAdmin;
  const puedeExportarJugadoresExcelVista = useMemo(
    () =>
      isAdminGestionEnEstaVista &&
      puedeExportarJugadoresTorneoExcel({ email: currentEmail, rol }),
    [isAdminGestionEnEstaVista, currentEmail, rol]
  );
  const puedeGestionarEquiposTorneo = useMemo(
    () =>
      computePuedeGestionarEquiposTorneo({
        torneo,
        sedeTorneo,
        rol,
        userSedeId,
        userPaisRol,
        fromAdmin,
        enRutaAdmin: enRutaAdminTorneo,
      }),
    [torneo, sedeTorneo, rol, userSedeId, userPaisRol, fromAdmin, enRutaAdminTorneo]
  );
  const torneoNavState = useMemo(
    () => (fromAdmin || location.state ? { ...(location.state || {}), ...(fromAdmin ? { fromAdmin: true } : {}) } : null),
    [location.state, fromAdmin]
  );
  /** No reenviar `fromAdmin` a enlaces de la vista pública (perfiles, equipos en solo lectura). */
  const torneoNavStateParaTabbed = fromAdmin ? torneoNavState : null;

  const equiposConfirmadosInscripcion = useMemo(
    () =>
      (equipos || []).filter(
        (eq) => String(eq?.inscripcion_estado || '').toLowerCase() === 'confirmado',
      ).length,
    [equipos],
  );
  const tieneFixturePartidos = partidos.length > 0;
  const puedeIniciarTorneoEnCurso =
    !loading && equiposConfirmadosInscripcion >= 2 && tieneFixturePartidos;

  const loadBuscaDupla = useCallback(async () => {
    const idNum = parseInt(String(torneoId), 10);
    if (!Number.isFinite(idNum)) return;
    setBuscaDuplaLoading(true);
    try {
      const pub = await fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/busca-dupla`);
      if (pub.ok) {
        const j = await pub.json();
        setBuscaDuplaList(Array.isArray(j) ? j : []);
      } else {
        setBuscaDuplaList([]);
      }
      if (session?.access_token) {
        const [meRes, invRes] = await Promise.all([
          fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/busca-dupla/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/busca-dupla/invitaciones`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);
        if (meRes.ok) {
          const m = await meRes.json().catch(() => ({}));
          setBuscaDuplaEnrolled(Boolean(m?.enrolled));
        } else {
          setBuscaDuplaEnrolled(false);
        }
        if (invRes.ok) {
          const inv = await invRes.json().catch(() => ({}));
          setBuscaDuplaInvRecibidas(Array.isArray(inv?.recibidas) ? inv.recibidas : []);
          setBuscaDuplaInvEnviadas(Array.isArray(inv?.enviadas) ? inv.enviadas : []);
        } else {
          setBuscaDuplaInvRecibidas([]);
          setBuscaDuplaInvEnviadas([]);
        }
      } else {
        setBuscaDuplaEnrolled(false);
        setBuscaDuplaInvRecibidas([]);
        setBuscaDuplaInvEnviadas([]);
      }
    } catch (e) {
      console.warn('[TorneoVista] busca dupla:', e);
      setBuscaDuplaList([]);
    } finally {
      setBuscaDuplaLoading(false);
    }
  }, [torneoId, session?.access_token]);

  const recargarDatosTorneo = useCallback(async () => {
    try {
      const [torneoRes, equiposRes, partidosRes, sedesRes] = await Promise.all([
        fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}`),
        fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/equipos`),
        fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/partidos`),
        fetch(`${apiBaseUrlTorneo}/api/sedes`).catch(() => null),
      ]);
      if (torneoRes.ok) {
        try {
          const t = await torneoRes.json();
          if (t && typeof t === 'object' && !t.error) setTorneo(t);
        } catch (e) {
          console.error('[TorneoVista] recargar torneo JSON:', e);
        }
      }
      if (equiposRes.ok) {
        try {
          const j = await equiposRes.json();
          if (Array.isArray(j)) setEquipos(j);
        } catch (e) {
          console.error('[TorneoVista] recargar equipos JSON:', e);
        }
      }
      if (partidosRes.ok) {
        try {
          const j = await partidosRes.json();
          if (Array.isArray(j)) setPartidos(j);
        } catch (e) {
          console.error('[TorneoVista] recargar partidos JSON:', e);
        }
      }
      if (sedesRes?.ok) {
        try {
          const sedesData = await sedesRes.json();
          const nextSedesMap = {};
          (Array.isArray(sedesData) ? sedesData : []).forEach((sede) => {
            nextSedesMap[String(sede.id)] = sede;
          });
          setSedesMap(nextSedesMap);
        } catch (e) {
          console.error('[TorneoVista] recargar sedes JSON:', e);
        }
      }
    } catch (e) {
      console.error('[TorneoVista] recargarDatosTorneo:', e);
    }
    await loadBuscaDupla();
  }, [torneoId, loadBuscaDupla]);

  useEffect(() => {
    const fetchData = async () => {
      const MSG_FALLA = 'No pudimos cargar el torneo';
      try {
        setLoading(true);
        setError(null);
        const idNum = parseInt(String(torneoId), 10);
        if (!Number.isFinite(idNum)) {
          setTorneo(null);
          setEquipos([]);
          setPartidos([]);
          setSedesMap({});
          setError(MSG_FALLA);
          return;
        }

        const [torneoRes, equiposRes, partidosRes, sedesRes] = await Promise.all([
          fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}`),
          fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/equipos`),
          fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/partidos`),
          fetch(`${apiBaseUrlTorneo}/api/sedes`).catch(() => null),
        ]);

        let torneoData = null;
        if (torneoRes.ok) {
          try {
            torneoData = await torneoRes.json();
          } catch (e) {
            console.error('[TorneoVista] JSON torneo:', e);
            torneoData = null;
          }
        }
        if (!torneoData || typeof torneoData !== 'object' || torneoData.error != null) {
          setTorneo(null);
          setEquipos([]);
          setPartidos([]);
          setSedesMap({});
          setError(MSG_FALLA);
          return;
        }

        let equiposData = [];
        if (equiposRes.ok) {
          try {
            const j = await equiposRes.json();
            equiposData = Array.isArray(j) ? j : [];
          } catch (e) {
            console.error('[TorneoVista] JSON equipos:', e);
          }
        } else {
          console.warn('[TorneoVista] equipos HTTP', equiposRes.status);
        }

        let partidosData = [];
        if (partidosRes.ok) {
          try {
            const j = await partidosRes.json();
            partidosData = Array.isArray(j) ? j : [];
          } catch (e) {
            console.error('[TorneoVista] JSON partidos:', e);
          }
        } else {
          console.warn('[TorneoVista] partidos HTTP', partidosRes.status);
        }

        let sedesData = [];
        if (sedesRes?.ok) {
          try {
            sedesData = await sedesRes.json();
          } catch (e) {
            console.error('[TorneoVista] JSON sedes:', e);
          }
        }

        const nextSedesMap = {};
        (Array.isArray(sedesData) ? sedesData : []).forEach((sede) => {
          nextSedesMap[String(sede.id)] = sede;
        });

        setTorneo(torneoData);
        setEquipos(equiposData);
        setPartidos(partidosData);
        setSedesMap(nextSedesMap);
        setError(null);
      } catch (err) {
        console.error('[TorneoVista] fetchData:', err);
        setTorneo(null);
        setEquipos([]);
        setPartidos([]);
        setSedesMap({});
        setError(MSG_FALLA);
      } finally {
        await loadBuscaDupla();
        setLoading(false);
      }
    };

    fetchData();
  }, [torneoId, loadBuscaDupla]);

  useEffect(() => {
    setListaEsperaChecked(false);
    setListaEsperaEnrolled(false);
    setListaEsperaMsg('');
  }, [torneoId]);

  useEffect(() => {
    const st = estadoTorneoNormalizado(torneo?.estado);
    if (!session?.access_token || !torneoId || (st !== 'planificacion' && st !== 'proximo')) {
      setListaEsperaChecked(true);
      if (st !== 'planificacion' && st !== 'proximo') setListaEsperaEnrolled(false);
      return;
    }
    let cancelled = false;
    setListaEsperaChecked(false);
    (async () => {
      try {
        const r = await fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/lista-espera/me`, {
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
      const res = await fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}`, {
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
    if (!Number.isFinite(tidNum) || estadoTorneoNormalizado(torneo?.estado) !== 'finalizado') {
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
    if (!puedeIniciarTorneoEnCurso) return;
    if (
      !window.confirm(
        '¿Iniciar el torneo? Se cerrará la inscripción y el estado pasará a «en curso».'
      )
    ) {
      return;
    }
    setIniciando(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ estado: 'en_curso' }),
      });
      if (res.ok) {
        setTorneo((prev) => ({ ...prev, estado: 'en_curso' }));
      } else {
        const err = await res.json().catch(() => ({}));
        const det = err?.iniciar_torneo;
        let msg = err?.error || 'Error al iniciar el torneo';
        if (det && typeof det.equipos_confirmados === 'number') {
          msg += `\n\nEquipos confirmados: ${det.equipos_confirmados} (mín. ${det.min_equipos_confirmados ?? 2}). Partidos generados: ${det.partidos_generados ?? 0}.`;
        }
        alert(msg);
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
      const res = await fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/finalizar`, {
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

  const estadoTorneoLower = estadoTorneoNormalizado(torneo?.estado);
  const torneoPasadoCalendario = useMemo(
    () => torneoFechaInicioEsPasadaCalendario(torneo?.fecha_inicio),
    [torneo?.fecha_inicio],
  );
  /** Solo `state.fromAdmin`: el flag de sesión no debe ocultar inscripción a quien entra desde el hub. */
  const modoAdminExplicitoEnVista = fromAdmin;
  const esListaEsperaTorneo =
    estadoTorneoLower === 'planificacion' || estadoTorneoLower === 'proximo';
  const esInscripcionAbiertaJugador =
    estadoTorneoLower === 'abierto' || estadoTorneoLower === 'inscripcion_abierta';
  const mostrarBannerJugadorTorneo =
    !modoAdminExplicitoEnVista &&
    !torneoPasadoCalendario &&
    estadoTorneoLower !== 'finalizado' &&
    estadoTorneoLower !== 'cancelado' &&
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

  const reservarMiLugarTorneo = useCallback(async () => {
    if (!session?.user) {
      navigate(authUrlWithRedirect(`/torneo/${torneoId}`));
      return;
    }
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/lista-espera`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          whatsapp: String(userProfile?.whatsapp || '').trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setListaEsperaEnrolled(true);
        setListaEsperaMsg(j?.already ? '' : TORNEO_RESERVA_LUGAR_CONFIRM_POST);
      } else {
        alert(j?.error || 'No se pudo reservar tu lugar');
      }
    } catch (e) {
      alert(e?.message || 'Error de red');
    }
  }, [session?.user, session?.access_token, torneoId, navigate, userProfile?.whatsapp]);

  const bannerInscripcionJugador = useMemo(() => {
    if (!torneo) return null;
    if (torneoPasadoCalendario && !modoAdminExplicitoEnVista) {
      return (
        <div className="torneo-inscripcion-jugador-banner">
          <p className="torneo-inscripcion-jugador-banner__texto" role="status">
            Torneo finalizado
          </p>
        </div>
      );
    }
    if (!mostrarBannerJugadorTorneo) return null;

    if (session?.user && miEquipoEnTorneo && esInscripcionAbiertaJugador) {
      return (
        <div className="torneo-inscripcion-jugador-banner">
          <p className="torneo-inscripcion-jugador-banner__texto">
            ✓ Ya eres parte del equipo {nombreEquipoMostrado(miEquipoEnTorneo)}
          </p>
        </div>
      );
    }

    if (esListaEsperaTorneo) {
      return (
        <div className="torneo-inscripcion-jugador-banner">
          <p className="torneo-inscripcion-jugador-banner__sub">{TORNEO_RESERVA_LUGAR_SUB_BANNER}</p>
          {listaEsperaMsg ? (
            <p className="torneo-inscripcion-jugador-banner__texto" style={{ marginTop: '10px' }}>
              {listaEsperaMsg}
            </p>
          ) : listaEsperaEnrolled ? (
            <p className="torneo-inscripcion-jugador-banner__texto" style={{ marginTop: '12px' }}>
              {TORNEO_RESERVA_LUGAR_YA_INSCRITO}
            </p>
          ) : null}
          {!listaEsperaEnrolled ? (
            <button
              type="button"
              className="torneo-inscripcion-jugador-banner__cta btn-agregar-jugadores"
              onClick={() => void reservarMiLugarTorneo()}
              disabled={session?.user && !listaEsperaChecked}
            >
              {TORNEO_RESERVA_LUGAR_BTN}
            </button>
          ) : null}
        </div>
      );
    }

    if (esInscripcionAbiertaJugador) {
      return (
        <div className="torneo-inscripcion-jugador-banner">
          <p className="torneo-inscripcion-jugador-banner__sub">
            Inscripción abierta. Elige cómo quieres participar.
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
    torneoPasadoCalendario,
    modoAdminExplicitoEnVista,
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
    reservarMiLugarTorneo,
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
      {!loading && !puedeIniciarTorneoEnCurso ? (
        <>
          {equiposConfirmadosInscripcion < 2 ? (
            <p className="torneo-iniciar-aviso" role="status">
              Faltan equipos confirmados: necesitas al menos 2 equipos con inscripción confirmada (ahora hay{' '}
              {equiposConfirmadosInscripcion}).
            </p>
          ) : null}
          {!tieneFixturePartidos ? (
            <p className="torneo-iniciar-aviso" role="status">
              Falta el sorteo o el fixture: genera los partidos del torneo (por ejemplo sorteo de grupos en el panel
              admin, o la generación de fixture) antes de pasar a «en curso».
            </p>
          ) : null}
        </>
      ) : null}
      <button
        type="button"
        className="btn-iniciar-torneo btn-iniciar-torneo--sobre-violeta"
        onClick={() => void iniciarTorneo()}
        disabled={iniciando || !puedeIniciarTorneoEnCurso}
      >
        {iniciando ? 'Iniciando...' : '🚀 Iniciar torneo'}
      </button>
    </div>
  ) : null;
  const adminBarFinalizarTorneo =
    isAdminGestionEnEstaVista &&
    ['en_curso', 'activo'].includes(estadoTorneoLower) &&
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

  const torneoVistaColumnStyle = useMemo(
    () => ({
      ...hubInstagramColumnWrapStyle,
      paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
      paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
      boxSizing: 'border-box',
    }),
    []
  );

  const torneoShareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !torneoId) return '';
    return `${window.location.origin}/torneo/${encodeURIComponent(String(torneoId))}`;
  }, [torneoId]);

  const torneoShareMeta = useMemo(() => {
    const nombreTor = String(torneo?.nombre || 'Torneo').trim() || 'Torneo';
    const sedeNombre = sedeTorneo ? String(sedeTorneo.nombre || '').trim() : 'la sede';
    const title = nombreTor;
    const url = torneoShareUrl;
    const text = `¡Participa en ${nombreTor} en ${sedeNombre}! 🏆⚽ Inscríbete aquí:`;
    return { title, text, url };
  }, [torneo, sedeTorneo, torneoShareUrl]);

  const cerrarModalInscribirse = useCallback(() => setModalInscribirseOpen(false), []);
  const irACrearEquipoDesdeTorneoVista = useCallback(() => {
    setModalInscribirseOpen(false);
    clearAdminNavContext();
    navigate(`/torneo/${torneoId}/equipos?crear=1`, {
      replace: true,
      state: { fromAdmin: false },
    });
  }, [navigate, torneoId]);

  const registrarBuscaDupla = useCallback(async () => {
    if (!session?.access_token) {
      navigate(authUrlWithRedirect(`/torneo/${torneoId}`));
      return;
    }
    setBuscaDuplaBusy(true);
    try {
      const res = await fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/busca-dupla`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || 'No se pudo anotarte en busca dupla');
        return;
      }
      await recargarDatosTorneo();
    } finally {
      setBuscaDuplaBusy(false);
    }
  }, [session?.access_token, torneoId, navigate, recargarDatosTorneo]);

  const salirBuscaDupla = useCallback(async () => {
    if (!session?.access_token) return;
    setBuscaDuplaBusy(true);
    try {
      const res = await fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/busca-dupla/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error || 'No se pudo quitar el anuncio');
        return;
      }
      await loadBuscaDupla();
    } finally {
      setBuscaDuplaBusy(false);
    }
  }, [session?.access_token, torneoId, loadBuscaDupla]);

  const invitarBuscaDupla = useCallback(
    async (toUserId) => {
      if (!session?.access_token || !toUserId) return;
      setBuscaDuplaBusy(true);
      try {
        const res = await fetch(`${apiBaseUrlTorneo}/api/torneos/${torneoId}/busca-dupla/invitar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ to_user_id: toUserId }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(j?.error || 'No se pudo enviar la invitación');
          return;
        }
        await loadBuscaDupla();
      } finally {
        setBuscaDuplaBusy(false);
      }
    },
    [session?.access_token, torneoId, loadBuscaDupla]
  );

  const aceptarInvitacionBuscaDupla = useCallback(
    async (invId) => {
      if (!session?.access_token || !invId) return;
      setBuscaDuplaBusy(true);
      try {
        const res = await fetch(
          `${apiBaseUrlTorneo}/api/torneos/${torneoId}/busca-dupla/invitaciones/${invId}/aceptar`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(j?.error || 'No se pudo formar el equipo');
          return;
        }
        await recargarDatosTorneo();
      } finally {
        setBuscaDuplaBusy(false);
      }
    },
    [session?.access_token, torneoId, recargarDatosTorneo]
  );

  const rechazarInvitacionBuscaDupla = useCallback(
    async (invId) => {
      if (!session?.access_token || !invId) return;
      setBuscaDuplaBusy(true);
      try {
        const res = await fetch(
          `${apiBaseUrlTorneo}/api/torneos/${torneoId}/busca-dupla/invitaciones/${invId}/rechazar`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(j?.error || 'No se pudo rechazar');
          return;
        }
        await loadBuscaDupla();
      } finally {
        setBuscaDuplaBusy(false);
      }
    },
    [session?.access_token, torneoId, loadBuscaDupla]
  );

  const buscaDuplaListOrdenada = useMemo(
    () => ordenarBuscaDuplaPorCompatibilidad(buscaDuplaList, userProfile?.nivel),
    [buscaDuplaList, userProfile?.nivel]
  );

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          paddingTop: hubContentPaddingTopWithLogoClearanceCss(location.pathname, navDock),
          paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
          boxSizing: 'border-box',
        }}
      >
        <AppHeader title="Torneo" showBack contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
        <div style={torneoVistaColumnStyle} className="loading">
          Cargando...
        </div>
        <BottomNav />
      </div>
    );
  }
  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          paddingTop: hubContentPaddingTopWithLogoClearanceCss(location.pathname, navDock),
          paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
          boxSizing: 'border-box',
        }}
      >
        <AppHeader title="Torneo" showBack contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
        <div style={torneoVistaColumnStyle} className="error">
          <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: '#b91c1c' }}>No pudimos cargar el torneo</p>
          {error && error !== 'No pudimos cargar el torneo' ? (
            <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.45 }}>{error}</p>
          ) : null}
        </div>
        <BottomNav />
      </div>
    );
  }
  if (!torneo) {
    return (
      <div
        style={{
          minHeight: '100vh',
          paddingTop: hubContentPaddingTopWithLogoClearanceCss(location.pathname, navDock),
          paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
          boxSizing: 'border-box',
        }}
      >
        <AppHeader title="Torneo" showBack contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
        <div style={torneoVistaColumnStyle} className="error">
          Torneo no encontrado
        </div>
        <BottomNav />
      </div>
    );
  }

  const puedePanelBuscaDupla =
    torneo && !torneoPasadoCalendario && torneoPermiteNuevasInscripciones(torneo);

  const buscaDuplaSeccion =
    puedePanelBuscaDupla ? (
      <div className="torneo-busca-dupla">
        <h3 className="torneo-busca-dupla__titulo">Jugadores buscando dupla</h3>
        {session?.user && indiceCategoriaNivelBuscaDupla(userProfile?.nivel) >= 0 ? (
          <p className="torneo-busca-dupla__orden-hint">
            Ordenados por compatibilidad con tu categoría ({String(userProfile?.nivel || '').trim() || '—'}).
          </p>
        ) : null}
        {buscaDuplaInvRecibidas.length > 0 ? (
          <div className="torneo-busca-dupla__invites">
            {buscaDuplaInvRecibidas.map((inv) => (
              <div key={inv.id} className="torneo-busca-dupla__invite-card">
                <p className="torneo-busca-dupla__invite-text">
                  <strong>{inv.otro_alias || inv.otro_nombre || 'Un jugador'}</strong> te invitó a formar dupla
                  para este torneo.
                </p>
                <div className="torneo-busca-dupla__invite-actions">
                  <button
                    type="button"
                    className="torneo-busca-dupla__btn torneo-busca-dupla__btn--primary"
                    disabled={buscaDuplaBusy}
                    onClick={() => void aceptarInvitacionBuscaDupla(inv.id)}
                  >
                    Aceptar y formar equipo
                  </button>
                  <button
                    type="button"
                    className="torneo-busca-dupla__btn"
                    disabled={buscaDuplaBusy}
                    onClick={() => void rechazarInvitacionBuscaDupla(inv.id)}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {session?.user && !miEquipoEnTorneo ? (
          <div className="torneo-busca-dupla__cta-row">
            {!buscaDuplaEnrolled ? (
              <button
                type="button"
                className="torneo-busca-dupla__btn torneo-busca-dupla__btn--primary"
                disabled={buscaDuplaBusy}
                onClick={() => void registrarBuscaDupla()}
              >
                Busco dupla para este torneo
              </button>
            ) : (
              <div className="torneo-busca-dupla__yo-anunciado">
                <span>Figuras como buscando dupla.</span>
                <button
                  type="button"
                  className="torneo-busca-dupla__btn-link"
                  disabled={buscaDuplaBusy}
                  onClick={() => void salirBuscaDupla()}
                >
                  Quitar mi anuncio
                </button>
              </div>
            )}
          </div>
        ) : null}
        {buscaDuplaLoading ? <p className="torneo-busca-dupla__hint">Cargando lista…</p> : null}
        {!buscaDuplaLoading && buscaDuplaListOrdenada.length === 0 ? (
          <p className="torneo-busca-dupla__hint">Todavía no hay jugadores anunciados. Sé el primero.</p>
        ) : null}
        {buscaDuplaListOrdenada.length > 0 ? (
          <ul className="torneo-busca-dupla__lista">
            {buscaDuplaListOrdenada.map((row) => {
              const wa = whatsappWebHref(row.whatsapp);
              const esYo = authUserId && row.user_id === authUserId;
              const nombreMostrar = String(row.nombre || row.alias || 'Jugador').trim() || 'Jugador';
              const tier =
                session?.user && authUserId && !esYo
                  ? tierCompatibilidadNivelBuscaDupla(userProfile?.nivel, row.categoria)
                  : null;
              const compatClass =
                tier === 0
                  ? 'torneo-busca-dupla__badge-compat torneo-busca-dupla__badge-compat--mismo'
                  : tier === 1
                    ? 'torneo-busca-dupla__badge-compat torneo-busca-dupla__badge-compat--similar'
                    : typeof tier === 'number'
                      ? 'torneo-busca-dupla__badge-compat torneo-busca-dupla__badge-compat--diferente'
                      : '';
              const latTxt = etiquetaLateralidadBuscaDupla(row.lateralidad);
              const invEnviada = buscaDuplaInvEnviadas.some((i) => String(i.to_user_id) === String(row.user_id));
              const invRecibida = buscaDuplaInvRecibidas.some((i) => String(i.from_user_id) === String(row.user_id));
              return (
                <li key={row.user_id} className="torneo-busca-dupla__fila">
                  <div className="torneo-busca-dupla__foto-wrap">
                    {row.foto_url ? (
                      <img src={row.foto_url} alt="" className="torneo-busca-dupla__foto" />
                    ) : (
                      <div className="torneo-busca-dupla__foto torneo-busca-dupla__foto--placeholder" aria-hidden />
                    )}
                  </div>
                  <div className="torneo-busca-dupla__datos">
                    <div className="torneo-busca-dupla__linea-nombre">
                      <strong>{nombreMostrar}</strong>
                      {row.alias ? <span className="torneo-busca-dupla__alias"> @{row.alias}</span> : null}
                      {esYo ? <span className="torneo-busca-dupla__vos"> (tú)</span> : null}
                    </div>
                    <div className="torneo-busca-dupla__meta-row">
                      {typeof tier === 'number' && compatClass ? (
                        <span className={compatClass}>{etiquetaCompatibilidadBuscaDupla(tier)}</span>
                      ) : null}
                      {latTxt ? <span className="torneo-busca-dupla__badge-lat">{latTxt}</span> : null}
                      {invEnviada ? (
                        <span className="torneo-busca-dupla__badge-inv torneo-busca-dupla__badge-inv--enviada">
                          Invitación enviada
                        </span>
                      ) : null}
                      {invRecibida ? (
                        <span className="torneo-busca-dupla__badge-inv torneo-busca-dupla__badge-inv--recibida">
                          Te invitó (pendiente)
                        </span>
                      ) : null}
                    </div>
                    {row.categoria ? (
                      <div className="torneo-busca-dupla__cat">Categoría: {row.categoria}</div>
                    ) : null}
                  </div>
                  <div className="torneo-busca-dupla__acciones">
                    {wa ? (
                      <a
                        className="torneo-busca-dupla__btn torneo-busca-dupla__btn--wa"
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Conectar por WhatsApp
                      </a>
                    ) : (
                      <span className="torneo-busca-dupla__sin-wa">Sin WhatsApp en perfil</span>
                    )}
                    {session?.user && authUserId && !esYo && !miEquipoEnTorneo && buscaDuplaEnrolled ? (
                      <button
                        type="button"
                        className="torneo-busca-dupla__btn"
                        disabled={buscaDuplaBusy || invEnviada}
                        onClick={() => void invitarBuscaDupla(row.user_id)}
                      >
                        Invitar a formar equipo
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        {buscaDuplaInvEnviadas.length > 0 ? (
          <p className="torneo-busca-dupla__hint">
            Invitaciones enviadas pendientes:{' '}
            {buscaDuplaInvEnviadas.map((i) => i.otro_alias || i.otro_nombre || 'jugador').join(', ')}
          </p>
        ) : null}
      </div>
    ) : null;

  return (
    <>
    <div
      className="torneo-vista-container"
      style={{
        paddingTop: hubContentPaddingTopWithLogoClearanceCss(location.pathname, navDock),
        paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
      }}
    >
      <div style={torneoVistaColumnStyle}>
        <AppHeader title="Torneo" showBack contentMaxWidth={HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX} />
        <TorneoTabbedView
          key={String(torneoId)}
          torneo={torneo}
          equipos={equipos}
          partidos={partidos}
          setPartidos={setPartidos}
          sedesMap={sedesMap}
          torneoId={torneoId}
          navigate={navigate}
          session={session}
          isAdmin={isAdminGestionEnEstaVista}
          equiposRevelacionBypass={isAdminGestionEnEstaVista}
          puedeGestionarEquiposTorneo={puedeGestionarEquiposTorneo}
          navigateState={torneoNavStateParaTabbed}
          jugadorNombreTorneoCtx={nombreTorneoCtxVista}
          clasificacionFinalFilas={clasificacionFinalFilas}
          adminTorneoBar={adminTorneoBar}
          bannerAntesTabs={
            <>
              {bannerInscripcionJugador}
              {buscaDuplaSeccion}
            </>
          }
          stickyTop={hubContentPaddingTopWithLogoClearanceCss(location.pathname, navDock)}
          showTorneoLogo
          shareTorneoMeta={torneo && torneoShareUrl ? torneoShareMeta : null}
          presentadoPorSponsor={presentadoPorSponsor}
          apiBaseUrl={apiBaseUrlTorneo}
          puedeExportarJugadoresExcel={puedeExportarJugadoresExcelVista}
          adminPuedeSorteoGrupos={isAdminGestionEnEstaVista}
          onAfterSorteoGrupos={recargarDatosTorneo}
          participacionModalOpen={modalInscribirseOpen && !torneoPasadoCalendario}
          onParticipacionModalClose={cerrarModalInscribirse}
          onParticipacionIrACrearEquipo={irACrearEquipoDesdeTorneoVista}
          onParticipacionDespuesUnirme={recargarDatosTorneo}
          authLoading={authLoading}
          userProfile={userProfile}
        />
      </div>
      <BottomNav />
    </div>
    </>
  );
}
