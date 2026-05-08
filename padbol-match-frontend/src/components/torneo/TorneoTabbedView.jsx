import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { padbolLogoImgStyle } from '../../constants/padbolLogoStyle';
import { badgeTorneoEstadoPublico } from '../../utils/torneoEstadoPublico';
import {
  formatNivelTorneo,
  formatTipoTorneo,
  formatCategoriaTorneo,
  formatGeneroCompetenciaTorneo,
  formatCategoriaEdadTorneo,
  torneoTipoCompetenciaDb,
} from '../../utils/torneoFormatters';
import { formatAliasConArroba, nombreListadoTorneoRanking } from '../../utils/jugadorPerfil';
import { buildJugadorPreviewModalData } from '../../utils/jugadorPreviewModalData';
import JugadorPreviewModal from '../JugadorPreviewModal';
import JugadorQrModal from '../JugadorQrModal';
import SorteoGruposModal, { equiposConfirmadosParaSorteo } from './SorteoGruposModal';
import {
  horasRevelarEquiposTorneo,
  torneoListaEquiposOcultaParaPublico,
} from '../../utils/torneoRevelacionEquipos';
import { canUseNavigatorShare, ShareIconSvg } from '../ShareLinkButton';
import {
  equipoAbiertoBuscandoCompanero,
  findMiEquipoEnLista,
  findMiSolicitudEquipo,
  fotoCapitanEquipo,
  solicitarUnirseAEquipoAbierto,
} from '../../utils/equipoOpenJoin';
import '../../styles/TorneoVista.css';
import { TORNEO_BANNER_ANTES_TABS_DATA_SLOT } from '../../utils/torneoReservaLugarCopy';
import {
  getSpeechRecognitionConstructor,
  parseMarcadorVozPartidoCompleto,
  speechRecognitionDisponible,
} from '../../utils/speechResultadoPartido';
import { downloadTorneoJugadoresXlsx } from '../../utils/exportTorneoJugadoresExcel';

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

function initialFromText(value) {
  const s = String(value || '').trim();
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (/[A-Za-zÀ-ÿ0-9]/.test(ch)) return ch.toUpperCase();
  }
  return '?';
}

/** Games a/b from "6-4", "6 4", "6  0". */
function parseSetGames(setStr) {
  const parts = String(setStr || '')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (parts.length < 2) return null;
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return { a, b };
}

/** Normaliza entrada de set a formato "n-m" (espacio → guion). */
function normalizeSetInput(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  const parts = t.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
  return t;
}

function avatarJugadorPodio(p) {
  const foto = String(p?.foto_url || '').trim();
  const label = nombreListadoTorneoRanking(p);
  return { foto, label, initial: initialFromText(label) };
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

/** Texto principal en listados de torneo: nombre + apellido (sin usar alias como nombre). */
export function jugadorEtiquetaConArroba(p) {
  return nombreListadoTorneoRanking(p);
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
      const parsed = parseSetGames(set);
      if (!parsed) return;
      const { a, b } = parsed;
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
    const parsed = parseSetGames(set);
    if (!parsed) return;
    const { a: x, b: y } = parsed;
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
  /** Ver equipos aunque aplique ocultación por horas: solo con contexto panel (`/admin` o `state.fromAdmin`). */
  equiposRevelacionBypass = false,
  /** Gestionar equipos: rol aplicable y contexto admin (`fromAdmin` / sesión panel). */
  puedeGestionarEquiposTorneo = false,
  /** Se reenvía en `navigate(..., { state })` al abrir gestión de equipo (mantener fromAdmin). */
  navigateState = null,
  /** Filas desde `tabla_puntos` + equipos (misma forma que FormEquipos). */
  clasificacionFinalFilas = null,
  /** CTA inscripción encima de la lista de equipos (jugador). */
  equiposTabHeader = null,
  /** Contenido extra bajo la lista de equipos (inscripción en FormEquipos). */
  equiposTabFooter = null,
  /** Bloque admin (iniciar/finalizar, etc.) encima de las pestañas. */
  adminTorneoBar = null,
  /** Inscripción jugador (p. ej. «Reservar mi lugar» en planificación): debajo de la barra admin y antes de pestañas. */
  bannerAntesTabs = null,
  stickyTop = '110px',
  showTorneoLogo = true,
  /** Contexto opcional para enriquecer preview (perfil, foto, categoría, sede). */
  jugadorNombreTorneoCtx = null,
  apiBaseUrl = 'https://padbol-backend.onrender.com',
  /** super_admin / admin_club (panel): exportar jugadores del torneo a Excel. */
  puedeExportarJugadoresExcel = false,
  /** Panel admin / gestión: mostrar sorteo manual en pestaña Grupos. */
  adminPuedeSorteoGrupos = false,
  /** Tras confirmar POST /sorteo: recargar torneo, equipos y partidos. */
  onAfterSorteoGrupos = null,
  /** Modal “¿Cómo quieres participar?” (TorneoVista / FormEquipos). */
  participacionModalOpen = false,
  onParticipacionModalClose = null,
  /** Cerrar modal e ir a crear equipo (FormEquipos: vista crear; TorneoVista: ?crear=1). */
  onParticipacionIrACrearEquipo = null,
  /** Tras solicitud exitosa a un equipo abierto. */
  onParticipacionDespuesUnirme = null,
  authLoading = false,
  userProfile = null,
  /** Si viene definido, ícono compartir (esquina superior derecha del bloque título del torneo). */
  shareTorneoMeta = null,
}) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => defaultTabId(torneo?.estado));
  const resultadosConfettiPlayedRef = useRef(false);
  const [sorteoModalOpen, setSorteoModalOpen] = useState(false);
  const [modalEquipo, setModalEquipo] = useState(null);
  const [jugadorPreview, setJugadorPreview] = useState(null);
  const [jugadorQrData, setJugadorQrData] = useState(null);
  const [showModalResultado, setShowModalResultado] = useState(false);
  const [selectedPartido, setSelectedPartido] = useState(null);
  const [resultado, setResultado] = useState({ set1: '', set2: '', set3: '' });
  /** Flujo voz: idle | listening | processing | confirm */
  const [voicePhase, setVoicePhase] = useState('idle');
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceInterimText, setVoiceInterimText] = useState('');
  const [voiceError, setVoiceError] = useState(null);
  const [voicePending, setVoicePending] = useState(null);
  const [voiceSaving, setVoiceSaving] = useState(false);
  const selectedPartidoRef = useRef(selectedPartido);
  const equiposRef = useRef([]);
  const miEquipoTorneoRef = useRef(null);
  const voiceRecognitionRef = useRef(null);
  selectedPartidoRef.current = selectedPartido;
  equiposRef.current = equipos;
  const [participacionPaso, setParticipacionPaso] = useState('menu');
  const [equiposBusquedaRaw, setEquiposBusquedaRaw] = useState([]);
  const [equiposBusquedaLoading, setEquiposBusquedaLoading] = useState(false);
  const [equiposBusquedaError, setEquiposBusquedaError] = useState(null);
  const [solicitudPendingId, setSolicitudPendingId] = useState(null);
  const [shareTorneoCopied, setShareTorneoCopied] = useState(false);

  const estadoLower = String(torneo?.estado || '').toLowerCase();
  const esFinalizado = estadoLower === 'finalizado';
  const puedeCargarResultados = isAdmin && (estadoLower === 'en_curso' || estadoLower === 'activo');
  const hayAlMenosUnResultadoEnPartidos = useMemo(() => {
    return partidos.some((p) => {
      try {
        if (!p) return false;
        if (String(p.estado || '').toLowerCase() === 'finalizado') return true;
        return parseResultadoSets(p).length > 0;
      } catch {
        return false;
      }
    });
  }, [partidos]);
  const mostrarCartelIniciarTorneoParaResultados =
    isAdmin &&
    estadoLower !== 'en_curso' &&
    estadoLower !== 'activo' &&
    !esFinalizado &&
    !hayAlMenosUnResultadoEnPartidos;
  const estadoBadge = useMemo(() => badgeTorneoEstadoPublico(torneo?.estado), [torneo?.estado]);

  const abrirPreviewJugador = useCallback(
    (p) => {
      setJugadorPreview(buildJugadorPreviewModalData(p, jugadorNombreTorneoCtx));
    },
    [jugadorNombreTorneoCtx]
  );

  const abrirQrJugador = useCallback(
    (p) => {
      const alias = String(p?.alias || '').trim();
      if (!alias) {
        alert('Este jugador no tiene alias público.');
        return;
      }
      const preview = buildJugadorPreviewModalData(p, jugadorNombreTorneoCtx);
      const nombreLinea =
        preview.nombreCompleto && preview.nombreCompleto !== '—'
          ? preview.nombreCompleto
          : nombreListadoTorneoRanking(p) || 'Jugador';
      const apodoLinea =
        preview.aliasLabel && preview.aliasLabel !== '—' ? preview.aliasLabel : '';
      const cat =
        preview.categoria && preview.categoria !== '—'
          ? preview.categoria
          : String(p?.nivel || '').trim();
      const sedeLinea =
        preview.sede && preview.sede !== '—' ? preview.sede : String(p?.ciudad || '').trim();
      setJugadorQrData({
        alias,
        nombre: nombreLinea,
        apodo: apodoLinea,
        categoria: cat,
        sede: sedeLinea,
        fotoUrl: String(p?.foto_url || preview.foto_url || '').trim(),
      });
    },
    [jugadorNombreTorneoCtx]
  );

  useEffect(() => {
    if (!torneo) return;
    console.log('[TorneoTabbedView] estado actual del torneo (API/DB):', {
      estado: torneo.estado,
      estadoNormalizado: String(torneo.estado || '').toLowerCase(),
      torneoId: torneo.id,
      nombre: torneo.nombre,
    });
  }, [torneo?.id, torneo?.estado]);

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

  /** Sorteo solo antes de fase de partidos: abierto / inscripción, con ≥2 equipos completos confirmados. */
  const puedeMostrarBotonSorteoGrupos =
    adminPuedeSorteoGrupos &&
    esGruposKnockout &&
    grupos.length === 0 &&
    (estadoLower === 'abierto' || estadoLower === 'inscripcion_abierta') &&
    equiposConfirmadosParaSorteo(equipos).length >= 2;

  const sorteoGruposAutoOpenedRef = useRef(false);
  useEffect(() => {
    sorteoGruposAutoOpenedRef.current = false;
  }, [torneo?.id, grupos.length]);

  useEffect(() => {
    if (activeTab !== 'grupos') return;
    if (!puedeMostrarBotonSorteoGrupos) return;
    if (sorteoGruposAutoOpenedRef.current) return;
    sorteoGruposAutoOpenedRef.current = true;
    setSorteoModalOpen(true);
  }, [activeTab, puedeMostrarBotonSorteoGrupos, torneo?.id, equipos]);

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
  const navOpts = navigateState != null ? { state: navigateState } : undefined;
  const sedeUbicacion = [sedeTorneo?.ciudad, sedeTorneo?.pais].filter(Boolean).join(', ');
  const sedeTexto = sedeTorneo
    ? `📍 ${sedeTorneo.nombre}${sedeUbicacion ? ` · ${sedeUbicacion}` : ''}`
    : null;

  useEffect(() => {
    if (!shareTorneoCopied) return undefined;
    const t = window.setTimeout(() => setShareTorneoCopied(false), 2200);
    return () => window.clearTimeout(t);
  }, [shareTorneoCopied]);

  const handleExportarJugadoresExcel = useCallback(() => {
    downloadTorneoJugadoresXlsx({
      torneo,
      equipos,
      jugadorNombreTorneoCtx,
    });
  }, [torneo, equipos, jugadorNombreTorneoCtx]);

  const handleShareTorneo = useCallback(async () => {
    if (!shareTorneoMeta?.url) return;
    const title = String(shareTorneoMeta.title || '').trim();
    const text = String(shareTorneoMeta.text || '').trim();
    const u = String(shareTorneoMeta.url || '').trim();
    if (canUseNavigatorShare()) {
      try {
        await navigator.share({ title, text, url: u });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(u);
      setShareTorneoCopied(true);
    } catch {
      window.prompt('Copia este link:', u);
    }
  }, [shareTorneoMeta]);

  useEffect(() => {
    if (!participacionModalOpen) return;
    setParticipacionPaso('menu');
    setEquiposBusquedaRaw([]);
    setEquiposBusquedaError(null);
    setEquiposBusquedaLoading(false);
  }, [participacionModalOpen]);

  useEffect(() => {
    if (!participacionModalOpen || participacionPaso !== 'buscar') return;
    let cancelled = false;
    setEquiposBusquedaLoading(true);
    setEquiposBusquedaError(null);
    (async () => {
      try {
        const url = `${String(apiBaseUrl || '').replace(/\/+$/, '')}/api/torneos/${encodeURIComponent(
          String(torneoId)
        )}/equipos`;
        const res = await fetch(url);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          const msg =
            data && typeof data === 'object' && data.error != null ? String(data.error) : 'No se pudo cargar la lista';
          setEquiposBusquedaError(msg);
          setEquiposBusquedaRaw([]);
          return;
        }
        setEquiposBusquedaRaw(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setEquiposBusquedaError(e?.message || 'Error de red');
          setEquiposBusquedaRaw([]);
        }
      } finally {
        if (!cancelled) setEquiposBusquedaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [participacionModalOpen, participacionPaso, apiBaseUrl, torneoId]);

  const equiposParaChequeoMi = useMemo(() => {
    const m = new Map();
    (equipos || []).forEach((eq) => {
      if (eq?.id != null) m.set(eq.id, eq);
    });
    (equiposBusquedaRaw || []).forEach((eq) => {
      if (eq?.id != null) m.set(eq.id, eq);
    });
    return [...m.values()];
  }, [equipos, equiposBusquedaRaw]);

  const miEquipoModal = useMemo(
    () => (session?.user ? findMiEquipoEnLista(equiposParaChequeoMi, session, userProfile) : null),
    [equiposParaChequeoMi, session, userProfile]
  );

  const miSolicitudModal = useMemo(
    () => (session?.user ? findMiSolicitudEquipo(equiposParaChequeoMi, session, userProfile) : null),
    [equiposParaChequeoMi, session, userProfile]
  );

  const miEquipoTorneo = useMemo(() => {
    const eq = findMiEquipoEnLista(equipos || [], session, userProfile);
    return eq?.id != null ? eq.id : null;
  }, [equipos, session, userProfile]);

  useEffect(() => {
    miEquipoTorneoRef.current = miEquipoTorneo;
  }, [miEquipoTorneo]);

  useEffect(() => {
    return () => {
      if (voiceRecognitionRef.current) {
        try {
          voiceRecognitionRef.current.stop();
        } catch {
          /* ignore */
        }
        voiceRecognitionRef.current = null;
      }
    };
  }, []);

  const equiposAbiertosListado = useMemo(
    () => (equiposBusquedaRaw || []).filter((eq) => equipoAbiertoBuscandoCompanero(eq)),
    [equiposBusquedaRaw]
  );

  const irACrearEquipoDefault = useCallback(() => {
    if (typeof onParticipacionModalClose === 'function') onParticipacionModalClose();
    const opts = navigateState != null ? { replace: true, state: navigateState } : { replace: true };
    navigate(`/torneo/${torneoId}/equipos?crear=1`, opts);
  }, [navigate, navigateState, onParticipacionModalClose, torneoId]);

  const irACrearEquipoEfectivo = useCallback(() => {
    if (typeof onParticipacionIrACrearEquipo === 'function') {
      onParticipacionIrACrearEquipo();
      return;
    }
    irACrearEquipoDefault();
  }, [onParticipacionIrACrearEquipo, irACrearEquipoDefault]);

  const handleSolicitarUnirme = useCallback(
    async (equipoRow) => {
      if (solicitudPendingId != null) return;
      setSolicitudPendingId(equipoRow.id);
      try {
        const r = await solicitarUnirseAEquipoAbierto({
          equipo: equipoRow,
          session,
          userProfile,
          authLoading,
          navigate,
          location,
          torneoIdForRedirect: torneoId,
          equiposTorneo: equiposParaChequeoMi,
        });
        if (!r.ok) {
          if (r.message) alert(r.message);
          return;
        }
        setEquiposBusquedaRaw((prev) =>
          prev.map((eq) => (eq.id === equipoRow.id ? { ...eq, solicitudes: r.nuevasSolicitudes } : eq))
        );
        if (typeof onParticipacionDespuesUnirme === 'function') onParticipacionDespuesUnirme();
      } finally {
        setSolicitudPendingId(null);
      }
    },
    [
      solicitudPendingId,
      session,
      userProfile,
      authLoading,
      navigate,
      location,
      torneoId,
      equiposParaChequeoMi,
      onParticipacionDespuesUnirme,
    ]
  );

  const abrirModalResultado = useCallback(
    (partido) => {
      if (!isAdmin) return;
      if (partido.estado === 'finalizado') return;
      if (!puedeCargarResultados) {
        alert('Inicia el torneo para comenzar a cargar resultados.');
        return;
      }
      setSelectedPartido(partido);
      setResultado({ set1: '', set2: '', set3: '' });
      setVoiceError(null);
      setVoicePending(null);
      setVoiceListening(false);
      setVoicePhase('idle');
      setVoiceInterimText('');
      setVoiceSaving(false);
      setShowModalResultado(true);
    },
    [isAdmin, puedeCargarResultados]
  );

  const startVoiceResultado = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      setVoiceError('Tu navegador no soporta reconocimiento de voz.');
      return;
    }
    const sp = selectedPartidoRef.current;
    if (!sp) return;

    setVoiceError(null);
    setVoicePending(null);
    setVoicePhase('listening');
    setVoiceInterimText('');

    try {
      if (voiceRecognitionRef.current) {
        try {
          voiceRecognitionRef.current.abort();
        } catch {
          try {
            voiceRecognitionRef.current.stop();
          } catch {
            /* ignore */
          }
        }
        voiceRecognitionRef.current = null;
      }
    } catch {
      /* ignore */
    }

    const rec = new Ctor();
    voiceRecognitionRef.current = rec;
    rec.lang = 'es-AR';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      let line = '';
      for (let i = 0; i < ev.results.length; i += 1) {
        line += ev.results[i][0]?.transcript || '';
      }
      const trimmed = line.trim();
      setVoiceInterimText(trimmed);
      const last = ev.results[ev.results.length - 1];
      if (!last?.isFinal) return;

      setVoiceListening(false);
      setVoicePhase('processing');

      const partido = selectedPartidoRef.current;
      const eqs = equiposRef.current || [];
      if (!partido) {
        setVoicePhase('idle');
        return;
      }

      const parsed = parseMarcadorVozPartidoCompleto(trimmed);
      const mA = equipoPorId(eqs, partido.equipo_a_id);
      const mB = equipoPorId(eqs, partido.equipo_b_id);
      const nameA = nombreEquipoMostrado(mA || {});
      const nameB = nombreEquipoMostrado(mB || {});

      if (!parsed.ok) {
        setVoiceError(parsed.error || 'No se pudo interpretar el marcador.');
        setVoicePending(null);
        setVoicePhase('idle');
        setVoiceInterimText('');
        return;
      }

      const winnerName = parsed.winnerSide === 'A' ? nameA : nameB;
      setVoiceError(null);
      setVoicePending({
        norm: parsed.norm,
        winnerSide: parsed.winnerSide,
        nameA,
        nameB,
        winnerName,
        resumenSets: parsed.resumenSets,
        transcript: parsed.transcript,
      });
      setVoicePhase('confirm');
      setVoiceInterimText('');
    };

    rec.onerror = (ev) => {
      setVoiceListening(false);
      setVoicePhase('idle');
      const code = ev?.error || '';
      if (code === 'aborted') return;
      const msg =
        code === 'not-allowed'
          ? 'Permití el micrófono para este sitio.'
          : code === 'no-speech'
            ? 'No se detectó voz. Probá de nuevo.'
            : code || 'Error de reconocimiento de voz.';
      setVoiceError(msg);
    };

    rec.onend = () => {
      setVoiceListening(false);
    };

    try {
      rec.start();
      setVoiceListening(true);
    } catch (e) {
      setVoiceError(e?.message || 'No se pudo iniciar el micrófono.');
      setVoiceListening(false);
      setVoicePhase('idle');
    }
  }, []);

  const repetirVozResultado = useCallback(() => {
    try {
      if (voiceRecognitionRef.current) voiceRecognitionRef.current.abort();
    } catch {
      /* ignore */
    }
    voiceRecognitionRef.current = null;
    setVoicePending(null);
    setVoiceError(null);
    setVoicePhase('idle');
    setVoiceInterimText('');
    setVoiceListening(false);
  }, []);

  const guardarResultado = useCallback(
    async (normOverride = null) => {
      if (!selectedPartido) return;
      if (!puedeCargarResultados) {
        alert('Inicia el torneo para comenzar a cargar resultados.');
        return;
      }
      const norm = normOverride
        ? {
            set1: normalizeSetInput(normOverride.set1),
            set2: normalizeSetInput(normOverride.set2),
            set3: normalizeSetInput(normOverride.set3 || ''),
          }
        : {
            set1: normalizeSetInput(resultado.set1),
            set2: normalizeSetInput(resultado.set2),
            set3: normalizeSetInput(resultado.set3),
          };
      const sets = [norm.set1, norm.set2, norm.set3].filter((s) => s.trim());
      if (sets.length < 2) {
        alert('Mínimo 2 sets requeridos');
        return;
      }
      try {
        const base = String(apiBaseUrl || '').replace(/\/+$/, '');
        const res = await fetch(`${base}/api/partidos/${selectedPartido.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estado: 'finalizado',
            resultado: JSON.stringify(norm),
          }),
        });
        if (res.ok) {
          setPartidos((prev) =>
            prev.map((p) =>
              p.id === selectedPartido.id ? { ...p, estado: 'finalizado', resultado: JSON.stringify(norm) } : p
            )
          );
          setResultado(norm);
          setShowModalResultado(false);
          setSelectedPartido(null);
          setVoicePending(null);
          setVoicePhase('idle');
          setVoiceInterimText('');
          setVoiceError(null);
        } else {
          const data = await res.json().catch(() => ({}));
          alert(data.error || res.statusText || 'No se pudo guardar');
        }
      } catch (err) {
        alert('Error al guardar: ' + err.message);
      }
    },
    [selectedPartido, puedeCargarResultados, resultado, apiBaseUrl, setPartidos]
  );

  const confirmarVozYGuardar = useCallback(async () => {
    if (!voicePending?.norm) return;
    setVoiceSaving(true);
    try {
      await guardarResultado(voicePending.norm);
    } finally {
      setVoiceSaving(false);
    }
  }, [voicePending, guardarResultado]);

  const resultadosFilas = useMemo(() => {
    if (clasificacionFinalFilas && clasificacionFinalFilas.length > 0) return clasificacionFinalFilas;
    if (!esFinalizado) return [];
    const sorted = [...equipos].sort((a, b) => (Number(b.puntos_ranking) || 0) - (Number(a.puntos_ranking) || 0));
    return sorted.map((eq, i) => ({
      equipoId: eq.id,
      posicion: i + 1,
      puntos: eq.puntos_ranking ?? 0,
      fotoEquipoUrl: String(eq?.foto_url || '').trim(),
      jugadores: safeJugadores(eq),
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
        equipoId: null,
        posicion: pos,
        equipoNombre: '',
        jugadorLineas: [],
        jugadores: [],
        fotoEquipoUrl: '',
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
      else rows.push({ posicion: pos, equipoNombre: '', jugadorLineas: [], jugadores: [], puntos: null, vacio: true });
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

  useEffect(() => {
    const validIds = tabs.map((x) => x.id);
    if (!validIds.length) return;
    if (!validIds.includes(activeTab)) {
      setActiveTab(defaultTabId(torneo?.estado));
    }
  }, [tabs, activeTab, torneo?.estado, torneo?.id]);

  const horasRevelarEquiposMsg = useMemo(
    () => String(horasRevelarEquiposTorneo(torneo)),
    [torneo?.horas_revelar_equipos]
  );

  const ocultarListaEquiposPublico = useMemo(
    () =>
      torneoListaEquiposOcultaParaPublico(torneo, {
        isAdmin: Boolean(isAdmin || equiposRevelacionBypass),
      }),
    [torneo, isAdmin, equiposRevelacionBypass]
  );

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
      {equiposTabHeader}
      {ocultarListaEquiposPublico ? (
        <div
          style={{
            padding: '16px 18px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(129,140,248,0.08) 100%)',
            border: '1px solid rgba(99,102,241,0.35)',
            color: '#312e81',
            fontSize: '15px',
            fontWeight: 700,
            lineHeight: 1.55,
            textAlign: 'center',
          }}
        >
          Los equipos participantes se revelan {horasRevelarEquiposMsg} horas antes del inicio. ¡Anotate y sorprendé a
          todos el día del torneo!
        </div>
      ) : equipos.length === 0 ? (
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
                  <button
                    type="button"
                    onClick={() => navigate(`/equipo/${equipo.id}`, navOpts)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontWeight: 900,
                      fontSize: '16px',
                      color: '#2563eb',
                      textDecoration: 'underline',
                      marginBottom: '10px',
                      flex: 1,
                      minWidth: 0,
                      padding: 0,
                      textAlign: 'left',
                    }}
                    title={titulo}
                  >
                    {titulo}
                  </button>
                  {puedeGestionarEquiposTorneo ? (
                    <button
                      type="button"
                      className="btn-agregar-jugadores"
                      onClick={() => navigate(`/torneo/${torneoId}/equipos/${equipo.id}`, navOpts)}
                      style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}
                    >
                      Gestionar
                    </button>
                  ) : capOk ? (
                    <button
                      type="button"
                      className="btn-agregar-jugadores"
                      onClick={() => navigate(`/torneo/${torneoId}/equipos/${equipo.id}`, navOpts)}
                      style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}
                    >
                      Ver mi equipo
                    </button>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {jugadores.length === 0 ? (
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>Sin jugadores</span>
                  ) : (
                    jugadores.map((p, idx) => {
                      const nombreMain = nombreListadoTorneoRanking(p);
                      const al = String(p?.alias || '').trim();
                      const initial = String(nombreMain || '?')
                        .charAt(0)
                        .toUpperCase();
                      const foto = String(p?.foto_url || '').trim();
                      return (
                        <div
                          key={`${equipo.id}-j-${idx}`}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                        >
                          <button
                            type="button"
                            onClick={() => abrirPreviewJugador(p)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: '4px 0',
                              textAlign: 'left',
                              flex: 1,
                              minWidth: 0,
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
                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', minWidth: 0 }}>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{nombreMain}</span>
                              {al ? (
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af' }}>
                                  {formatAliasConArroba(al)}
                                </span>
                              ) : null}
                            </span>
                          </button>
                          {puedeGestionarEquiposTorneo ? (
                            <button
                              type="button"
                              title="Ver QR"
                              onClick={() => abrirQrJugador(p)}
                              style={{
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                borderRadius: '8px',
                                padding: '4px 8px',
                                fontSize: '14px',
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              QR
                            </button>
                          ) : null}
                        </div>
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

  const renderGrupoTable = (grupoLabel, tablaRows, onNombreClick) => {
    const statHeaders = ['PJ', 'PG', 'PP', 'SF', 'SC', 'GF', 'GC', 'PTS'];
    return (
      <div style={{ marginBottom: '22px' }}>
        <div style={{ fontWeight: 900, fontSize: '15px', color: '#0f172a', marginBottom: '8px' }}>Grupo {grupoLabel}</div>
        <div className="tabla-grupos-scroll-outer">
          <table className="tabla-grupos-stats">
            <thead>
              <tr style={{ color: '#475569' }}>
                <th className="tabla-grupos-col-equipo tabla-grupos-th-equipo">EQUIPO</th>
                {statHeaders.map((h) => (
                  <th key={h} className="tabla-grupos-col-stat">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tablaRows.map((row, idx) => {
                const nombreCorto = trunc12(nombreEquipoMostrado({ ...row, nombre: row.nombre }));
                const clasifica = idx < 2;
                const bgFila = clasifica ? 'rgba(34, 197, 94, 0.12)' : '#ffffff';
                return (
                  <tr
                    key={row.id}
                    style={{
                      borderTop: '1px solid #f1f5f9',
                      background: bgFila,
                    }}
                  >
                    <td
                      className="tabla-grupos-col-equipo"
                      style={{ fontWeight: 700, maxWidth: 140, background: bgFila }}
                    >
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
                    <td className="tabla-grupos-col-stat" style={{ background: bgFila }}>
                      {row.jj}
                    </td>
                    <td className="tabla-grupos-col-stat" style={{ background: bgFila }}>
                      {row.g}
                    </td>
                    <td className="tabla-grupos-col-stat" style={{ background: bgFila }}>
                      {row.p}
                    </td>
                    <td className="tabla-grupos-col-stat" style={{ background: bgFila }}>
                      {row.sg}
                    </td>
                    <td className="tabla-grupos-col-stat" style={{ background: bgFila }}>
                      {row.sp}
                    </td>
                    <td className="tabla-grupos-col-stat" style={{ background: bgFila }}>
                      {row.gg}
                    </td>
                    <td className="tabla-grupos-col-stat" style={{ background: bgFila }}>
                      {row.gp}
                    </td>
                    <td className="tabla-grupos-col-stat" style={{ fontWeight: 900, color: '#4f46e5', background: bgFila }}>
                      {row.pts}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTabGrupos = () => {
    const openEq = (row) => setModalEquipo(equipos.find((e) => e.id === row.id) || row);
    if (esGruposKnockout) {
      if (grupos.length === 0) {
        return (
          <div style={{ marginTop: '8px' }}>
            {puedeMostrarBotonSorteoGrupos ? (
              <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setSorteoModalOpen(true)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(79,70,229,0.35)',
                  }}
                >
                  Realizar sorteo
                </button>
              </div>
            ) : null}
            <div
              style={{
                padding: '24px 16px',
                background: '#fff',
                borderRadius: '14px',
                textAlign: 'center',
                color: '#475569',
                fontWeight: 700,
                fontSize: '15px',
                lineHeight: 1.55,
                border: '1px solid #e2e8f0',
              }}
            >
              Los grupos se definirán después del sorteo oficial.
            </div>
          </div>
        );
      }
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
          style={{ cursor: puedeCargarResultados ? 'pointer' : 'default' }}
          onClick={puedeCargarResultados ? () => abrirModalResultado(partido) : undefined}
          role={puedeCargarResultados ? 'button' : undefined}
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
        style={{ cursor: puedeCargarResultados ? 'pointer' : 'default' }}
        onClick={puedeCargarResultados ? () => abrirModalResultado(partido) : undefined}
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
      {mostrarCartelIniciarTorneoParaResultados ? (
        <p
          style={{
            margin: '0 0 14px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: '#fef3c7',
            color: '#92400e',
            fontWeight: 600,
            fontSize: '14px',
            border: '1px solid #fcd34d',
            lineHeight: 1.45,
          }}
        >
          Inicia el torneo para comenzar a cargar resultados.
        </p>
      ) : null}
      {partidosOrdenados.length === 0 ? (
        <p className="sin-partidos">Sin partidos</p>
      ) : (
        <div className="lista-partidos">{partidosOrdenados.map(renderFixtureLine)}</div>
      )}
    </div>
  );

  const nombreLlaveSlot = (partido, lado) => {
    const id = lado === 'a' ? partido.equipo_a_id : partido.equipo_b_id;
    if (id == null || id === '') return 'Por definir';
    const eq = equipoPorId(equipos, id);
    return nombreEquipoMostrado(eq || {});
  };

  const renderBracketMatchCard = (partido) => {
    const na = nombreLlaveSlot(partido, 'a');
    const nb = nombreLlaveSlot(partido, 'b');
    const fin = partido.estado === 'finalizado';
    const { sgA, sgB } = fin ? contarSetsGanados(partido) : { sgA: 0, sgB: 0 };
    const ganaA = fin && sgA > sgB;
    const ganaB = fin && sgB > sgA;
    const setsList = fin ? parseResultadoSets(partido) : [];
    const setsTxt = setsList.length > 0 ? setsList.join(', ') : null;
    const fh = partido.fecha_hora
      ? new Date(partido.fecha_hora).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
      : null;
    const click = puedeCargarResultados ? () => abrirModalResultado(partido) : undefined;
    return (
      <div
        key={partido.id}
        className={`torneo-bracket-card${puedeCargarResultados ? ' torneo-bracket-card--clickable' : ''}`}
        onClick={click}
        role={click ? 'button' : undefined}
      >
        <div className={`torneo-bracket-team${ganaA ? ' torneo-bracket-team--winner' : ''}${na === 'Por definir' ? ' torneo-bracket-team--tbd' : ''}`}>
          <span className="torneo-bracket-team-name">{na}</span>
          {ganaA ? <span className="torneo-bracket-winner-mark">✓</span> : null}
        </div>
        <div className="torneo-bracket-vs">vs</div>
        <div className={`torneo-bracket-team${ganaB ? ' torneo-bracket-team--winner' : ''}${nb === 'Por definir' ? ' torneo-bracket-team--tbd' : ''}`}>
          <span className="torneo-bracket-team-name">{nb}</span>
          {ganaB ? <span className="torneo-bracket-winner-mark">✓</span> : null}
        </div>
        {fin && setsTxt ? <div className="torneo-bracket-score">{setsTxt}</div> : null}
        {!fin && fh ? <div className="torneo-bracket-meta">{fh}</div> : null}
      </div>
    );
  };

  const bracketConnectorSvg = (isPair) => (
    <div className="torneo-bracket-connector" aria-hidden>
      {isPair ? (
        <svg className="torneo-bracket-connector-svg" viewBox="0 0 24 100" preserveAspectRatio="none">
          <path
            d="M 0 25 L 10 25 L 10 50 M 0 75 L 10 75 L 10 50 M 10 50 L 24 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg className="torneo-bracket-connector-svg" viewBox="0 0 24 100" preserveAspectRatio="none">
          <path
            d="M 0 50 L 24 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );

  const filasLlavePorRonda = (indiceRonda, plist) => {
    if (indiceRonda === 0) {
      const rows = [];
      for (let i = 0; i < plist.length; i += 2) {
        rows.push(plist.slice(i, i + 2));
      }
      return rows;
    }
    return plist.map((p) => [p]);
  };

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
    const ultimaIdx = rondasLlave.length - 1;
    return (
      <div className="torneo-bracket-scroll">
        <div className="torneo-bracket-track">
          {rondasLlave.map(({ ronda, partidos: plist }, colIdx) => {
            const isLastCol = colIdx === ultimaIdx;
            const rows = filasLlavePorRonda(colIdx, plist);
            return (
              <Fragment key={ronda}>
                <div className="torneo-bracket-col">
                  <div className="torneo-bracket-ronda-label">Ronda {ronda}</div>
                  {isLastCol && plist.length === 1 ? (
                    <div className="torneo-bracket-col-body torneo-bracket-col-body--final">
                      {plist[0] ? renderBracketMatchCard(plist[0]) : null}
                    </div>
                  ) : isLastCol ? (
                    <div className="torneo-bracket-col-body">
                      {rows.map((row, rowIdx) => (
                        <div key={row.map((p) => p.id).join('-') || `row-${rowIdx}`} className="torneo-bracket-row torneo-bracket-row--terminal">
                          <div className="torneo-bracket-row-cards">
                            {row.map((p) => renderBracketMatchCard(p))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="torneo-bracket-col-body">
                      {rows.map((row, rowIdx) => (
                        <div key={row.map((p) => p.id).join('-') || `row-${rowIdx}`} className="torneo-bracket-row">
                          <div className="torneo-bracket-row-cards">
                            {row.map((p) => renderBracketMatchCard(p))}
                          </div>
                          {bracketConnectorSvg(row.length >= 2)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
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
                  {sinEquipo ? (
                    'Sin definir'
                  ) : fila.equipoId != null ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/equipo/${fila.equipoId}`, navOpts)}
                      className="podium-team-link"
                    >
                      {fila.equipoNombre}
                    </button>
                  ) : (
                    fila.equipoNombre
                  )}
                </div>
                {!sinEquipo ? (
                  <div className="podium-player-avatars">
                    {(Array.isArray(fila.jugadores) ? fila.jugadores : [])
                      .slice(0, 4)
                      .map((p, idx) => {
                        const a = avatarJugadorPodio(p);
                        const nombreJug = String(p?.nombre || p?.name || a.label || 'Jugador').trim() || 'Jugador';
                        return (
                          <button
                            key={`${a.label}-${idx}`}
                            type="button"
                            className="podium-player-avatar-wrap"
                            style={{ zIndex: idx + 1 }}
                            onClick={() => abrirPreviewJugador(p)}
                            aria-label={`Ver ${nombreJug}`}
                          >
                            {a.foto ? (
                              <img src={a.foto} alt="" className="podium-player-avatar" loading="lazy" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="podium-player-avatar-fallback">{a.initial}</span>
                            )}
                          </button>
                        );
                      })}
                  </div>
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
            const jugadoresRow = Array.isArray(f.jugadores) ? f.jugadores : [];
            const nombre = vacio || !String(f.equipoNombre || '').trim() ? '—' : f.equipoNombre;
            const ptsTxt =
              vacio || f.puntos == null || f.puntos === '' || Number.isNaN(Number(f.puntos))
                ? '—'
                : `${Number(f.puntos)} pts`;
            return (
              <div key={f.posicion} className="clasificacion-final-fila">
                <span className="clasificacion-final-pos">{f.posicion}</span>
                <span className={`clasificacion-final-equipo${vacio ? ' clasificacion-final-mute' : ''}`}>{nombre}</span>
                <span className={`clasificacion-final-jug clasificacion-final-jug--chips${vacio ? ' clasificacion-final-mute' : ''}`}>
                  {!vacio && jugadoresRow.length ? (
                    jugadoresRow.slice(0, 4).map((p, idx) => (
                      <button
                        key={`${f.posicion}-${p?.id ?? p?.jugador_id ?? idx}-${jugadorEtiquetaConArroba(p)}`}
                        type="button"
                        className="clasificacion-final-jug-chip"
                        onClick={() => abrirPreviewJugador(p)}
                      >
                        {jugadorEtiquetaConArroba(p)}
                      </button>
                    ))
                  ) : (
                    '—'
                  )}
                </span>
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
        return muestraTabLlave ? renderTabLlave() : renderTabEquipos();
      case 'resultados':
        return esFinalizado ? renderTabResultados() : renderTabEquipos();
      default:
        return renderTabEquipos();
    }
  };

  const modalJugadores = modalEquipo ? safeJugadores(modalEquipo) : [];

  return (
    <>
      {participacionModalOpen ? (
        <div
          className="torneo-modal-participacion-overlay"
          role="presentation"
          onClick={() => {
            if (typeof onParticipacionModalClose === 'function') onParticipacionModalClose();
          }}
        >
          <div
            className="torneo-modal-participacion-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={participacionPaso === 'menu' ? 'torneo-participacion-titulo' : undefined}
            aria-label={participacionPaso === 'buscar' ? 'Equipos abiertos buscando compañero' : undefined}
            onClick={(e) => e.stopPropagation()}
            style={
              participacionPaso === 'buscar'
                ? { maxWidth: 'min(520px, 100vw)', maxHeight: 'min(88vh, 720px)', display: 'flex', flexDirection: 'column' }
                : undefined
            }
          >
            {participacionPaso === 'menu' ? (
              <>
                <h2 id="torneo-participacion-titulo" className="torneo-modal-participacion-titulo">
                  ¿Cómo quieres participar?
                </h2>
                <button
                  type="button"
                  className="torneo-modal-participacion-opcion torneo-modal-participacion-opcion--primaria"
                  onClick={irACrearEquipoEfectivo}
                >
                  <span className="torneo-modal-participacion-opcion__titulo">Tengo equipo completo</span>
                  <span className="torneo-modal-participacion-opcion__sub">Ya tenemos todos los integrantes</span>
                </button>
                <button
                  type="button"
                  className="torneo-modal-participacion-opcion torneo-modal-participacion-opcion--secundaria"
                  onClick={() => setParticipacionPaso('buscar')}
                >
                  <span className="torneo-modal-participacion-opcion__titulo">Busco compañero/s</span>
                  <span className="torneo-modal-participacion-opcion__sub">Me anoto solo y busco con quién jugar</span>
                </button>
                <button
                  type="button"
                  className="torneo-modal-participacion-cerrar"
                  onClick={() => {
                    if (typeof onParticipacionModalClose === 'function') onParticipacionModalClose();
                  }}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setParticipacionPaso('menu')}
                    style={{
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    ← Atrás
                  </button>
                  <h2 className="torneo-modal-participacion-titulo" style={{ margin: 0, flex: 1, textAlign: 'center', fontSize: '1.1rem' }}>
                    Equipos abiertos
                  </h2>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  {equiposBusquedaLoading ? (
                    <p style={{ textAlign: 'center', color: '#64748b', fontWeight: 600, margin: '20px 0' }}>
                      Cargando equipos…
                    </p>
                  ) : equiposBusquedaError ? (
                    <p style={{ textAlign: 'center', color: '#b91c1c', fontWeight: 700, margin: '16px 0' }}>
                      {equiposBusquedaError}
                    </p>
                  ) : equiposAbiertosListado.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '8px 4px 20px' }}>
                      <p style={{ color: '#334155', fontWeight: 700, lineHeight: 1.5, margin: '0 0 16px' }}>
                        No hay equipos buscando compañero. ¿Quieres crear el tuyo?
                      </p>
                      <button
                        type="button"
                        onClick={irACrearEquipoEfectivo}
                        style={{
                          padding: '12px 20px',
                          fontSize: '15px',
                          fontWeight: 800,
                          borderRadius: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                          color: 'white',
                          boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                        }}
                      >
                        Crear equipo
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '8px' }}>
                      {equiposAbiertosListado.map((eq) => {
                        const titulo = nombreEquipoMostrado(eq);
                        const cupo = Number(eq.cupo_maximo || eq.cupo || 2);
                        const n = safeJugadores(eq).length;
                        const fotoCap = fotoCapitanEquipo(eq);
                        const initial = initialFromText(titulo);
                        const busy = solicitudPendingId === eq.id;
                        const yaSoliciteAqui = miSolicitudModal?.id === eq.id;
                        const bloquearSolicitud = Boolean(miEquipoModal || (miSolicitudModal && miSolicitudModal.id !== eq.id));
                        return (
                          <div
                            key={eq.id}
                            style={{
                              border: '1px solid #e2e8f0',
                              borderRadius: '14px',
                              padding: '12px 14px',
                              background: '#f8fafc',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {fotoCap ? (
                                <img
                                  src={fotoCap}
                                  alt=""
                                  style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    flexShrink: 0,
                                    border: '1px solid #e2e8f0',
                                  }}
                                />
                              ) : (
                                <span
                                  style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                    color: 'white',
                                    fontSize: '16px',
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
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 900, color: '#0f172a', fontSize: '15px', lineHeight: 1.3 }}>
                                  {titulo}
                                </div>
                                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
                                  {n} / {cupo} jugadores
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={busy || bloquearSolicitud || yaSoliciteAqui}
                              onClick={() => void handleSolicitarUnirme(eq)}
                              style={{
                                padding: '10px 14px',
                                fontSize: '14px',
                                fontWeight: 800,
                                borderRadius: '10px',
                                border: 'none',
                                cursor:
                                  busy || bloquearSolicitud || yaSoliciteAqui ? 'not-allowed' : 'pointer',
                                background:
                                  busy || bloquearSolicitud || yaSoliciteAqui ? '#cbd5e1' : '#2563eb',
                                color: 'white',
                                opacity: busy ? 0.85 : 1,
                              }}
                            >
                              {yaSoliciteAqui
                                ? 'Solicitud enviada'
                                : bloquearSolicitud
                                  ? miEquipoModal
                                    ? 'Ya estás en un equipo'
                                    : 'Ya tienes una solicitud'
                                  : busy
                                    ? 'Enviando…'
                                    : 'Solicitar unirme'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="torneo-modal-participacion-cerrar"
                  onClick={() => {
                    if (typeof onParticipacionModalClose === 'function') onParticipacionModalClose();
                  }}
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
      {showTorneoLogo ? (
        <img
          src="/logo-padbol-match.png"
          alt="Padbol Match"
          style={{
            ...padbolLogoImgStyle,
            marginTop: 0,
            marginBottom: '8px',
          }}
        />
      ) : null}

      <div
        className="torneo-header"
        style={{
          position: 'relative',
          marginTop: showTorneoLogo ? 0 : '8px',
          marginBottom: '12px',
          padding: '20px',
          paddingRight: shareTorneoMeta?.url ? '52px' : '20px',
        }}
      >
        {shareTorneoMeta?.url ? (
          <>
            <button
              type="button"
              onClick={() => void handleShareTorneo()}
              aria-label="Compartir torneo"
              title="Compartir torneo"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 2,
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.38)',
                background: 'rgba(15,23,42,0.28)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                margin: 0,
                boxSizing: 'border-box',
              }}
            >
              <ShareIconSvg width={18} height={18} />
            </button>
            {shareTorneoCopied ? (
              <span
                role="status"
                style={{
                  position: 'absolute',
                  top: '50px',
                  right: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#f8fafc',
                  background: 'rgba(15,23,42,0.82)',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  whiteSpace: 'nowrap',
                }}
              >
                Copiado
              </span>
            ) : null}
          </>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'clamp(1.15rem, 4vw, 1.75rem)', margin: 0 }}>🏆 {torneo?.nombre}</h1>
          {estadoBadge ? (
            <span
              style={{
                display: 'inline-block',
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.03em',
                background: estadoBadge.bg,
                color: estadoBadge.color,
                border: '1px solid rgba(15,23,42,0.08)',
                whiteSpace: 'nowrap',
              }}
            >
              {estadoBadge.label}
            </span>
          ) : null}
        </div>
        {sedeTexto ? <p>{sedeTexto}</p> : null}
        <p>
          {formatNivelTorneo(torneo?.nivel_torneo)} • {formatCategoriaTorneo(torneo?.categoria)} •{' '}
          {formatGeneroCompetenciaTorneo(torneoTipoCompetenciaDb(torneo))} •{' '}
          {formatCategoriaEdadTorneo(torneo?.categoria_edad)} • {formatTipoTorneo(torneo?.tipo_torneo)} •{' '}
          {formatFecha(torneo?.fecha_inicio)} a {formatFecha(torneo?.fecha_fin)}
        </p>
      </div>

      {adminTorneoBar}

      {puedeExportarJugadoresExcel ? (
        <div
          style={{
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={handleExportarJugadoresExcel}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid #15803d',
              background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.35)',
            }}
          >
            📥 Exportar jugadores
          </button>
        </div>
      ) : null}

      <div data-torneo-banner-slot={TORNEO_BANNER_ANTES_TABS_DATA_SLOT}>{bannerAntesTabs}</div>

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
              {modalJugadores.map((p, i) => {
                const fotoM = String(p?.foto_url || '').trim();
                const alM = String(p?.alias || '').trim();
                const nm = nombreListadoTorneoRanking(p);
                const ini = String(nm || '?')
                  .charAt(0)
                  .toUpperCase();
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '8px',
                      background: '#f8fafc',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        abrirPreviewJugador(p);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        flex: 1,
                        minWidth: 0,
                        padding: 0,
                      }}
                    >
                      {fotoM ? (
                        <img
                          src={fotoM}
                          alt=""
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                            border: '1px solid #e2e8f0',
                          }}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                          aria-hidden
                        >
                          {ini}
                        </span>
                      )}
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', minWidth: 0 }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{nm}</span>
                        {alM ? (
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af' }}>
                            {formatAliasConArroba(alM)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {puedeGestionarEquiposTorneo ? (
                      <button
                        type="button"
                        title="Ver QR"
                        onClick={() => abrirQrJugador(p)}
                        style={{
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          borderRadius: '8px',
                          padding: '4px 8px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        QR
                      </button>
                    ) : null}
                  </div>
                );
              })}
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
        <div
          className="modal-overlay modal-overlay--cargar-resultado-mobile"
          onClick={() => {
            try {
              if (voiceRecognitionRef.current) voiceRecognitionRef.current.stop();
            } catch {
              /* ignore */
            }
            setVoicePending(null);
            setVoicePhase('idle');
            setVoiceInterimText('');
            setVoiceError(null);
            setVoiceListening(false);
            setShowModalResultado(false);
          }}
        >
          <div className="modal-content modal-content--cargar-resultado" onClick={(e) => e.stopPropagation()}>
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

            {speechRecognitionDisponible() ? (
              <div style={{ marginBottom: '14px' }}>
                <button
                  type="button"
                  className={`torneo-voice-mic-btn${voiceListening ? ' torneo-voice-mic-btn--listening' : ''}`}
                  onClick={() => startVoiceResultado()}
                  disabled={
                    voiceListening || voicePhase === 'processing' || voiceSaving || voicePhase === 'confirm'
                  }
                >
                  <span className="torneo-voice-mic-btn__icon" aria-hidden>
                    🎤
                  </span>
                  <span className="torneo-voice-mic-btn__label">
                    {voicePhase === 'processing'
                      ? 'Procesando…'
                      : voiceListening
                        ? 'Escuchando…'
                        : 'Dictar resultado (una frase)'}
                  </span>
                </button>
                <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  Español (Argentina) · Una sola frase con todos los sets
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                  Decí los games de cada set en orden: primero el equipo de la izquierda (A), luego el de la derecha (B).
                  Ejemplos: «6 4, 3 6, 7 5» · «6 4 3 6» (2 sets) · «6 4 6 2» (2-0). Mejor de 3: hace falta un ganador
                  a 2 sets (2-0 o 2-1).
                </p>
                {(voiceListening || voicePhase === 'processing') ? (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px 14px',
                      background: '#f1f5f9',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#0f172a',
                      minHeight: '48px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                      {voicePhase === 'processing' ? 'Procesando' : 'Reconocido'}
                    </span>
                    {voicePhase === 'processing' ? (
                      <span>Interpretando marcador…</span>
                    ) : voiceInterimText ? (
                      voiceInterimText
                    ) : (
                      <span style={{ color: '#94a3b8' }}>Hablando…</span>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <p
                style={{
                  margin: '0 0 14px',
                  padding: '10px 12px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  fontSize: '13px',
                  color: '#475569',
                  fontWeight: 600,
                }}
              >
                Tu navegador no permite dictado por voz. Usa los campos de abajo.
              </p>
            )}

            {voiceError ? (
              <div style={{ margin: '0 0 12px' }}>
                <p
                  role="alert"
                  style={{
                    margin: 0,
                    padding: '10px 12px',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {voiceError}
                </p>
                <button
                  type="button"
                  className="btn-guardar"
                  style={{ marginTop: '10px', width: '100%', minHeight: '48px', fontSize: '15px', fontWeight: 800 }}
                  onClick={() => {
                    setVoiceError(null);
                    startVoiceResultado();
                  }}
                >
                  Repetir dictado
                </button>
              </div>
            ) : null}

            {voicePending && voicePhase === 'confirm' ? (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '16px 16px',
                  background: '#eef2ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: '12px',
                }}
              >
                <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Confirmar resultado
                </p>
                <p style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 800, color: '#1e1b4b', lineHeight: 1.35 }}>
                  <strong>{voicePending.nameA}</strong>
                  <span style={{ color: '#64748b', fontWeight: 700 }}> vs </span>
                  <strong>{voicePending.nameB}</strong>
                </p>
                <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: '#312e81' }}>
                  {voicePending.resumenSets}
                </p>
                <p style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 800, color: '#15803d' }}>
                  Ganador del partido: {voicePending.winnerName}
                </p>
                <p style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#1e1b4b' }}>¿Confirmas?</p>
                {voicePending.transcript ? (
                  <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#6366f1', fontStyle: 'italic' }}>
                    Escuchado: «{voicePending.transcript}»
                  </p>
                ) : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-guardar"
                    disabled={voiceSaving}
                    style={{ width: '100%', minHeight: '52px', fontSize: '16px', fontWeight: 800 }}
                    onClick={() => void confirmarVozYGuardar()}
                  >
                    {voiceSaving ? 'Guardando…' : 'CONFIRMAR'}
                  </button>
                  <button
                    type="button"
                    className="btn-cancelar"
                    disabled={voiceSaving}
                    style={{ width: '100%', minHeight: '52px', fontSize: '16px', fontWeight: 700 }}
                    onClick={repetirVozResultado}
                  >
                    REPETIR
                  </button>
                </div>
              </div>
            ) : null}

            <div className="form-sets">
              <div className="input-group">
                <label>Set 1</label>
                <input
                  type="text"
                  placeholder="6-4"
                  value={resultado.set1}
                  onChange={(e) =>
                    setResultado({ ...resultado, set1: normalizeSetInput(e.target.value) })
                  }
                />
              </div>
              <div className="input-group">
                <label>Set 2</label>
                <input
                  type="text"
                  value={resultado.set2}
                  onChange={(e) =>
                    setResultado({ ...resultado, set2: normalizeSetInput(e.target.value) })
                  }
                />
              </div>
              <div className="input-group">
                <label>Set 3 (opcional)</label>
                <input
                  type="text"
                  value={resultado.set3}
                  onChange={(e) =>
                    setResultado({ ...resultado, set3: normalizeSetInput(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="modal-buttons">
              <button type="button" className="btn-guardar" onClick={() => void guardarResultado()}>
                Guardar
              </button>
              <button
                type="button"
                className="btn-cancelar"
                onClick={() => {
                  try {
                    if (voiceRecognitionRef.current) voiceRecognitionRef.current.stop();
                  } catch {
                    /* ignore */
                  }
                  setVoicePending(null);
                  setVoicePhase('idle');
                  setVoiceInterimText('');
                  setVoiceError(null);
                  setVoiceListening(false);
                  setShowModalResultado(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <JugadorPreviewModal
        open={Boolean(jugadorPreview)}
        onClose={() => setJugadorPreview(null)}
        data={jugadorPreview}
      />
      <JugadorQrModal
        open={Boolean(jugadorQrData)}
        onClose={() => setJugadorQrData(null)}
        alias={jugadorQrData?.alias}
        nombre={jugadorQrData?.nombre}
        apodo={jugadorQrData?.apodo}
        categoria={jugadorQrData?.categoria}
        sede={jugadorQrData?.sede}
        fotoUrl={jugadorQrData?.fotoUrl}
      />

      <SorteoGruposModal
        open={sorteoModalOpen}
        onClose={() => setSorteoModalOpen(false)}
        torneo={torneo}
        equipos={equipos}
        apiBaseUrl={apiBaseUrl}
        accessToken={session?.access_token}
        onConfirmed={() => {
          setSorteoModalOpen(false);
          onAfterSorteoGrupos?.();
        }}
      />
    </>
  );
}
