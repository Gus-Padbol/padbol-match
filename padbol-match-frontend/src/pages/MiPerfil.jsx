import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import SedeBusquedaInput from '../components/SedeBusquedaInput';
import TelefonoPaisCodigoRow from '../components/TelefonoPaisCodigoRow';
import JugadorPreviewModal from '../components/JugadorPreviewModal';
import ConfirmCancelReservaModal from '../components/ConfirmCancelReservaModal';
import ReservaQrModal from '../components/ReservaQrModal';
import ConfirmModal from '../components/ConfirmModal';
import { fetchWhatsappDisponibleRegistro } from '../utils/registroWhatsappApi';
import { upsertJugadorPerfilPorSesion } from '../utils/upsertJugadorPerfil';
import { buildJugadorPreviewModalData } from '../utils/jugadorPreviewModalData';
import {
  hubContentPaddingTopCss,
  hubMainPaddingBottomCss,
  HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX,
} from '../constants/hubLayout';
import {
  persistJugadorPerfil,
  refreshJugadorPerfilFromSupabase,
  isPerfilTorneoCompleto,
  nombreCompletoJugadorPerfil,
  formatAliasConArroba,
  esCategoriaPendienteValidacion,
} from '../utils/jugadorPerfil';
import { formatNivelTorneo } from '../utils/torneoFormatters';
import { fetchTorneosConPuntosParaPerfil, emojiMedallaPosicionCompacta } from '../utils/torneoHistorialPuntosJugador';
import {
  sumarPuntosPorAlcanceDesdeFilasTorneo,
  tieneAlgunoPuntosPorAlcance,
  contarTorneosUnicosConPuntos,
} from '../utils/perfilPuntosResumen';
import {
  torneosJugadosTotalDesdeEstadisticas,
  sliceEstadisticasJugadorTorneo,
} from '../utils/jugadorEstadisticasPorDeporte';
import { IconGeroUbicacion } from '../components/icons/GeroIcons';
import { etiquetaDeporteTorneo } from '../utils/torneoDeporteFormato';
import { fetchMisClases } from '../utils/clasesApi';
import InstructorFipaSection from '../components/InstructorFipaSection';
import JugadorFichaTorneosSection from '../components/JugadorFichaTorneosSection';
import { normalizeHoraClase } from '../utils/clasesFechas';
import {
  whatsappDigitsValido,
  digitsOnly,
  buildFullWhatsDigits,
  formatWhatsAppE164,
  whatsappNacionalValido,
  splitStoredWhatsapp,
} from '../utils/authIdentidad';
import {
  mensajeErrorAuthSupabase,
  mensajeErrorDbSupabase,
  mensajeErrorJugadoresPerfilDuplicado,
} from '../utils/authErrorsEs';
import { normalizeTorneoPostPerfilPath } from '../utils/torneoPostPerfilNavigation';
import { getOrCreateUsuarioBasico } from '../utils/usuarioBasico';
import { handleAuthOnce } from '../utils/handleAuthOnce';
import { authLoginRedirectPath, authUrlWithRedirect } from '../utils/authLoginRedirect';
import { useAuth } from '../context/AuthContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { getDisplayName, headerNombreVisible } from '../utils/displayName';
import { getCroppedImgBlob } from '../utils/cropImage';
import { PRESET_PROFILE_AVATAR_URLS } from '../constants/presetProfileAvatars';
import { categoriasNivelPorGenero } from '../constants/jugadorCategoria';
import DeportesPreferidosChips from '../components/DeportesPreferidosChips';
import DeportesPreferidosLecturaChips from '../components/DeportesPreferidosLecturaChips';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import {
  normalizeDeportesPreferidosArray,
  hasDeportesPreferidosCargados,
} from '../constants/deportesPreferidos';
import ReputacionJugadorPanel from '../components/ReputacionJugadorPanel';
import { pathPerfilPublicoPorUserId } from '../utils/jugadorPerfilPublicoUrl';
import { getPaisDisplay } from '../utils/paisDisplay';
import './MiPerfilVerPublicoBtn.css';

const API_BASE_URL = 'https://padbol-backend.onrender.com';

const MSG_CUENTA_Y_FICHA_OK = 'Cuenta creada y ficha guardada correctamente';

/** Bucket público en Supabase Storage para fotos de perfil (`jugadores_perfil.foto_url`). */
const AVATAR_STORAGE_BUCKET = 'avatars';

const MI_PERFIL_CONTENT_WRAP = {
  maxWidth: `${HUB_INSTAGRAM_COLUMN_MAX_WIDTH_PX}px`,
  width: '100%',
  margin: '0 auto',
  padding: '20px',
  boxSizing: 'border-box',
};

function miPerfilPageOuterStyle(paddingTopCss, paddingBottomCss) {
  return {
    minHeight: '100vh',
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
    fontFamily: 'Arial',
    paddingTop: paddingTopCss,
    paddingBottom: paddingBottomCss,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    paddingLeft: 'calc(16px + env(safe-area-inset-left, 0px))',
    paddingRight: 'calc(16px + env(safe-area-inset-right, 0px))',
  };
}

/** Asterisco obligatorio (rojo) para labels del registro. */
const reqAst = <span style={{ color: '#d32f2f', fontWeight: 800 }}>*</span>;

function emailValidoVisible(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Inicial para avatar circular cuando no hay `foto_url`. */
function inicialDesdeNombreCompanero(raw) {
  const s = String(raw || '').trim();
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (/[A-Za-zÀ-ÿÁÉÍÓÚÑáéíóúñ0-9]/.test(ch)) return ch.toUpperCase();
  }
  return '?';
}

function nombreCompletoCompaneroOp(op) {
  const n = String(op?.nombre || '').trim();
  if (n) return n;
  return String(op?.alias || '').trim() || 'Jugador';
}

function etiquetaCompaneroNombreYAlias(op) {
  const nombre = nombreCompletoCompaneroOp(op);
  const al = String(op?.alias || '').trim();
  return al ? `${nombre} (${formatAliasConArroba(al)})` : nombre;
}

function etiquetaGeneroPerfil(t, genero) {
  const g = String(genero || '').trim().toLowerCase();
  if (!g) return '—';
  const key = `perfil.genero.${g}`;
  const translated = t(key);
  return translated !== key ? translated : '—';
}

function etiquetaLateralidadPerfil(t, raw) {
  const v = String(raw || '').trim();
  if (v === 'Diestro') return t('perfil.diestro');
  if (v === 'Zurdo') return t('perfil.zurdo');
  if (v === 'Ambidiestro') return t('perfil.ambidiestro');
  return v || '—';
}

function escapeIlikeLiteral(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/** Primeros YYYY-MM-DD del valor (DATE o ISO legacy) sin interpretar como UTC. */
function fechaNacimientoDesdeDb(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : '';
}

/** Solo persiste calendario local YYYY-MM-DD; evita Date / toISOString(). */
function fechaNacimientoParaPayload(inputValue) {
  const s = String(inputValue ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

/** Vista es-AR dd/mm/yyyy desde string almacenado, sin new Date(). */
function fechaNacimientoDisplayEsAr(raw) {
  const ymd = fechaNacimientoDesdeDb(raw);
  if (!ymd) return '—';
  const [y, mo, d] = ymd.split('-');
  return `${d}/${mo}/${y}`;
}

/** Base para sugerencias de alias: minúsculas, sin espacios ni caracteres especiales. */
function baseAliasDesdeTextoLibre(raw) {
  const t = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return t.replace(/[^a-z0-9_]/g, '').slice(0, 32);
}

/** Columnas `nombre` + `apellido`; si falta `apellido`, parte desde `nombre` con espacios (datos viejos). */
function nombreApellidoEditDesdePerfilRow(row) {
  if (!row || typeof row !== 'object') return { nombre: '', apellido: '' };
  const ap = String(row.apellido ?? '').trim();
  const nomRaw = String(row.nombre || '').trim();
  if (ap) return { nombre: nomRaw, apellido: ap };
  if (!nomRaw) return { nombre: '', apellido: '' };
  const parts = nomRaw.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { nombre: nomRaw, apellido: '' };
  return { nombre: parts[0], apellido: parts.slice(1).join(' ') };
}

const CATEGORIA_COLOR = {
  Principiante: '#78909c',
  '5ta':        '#43a047',
  '4ta':        '#039be5',
  '3ra':        '#8e24aa',
  '2da':        '#e53935',
  '1ra':        '#f57c00',
  Elite:        '#212121',
};

/** Valor del select "país" alineado con opciones (🇦🇷 Argentina). */
const PAIS_ARGENTINA_PERFIL = `${PAISES_TELEFONO_PRINCIPALES[0].bandera} ${PAISES_TELEFONO_PRINCIPALES[0].nombre}`;

function normalizeNivelTorneoScope(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/** Alcance del torneo: local | nacional | internacional (campo `nivel_torneo` en DB). */
function mostrarCampoPaisSegunTorneo(torneoRow) {
  if (!torneoRow) return true;
  const n = normalizeNivelTorneoScope(torneoRow.nivel_torneo);
  return n === 'nacional' || n === 'internacional';
}

function mensajeValidarPaisTorneo(torneoRow, paisForm, t) {
  if (!torneoRow) {
    return String(paisForm || '').trim() ? null : t('perfil.selectCountry');
  }
  const n = normalizeNivelTorneoScope(torneoRow.nivel_torneo);
  if (n === 'internacional' && !String(paisForm || '').trim()) {
    return t('perfil.selectCountry');
  }
  return null;
}

function paisPayloadSegunTorneo(torneoRow, paisForm) {
  const p = String(paisForm || '').trim();
  if (!torneoRow) return p;
  const n = normalizeNivelTorneoScope(torneoRow.nivel_torneo);
  if (n === 'local') return PAIS_ARGENTINA_PERFIL;
  if (n === 'nacional') return p || PAIS_ARGENTINA_PERFIL;
  if (n === 'internacional') return p;
  return p || PAIS_ARGENTINA_PERFIL;
}

/** Handle sin @ para el input, desde `instagram_url` (URL o @usuario) guardada en BD. */
function instagramHandleFromStored(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.hostname.toLowerCase().includes('instagram.com')) {
        const parts = u.pathname.split('/').filter(Boolean);
        return parts[0] ? String(parts[0]).replace(/\/$/, '') : '';
      }
    } catch {
      return '';
    }
  }
  return s.replace(/^@/, '').trim();
}

/** Valor para columna `jugadores_perfil.instagram_url`; null si vacío. */
function instagramUrlFromHandle(handle) {
  const h = String(handle ?? '')
    .trim()
    .replace(/^@/, '')
    .replace(/^\/+|\/+$/g, '');
  if (!h) return null;
  return `https://www.instagram.com/${h}/`;
}

function urlComprobanteMercadoPagoReserva(r) {
  const direct = String(r?.mp_comprobante_url || '').trim();
  if (direct) return direct;
  return 'https://www.mercadopago.com.ar/activities';
}

function puedeMostrarComprobanteMp(r) {
  return Boolean(String(r?.mp_comprobante_url || '').trim() || String(r?.mp_payment_id || '').trim());
}

export default function MiPerfil() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const { session, loading: authLoading, userProfile, refreshSession, signOutAndClear } = useAuth();
  const [searchParams] = useSearchParams();
  const torneoIdPerfil = searchParams.get('id');
  const redirectAfterAuth = searchParams.get('redirect') || '';
  const torneoIdValido = Boolean(torneoIdPerfil && /^\d+$/.test(String(torneoIdPerfil)));
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState([]);
  const [misReservasColapsado, setMisReservasColapsado] = useState(true);
  const [misClasesColapsado, setMisClasesColapsado] = useState(true);
  const [misClases, setMisClases] = useState([]);
  const [misClasesLoading, setMisClasesLoading] = useState(false);
  const [torneosConPuntosMiPerfil, setTorneosConPuntosMiPerfil] = useState([]);
  const [mostrarTodosTorneosMiPerfil, setMostrarTodosTorneosMiPerfil] = useState(false);
  const [editando, setEditando] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const perfilSubmitLockRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  /** Preview local (blob URL); se muestra hasta que elijas otra o cancels edición del formulario */
  const [fotoPreview, setFotoPreview] = useState(null);
  /** Hay archivo elegido aún no persistido en Storage (muestra "Guardar foto"). */
  const [fotoPendienteDeSubir, setFotoPendienteDeSubir] = useState(false);
  const [guardandoFoto, setGuardandoFoto] = useState(false);
  /** Modal react-easy-crop: URL (blob) de la imagen elegida antes de confirmar recorte. */
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropAreaListo, setCropAreaListo] = useState(false);
  const croppedAreaPixelsRef = useRef(null);
  const [fotoAccionModalOpen, setFotoAccionModalOpen] = useState(false);
  const [fotoAccionModalStep, setFotoAccionModalStep] = useState('menu');
  /** Valor inline de `body.style.overflow` antes de abrir el modal de recorte (restaurar al cerrar). */
  const cropModalBodyOverflowPrevRef = useRef('');
  const fileInputRef = useRef(null);
  /** Archivo elegido hasta guardar (subida a Storage al confirmar el formulario). */
  const pendingFotoFileRef = useRef(null);
  const fotoPreviewRef = useRef(null);
  const hintEdicionTorneoRef = useRef(false);
  const [cancelando, setCancelando] = useState(null); // reservaId being cancelled
  const [reservaCancelModal, setReservaCancelModal] = useState(null);
  const [reservaQrModal, setReservaQrModal] = useState(null);
  const [jugadorPreviewMiCompanero, setJugadorPreviewMiCompanero] = useState(null);
  const [creditTotal, setCreditTotal] = useState(0);
  const [creditItems, setCreditItems] = useState([]);
  const [modalConfirmarCerrarSesion, setModalConfirmarCerrarSesion] = useState(false);

  const sessionOwnerEmail = useMemo(() => session?.user?.email?.trim() || null, [session?.user?.email]);

  const pathMiPerfilPublico = useMemo(
    () => pathPerfilPublicoPorUserId(session?.user?.id),
    [session?.user?.id],
  );

  /** Solo confirmadas/pendientes con inicio ≥ ahora; orden próximo → lejano. */
  const reservasProximasOrdenadas = useMemo(() => {
    const rows = Array.isArray(reservas) ? reservas : [];
    const parseHoraParts = (h) => {
      const m = String(h || '').trim().match(/^(\d{1,2}):(\d{2})/);
      return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
    };
    const startMsLocal = (r) => {
      const fy = String(r.fecha || '').trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fy)) return null;
      const hp = parseHoraParts(r.hora);
      if (!hp) return null;
      const [y, mo, da] = fy.split('-').map((x) => parseInt(x, 10));
      return new Date(y, mo - 1, da, hp[0], hp[1], 0, 0).getTime();
    };
    return rows
      .filter((r) => String(r.estado || '').toLowerCase() !== 'cancelada')
      .map((r) => ({ r, ms: startMsLocal(r) }))
      .filter(({ ms }) => ms != null && Number.isFinite(ms) && ms >= Date.now())
      .sort((a, b) => a.ms - b.ms)
      .map(({ r }) => r);
  }, [reservas]);

  fotoPreviewRef.current = fotoPreview;
  useEffect(() => () => {
    const u = fotoPreviewRef.current;
    if (u && String(u).startsWith('blob:')) URL.revokeObjectURL(u);
  }, []);

  useEffect(() => {
    if (!cropModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    cropModalBodyOverflowPrevRef.current = prevOverflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = cropModalBodyOverflowPrevRef.current;
    };
  }, [cropModalOpen]);

  useEffect(() => {
    if (!fotoAccionModalOpen) setFotoAccionModalStep('menu');
  }, [fotoAccionModalOpen]);

  const cuentaDeSesion = useMemo(() => {
    if (!sessionOwnerEmail) return null;
    return {
      email: sessionOwnerEmail,
      nombre: getDisplayName(userProfile, session),
      whatsapp: String(userProfile?.whatsapp || '').trim(),
      foto: userProfile?.foto_url ?? userProfile?.foto ?? null,
    };
  }, [sessionOwnerEmail, userProfile, session]);

  /** Mi perfil: siempre vista jugador (sin ocultar bloques por rol admin). */
  const ocultarUiJugadorPorAdmin = false;

  /** Código país (ej. +54) + número local solo dígitos (sin repetir código en el input) */
  const [waCodigoPais, setWaCodigoPais] = useState('+54');
  const [waNumeroLocal, setWaNumeroLocal] = useState('');
  const [waConfirmLocal, setWaConfirmLocal] = useState('');
  const waTorneoFormInitRef = useRef(false);
  const [nombreRegistroTorneo, setNombreRegistroTorneo] = useState('');
  const [apellidoRegistroTorneo, setApellidoRegistroTorneo] = useState('');
  const [emailRegistro, setEmailRegistro] = useState('');
  const [passRegistroTorneo, setPassRegistroTorneo] = useState('');
  const [passRegistroTorneo2, setPassRegistroTorneo2] = useState('');
  const [torneoPerfil, setTorneoPerfil] = useState(null);
  /** Errores por campo en formulario registro sin sesión */
  const [registroFieldErrors, setRegistroFieldErrors] = useState({});
  /** Registro sin sesión: 0 = datos cuenta; 1 = deportes preferidos (opcional). */
  const [registroPasoDeportes, setRegistroPasoDeportes] = useState(0);
  const [registroDeportesSel, setRegistroDeportesSel] = useState([]);
  const [aceptoTerminosPrivacidadRegistro, setAceptoTerminosPrivacidadRegistro] = useState(false);
  const [fichaFieldErrors, setFichaFieldErrors] = useState({});
  const fichErr = (k) => fichaFieldErrors[k];
  const fichErrP = (k) =>
    fichErr(k) ? (
      <p style={{ color: '#d32f2f', fontSize: '12px', marginTop: '-4px', marginBottom: '8px', fontWeight: 600 }}>
        {fichErr(k)}
      </p>
    ) : null;
  const fichBorder = (k) => (fichErr(k) ? '2px solid #d32f2f' : '1px solid var(--border)');

  /** Sin sesión: pantalla única de alta de cuenta + ficha. */
  const esRegistroSinSesion = Boolean(!authLoading && !sessionOwnerEmail);

  const avisoPerfilTorneoMsg = useMemo(
    () =>
      (location.state && location.state.avisoPerfilTorneo) ||
      (torneoIdValido ? t('perfil.flow.completeForTournament') : '') ||
      (redirectAfterAuth ? t('perfil.flow.completeToContinue') : ''),
    [location.state, torneoIdValido, redirectAfterAuth, t]
  );

  /** Sin fila o faltan datos obligatorios (foto no obligatoria). */
  const perfilFaltaCamposEsenciales = useMemo(() => {
    const p = perfil;
    if (!p || typeof p !== 'object') return true;
    if (!String(p.nombre || '').trim()) return true;
    if (!String(p.apellido || '').trim()) return true;
    if (!String(p.genero || '').trim()) return true;
    if (!String(p.pais || '').trim()) return true;
    if (!String(p.lateralidad || '').trim()) return true;
    if (!String(p.nivel || '').trim()) return true;
    return false;
  }, [perfil]);

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    genero: '',
    apodo: '',
    lateralidad: 'Diestro',
    nivel: 'Principiante',
    pais: '',
    localidad: '',
    ciudad: '',
    alias: '',
    instagram: '',
    /** UUID (`user_id`) del compañero habitual en `jugadores_perfil.companero_id`. */
    companero_id: null,

    fecha_nacimiento: '',
    numero_fipa: '',
    es_federado: false,
    mostrar_torneos_jugados: false,
    busca_companero: false,
    deportes_preferidos: [],
  });

  const [companeroBusqueda, setCompaneroBusqueda] = useState('');
  const [companeroOpciones, setCompaneroOpciones] = useState([]);
  const [companeroMenuAbierto, setCompaneroMenuAbierto] = useState(false);
  const [companeroCargando, setCompaneroCargando] = useState(false);
  /** Vista lectura: `{ row, kind }` con `kind` habitual | ultimo; `null` si no hay ningún id. */
  const [perfilCompaneroDisplay, setPerfilCompaneroDisplay] = useState(null);
  const [companeroSeleccionado, setCompaneroSeleccionado] = useState(null);
  const [sedesClubHabitual, setSedesClubHabitual] = useState([]);
  const companeroSearchSeqRef = useRef(0);
  const [aliasDuplicado, setAliasDuplicado] = useState(false);
  const [aliasVerificando, setAliasVerificando] = useState(false);
  const [aliasDisponible, setAliasDisponible] = useState(false);
  const [aliasSuggestions, setAliasSuggestions] = useState([]);
  const [aliasSugerenciasCargando, setAliasSugerenciasCargando] = useState(false);
  const aliasCheckSeqRef = useRef(0);
  const nombreSaludoSuggestSeqRef = useRef(0);

  useEffect(() => {
    setFormData((prev) => {
      const opts = categoriasNivelPorGenero(prev.genero);
      if (!prev.nivel || opts.includes(prev.nivel)) return prev;
      return { ...prev, nivel: 'Principiante' };
    });
  }, [formData.genero]);

  const nivelTorneoScope = useMemo(
    () => normalizeNivelTorneoScope(torneoPerfil?.nivel_torneo),
    [torneoPerfil?.nivel_torneo]
  );
  const mostrarCampoPais = useMemo(
    () => mostrarCampoPaisSegunTorneo(torneoPerfil),
    [torneoPerfil]
  );
  const paisHtmlRequired = !torneoPerfil || nivelTorneoScope === 'internacional';

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('sedes')
      .select('id, nombre, pais, ciudad')
      .order('nombre', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && Array.isArray(data)) setSedesClubHabitual(data);
        else setSedesClubHabitual([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!torneoIdValido) {
      setTorneoPerfil(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('torneos')
        .select('id, nivel_torneo')
        .eq('id', Number(torneoIdPerfil))
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) setTorneoPerfil(data);
      else setTorneoPerfil(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [torneoIdValido, torneoIdPerfil]);

  /** Torneo nacional: país por defecto Argentina en el formulario. */
  useEffect(() => {
    if (!torneoPerfil || nivelTorneoScope !== 'nacional') return;
    setFormData((prev) => {
      if (String(prev.pais || '').trim()) return prev;
      return { ...prev, pais: PAIS_ARGENTINA_PERFIL };
    });
  }, [torneoPerfil, nivelTorneoScope]);

  /** Vista lectura: compañero habitual (`companero_id`) o último torneo (`ultimo_companero_id`). */
  useEffect(() => {
    if (editando || !perfil) {
      setPerfilCompaneroDisplay(null);
      return;
    }
    const cid = perfil.companero_id != null ? String(perfil.companero_id).trim() : '';
    const uid = perfil.ultimo_companero_id != null ? String(perfil.ultimo_companero_id).trim() : '';
    if (!cid && !uid) {
      setPerfilCompaneroDisplay(null);
      return;
    }
    let cancelled = false;
    (async () => {
      if (cid) {
        const { data } = await supabase
          .from('jugadores_perfil')
          .select('user_id, alias, foto_url, nombre')
          .eq('user_id', cid)
          .maybeSingle();
        if (!cancelled) setPerfilCompaneroDisplay({ kind: 'habitual', row: data || null });
        return;
      }
      const { data } = await supabase
        .from('jugadores_perfil')
        .select('user_id, alias, foto_url, nombre')
        .eq('user_id', uid)
        .maybeSingle();
      if (!cancelled) setPerfilCompaneroDisplay({ kind: 'ultimo', row: data || null });
    })();
    return () => {
      cancelled = true;
    };
  }, [editando, perfil, perfil?.companero_id, perfil?.ultimo_companero_id]);

  /** Edición: sincronizar fila mostrada al guardar `companero_id`. */
  useEffect(() => {
    if (!editando) {
      setCompaneroSeleccionado(null);
      return;
    }
    const id = formData.companero_id != null ? String(formData.companero_id).trim() : '';
    if (!id) {
      setCompaneroSeleccionado(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('jugadores_perfil')
        .select('user_id, alias, foto_url, nombre')
        .eq('user_id', id)
        .maybeSingle();
      if (!cancelled) setCompaneroSeleccionado(data || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [editando, formData.companero_id]);

  /** Búsqueda de compañero por alias y nombre (debounce). */
  useEffect(() => {
    if (!editando) {
      setCompaneroOpciones([]);
      setCompaneroCargando(false);
      return;
    }
    const raw = companeroBusqueda.trim();
    if (raw.length < 2) {
      setCompaneroOpciones([]);
      setCompaneroCargando(false);
      return;
    }
    const seq = ++companeroSearchSeqRef.current;
    const handle = setTimeout(async () => {
      setCompaneroCargando(true);
      const term = raw.replace(/[%_\\]/g, '');
      const pattern = `%${term}%`;
      const myUid = session?.user?.id;
      let qAlias = supabase
        .from('jugadores_perfil')
        .select('user_id, alias, foto_url, nombre')
        .ilike('alias', pattern)
        .limit(12);
      let qNombre = supabase
        .from('jugadores_perfil')
        .select('user_id, alias, foto_url, nombre')
        .ilike('nombre', pattern)
        .limit(12);
      if (myUid) {
        qAlias = qAlias.neq('user_id', myUid);
        qNombre = qNombre.neq('user_id', myUid);
      }
      const [{ data: rowsAlias, error: errAlias }, { data: rowsNombre, error: errNombre }] = await Promise.all([
        qAlias,
        qNombre,
      ]);
      if (seq !== companeroSearchSeqRef.current) return;
      const byUserId = new Map();
      for (const row of [...(rowsAlias || []), ...(rowsNombre || [])]) {
        const uid = row?.user_id;
        if (uid == null || uid === '') continue;
        if (!byUserId.has(uid)) byUserId.set(uid, row);
      }
      const merged = Array.from(byUserId.values()).slice(0, 12);
      console.log(
        '[Compañero] buscando:',
        term,
        'resultados:',
        merged,
        'length:',
        merged.length,
        'errors:',
        { alias: errAlias, nombre: errNombre }
      );
      setCompaneroCargando(false);
      if (errAlias && errNombre) {
        setCompaneroOpciones([]);
        return;
      }
      setCompaneroOpciones(merged);
    }, 280);
    return () => clearTimeout(handle);
  }, [editando, companeroBusqueda, session?.user?.id]);

  /** Comprueba que el alias no esté tomado (debounce 500 ms). Con sesión: excluye el propio `user_id`. */
  useEffect(() => {
    if (!editando && !esRegistroSinSesion) {
      setAliasDuplicado(false);
      setAliasVerificando(false);
      setAliasDisponible(false);
      return;
    }
    if (String(perfil?.alias || '').trim() && !esRegistroSinSesion) {
      setAliasDuplicado(false);
      setAliasVerificando(false);
      setAliasDisponible(false);
      return;
    }
    const raw = String(formData.alias || '').trim();
    if (!raw) {
      setAliasDuplicado(false);
      setAliasVerificando(false);
      setAliasDisponible(false);
      return;
    }
    const seq = ++aliasCheckSeqRef.current;
    setAliasVerificando(true);
    setAliasDisponible(false);
    const handle = setTimeout(async () => {
      const uid = session?.user?.id;
      const literal = escapeIlikeLiteral(raw);
      let q = supabase.from('jugadores_perfil').select('user_id').ilike('alias', literal).limit(1);
      if (uid) q = q.neq('user_id', String(uid));
      const { data, error } = await q;
      if (seq !== aliasCheckSeqRef.current) return;
      setAliasVerificando(false);
      if (error) {
        setAliasDuplicado(false);
        setAliasDisponible(false);
        return;
      }
      const dup = Array.isArray(data) && data.length > 0;
      setAliasDuplicado(dup);
      setAliasDisponible(!dup);
    }, 500);
    return () => clearTimeout(handle);
  }, [editando, esRegistroSinSesion, perfil?.alias, formData.alias, session?.user?.id]);

  /** Sugerencias de alias desde «¿Cómo quieres que te llamemos?» (disponibilidad en jugadores_perfil). */
  useEffect(() => {
    if (!editando && !esRegistroSinSesion) {
      setAliasSuggestions([]);
      setAliasSugerenciasCargando(false);
      return;
    }
    if (String(perfil?.alias || '').trim() && !esRegistroSinSesion) {
      setAliasSuggestions([]);
      setAliasSugerenciasCargando(false);
      return;
    }
    const uid = session?.user?.id;
    if (!uid && !esRegistroSinSesion) {
      setAliasSuggestions([]);
      return;
    }
    const base = baseAliasDesdeTextoLibre(formData.apodo);
    if (!base) {
      setAliasSuggestions([]);
      setAliasSugerenciasCargando(false);
      return;
    }
    const nRand = Math.floor(Math.random() * 90) + 10;
    const rawCandidates = [`${base}`, `${base}${nRand}`, `${base}_padbol`];
    const candidates = [...new Set(rawCandidates.map((s) => String(s).toLowerCase()))];
    const seq = ++nombreSaludoSuggestSeqRef.current;
    setAliasSugerenciasCargando(true);
    const t = setTimeout(async () => {
      const checkFree = async (aliasVal) => {
        const lit = escapeIlikeLiteral(String(aliasVal || '').trim());
        if (!lit) return false;
        let q = supabase.from('jugadores_perfil').select('user_id').ilike('alias', lit).limit(1);
        if (uid) q = q.neq('user_id', String(uid));
        const { data, error } = await q;
        if (error) return false;
        return !(Array.isArray(data) && data.length > 0);
      };
      const rows = await Promise.all(
        candidates.map(async (texto) => ({
          texto,
          libre: await checkFree(texto),
        }))
      );
      if (seq !== nombreSaludoSuggestSeqRef.current) return;
      setAliasSugerenciasCargando(false);
      setAliasSuggestions(rows);
    }, 500);
    return () => clearTimeout(t);
  }, [editando, esRegistroSinSesion, perfil?.alias, formData.apodo, session?.user?.id]);

  useEffect(() => {
    if (sessionOwnerEmail) return;
    getOrCreateUsuarioBasico();
  }, [sessionOwnerEmail]);

  useEffect(() => {
    if (!sessionOwnerEmail) {
      if (!authLoading) setLoading(false);
      return;
    }
    fetchPerfil();
    fetchReservas();
    void fetchMisClasesPerfil();
    fetchCreditos();
  }, [sessionOwnerEmail, session?.user?.id, location.search, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading || !sessionOwnerEmail) return;
    const needHint = torneoIdValido || Boolean(redirectAfterAuth);
    if (!needHint) return;
    if (!isPerfilTorneoCompleto() && !hintEdicionTorneoRef.current) {
      hintEdicionTorneoRef.current = true;
      setEditando(true);
    }
  }, [torneoIdValido, redirectAfterAuth, loading, sessionOwnerEmail, perfil]);

  useEffect(() => {
    if (!editando) {
      waTorneoFormInitRef.current = false;
      return;
    }
    if (!sessionOwnerEmail) return;

    if (!waTorneoFormInitRef.current) {
      waTorneoFormInitRef.current = true;
      const raw = String(perfil?.whatsapp || cuentaDeSesion?.whatsapp || '').trim();
      const { codigo, local } = splitStoredWhatsapp(raw);
      setWaCodigoPais(codigo || '+54');
      setWaNumeroLocal(local);
      setWaConfirmLocal('');
    }
  }, [
    editando,
    sessionOwnerEmail,
    cuentaDeSesion?.whatsapp,
    perfil?.whatsapp,
  ]);

  const fetchPerfil = async () => {
    const owner = sessionOwnerEmail;
    if (!owner) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout loading profile')), 8000)
      );
      const uid = session?.user?.id ?? null;
      const byUserId = uid
        ? supabase.from('jugadores_perfil').select('*').eq('user_id', uid).maybeSingle()
        : null;
      const byEmail = supabase.from('jugadores_perfil').select('*').eq('email', owner).maybeSingle();

      let data = null;
      if (byUserId) {
        const r1 = await Promise.race([byUserId, timeoutPromise]);
        if (r1?.data) data = r1.data;
      }
      if (!data) {
        const r2 = await Promise.race([byEmail, timeoutPromise]);
        data = r2?.data ?? null;
      }

      if (data) {
        setPerfil(data);
        const na = nombreApellidoEditDesdePerfilRow(data);
        setFormData({
          nombre: na.nombre,
          apellido: na.apellido,
          genero: data.genero != null ? String(data.genero).trim() : '',
          apodo:
            String(data.apodo ?? '').trim() ||
            (data.nombre_saludo != null ? String(data.nombre_saludo) : ''),
          lateralidad: data.lateralidad || 'Diestro',
          nivel: data.nivel || 'Principiante',
          pais: data.pais || '',
          localidad: data.localidad != null ? String(data.localidad) : '',
          ciudad: data.ciudad || '',
          alias: data.alias != null ? String(data.alias) : '',
          instagram: instagramHandleFromStored(data.instagram_url),
          companero_id: data.companero_id != null && String(data.companero_id).trim() ? String(data.companero_id).trim() : null,
          fecha_nacimiento: fechaNacimientoDesdeDb(data.fecha_nacimiento),
          numero_fipa: data.numero_fipa || '',
          es_federado: data.es_federado || false,
          mostrar_torneos_jugados: Boolean(data.mostrar_torneos_jugados),
          busca_companero: Boolean(data.busca_companero),
          deportes_preferidos: normalizeDeportesPreferidosArray(data.deportes_preferidos),
        });
        {
          const wa =
            (cuentaDeSesion?.email || '').trim().toLowerCase() === owner.toLowerCase()
              ? String(cuentaDeSesion?.whatsapp || '').trim()
              : '';
          persistJugadorPerfil({
            nombre: na.nombre,
            apellido: na.apellido,
            categoria: String(data.nivel || '').trim(),
            ...(wa ? { whatsapp: wa } : {}),
            ...(data?.foto_url ? { foto_url: data.foto_url } : {}),
            email: owner,
          });
        }
      } else {
        setPerfil(null);
      }
    } catch (err) {
      // Profile is optional; silently fail if not found or network error
      console.log('[MiPerfil] fetchPerfil error (expected if no profile yet):', err.message);
    }
    setLoading(false);
  };

  const fetchReservas = async () => {
    const uid = session?.user?.id;
    if (!uid) {
      setReservas([]);
      return;
    }
    try {
      const d = new Date();
      const todayYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('reservas')
        .select('id, sede, fecha, hora, cancha, estado, precio, moneda, monto_pagado, mp_payment_id, mp_comprobante_url, qr_token')
        .eq('user_id', uid)
        .gte('fecha', todayYmd)
        .order('fecha', { ascending: true })
        .limit(80);
      if (error) {
        console.error('[MiPerfil] reservas Supabase error (completo):', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          raw: error,
        });
      } else {
        console.log('[MiPerfil] reservas por user_id:', uid, 'filas:', Array.isArray(data) ? data.length : 0);
      }
      setReservas(data || []);
    } catch {
      // fail silently
    }
  };

  const fetchMisClasesPerfil = async () => {
    const token = session?.access_token;
    if (!token) {
      setMisClases([]);
      return;
    }
    setMisClasesLoading(true);
    try {
      const rows = await fetchMisClases({ accessToken: token });
      setMisClases(rows);
    } catch (e) {
      console.warn('[MiPerfil] mis-clases', e);
      setMisClases([]);
    } finally {
      setMisClasesLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!perfil || typeof perfil !== 'object') {
      setTorneosConPuntosMiPerfil([]);
      return undefined;
    }
    (async () => {
      try {
        const list = await fetchTorneosConPuntosParaPerfil(perfil);
        if (!cancelled) setTorneosConPuntosMiPerfil(Array.isArray(list) ? list : []);
      } catch (e) {
        console.warn('[MiPerfil] torneos con puntos', e);
        if (!cancelled) setTorneosConPuntosMiPerfil([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [perfil]);

  useEffect(() => {
    setMostrarTodosTorneosMiPerfil(false);
  }, [torneosConPuntosMiPerfil]);

  const puntosAlcanceMiPerfil = useMemo(
    () => sumarPuntosPorAlcanceDesdeFilasTorneo(torneosConPuntosMiPerfil),
    [torneosConPuntosMiPerfil]
  );
  const torneosUnicosConPuntosMiPerfil = useMemo(
    () => contarTorneosUnicosConPuntos(torneosConPuntosMiPerfil),
    [torneosConPuntosMiPerfil]
  );

  /** Misma respuesta que GET /api/jugador/:alias/estadisticas (backend). */
  const [estadisticasMiPerfil, setEstadisticasMiPerfil] = useState(null);
  const [estadisticasMiPerfilLoading, setEstadisticasMiPerfilLoading] = useState(false);
  /** Slug canónico (`padbol`, `padel`, …) para filtrar la grilla cuando hay varios deportes con puntos. */
  const [estadisticasDeporteTab, setEstadisticasDeporteTab] = useState(null);

  useEffect(() => {
    if (!estadisticasMiPerfil) {
      setEstadisticasDeporteTab(null);
      return;
    }
    const deps = estadisticasMiPerfil.deportes_jugados;
    if (!Array.isArray(deps) || !deps.length) {
      setEstadisticasDeporteTab(null);
      return;
    }
    setEstadisticasDeporteTab((prev) => {
      const keys = new Set(deps.map((d) => d.deporte));
      if (prev && keys.has(prev)) return prev;
      return deps[0].deporte;
    });
  }, [estadisticasMiPerfil]);

  useEffect(() => {
    let cancelled = false;
    const alias = String(perfil?.alias || '').trim();
    if (!alias) {
      setEstadisticasMiPerfil(null);
      setEstadisticasDeporteTab(null);
      setEstadisticasMiPerfilLoading(false);
      return undefined;
    }
    setEstadisticasMiPerfilLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/jugador/${encodeURIComponent(alias)}/estadisticas`);
        if (cancelled) return;
        if (res.ok) {
          const j = await res.json();
          setEstadisticasMiPerfil(j && typeof j === 'object' ? j : null);
        } else {
          setEstadisticasMiPerfil(null);
        }
      } catch {
        if (!cancelled) setEstadisticasMiPerfil(null);
      } finally {
        if (!cancelled) setEstadisticasMiPerfilLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [perfil?.alias]);

  const fetchCreditos = async () => {
    if (!sessionOwnerEmail) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/creditos/${encodeURIComponent(sessionOwnerEmail)}`);
      if (!res.ok) return;
      const data = await res.json();
      setCreditTotal(data.total || 0);
      setCreditItems(data.creditos || []);
    } catch {
      // fail silently — credits are informational
    }
  };

  const cerrarModalRecorte = useCallback(() => {
    document.body.style.overflow = cropModalBodyOverflowPrevRef.current;
    setCropModalOpen(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropAreaListo(false);
    croppedAreaPixelsRef.current = null;
    setCropImageSrc((prev) => {
      if (prev && String(prev).startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const onCropComplete = useCallback((_area, areaPixels) => {
    croppedAreaPixelsRef.current = areaPixels;
    setCropAreaListo(true);
  }, []);

  const handleConfirmarRecorte = useCallback(async () => {
    const src = cropImageSrc;
    const pixels = croppedAreaPixelsRef.current;
    if (!src || !pixels) return;
    setErrorMsg('');
    try {
      const blob = await getCroppedImgBlob(src, pixels, 'image/jpeg', 0.92);
      cerrarModalRecorte();
      const file = new File([blob], 'perfil-recorte.jpg', { type: 'image/jpeg' });
      pendingFotoFileRef.current = file;
      setFotoPendienteDeSubir(true);
      setFotoPreview((prev) => {
        if (prev && String(prev).startsWith('blob:')) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    } catch (err) {
      console.error(err);
      setErrorMsg(String(err?.message || t('perfil.flow.cropFailed')));
    }
  }, [cropImageSrc, cerrarModalRecorte, t]);

  const handlePhotoSelected = (e) => {
    setFotoAccionModalOpen(false);
    setFotoAccionModalStep('menu');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setErrorMsg(t('perfil.flow.chooseImageFile'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setErrorMsg('');
    setCropImageSrc((prev) => {
      if (prev && String(prev).startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropAreaListo(false);
    croppedAreaPixelsRef.current = null;
    setCropModalOpen(true);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGuardarFoto = async () => {
    const owner = sessionOwnerEmail;
    const userId = session?.user?.id ?? null;
    const pendingFoto = pendingFotoFileRef.current;
    if (!owner || !userId || !pendingFoto || guardandoFoto) return;

    setGuardandoFoto(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (pendingFoto.size > 2 * 1024 * 1024) {
        setErrorMsg(t('perfil.flow.imageOver2mb'));
        return;
      }
      const extRaw = String(pendingFoto.name.split('.').pop() || 'jpg').toLowerCase();
      const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extRaw) ? extRaw : 'jpg';
      const path = `perfil/${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(AVATAR_STORAGE_BUCKET)
        .upload(path, pendingFoto, { upsert: true, contentType: pendingFoto.type || 'image/jpeg' });
      if (upErr) {
        setErrorMsg(t('perfil.flow.uploadPhotoFailed', { message: upErr.message }));
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_STORAGE_BUCKET).getPublicUrl(path);
      const fotoUrlGuardada = `${publicUrl}?t=${Date.now()}`;

      let rowAfter = perfil;
      if (perfil) {
        const { error: upDbErr } = await supabase
          .from('jugadores_perfil')
          .update({ foto_url: fotoUrlGuardada })
          .eq('email', owner);
        if (upDbErr) {
          setErrorMsg(mensajeErrorDbSupabase(upDbErr));
          return;
        }
        rowAfter = { ...perfil, foto_url: fotoUrlGuardada };
        setPerfil((prev) => (prev ? { ...prev, foto_url: fotoUrlGuardada } : prev));
      } else {
        const payloadDb = {
          user_id: userId,
          email: owner,
          nombre: getDisplayName(userProfile, session) || 'Jugador',
          whatsapp: String(userProfile?.whatsapp || '').trim() || null,
          nivel: 'Principiante',
          lateralidad: 'Diestro',
          pendiente_validacion: true,
          foto_url: fotoUrlGuardada,
          instagram_url: instagramUrlFromHandle(formData.instagram),
          companero_id: formData.companero_id || null,
          localidad: formData.localidad?.trim() ? formData.localidad.trim() : null,
        };
        const { data: inserted, error: insErr } = await supabase
          .from('jugadores_perfil')
          .upsert(payloadDb, { onConflict: 'email' })
          .select()
          .maybeSingle();
        if (insErr) {
          setErrorMsg(mensajeErrorDbSupabase(insErr));
          return;
        }
        if (inserted) {
          rowAfter = inserted;
          setPerfil(inserted);
        } else {
          const { data: reread } = await supabase
            .from('jugadores_perfil')
            .select('*')
            .eq('email', owner)
            .maybeSingle();
          if (reread) {
            rowAfter = reread;
            setPerfil(reread);
          } else {
            rowAfter = payloadDb;
          }
        }
      }

      pendingFotoFileRef.current = null;
      setFotoPendienteDeSubir(false);
      setFotoPreview((prev) => {
        if (prev && String(prev).startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });

      const naFoto = nombreApellidoEditDesdePerfilRow(rowAfter || {});
      const nomF = naFoto.nombre || String(rowAfter?.nombre || '').trim() || 'Jugador';
      const apF = naFoto.apellido;
      persistJugadorPerfil({
        nombre: nomF,
        apellido: apF,
        categoria: String(rowAfter?.nivel || formData.nivel || 'Principiante').trim(),
        whatsapp: String(rowAfter?.whatsapp || userProfile?.whatsapp || '').trim(),
        email: owner,
        foto_url: fotoUrlGuardada,
      });
      await refreshJugadorPerfilFromSupabase(owner);
      await refreshSession();

      setSuccessMsg('✅ Foto guardada');
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setGuardandoFoto(false);
    }
  };

  const cerrarFotoAccionModal = useCallback(() => {
    setFotoAccionModalOpen(false);
    setFotoAccionModalStep('menu');
  }, []);

  const aplicarFotoUrlASesion = useCallback(
    async (fotoUrlValue) => {
      const owner = sessionOwnerEmail;
      const userId = session?.user?.id ?? null;
      if (!owner || !userId) {
        setErrorMsg(t('perfil.loginToChangePhoto'));
        return;
      }
      if (!perfil) {
        setErrorMsg(t('perfil.flow.playerRecordNotFound'));
        return;
      }

      setGuardandoFoto(true);
      setErrorMsg('');
      setSuccessMsg('');
      try {
        const fotoVal =
          fotoUrlValue == null || String(fotoUrlValue).trim() === '' ? null : String(fotoUrlValue).trim();

        const { error: upDbErr } = await supabase
          .from('jugadores_perfil')
          .update({ foto_url: fotoVal })
          .eq('email', owner);
        if (upDbErr) {
          setErrorMsg(mensajeErrorDbSupabase(upDbErr));
          return;
        }

        setPerfil((prev) => (prev ? { ...prev, foto_url: fotoVal } : prev));
        const na = nombreApellidoEditDesdePerfilRow(perfil);
        persistJugadorPerfil({
          nombre: na.nombre || String(perfil.nombre || '').trim() || 'Jugador',
          apellido: na.apellido,
          categoria: String(perfil.nivel || formData.nivel || 'Principiante').trim(),
          whatsapp: String(perfil.whatsapp || userProfile?.whatsapp || '').trim(),
          email: owner,
          foto_url: fotoVal || '',
        });
        pendingFotoFileRef.current = null;
        setFotoPendienteDeSubir(false);
        setFotoPreview((prev) => {
          if (prev && String(prev).startsWith('blob:')) URL.revokeObjectURL(prev);
          return null;
        });
        await refreshJugadorPerfilFromSupabase(owner);
        await refreshSession();
        cerrarFotoAccionModal();
        setSuccessMsg(fotoVal ? '✅ Foto actualizada' : '✅ Foto eliminada');
        setTimeout(() => setSuccessMsg(''), 3000);
      } finally {
        setGuardandoFoto(false);
      }
    },
    [sessionOwnerEmail, session?.user?.id, perfil, formData.nivel, userProfile?.whatsapp, cerrarFotoAccionModal, refreshSession, t]
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextVal = type === 'checkbox' ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: nextVal }));
    if (['nombre', 'apellido', 'genero', 'nivel', 'lateralidad'].includes(name)) {
      setFichaFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleRegistroCuenta = async (e) => {
    e.preventDefault();
    if (perfilSubmitLockRef.current || isSubmitting) return;
    perfilSubmitLockRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    setRegistroFieldErrors({});

    try {
      const fe = {};
      const nom = String(nombreRegistroTorneo || '').trim();
      const apellReg = String(apellidoRegistroTorneo || '').trim();
      if (!nom) {
        fe.nombre = 'Completa tu nombre.';
      }
      if (!apellReg) {
        fe.apellido = 'Completa tu apellido.';
      }
      const genReg = String(formData.genero || '').trim();
      if (!genReg || !['masculino', 'femenino', 'otro', 'open'].includes(genReg)) {
        fe.genero = t('perfil.selectGender');
      }
      if (!String(formData.lateralidad || '').trim()) {
        fe.lateralidad = t('perfil.flow.selectLaterality');
      }

      const emRaw = emailRegistro.trim();
      const emailAuth = emRaw.toLowerCase();
      if (!emRaw) {
        fe.email = 'Completa tu email';
      } else if (!emailValidoVisible(emRaw)) {
        fe.email = t('perfil.invalidEmail');
      }

      const local = waNumeroLocal.trim();
      const localConf = waConfirmLocal.trim();
      if (!digitsOnly(local)) {
        fe.whatsapp = 'Completa tu WhatsApp';
      } else if (!whatsappNacionalValido(local)) {
        fe.whatsapp = t('perfil.invalidWhatsapp');
      } else if (digitsOnly(local) !== digitsOnly(localConf)) {
        fe.whatsappConfirma = t('perfil.whatsappConfirmMismatch');
      }
      const waDigits = buildFullWhatsDigits(waCodigoPais, local);
      if (!fe.whatsapp && !whatsappDigitsValido(waDigits)) {
        fe.whatsapp = t('perfil.completeWhatsapp');
      }
      const wa = formatWhatsAppE164(waCodigoPais, local);

      if (!String(formData.nivel || '').trim()) {
        fe.categoria = t('perfil.selectCategory');
      }

      if (!passRegistroTorneo && !passRegistroTorneo2) {
        fe.password = t('perfil.completePassword');
        fe.password2 = t('perfil.confirmPassword');
      } else if (!passRegistroTorneo) {
        fe.password = t('perfil.completePassword');
      } else if (!passRegistroTorneo2) {
        fe.password2 = t('perfil.confirmPassword');
      } else if (passRegistroTorneo.length < 6) {
        fe.password = t('perfil.passwordMin6');
      } else if (passRegistroTorneo !== passRegistroTorneo2) {
        fe.password2 = t('perfil.passwordMismatch');
      }

      const errPaisInv = mensajeValidarPaisTorneo(torneoPerfil, formData.pais, t);
      if (errPaisInv) {
        fe.pais = errPaisInv;
      }

      if (!aceptoTerminosPrivacidadRegistro) {
        fe.acepto_terminos = t('perfil.acceptTermsRequired');
      }

      if (Object.keys(fe).length > 0) {
        setRegistroFieldErrors(fe);
        return;
      }

      if (registroPasoDeportes === 0) {
        setRegistroPasoDeportes(1);
        perfilSubmitLockRef.current = false;
        setIsSubmitting(false);
        return;
      }

      const aliasReg = String(formData.alias || '').trim();
      if (aliasReg && (aliasDuplicado || aliasVerificando)) {
        setErrorMsg(
          aliasVerificando ? t('perfil.aliasChecking') : t('perfil.aliasTaken')
        );
        return;
      }
      if (aliasReg) {
        const lit = escapeIlikeLiteral(aliasReg);
        const { data: dupReg, error: dupRegErr } = await supabase
          .from('jugadores_perfil')
          .select('user_id')
          .ilike('alias', lit)
          .limit(1);
        if (!dupRegErr && Array.isArray(dupReg) && dupReg.length > 0) {
          setErrorMsg(t('perfil.aliasTaken'));
          return;
        }
      }

      if (session?.user?.email) {
        setErrorMsg(t('perfil.sessionActive'));
        return;
      }

      try {
        const { disponible } = await fetchWhatsappDisponibleRegistro(wa);
        if (!disponible) {
          setErrorMsg(t('perfil.phoneRegistered'));
          return;
        }
      } catch (e) {
        setErrorMsg(e.message || t('perfil.phoneValidationFailed'));
        return;
      }

      const { data: authData, error: authErr } = await handleAuthOnce({
        kind: 'signUp',
        email: emailAuth,
        password: passRegistroTorneo,
        options: {
          data: {
            nombre: nom,
            apellido: apellReg,
            genero: genReg,
            whatsapp: wa,
          },
        },
      });
      if (authErr) {
        console.log('ERROR SIGNUP:', authErr);
        setErrorMsg(
          mensajeErrorJugadoresPerfilDuplicado(authErr) ||
            mensajeErrorAuthSupabase(authErr.message)
        );
        return;
      }
      const user = authData?.user;
      const owner = String(user?.email || emailAuth || '')
        .trim()
        .toLowerCase();
      if (!owner) {
        console.log('ERROR SIGNUP: respuesta sin user.email', authData);
        setErrorMsg(
          t('perfil.noEmailAfterSignup')
        );
        return;
      }
      const nombreCli = [nom, apellReg].filter(Boolean).join(' ').trim();
      const paisGuardado = paisPayloadSegunTorneo(torneoPerfil, formData.pais);

      const { error: cliErr } = await supabase
        .from('clientes')
        .upsert({ email: owner, nombre: nombreCli, whatsapp: wa }, { onConflict: 'email' });
      if (cliErr) {
        console.error(cliErr);
        setErrorMsg(mensajeErrorDbSupabase(cliErr));
        return;
      }

      const aliasTrimReg = String(formData.alias || '').trim();
      const apodoReg = String(formData.apodo || '').trim();
      const payload = {
        lateralidad: formData.lateralidad,
        nivel: formData.nivel,
        genero: genReg,
        pendiente_validacion: true,
        pais: paisGuardado,
        localidad: formData.localidad?.trim() ? formData.localidad.trim() : null,
        ciudad: formData.ciudad?.trim() ? formData.ciudad.trim() : null,
        fecha_nacimiento: fechaNacimientoParaPayload(formData.fecha_nacimiento),
        numero_fipa: formData.numero_fipa?.trim() ? formData.numero_fipa.trim() : null,
        es_federado: formData.es_federado,
        whatsapp: wa,
        alias: aliasTrimReg || null,
        apodo: apodoReg || null,
        instagram_url: instagramUrlFromHandle(formData.instagram),
        companero_id: null,
        mostrar_torneos_jugados: false,
        busca_companero: false,
        deportes_preferidos: normalizeDeportesPreferidosArray(registroDeportesSel),
      };

      const { error: jpErr } = await upsertJugadorPerfilPorSesion({
        userId: user?.id,
        email: owner,
        row: {
          nombre: nom,
          apellido: apellReg,
          ...payload,
        },
      });

      if (jpErr) {
        setErrorMsg(mensajeErrorJugadoresPerfilDuplicado(jpErr) || mensajeErrorDbSupabase(jpErr));
        return;
      }

      void refreshSession();
      persistJugadorPerfil({
        nombre: nom,
        apellido: apellReg,
        genero: genReg,
        apodo: String(formData.apodo || '').trim(),
        categoria: String(formData.nivel || '').trim(),
        whatsapp: wa,
        email: owner,
      });
      await refreshJugadorPerfilFromSupabase(owner);

      setSuccessMsg(MSG_CUENTA_Y_FICHA_OK);
      setRegistroFieldErrors({});
      setRegistroPasoDeportes(0);
      setRegistroDeportesSel([]);

      if (isPerfilTorneoCompleto()) {
        await new Promise((r) => setTimeout(r, 450));
        const target = normalizeTorneoPostPerfilPath(redirectAfterAuth, torneoIdValido ? torneoIdPerfil : '');
        navigate(target && target !== '/home' && target !== '/' ? target : '/', { replace: true });
      } else {
        setErrorMsg(t('perfil.missingRequiredFields'));
      }
    } catch (err) {
      console.log('ERROR SIGNUP:', err);
      setErrorMsg(
        mensajeErrorJugadoresPerfilDuplicado(err) ||
          mensajeErrorDbSupabase(err) ||
          t('perfil.flow.registrationFailed')
      );
    } finally {
      perfilSubmitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (perfilSubmitLockRef.current || isSubmitting) return;
    perfilSubmitLockRef.current = true;
    setErrorMsg('');
    setSuccessMsg('');
    setFichaFieldErrors({});

    try {
      const owner = sessionOwnerEmail;
      if (!owner) {
        setErrorMsg(t('perfil.noActiveSession'));
        return;
      }
      const errPais = mensajeValidarPaisTorneo(torneoPerfil, formData.pais, t);
      if (errPais) {
        setErrorMsg(errPais);
        return;
      }
      const nombreTrim = String(formData.nombre || '').trim();
      const apellidoTrim = String(formData.apellido || '').trim();
      const genTrim = String(formData.genero || '').trim();
      const fe = {};
      if (!nombreTrim) fe.nombre = 'Completa tu nombre.';
      if (!apellidoTrim) fe.apellido = 'Completa tu apellido.';
      if (!genTrim || !['masculino', 'femenino', 'otro', 'open'].includes(genTrim)) {
        fe.genero = t('perfil.selectGender');
      }
      if (!String(formData.nivel || '').trim()) fe.nivel = t('perfil.selectCategory');
      if (!String(formData.lateralidad || '').trim()) fe.lateralidad = t('perfil.flow.selectLaterality');
      if (Object.keys(fe).length) {
        setFichaFieldErrors(fe);
        return;
      }

      const aliasPerfilExistente = String(perfil?.alias || '').trim();
      if (!aliasPerfilExistente && String(formData.alias || '').trim() && aliasDuplicado) {
        setErrorMsg(t('perfil.aliasTaken'));
        return;
      }
      if (!aliasPerfilExistente && String(formData.alias || '').trim() && aliasVerificando) {
        return;
      }

      const local = waNumeroLocal.trim();
      if (!digitsOnly(local)) {
        setErrorMsg('Completa tu WhatsApp');
        return;
      }
      if (!whatsappNacionalValido(local)) {
        setErrorMsg(t('perfil.completeWhatsappDigits'));
        return;
      }
      const waBuilt = buildFullWhatsDigits(waCodigoPais, local);
      if (!whatsappDigitsValido(waBuilt)) {
        setErrorMsg(t('perfil.completeWhatsapp'));
        return;
      }
      const waFinal = formatWhatsAppE164(waCodigoPais, local);

      setIsSubmitting(true);

      const paisGuardado = paisPayloadSegunTorneo(torneoPerfil, formData.pais);

      const aliasTrim = aliasPerfilExistente || String(formData.alias || '').trim();
      const payload = {
        lateralidad: formData.lateralidad,
        nivel: formData.nivel,
        genero: genTrim,
        pendiente_validacion: true,
        pais: paisGuardado,
        localidad: formData.localidad?.trim() ? formData.localidad.trim() : null,
        ciudad: formData.ciudad?.trim() ? formData.ciudad.trim() : null,

        fecha_nacimiento: fechaNacimientoParaPayload(formData.fecha_nacimiento),
        numero_fipa: formData.numero_fipa?.trim() ? formData.numero_fipa.trim() : null,
        es_federado: formData.es_federado,
        mostrar_torneos_jugados: !!formData.mostrar_torneos_jugados,
        alias: aliasTrim || null,
        instagram_url: instagramUrlFromHandle(formData.instagram),
        companero_id: formData.companero_id || null,
        ultimo_companero_id:
          perfil?.ultimo_companero_id != null && String(perfil.ultimo_companero_id).trim()
            ? String(perfil.ultimo_companero_id).trim()
            : null,
        busca_companero: !!formData.busca_companero,
        deportes_preferidos: normalizeDeportesPreferidosArray(formData.deportes_preferidos),
      };

      const userId = session?.user?.id ?? null;
      if (!userId) {
        setErrorMsg(t('perfil.sessionUserMissing'));
        return;
      }

      if (!aliasPerfilExistente && aliasTrim) {
        const lit = escapeIlikeLiteral(aliasTrim);
        const { data: dupRows, error: dupErr } = await supabase
          .from('jugadores_perfil')
          .select('user_id')
          .ilike('alias', lit)
          .neq('user_id', String(userId))
          .limit(1);
        if (!dupErr && Array.isArray(dupRows) && dupRows.length > 0) {
          setErrorMsg(t('perfil.aliasTaken'));
          return;
        }
      }

      const payloadDb = {
        user_id: userId,
        email: owner,
        nombre: nombreTrim,
        apellido: apellidoTrim || null,
        apodo: String(formData.apodo || '').trim() || null,
        whatsapp: waFinal,
        ...payload,
      };

      let fotoUrlGuardada = perfil?.foto_url ?? null;
      const pendingFoto = pendingFotoFileRef.current;
      if (pendingFoto) {
        if (pendingFoto.size > 2 * 1024 * 1024) {
          setErrorMsg(t('perfil.flow.imageOver2mb'));
          return;
        }
        const extRaw = String(pendingFoto.name.split('.').pop() || 'jpg').toLowerCase();
        const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extRaw) ? extRaw : 'jpg';
        const path = `perfil/${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(AVATAR_STORAGE_BUCKET)
          .upload(path, pendingFoto, { upsert: true, contentType: pendingFoto.type || 'image/jpeg' });
        if (upErr) {
          setErrorMsg(t('perfil.flow.uploadPhotoFailed', { message: upErr.message }));
          return;
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from(AVATAR_STORAGE_BUCKET).getPublicUrl(path);
        fotoUrlGuardada = `${publicUrl}?t=${Date.now()}`;
      }
      payloadDb.foto_url = fotoUrlGuardada;

      const { error } = await supabase
        .from('jugadores_perfil')
        .upsert(payloadDb, { onConflict: 'email' });

      if (error) {
        console.error('ERROR COMPLETO UPSERT:', JSON.stringify(error));
        setErrorMsg(mensajeErrorDbSupabase(error));
        return;
      }

      const nombreClienteDisplay = [nombreTrim, apellidoTrim].filter(Boolean).join(' ').trim();
      const { error: errCli } = await supabase
        .from('clientes')
        .update({ whatsapp: waFinal, nombre: nombreClienteDisplay })
        .eq('email', owner);
      if (errCli) {
        console.error(errCli);
      }
      pendingFotoFileRef.current = null;
      setFotoPendienteDeSubir(false);
      setFotoPreview((prev) => {
        if (prev && String(prev).startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });

      await fetchPerfil();
      persistJugadorPerfil({
        nombre: nombreTrim,
        apellido: apellidoTrim,
        genero: genTrim,
        apodo: String(formData.apodo || '').trim(),
        categoria: String(formData.nivel || '').trim(),
        whatsapp: waFinal,
        email: owner,
        ...(fotoUrlGuardada ? { foto_url: fotoUrlGuardada } : {}),
      });
      await refreshJugadorPerfilFromSupabase(owner);
      await refreshSession();

      setPassRegistroTorneo('');
      setPassRegistroTorneo2('');

      const target = normalizeTorneoPostPerfilPath(redirectAfterAuth, torneoIdValido ? torneoIdPerfil : '');
      if (isPerfilTorneoCompleto() && target && target !== '/home' && target !== '/') {
        setSuccessMsg(target.startsWith('/torneo/') ? MSG_CUENTA_Y_FICHA_OK : '✅ Perfil guardado');
        setEditando(false);
        await new Promise((r) => setTimeout(r, 450));
        navigate(target, { replace: true });
        return;
      }
      setSuccessMsg('✅ Perfil guardado');
      setEditando(false);
      setFichaFieldErrors({});
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      perfilSubmitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCancelar = async (r) => {
    const owner = sessionOwnerEmail;
    if (!owner) return;
    setCancelando(r.id);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/cancelar-reserva`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaId: r.id, email: owner }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || t('perfil.flow.cancelFailed'));
      if (data.credito) {
        alert(t('perfil.cancelCreditAlert', { amount: Number(data.credito.monto).toLocaleString('es-AR') }));
      } else {
        alert(t('perfil.cancelNoCreditAlert'));
      }
      await fetchReservas();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCancelando(null);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px', marginBottom: '6px',
    border: '1px solid var(--border)', borderRadius: '5px',
    boxSizing: 'border-box', fontSize: '14px', background: 'var(--bg-card)', color: 'var(--text-primary)',
  };
  const labelStyle = {
    display: 'block', fontWeight: 'bold',
    marginBottom: '5px', color: 'var(--text-secondary)', fontSize: '13px',
  };

  if (authLoading) {
    return (
      <div style={miPerfilPageOuterStyle(hubContentPaddingTopCss(location.pathname, navDock), hubMainPaddingBottomCss(location.pathname, navDock))}>
        <AppHeader title={t('perfil.titulo')} />
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Verificando sesión...
        </div>
        <BottomNav />
      </div>
    );
  }

  if (esRegistroSinSesion) {
    if (!torneoIdValido) {
      const goAuth = () => navigate(authUrlWithRedirect(authLoginRedirectPath(location)));
      return (
        <div style={miPerfilPageOuterStyle(hubContentPaddingTopCss(location.pathname, navDock), hubMainPaddingBottomCss(location.pathname, navDock))}>
          <AppHeader title={t('perfil.titulo')} />
          <div style={MI_PERFIL_CONTENT_WRAP}>
            {avisoPerfilTorneoMsg ? (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '12px 14px',
                  background: '#fef9c3',
                  border: '1px solid #fde047',
                  borderRadius: '10px',
                  color: '#854d0e',
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: 1.45,
                }}
              >
                {avisoPerfilTorneoMsg}
              </div>
            ) : null}
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '12px', color: 'var(--text-primary)' }}>{t('perfil.guestTitle')}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px', lineHeight: 1.5 }}>
                Para ver y editar tu ficha necesitas una cuenta. Puedes explorar el resto de la app sin iniciar sesión.
              </p>
              <button
                type="button"
                onClick={goAuth}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  marginBottom: '10px',
                }}
              >
                Iniciar sesión o registrarte
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'transparent',
                  color: '#444',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                Volver al inicio
              </button>
            </div>
          </div>
          <BottomNav />
        </div>
      );
    }

    const regErr = (k) => registroFieldErrors[k];
    const regBorder = (k) => (regErr(k) ? '1px solid #d32f2f' : '1px solid var(--border)');
    const regErrP = (k) =>
      regErr(k) ? (
        <p style={{ color: '#d32f2f', fontSize: '13px', marginTop: '-2px', marginBottom: '10px', lineHeight: 1.35 }}>
          {regErr(k)}
        </p>
      ) : null;
    const guestInputStyle = {
      width: '100%',
      padding: '10px',
      marginBottom: '6px',
      border: '1px solid var(--border)',
      borderRadius: '5px',
      boxSizing: 'border-box',
      fontSize: '14px',
      background: 'var(--bg-card)',
      color: 'var(--text-primary)',
    };
    const guestLabelStyle = {
      display: 'block',
      fontWeight: 'bold',
      marginBottom: '5px',
      color: 'var(--text-secondary)',
      fontSize: '13px',
    };
    return (
      <div style={miPerfilPageOuterStyle(hubContentPaddingTopCss(location.pathname, navDock), hubMainPaddingBottomCss(location.pathname, navDock))}>
        <AppHeader title={t('perfil.titulo')} />
        <div style={MI_PERFIL_CONTENT_WRAP}>
          {avisoPerfilTorneoMsg ? (
            <div
              style={{
                marginBottom: '14px',
                padding: '12px 14px',
                background: '#fef9c3',
                border: '1px solid #fde047',
                borderRadius: '10px',
                color: '#854d0e',
                fontSize: '14px',
                fontWeight: 600,
                lineHeight: 1.45,
              }}
            >
              {avisoPerfilTorneoMsg}
            </div>
          ) : null}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-primary)' }}>{t('perfil.createAccountTitle')}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '18px', lineHeight: 1.45 }}>
              Completa tus datos con un email real: se crea tu usuario en Padbol Match y se guarda tu ficha de jugador.
              {torneoIdValido ? t('perfil.afterSignupReturnTorneo') : ''}
            </p>
            <form onSubmit={handleRegistroCuenta}>
              {registroPasoDeportes === 0 ? (
                <>
              <label style={guestLabelStyle}>
                Nombre {reqAst}
              </label>
              <input
                type="text"
                value={nombreRegistroTorneo}
                onChange={(e) => {
                  setNombreRegistroTorneo(e.target.value);
                  setRegistroFieldErrors((p) => ({ ...p, nombre: '' }));
                }}
                placeholder="Ej: Juan Pablo"
                style={{ ...guestInputStyle, marginBottom: regErr('nombre') ? '6px' : '14px', border: regBorder('nombre') }}
                autoComplete="given-name"
              />
              {regErrP('nombre')}
              <label style={guestLabelStyle}>
                Apellido {reqAst}
              </label>
              <input
                type="text"
                value={apellidoRegistroTorneo}
                onChange={(e) => {
                  setApellidoRegistroTorneo(e.target.value);
                  setRegistroFieldErrors((p) => ({ ...p, apellido: '' }));
                }}
                placeholder={t("perfil.placeholderLastName")}
                style={{ ...guestInputStyle, marginBottom: regErr('apellido') ? '6px' : '14px', border: regBorder('apellido') }}
                autoComplete="family-name"
              />
              {regErrP('apellido')}

              <label style={guestLabelStyle}>
                {t('auth.gender')} {reqAst}
              </label>
              <select
                name="genero"
                value={formData.genero}
                onChange={(e) => {
                  handleChange(e);
                  setRegistroFieldErrors((p) => ({ ...p, genero: '' }));
                }}
                style={{ ...guestInputStyle, marginBottom: regErr('genero') ? '6px' : '14px', border: regBorder('genero') }}
              >
                <option value="">— Elegir —</option>
                <option value="masculino">{t('perfil.genero.masculino')}</option>
                <option value="femenino">{t('perfil.genero.femenino')}</option>
                <option value="otro">{t('perfil.genero.otro')}</option>
                <option value="open">{t('perfil.genero.open')}</option>
              </select>
              {regErrP('genero')}

              <label style={guestLabelStyle}>{t('perfil.displayName')}</label>
              <input
                type="text"
                name="apodo"
                value={formData.apodo}
                onChange={handleChange}
                placeholder="Ej: Gus, Eli, Carlitos"
                style={{ ...guestInputStyle, marginBottom: '8px' }}
                autoComplete="off"
              />
              {aliasSugerenciasCargando ? (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '10px' }}>{t('perfil.searchingAlias')}</p>
              ) : null}
              {aliasSuggestions.length > 0 ? (
                <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#f1f5f9', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Sugerencias de alias
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {aliasSuggestions.map(({ texto, libre }) => (
                      <button
                        key={texto}
                        type="button"
                        disabled={!libre}
                        onClick={() => {
                          if (!libre) return;
                          setFormData((prev) => ({ ...prev, alias: texto }));
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          background: libre ? '#fff' : '#fef2f2',
                          cursor: libre ? 'pointer' : 'not-allowed',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#0f172a',
                          textAlign: 'left',
                        }}
                      >
                        <span aria-hidden>{libre ? '✓' : '✗'}</span>
                        <span>{formatAliasConArroba(texto)}</span>
                        <span style={{ fontSize: '11px', color: libre ? '#15803d' : '#b91c1c', marginLeft: 'auto' }}>
                          {libre ? 'Disponible' : 'En uso'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <label style={guestLabelStyle}>
                Email {reqAst}
              </label>
              <input
                type="email"
                value={emailRegistro}
                onChange={(e) => {
                  setEmailRegistro(e.target.value);
                  setRegistroFieldErrors((p) => ({ ...p, email: '' }));
                }}
                placeholder="tu@email.com"
                style={{ ...guestInputStyle, marginBottom: regErr('email') ? '6px' : '14px', border: regBorder('email') }}
                autoComplete="email"
              />
              {regErrP('email')}

              <label style={guestLabelStyle}>{t('perfil.alias')}</label>
              <input
                type="text"
                name="alias"
                value={formData.alias}
                onChange={handleChange}
                placeholder="Alias (opcional)"
                style={{
                  ...guestInputStyle,
                  marginBottom: aliasDuplicado ? '6px' : '14px',
                  borderColor: aliasDuplicado ? '#f87171' : aliasDisponible && String(formData.alias || '').trim() ? '#22c55e' : undefined,
                }}
                autoComplete="nickname"
              />
              {String(formData.alias || '').trim() && !aliasVerificando && !aliasDuplicado ? (
                <p style={{ color: '#15803d', fontSize: '13px', marginTop: '-8px', marginBottom: '10px', fontWeight: 600 }}>
                  ✓ Disponible
                </p>
              ) : null}
              {aliasDuplicado ? (
                <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '-8px', marginBottom: '14px', fontWeight: 600 }}>
                  ✗ Ya está en uso
                </p>
              ) : null}

              <label style={guestLabelStyle}>{t('perfil.instagram')}</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  marginBottom: '14px',
                  border: '1px solid var(--border)',
                  borderRadius: '5px',
                  boxSizing: 'border-box',
                  background: 'var(--bg-card)',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    padding: '10px 0 10px 10px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  @
                </span>
                <input
                  type="text"
                  name="instagram"
                  value={formData.instagram}
                  onChange={handleChange}
                  placeholder="usuario"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    padding: '10px 10px 10px 4px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '6px', width: '100%' }}>
                <TelefonoPaisCodigoRow
                  sectionHeading={
                    <span style={guestLabelStyle}>
                      WhatsApp {reqAst}
                    </span>
                  }
                  labelStyle={guestLabelStyle}
                  codigoValue={waCodigoPais}
                  onCodigoChange={(v) => {
                    setWaCodigoPais(v);
                    setRegistroFieldErrors((p) => ({ ...p, whatsapp: '', whatsappConfirma: '' }));
                  }}
                  localValue={waNumeroLocal}
                  onLocalChange={(v) => {
                    setWaNumeroLocal(digitsOnly(v));
                    setRegistroFieldErrors((p) => ({ ...p, whatsapp: '', whatsappConfirma: '' }));
                  }}
                  confirmLocalValue={waConfirmLocal}
                  onConfirmLocalChange={(v) => {
                    setWaConfirmLocal(digitsOnly(v));
                    setRegistroFieldErrors((p) => ({ ...p, whatsapp: '', whatsappConfirma: '' }));
                  }}
                  confirmRequired
                  requiredAsteriskStyle={{ color: '#dc2626' }}
                  placeholderLocal="Ej: 2211234567"
                  placeholderConfirm="Ej: 2211234567"
                  selectStyle={{
                    ...guestInputStyle,
                    marginBottom: 0,
                    cursor: 'pointer',
                    border: regBorder('whatsapp'),
                  }}
                  inputStyle={{
                    ...guestInputStyle,
                    marginBottom: 0,
                    border: regBorder('whatsapp'),
                  }}
                  confirmInputStyle={{
                    ...guestInputStyle,
                    marginBottom: regErr('whatsappConfirma') ? '6px' : '14px',
                    border: regBorder('whatsappConfirma'),
                  }}
                />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: 0, marginBottom: '6px', lineHeight: 1.4 }}>
                Elige país (bandera + código) y escribe solo el número local (mín. 10 dígitos). Se guarda en formato internacional.
              </p>
              {regErrP('whatsapp')}
              {regErrP('whatsappConfirma')}

              <label style={guestLabelStyle}>
                Contraseña {reqAst}
              </label>
              <input
                type="password"
                value={passRegistroTorneo}
                onChange={(e) => {
                  setPassRegistroTorneo(e.target.value);
                  setRegistroFieldErrors((p) => ({ ...p, password: '', password2: '' }));
                }}
                placeholder={t("perfil.placeholderPasswordMin")}
                style={{ ...guestInputStyle, marginBottom: regErr('password') ? '6px' : '14px', border: regBorder('password') }}
                autoComplete="new-password"
              />
              {regErrP('password')}

              <label style={guestLabelStyle}>
                Confirmar contraseña {reqAst}
              </label>
              <input
                type="password"
                value={passRegistroTorneo2}
                onChange={(e) => {
                  setPassRegistroTorneo2(e.target.value);
                  setRegistroFieldErrors((p) => ({ ...p, password2: '', password: '' }));
                }}
                placeholder={t("perfil.placeholderRepeatPassword")}
                style={{ ...guestInputStyle, marginBottom: regErr('password2') ? '6px' : '14px', border: regBorder('password2') }}
                autoComplete="new-password"
              />
              {regErrP('password2')}

              <label style={guestLabelStyle}>
                {t('perfil.lateralidad')} {reqAst}
              </label>
              <select
                name="lateralidad"
                value={formData.lateralidad}
                onChange={(e) => {
                  handleChange(e);
                  setRegistroFieldErrors((p) => ({ ...p, lateralidad: '' }));
                }}
                style={{ ...guestInputStyle, marginBottom: regErr('lateralidad') ? '6px' : '14px', border: regBorder('lateralidad') }}
              >
                <option value="Diestro">{t('perfil.diestro')}</option>
                <option value="Zurdo">{t('perfil.zurdo')}</option>
                <option value="Ambidiestro">{t('perfil.ambidiestro')}</option>
              </select>
              {regErrP('lateralidad')}

              <label style={guestLabelStyle}>
                Categoría {reqAst}
              </label>
              <select
                name="nivel"
                value={formData.nivel}
                onChange={(e) => {
                  handleChange(e);
                  setRegistroFieldErrors((p) => ({ ...p, categoria: '' }));
                }}
                style={{ ...guestInputStyle, marginBottom: regErr('categoria') ? '6px' : '14px', border: regBorder('categoria') }}
              >
                {categoriasNivelPorGenero(formData.genero).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '2px', marginBottom: regErr('categoria') ? '6px' : '14px' }}>
                La categoría será validada por un administrador
              </p>
              {regErrP('categoria')}

              {mostrarCampoPais ? (
                <>
                  <label style={guestLabelStyle}>
                    País
                    {paisHtmlRequired ? <> {reqAst}</> : null}
                  </label>
                  {torneoPerfil && nivelTorneoScope === 'nacional' ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: 0, marginBottom: '6px', lineHeight: 1.35 }}>
                      Por defecto Argentina; puedes cambiar el país si corresponde.
                    </p>
                  ) : null}
                  <select
                    name="pais"
                    value={formData.pais}
                    onChange={(e) => {
                      handleChange(e);
                      setRegistroFieldErrors((p) => ({ ...p, pais: '' }));
                    }}
                    style={{ ...guestInputStyle, marginBottom: regErr('pais') ? '6px' : '14px', border: regBorder('pais') }}
                    required={paisHtmlRequired}
                  >
                    <option value="">{t("perfil.selectCountryOption")}</option>
                    <optgroup label="Principales">
                      {PAISES_TELEFONO_PRINCIPALES.map((p) => (
                        <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>
                          {p.bandera} {p.nombre}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={t("perfil.otherCountries")}>
                      {PAISES_TELEFONO_OTROS.map((p) => (
                        <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>
                          {p.bandera} {p.nombre}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  {regErrP('pais')}
                </>
              ) : null}

              <label style={guestLabelStyle}>Ciudad</label>
              <input
                type="text"
                name="localidad"
                placeholder={t('perfil.flow.cityPlaceholder')}
                value={formData.localidad}
                onChange={handleChange}
                style={{ ...guestInputStyle, marginBottom: '14px' }}
                autoComplete="address-level2"
              />

              <label style={guestLabelStyle}>{t('perfil.usualClub')}</label>
              <div style={{ marginBottom: '14px' }}>
                <SedeBusquedaInput
                  mode="nombre"
                  sedes={sedesClubHabitual}
                  valueNombre={String(formData.ciudad || '').trim()}
                  onSelectNombre={(nombre) =>
                    setFormData((prev) => ({ ...prev, ciudad: String(nombre || '').trim() }))
                  }
                  placeholder={t("perfil.searchVenuePlaceholder")}
                  debounceMs={320}
                  minChars={2}
                  inputStyle={guestInputStyle}
                  aria-label={t('perfil.flow.searchUsualClub')}
                />
              </div>

              <label style={guestLabelStyle}>{t('perfil.birthDate')}</label>
              <input
                type="date"
                name="fecha_nacimiento"
                value={formData.fecha_nacimiento}
                onChange={handleChange}
                style={{ ...guestInputStyle, marginBottom: '14px' }}
              />

              <label style={guestLabelStyle}>N° FIPA</label>
              <input
                type="text"
                name="numero_fipa"
                placeholder="Ej: 12345"
                value={formData.numero_fipa}
                onChange={handleChange}
                style={{ ...guestInputStyle, marginBottom: '14px' }}
              />

              <label style={{ ...guestLabelStyle, marginBottom: '8px' }}>{t('perfil.federatedQuestion')}</label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, es_federado: true }))}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: '2px solid',
                    borderColor: formData.es_federado ? '#388e3c' : 'var(--border)',
                    background: formData.es_federado ? '#e8f5e9' : 'var(--bg-card)',
                    color: formData.es_federado ? '#388e3c' : 'var(--text-secondary)',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, es_federado: false }))}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: '2px solid',
                    borderColor: !formData.es_federado ? '#d32f2f' : 'var(--border)',
                    background: !formData.es_federado ? '#fff3f3' : 'var(--bg-card)',
                    color: !formData.es_federado ? '#d32f2f' : 'var(--text-secondary)',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  No
                </button>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: regErr('acepto_terminos') ? '6px' : '16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.45,
                }}
              >
                <input
                  type="checkbox"
                  checked={aceptoTerminosPrivacidadRegistro}
                  onChange={(e) => {
                    setAceptoTerminosPrivacidadRegistro(e.target.checked);
                    setRegistroFieldErrors((p) => ({ ...p, acepto_terminos: '' }));
                  }}
                  style={{ marginTop: '3px', width: 18, height: 18, flexShrink: 0 }}
                />
                <span>
                  Acepto los{' '}
                  <Link to="/terminos" target="_blank" rel="noopener noreferrer" style={{ color: '#5c6bc0', fontWeight: 700 }}>
                    Términos y Condiciones
                  </Link>{' '}
                  y la{' '}
                  <Link to="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: '#5c6bc0', fontWeight: 700 }}>
                    Política de Privacidad
                  </Link>{' '}
                  {reqAst}
                </span>
              </label>
              {regErrP('acepto_terminos')}
                </>
              ) : (
                <>
                  <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
                    ¿Qué deportes practicas?
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '14px', lineHeight: 1.45 }}>
                    Elige uno o más. Es opcional pero nos ayuda a mostrarte sedes y turnos más acordes. Puedes editarlo después en Mi perfil.
                  </p>
                  <DeportesPreferidosChips value={registroDeportesSel} onChange={setRegistroDeportesSel} disabled={isSubmitting} />
                  <button
                    type="button"
                    onClick={() => setRegistroPasoDeportes(0)}
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      padding: '11px',
                      marginTop: '16px',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '14px',
                    }}
                  >
                    Volver
                  </button>
                </>
              )}

              {successMsg ? (
                <p style={{ color: '#2e7d32', marginBottom: '10px', fontWeight: 600, lineHeight: 1.4 }}>{successMsg}</p>
              ) : null}
              {errorMsg ? <p style={{ color: 'red', marginBottom: '10px' }}>{errorMsg}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  opacity: isSubmitting ? 0.65 : 1,
                }}
              >
                {isSubmitting ? 'Guardando...' : registroPasoDeportes === 0 ? 'Continuar' : torneoIdValido ? t('perfil.flow.saveReturnTournament') : t('auth.registerTitle')}
              </button>
            </form>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={miPerfilPageOuterStyle(hubContentPaddingTopCss(location.pathname, navDock), hubMainPaddingBottomCss(location.pathname, navDock))}>
        <AppHeader title={t('perfil.titulo')} />
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Cargando perfil...
        </div>
        <BottomNav />
      </div>
    );
  }

  const paisDisplay = getPaisDisplay(perfil?.pais);
  const categoriaColor = CATEGORIA_COLOR[perfil?.nivel] || '#999';
  const foto = perfil?.foto_url || cuentaDeSesion?.foto || null;
  const puedeEliminarFotoPerfil = Boolean(
    (fotoPreview && String(fotoPreview).trim()) ||
      String(perfil?.foto_url || '').trim() ||
      String(cuentaDeSesion?.foto || '').trim()
  );

  /**
   * Fila para nombre bajo la foto: en vista, priorizar `perfil` (Supabase en esta pantalla) sobre `userProfile`
   * del contexto para que `apodo` / nombre legal no queden desfasados respecto al alias.
   * Jerarquía: apodo → nombre real; el alias (@…) va aparte en gris.
   */
  const filaParaCabeceraPerfil = editando
    ? {
        ...(perfil && typeof perfil === 'object' ? perfil : {}),
        apodo: String(formData.apodo || '').trim(),
        nombre: String(formData.nombre || '').trim(),
        apellido: String(formData.apellido || '').trim(),
        email: perfil?.email || session?.user?.email,
        alias: String(formData.alias || '').trim(),
      }
    : perfil && userProfile
      ? { ...userProfile, ...perfil }
      : perfil || userProfile || {};

  const aliasLineaSecundaria = editando
    ? String(formData.alias || '').trim()
    : String(filaParaCabeceraPerfil?.alias || '').trim();

  const tituloPrincipalDebajoFoto =
    headerNombreVisible(filaParaCabeceraPerfil, session) ||
    getDisplayName(filaParaCabeceraPerfil, session) ||
    'Jugador';

  return (
    <div style={miPerfilPageOuterStyle(hubContentPaddingTopCss(location.pathname, navDock), hubMainPaddingBottomCss(location.pathname, navDock))}>

      <AppHeader title={t('perfil.titulo')} />

    <div style={MI_PERFIL_CONTENT_WRAP}>
      {perfilFaltaCamposEsenciales && !ocultarUiJugadorPorAdmin ? (
        <div
          style={{
            marginBottom: '14px',
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            border: '1px solid #fdba74',
            borderRadius: '12px',
            color: '#9a3412',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 1.45,
            boxShadow: '0 2px 10px rgba(234, 88, 12, 0.12)',
          }}
        >
          <p style={{ margin: '0 0 12px', padding: 0 }}>
            ⚠️ Tu perfil está incompleto. Completa tus datos para aparecer bien en torneos y rankings.
          </p>
          <button
            type="button"
            onClick={() => setEditando(true)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '14px',
              boxShadow: '0 2px 8px rgba(194, 65, 12, 0.35)',
            }}
          >
            Completar perfil
          </button>
        </div>
      ) : null}
      {avisoPerfilTorneoMsg ? (
        <div
          style={{
            marginBottom: '14px',
            padding: '12px 14px',
            background: '#fef9c3',
            border: '1px solid #fde047',
            borderRadius: '10px',
            color: '#854d0e',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          {avisoPerfilTorneoMsg}
        </div>
      ) : null}

      <ReputacionJugadorPanel
        apiBaseUrl={API_BASE_URL}
        accessToken={session?.access_token ?? null}
      />

      {!ocultarUiJugadorPorAdmin ? (
        <section
          style={{
            marginBottom: 16,
            padding: '20px 22px',
            border: '1px solid rgba(225, 27, 34, 0.38)',
            borderRadius: 14,
            background: 'radial-gradient(circle at top right, rgba(225,27,34,.14), transparent 45%), var(--bg-card)',
            boxShadow: '0 8px 24px rgba(0,0,0,.08)',
          }}
        >
          <div style={{ color: '#e11b22', fontSize: 11, fontWeight: 900, letterSpacing: '.11em', textTransform: 'uppercase' }}>
            Tu juego no empieza de cero
          </div>
          <h3 style={{ margin: '8px 0', color: 'var(--text-primary)', fontSize: 21 }}>{t('perfil.flow.bringHistoryTitle')}</h3>
          <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: 14 }}>
            Subí capturas de tu ranking, categoría, partidos, torneos o logros. Las revisamos y te avisamos dentro de las próximas 24 horas. Tus datos son tuyos y podrás llevártelos cuando quieras.
          </p>
          <button
            type="button"
            onClick={() => navigate('/mi-perfil/recorrido')}
            style={{ padding: '11px 16px', border: 0, borderRadius: 10, background: '#e11b22', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
          >
            Traer mi recorrido →
          </button>
        </section>
      ) : null}

      {errorMsg && !editando ? (
        <div
          style={{
            marginBottom: '14px',
            padding: '12px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#b91c1c',
            fontSize: '13px',
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          {errorMsg}
        </div>
      ) : null}

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '30px 24px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', marginBottom: '16px', textAlign: 'center', border: '1px solid var(--border)' }}>
        {/* Foto de perfil: avatar + overlay + input file */}
        <div className="mi-perfil-foto-bloque">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handlePhotoSelected}
        />
        <button
          type="button"
          aria-label={t('perfil.flow.changeProfilePhoto')}
          onClick={() => {
            if (!sessionOwnerEmail) {
              fileInputRef.current?.click();
              return;
            }
            setFotoAccionModalOpen(true);
          }}
          style={{
            position: 'relative',
            width: '120px',
            height: '120px',
            margin: '0 auto 6px',
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: '50%',
            display: 'block',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <img
            src={fotoPreview || perfil?.foto_url || cuentaDeSesion?.foto || '/default-avatar.svg'}
            alt={t('nav.perfil')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center center',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
          {!fotoPreview && !foto && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(15, 23, 42, 0.45)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                borderRadius: '50%',
                textAlign: 'center',
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: '28px',
                  marginBottom: '6px',
                }}
                aria-hidden
              >
                📷
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                Subir foto
              </span>
            </div>
          )}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              boxShadow: 'inset 0 0 0 3px #ef4444',
              pointerEvents: 'none',
            }}
          />
        </button>
        </div>
        {fotoPendienteDeSubir ? (
          <button
            type="button"
            disabled={guardandoFoto}
            onClick={() => void handleGuardarFoto()}
            style={{
              display: 'block',
              margin: '0 auto 6px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 700,
              color: '#fff',
              background: guardandoFoto ? '#94a3b8' : '#15803d',
              border: 'none',
              borderRadius: '10px',
              cursor: guardandoFoto ? 'default' : 'pointer',
              boxShadow: guardandoFoto ? 'none' : '0 4px 12px rgba(21,128,61,0.35)',
            }}
          >
            {guardandoFoto ? t('perfil.flow.saving') : t('perfil.flow.savePhoto')}
          </button>
        ) : null}

        <h2
          style={{
            margin: aliasLineaSecundaria ? '2px 0 4px' : '2px 0 6px',
            fontSize: '22px',
            fontWeight: 'bold',
            color: 'var(--text-primary)',
          }}
        >
          {tituloPrincipalDebajoFoto}
        </h2>
        {aliasLineaSecundaria ? (
          <p
            style={{
              margin: '0 0 6px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              fontWeight: 400,
              lineHeight: 1.35,
            }}
          >
            {formatAliasConArroba(aliasLineaSecundaria)}
          </p>
        ) : null}

        {pathMiPerfilPublico && !editando ? (
          <div className="mi-perfil-ver-publico-wrap">
            <button
              type="button"
              className="mi-perfil-ver-publico-btn"
              onClick={() => navigate(pathMiPerfilPublico)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {t('perfil.viewPublicProfile')}
            </button>
          </div>
        ) : null}

        {paisDisplay ? (
          <p style={{ margin: '0 0 4px', fontSize: '16px', color: 'var(--text-primary)' }}>{paisDisplay}</p>
        ) : null}
        {perfil && !editando && String(perfil.localidad || perfil.ciudad_residencia || '').trim() ? (
          <p
            style={{
              margin: '0 0 3px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <span style={{ display: 'inline-flex', flexShrink: 0, color: 'inherit' }}>
              <IconGeroUbicacion size={14} />
            </span>
            {String(perfil.localidad || perfil.ciudad_residencia).trim()}
          </p>
        ) : null}
        {perfil?.ciudad && (
          <p style={{ margin: '0 0 3px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            {t('perfil.usualClub')}: {perfil.ciudad}
          </p>
        )}
        {perfil && !editando ? (
          <p style={{ margin: '0 0 3px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            {perfilCompaneroDisplay?.kind === 'ultimo' ? t('perfil.lastPartner') : t('perfil.regularPartner')}:{' '}
            {perfilCompaneroDisplay?.row && String(perfilCompaneroDisplay.row.alias || '').trim() ? (
              <button
                type="button"
                onClick={() =>
                  setJugadorPreviewMiCompanero(buildJugadorPreviewModalData(perfilCompaneroDisplay.row, null))
                }
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  cursor: 'pointer',
                  color: '#991b1b',
                  fontWeight: 600,
                  fontSize: '13px',
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                }}
              >
                {formatAliasConArroba(String(perfilCompaneroDisplay.row.alias).trim())}
              </button>
            ) : perfilCompaneroDisplay?.row ? (
              <button
                type="button"
                onClick={() =>
                  setJugadorPreviewMiCompanero(buildJugadorPreviewModalData(perfilCompaneroDisplay.row, null))
                }
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  cursor: 'pointer',
                  color: '#991b1b',
                  fontWeight: 600,
                  fontSize: '13px',
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                }}
              >
                {nombreCompletoJugadorPerfil(perfilCompaneroDisplay.row) ||
                  perfilCompaneroDisplay.row.nombre ||
                  t('perfil.undefined')}
              </button>
            ) : (
              t('perfil.undefined')
            )}
          </p>
        ) : null}
        {/* Badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {perfil?.nivel && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: 'white', background: categoriaColor }}>
              {perfil.nivel}
              {esCategoriaPendienteValidacion(perfil) && (
                <span
                  title={t("perfil.pendingAdminValidation")}
                  style={{
                    fontSize: '11px',
                    background: 'rgba(255, 255, 255, 0.92)',
                    color: '#713f12',
                    border: '1px solid rgba(253, 224, 71, 0.85)',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontWeight: 700,
                  }}
                >
                  ⏳ pendiente
                </span>
              )}
            </span>
          )}
          {perfil?.lateralidad && <Badge text={etiquetaLateralidadPerfil(t, perfil.lateralidad)} color="#555" />}
          {perfil?.es_federado && <Badge text={t('perfil.federatedBadge')} color="#388e3c" />}
          {perfil?.numero_fipa && <Badge text={`FIPA ${perfil.numero_fipa}`} color="#7b1fa2" />}
        </div>

        {successMsg && <p style={{ color: '#4caf50', fontWeight: 'bold', marginTop: '14px', marginBottom: 0 }}>{successMsg}</p>}
      </div>

      <JugadorFichaTorneosSection
        perfil={perfil}
        whatsappFallback={String(cuentaDeSesion?.whatsapp || '').trim()}
      />

      {/* Ficha detail card */}
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '20px 24px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
          marginBottom: '16px',
          border: '1px solid var(--border)',
        }}
      >

        {!perfil && !editando ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{t('perfil.noProfileYet')}</p>
            <button
              onClick={() => setEditando(true)}
              style={{ padding: '12px 24px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🏆 Crear ficha de jugador
            </button>
          </div>

        ) : !editando ? (
          <>
            <h4 style={{ margin: '0 0 14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>{t('perfil.playerData')}</h4>
            <div style={{ display: 'grid', gap: '2px', marginBottom: '18px' }}>
              <Row
                label={t('perfil.fullName')}
                value={nombreCompletoJugadorPerfil(perfil)?.trim() || '—'}
              />
              <Row
                label={t('auth.gender')}
                value={etiquetaGeneroPerfil(t, perfil.genero)}
              />
              <Row label="WhatsApp" value={String(perfil?.whatsapp || cuentaDeSesion?.whatsapp || '—').trim() || '—'} />
              <Row
                label={t("perfil.displayName")}
                value={
                  String(perfil?.apodo || '').trim() ||
                  String(perfil?.nombre_saludo || '').trim() ||
                  '—'
                }
              />
              <Row
                label={t('perfil.alias')}
                value={String(perfil?.alias || '').trim() ? formatAliasConArroba(String(perfil.alias).trim()) : '—'}
              />
              <Row
                label={t('perfil.instagram')}
                value={
                  perfil?.instagram_url
                    ? `@${instagramHandleFromStored(perfil.instagram_url)}`
                    : '—'
                }
              />
              <Row label={t('perfil.emailAccount')} value={cuentaDeSesion?.email || '—'} />
              <Row label={t("perfil.categoryLabel")} value={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: categoriaColor }}>{perfil.nivel}</span>
                  {esCategoriaPendienteValidacion(perfil) && (
                    <span
                      title={t("perfil.pendingValidation")}
                      style={{
                        fontSize: '11px',
                        background: 'var(--bg-page)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '1px 7px',
                        fontWeight: 700,
                      }}
                    >
                      ⏳ pendiente
                    </span>
                  )}
                </span>
              } />
              <Row label={t('perfil.lateralidad')} value={etiquetaLateralidadPerfil(t, perfil.lateralidad)} />
              <Row
                label={t('perfil.lookingForPartner')}
                value={perfil.busca_companero ? t('perfil.lookingForPartnerYes') : t('perfil.no')}
              />
              {fechaNacimientoDesdeDb(perfil.fecha_nacimiento) && (
                <Row
                  label={t('perfil.birthDate')}
                  value={fechaNacimientoDisplayEsAr(perfil.fecha_nacimiento)}
                />
              )}
              <div>
                <strong>{t("perfil.federated")}</strong> {perfil.es_federado ? t('perfil.yes') : t('perfil.no')}
              </div>
              <div>
                <strong>{t("perfil.federatedNumber")}</strong> {perfil.numero_fipa}
              </div>
            </div>
            <button
              onClick={() => setEditando(true)}
              style={{ width: '100%', padding: '11px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✏️ Editar perfil
            </button>
          </>

        ) : (
          <form id="mi-perfil-ficha-form" onSubmit={handleGuardar}>
            <h4 style={{ margin: '0 0 16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>{t('perfil.editData')}</h4>

            <label style={labelStyle}>{t("perfil.firstName")} {reqAst}</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: Juan Pablo"
              style={{ ...inputStyle, marginBottom: fichErr('nombre') ? '6px' : '10px', border: fichBorder('nombre') }}
              autoComplete="given-name"
              required
            />
            {fichErrP('nombre')}
            <label style={labelStyle}>{t("perfil.lastName")} {reqAst}</label>
            <input
              type="text"
              name="apellido"
              value={formData.apellido}
              onChange={handleChange}
              placeholder={t("perfil.placeholderLastName")}
              style={{ ...inputStyle, marginBottom: fichErr('apellido') ? '6px' : '14px', border: fichBorder('apellido') }}
              autoComplete="family-name"
            />
            {fichErrP('apellido')}

            <label style={labelStyle}>{t('auth.gender')} {reqAst}</label>
            <select
              name="genero"
              value={formData.genero}
              onChange={handleChange}
              style={{ ...inputStyle, marginBottom: fichErr('genero') ? '6px' : '14px', border: fichBorder('genero') }}
            >
              <option value="">— Elegir —</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">{t('perfil.genero.otro')}</option>
              <option value="open">{t('perfil.genero.open')}</option>
            </select>
            {fichErrP('genero')}

            <label style={labelStyle}>{t('perfil.displayName')}</label>
            <input
              type="text"
              name="apodo"
              value={formData.apodo}
              onChange={handleChange}
              placeholder="Ej: Gus, Eli, Carlitos"
              style={{ ...inputStyle, marginBottom: '8px' }}
              autoComplete="off"
            />
            {!String(perfil?.alias || '').trim() ? (
              <>
            {aliasSugerenciasCargando ? (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '10px' }}>{t('perfil.searchingAlias')}</p>
            ) : null}
            {aliasSuggestions.length > 0 ? (
              <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#f1f5f9', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Sugerencias de alias (toca para usar)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {aliasSuggestions.map(({ texto, libre }) => (
                    <button
                      key={texto}
                      type="button"
                      disabled={!libre}
                      onClick={() => {
                        if (!libre) return;
                        setFormData((prev) => ({ ...prev, alias: texto }));
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        background: libre ? '#fff' : '#fef2f2',
                        cursor: libre ? 'pointer' : 'not-allowed',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#0f172a',
                        textAlign: 'left',
                      }}
                    >
                      <span aria-hidden style={{ fontSize: '14px' }}>
                        {libre ? '✓' : '✗'}
                      </span>
                      <span>{formatAliasConArroba(texto)}</span>
                      <span style={{ fontSize: '11px', color: libre ? '#15803d' : '#b91c1c', marginLeft: 'auto' }}>
                        {libre ? 'Disponible' : 'En uso'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label style={labelStyle}>{t('perfil.alias')}</label>
            <input
              type="text"
              name="alias"
              value={formData.alias}
              onChange={handleChange}
              placeholder="Alias (opcional)"
              style={{
                ...inputStyle,
                marginBottom: aliasDuplicado ? '6px' : '14px',
                borderColor: aliasDuplicado ? '#f87171' : aliasDisponible && String(formData.alias || '').trim() ? '#22c55e' : undefined,
              }}
              autoComplete="nickname"
            />
            {String(formData.alias || '').trim() && !aliasVerificando && !aliasDuplicado ? (
              <p style={{ color: '#15803d', fontSize: '13px', marginTop: '-10px', marginBottom: '12px', fontWeight: 600 }}>
                ✓ Disponible
              </p>
            ) : null}
            {aliasDuplicado ? (
              <p
                style={{
                  color: '#dc2626',
                  fontSize: '13px',
                  marginTop: '-8px',
                  marginBottom: '14px',
                  fontWeight: 600,
                  lineHeight: 1.35,
                }}
              >
                ✗ Ya está en uso — elige otro u otra sugerencia.
              </p>
            ) : null}
              </>
            ) : (
              <p
                style={{
                  fontSize: '13px',
                  color: '#475569',
                  marginBottom: '14px',
                  lineHeight: 1.45,
                  fontWeight: 600,
                }}
              >
                Tu alias es {formatAliasConArroba(String(perfil.alias).trim())} y no puede modificarse.
              </p>
            )}

            <label style={labelStyle}>{t('perfil.instagram')}</label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                marginBottom: '14px',
                border: '1px solid var(--border)',
                borderRadius: '5px',
                boxSizing: 'border-box',
                background: 'var(--bg-card)',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  padding: '10px 0 10px 10px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                  flexShrink: 0,
                }}
                aria-hidden
              >
                @
              </span>
              <input
                type="text"
                name="instagram"
                value={formData.instagram}
                onChange={handleChange}
                placeholder="usuario"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  padding: '10px 10px 10px 4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="mostrar_torneos_jugados"
                checked={!!formData.mostrar_torneos_jugados}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', flexShrink: 0 }}
              />
              <span style={{ fontWeight: 600 }}>
                Mostrar en mi perfil público la cantidad de torneos jugados (solo el número; por defecto no se muestra).
              </span>
            </label>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '-4px', marginBottom: '14px', lineHeight: 1.4 }}>
              No revela nombres de torneos ni resultados; solo el total si activas esta opción.
            </p>

            <label style={{ ...labelStyle, display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="busca_companero"
                checked={!!formData.busca_companero}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '2px' }}
              />
              <span style={{ fontWeight: 600, lineHeight: 1.4 }}>
                Busco compañero: aparecer en el inicio para jugadores de mi club habitual (misma sede).
              </span>
            </label>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '-4px', marginBottom: '14px', lineHeight: 1.4 }}>
              Necesitas tener club habitual o sede en tu ficha. Otros te contactan por WhatsApp si tienes número en el perfil o en una reserva.
            </p>

            <div style={{ marginBottom: '6px', width: '100%' }}>
              <TelefonoPaisCodigoRow
                sectionHeading={<span style={labelStyle}>WhatsApp</span>}
                labelStyle={labelStyle}
                codigoValue={waCodigoPais}
                onCodigoChange={setWaCodigoPais}
                localValue={waNumeroLocal}
                onLocalChange={(v) => setWaNumeroLocal(digitsOnly(v))}
                placeholderLocal="Ej: 91123456789"
                selectStyle={{
                  ...inputStyle,
                  marginBottom: 0,
                  cursor: 'pointer',
                }}
                inputStyle={{
                  ...inputStyle,
                  marginBottom: 0,
                }}
              />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: 0, marginBottom: '14px', lineHeight: 1.4 }}>
              Elige país (bandera + código) y el número local (mín. 10 dígitos). Se guarda en formato internacional.
            </p>

            <label style={labelStyle}>{t("perfil.lateralidad")} {reqAst}</label>
            <select
              name="lateralidad"
              value={formData.lateralidad}
              onChange={handleChange}
              style={{ ...inputStyle, marginBottom: fichErr('lateralidad') ? '6px' : '14px', border: fichBorder('lateralidad') }}
            >
              <option value="Diestro">🤜 {t('perfil.diestro')}</option>
              <option value="Zurdo">🤛 {t('perfil.zurdo')}</option>
              <option value="Ambidiestro">{t('perfil.ambidiestro')}</option>
            </select>
            {fichErrP('lateralidad')}

            <label style={labelStyle}>{t('perfil.categoryLabel')} {reqAst}</label>
            <select
              name="nivel"
              value={formData.nivel}
              onChange={handleChange}
              style={{ ...inputStyle, border: fichBorder('nivel') }}
            >
              {categoriasNivelPorGenero(formData.genero).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {fichErrP('nivel')}
            <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '2px', marginBottom: '14px' }}>
              ⏳ La categoría será validada por un administrador
            </p>

            {mostrarCampoPais ? (
              <>
                <label style={labelStyle}>
                  País
                  {!torneoPerfil || nivelTorneoScope === 'internacional' ? ' *' : ''}
                </label>
                {torneoPerfil && nivelTorneoScope === 'nacional' ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: 0, marginBottom: '6px', lineHeight: 1.35 }}>
                    Por defecto Argentina; puedes cambiar el país si corresponde.
                  </p>
                ) : null}
                <select
                  name="pais"
                  value={formData.pais}
                  onChange={handleChange}
                  style={{ ...inputStyle, marginBottom: '14px' }}
                  required={paisHtmlRequired}
                >
                  <option value="">{t("perfil.selectCountryOption")}</option>
                  <optgroup label="Principales">
                    {PAISES_TELEFONO_PRINCIPALES.map((p) => (
                      <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>
                        {p.bandera} {p.nombre}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t("perfil.otherCountries")}>
                    {PAISES_TELEFONO_OTROS.map((p) => (
                      <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>
                        {p.bandera} {p.nombre}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </>
            ) : null}

            <label style={labelStyle}>Ciudad</label>
            <input
              type="text"
              name="localidad"
              placeholder={t('perfil.flow.cityPlaceholder')}
              value={formData.localidad}
              onChange={handleChange}
              style={{ ...inputStyle, marginBottom: '14px' }}
              autoComplete="address-level2"
            />

            <label style={labelStyle}>{t('perfil.usualClub')}</label>
            <div style={{ marginBottom: '14px' }}>
              <SedeBusquedaInput
                mode="nombre"
                sedes={sedesClubHabitual}
                valueNombre={String(formData.ciudad || '').trim()}
                onSelectNombre={(nombre) =>
                  setFormData((prev) => ({ ...prev, ciudad: String(nombre || '').trim() }))
                }
                placeholder={t("perfil.searchVenuePlaceholder")}
                debounceMs={320}
                minChars={2}
                inputStyle={inputStyle}
                aria-label={t('perfil.flow.searchUsualClub')}
              />
            </div>

            <label style={labelStyle}>{t("perfil.partnerHabitual")}</label>
            {companeroSeleccionado ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  marginBottom: '14px',
                  padding: '8px 10px',
                  background: 'var(--bg-card)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '14px', minWidth: 0 }}>
                  {companeroSeleccionado.foto_url ? (
                    <img
                      src={companeroSeleccionado.foto_url}
                      alt=""
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{
                        width: '32px',
                        height: '32px',
                        flexShrink: 0,
                        borderRadius: '50%',
                        background: '#E11B22',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '14px',
                      }}
                    >
                      {inicialDesdeNombreCompanero(nombreCompletoCompaneroOp(companeroSeleccionado))}
                    </div>
                  )}
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', minWidth: 0, lineHeight: 1.3 }}>
                    {etiquetaCompaneroNombreYAlias(companeroSeleccionado)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, companero_id: null }));
                    setCompaneroSeleccionado(null);
                    setCompaneroBusqueda('');
                    setCompaneroOpciones([]);
                  }}
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#b91c1c',
                    background: 'transparent',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Quitar
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <input
                  type="text"
                  value={companeroBusqueda}
                  onChange={(e) => {
                    setCompaneroBusqueda(e.target.value);
                    setCompaneroMenuAbierto(true);
                  }}
                  onFocus={() => setCompaneroMenuAbierto(true)}
                  onBlur={() => {
                    window.setTimeout(() => setCompaneroMenuAbierto(false), 180);
                  }}
                  placeholder={t('perfil.flow.searchPlayer')}
                  autoComplete="off"
                  spellCheck={false}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />
                {companeroMenuAbierto && (companeroCargando || companeroOpciones.length > 0) ? (
                  <ul
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '100%',
                      margin: '4px 0 0',
                      padding: '4px 0',
                      listStyle: 'none',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      zIndex: 50,
                    }}
                  >
                    {companeroCargando && companeroOpciones.length === 0 ? (
                      <li style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{t('perfil.searching')}</li>
                    ) : null}
                    {companeroOpciones.map((op) => {
                      const nom = nombreCompletoCompaneroOp(op);
                      return (
                        <li key={op.user_id}>
                          <button
                            type="button"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, companero_id: op.user_id }));
                              setCompaneroSeleccionado(op);
                              setCompaneroBusqueda('');
                              setCompaneroOpciones([]);
                              setCompaneroMenuAbierto(false);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 12px',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            {op.foto_url ? (
                              <img
                                src={op.foto_url}
                                alt=""
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  flexShrink: 0,
                                }}
                              />
                            ) : (
                              <div
                                aria-hidden
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  flexShrink: 0,
                                  borderRadius: '50%',
                                  background: '#E11B22',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#fff',
                                  fontWeight: 800,
                                  fontSize: '14px',
                                }}
                              >
                                {inicialDesdeNombreCompanero(nom)}
                              </div>
                            )}
                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a', lineHeight: 1.3, minWidth: 0 }}>
                              {etiquetaCompaneroNombreYAlias(op)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            )}
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginTop: '-4px',
                marginBottom: '14px',
                lineHeight: 1.45,
              }}
            >
              Tu último compañero de torneo se actualiza automáticamente
            </p>

            <label style={labelStyle}>{t('perfil.birthDate')}</label>
            <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={labelStyle}>{t('perfil.fipaNumberLong')}</label>
            <input type="text" name="numero_fipa" placeholder="Ej: 12345" value={formData.numero_fipa} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={{ ...labelStyle, marginBottom: '8px' }}>{t('perfil.federatedQuestion')}</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, es_federado: true }))}
                style={{ flex: 1, padding: '10px', border: '2px solid', borderColor: formData.es_federado ? '#388e3c' : 'var(--border)', background: formData.es_federado ? '#e8f5e9' : 'var(--bg-card)', color: formData.es_federado ? '#388e3c' : 'var(--text-secondary)', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                ✅ Sí
              </button>
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, es_federado: false }))}
                style={{ flex: 1, padding: '10px', border: '2px solid', borderColor: !formData.es_federado ? '#d32f2f' : 'var(--border)', background: !formData.es_federado ? '#fff3f3' : 'var(--bg-card)', color: !formData.es_federado ? '#d32f2f' : 'var(--text-secondary)', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                ❌ No
              </button>
            </div>

            {errorMsg && <p style={{ color: 'red', marginBottom: '10px' }}>{errorMsg}</p>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  (!!(String(formData.alias || '').trim()) && (aliasVerificando || aliasDuplicado))
                }
                style={{
                  flex: 1,
                  padding: '11px',
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  opacity:
                    isSubmitting || (!!(String(formData.alias || '').trim()) && (aliasVerificando || aliasDuplicado))
                      ? 0.6
                      : 1,
                }}
              >
                {isSubmitting
                  ? 'Guardando...'
                  : torneoIdValido
                    ? t('perfil.flow.saveReturnTournament')
                    : '✅ Guardar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingFotoFileRef.current = null;
                  setFotoPendienteDeSubir(false);
                  setAliasDuplicado(false);
                  setAliasVerificando(false);
                  setAliasDisponible(false);
                  setAliasSuggestions([]);
                  setAliasSugerenciasCargando(false);
                  setEditando(false);
                  setErrorMsg('');
                  setFotoPreview((prev) => {
                    if (prev && String(prev).startsWith('blob:')) URL.revokeObjectURL(prev);
                    return null;
                  });
                  setWaConfirmLocal('');
                  setWaNumeroLocal('');
                  setWaCodigoPais('+54');
                  waTorneoFormInitRef.current = false;
                  setPassRegistroTorneo('');
                  setPassRegistroTorneo2('');
                  setCompaneroBusqueda('');
                  setCompaneroOpciones([]);
                  setCompaneroMenuAbierto(false);
                  setCompaneroSeleccionado(null);
                  setFormData((prev) => {
                    const na = nombreApellidoEditDesdePerfilRow(perfil || {});
                    return {
                      ...prev,
                      nombre: na.nombre,
                      apellido: na.apellido,
                      companero_id: perfil?.companero_id != null && String(perfil.companero_id).trim()
                        ? String(perfil.companero_id).trim()
                        : null,
                      lateralidad: perfil?.lateralidad || prev.lateralidad,
                      nivel: perfil?.nivel || prev.nivel,
                      pais: perfil?.pais || '',
                      localidad: perfil?.localidad != null ? String(perfil.localidad) : '',
                      ciudad: perfil?.ciudad || '',
                      alias: perfil?.alias != null ? String(perfil.alias) : '',
                      apodo:
                        String(perfil?.apodo ?? '').trim() ||
                        (perfil?.nombre_saludo != null ? String(perfil.nombre_saludo) : ''),
                      instagram: instagramHandleFromStored(perfil?.instagram_url),
                      fecha_nacimiento: fechaNacimientoDesdeDb(perfil?.fecha_nacimiento) || '',
                      numero_fipa: perfil?.numero_fipa || '',
                      es_federado: perfil?.es_federado || false,
                      mostrar_torneos_jugados: Boolean(perfil?.mostrar_torneos_jugados),
                      busca_companero: Boolean(perfil?.busca_companero),
                      deportes_preferidos: normalizeDeportesPreferidosArray(perfil?.deportes_preferidos),
                    };
                  });
                }}
                style={{ flex: 1, padding: '11px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '5px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>

            <div
              style={{
                marginTop: '22px',
                paddingTop: '18px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <h4
                style={{
                  margin: '0 0 12px',
                  color: 'var(--text-primary)',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '8px',
                }}
              >
                Deportes que practico
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: 0, marginBottom: '8px', lineHeight: 1.4 }}>
                Selecciona los deportes que practicas (opcional). Mejoran las sugerencias del asistente.
              </p>
              <div id="mi-perfil-deportes-chips">
                <DeportesPreferidosChips
                  value={formData.deportes_preferidos}
                  onChange={(next) =>
                    setFormData((prev) => ({
                      ...prev,
                      deportes_preferidos: normalizeDeportesPreferidosArray(next),
                    }))
                  }
                  disabled={isSubmitting}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (!!(String(formData.alias || '').trim()) && (aliasVerificando || aliasDuplicado))
                  }
                  style={{
                    flex: 1,
                    padding: '11px',
                    background: '#d32f2f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    opacity:
                      isSubmitting || (!!(String(formData.alias || '').trim()) && (aliasVerificando || aliasDuplicado))
                        ? 0.6
                        : 1,
                  }}
                >
                  {isSubmitting
                    ? 'Guardando...'
                    : torneoIdValido
                      ? t('perfil.flow.saveReturnTournament')
                      : '✅ Guardar'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {perfil && typeof perfil === 'object' && !editando ? (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
            marginBottom: '16px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            border: '1px solid var(--border)',
          }}
        >
          <h4
            style={{
              margin: '0 0 12px',
              color: 'var(--text-primary)',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '8px',
            }}
          >
            Deportes que practico
          </h4>
          {hasDeportesPreferidosCargados(perfil?.deportes_preferidos) ? (
            <DeportesPreferidosLecturaChips keys={perfil.deportes_preferidos} />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditando(true);
                window.setTimeout(() => {
                  document.getElementById('mi-perfil-deportes-chips')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                }, 150);
              }}
              style={{
                display: 'inline-block',
                padding: '10px 18px',
                background: '#E11B22',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              Agregar deportes
            </button>
          )}
        </div>
      ) : null}

      {/* Estadísticas: puntos por alcance + resumen backend (torneos finalizados, racha, reservas, etc.). */}
      {perfil && typeof perfil === 'object' ? (() => {
        const flagTorneosPub = editando ? !!formData.mostrar_torneos_jugados : !!perfil?.mostrar_torneos_jugados;
        const hayPuntosNivel = tieneAlgunoPuntosPorAlcance(puntosAlcanceMiPerfil);
        const st = estadisticasMiPerfil && typeof estadisticasMiPerfil === 'object' ? estadisticasMiPerfil : {};
        const aliasStats = String(perfil?.alias || '').trim();
        const torneosTot = torneosJugadosTotalDesdeEstadisticas(st);
        const depsList = Array.isArray(st.deportes_jugados) ? st.deportes_jugados : [];
        const rowStats =
          aliasStats && torneosTot > 0
            ? sliceEstadisticasJugadorTorneo(st, estadisticasDeporteTab) || st
            : st;
        const mostrarTabsDeporteStats = Boolean(aliasStats && torneosTot > 0 && depsList.length > 1);
        const gridItems = [
          {
            k: 'torneos',
            label: t('perfil.torneosJugados'),
            value: estadisticasMiPerfilLoading ? '…' : `${Number(rowStats?.torneos_jugados) || 0}`,
            sub:
              !aliasStats
                ? t('perfil.definePublicAlias')
                : Number(rowStats?.torneos_ganados) > 0
                  ? `${rowStats.torneos_ganados} ganado${Number(rowStats.torneos_ganados) === 1 ? '' : 's'}`
                  : t('perfil.torneosFinalizados'),
          },
          {
            k: 'partidos',
            label: t('perfil.partidosJugados'),
            value: estadisticasMiPerfilLoading ? '…' : `${Number(rowStats?.partidos_jugados) || 0}`,
            sub:
              !aliasStats
                ? '—'
                : Number(rowStats?.partidos_jugados) > 0
                  ? `${Number(rowStats.partidos_ganados) || 0} victorias`
                  : t('perfil.enTorneosFinalizados'),
          },
          {
            k: 'win',
            label: t('perfil.winRate'),
            value:
              estadisticasMiPerfilLoading || !aliasStats
                ? '—'
                : Number(rowStats?.partidos_jugados) > 0
                  ? `${rowStats.win_rate_pct}%`
                  : '—',
            sub: t('perfil.victoriasJugados'),
          },
          {
            k: 'pts',
            label: t('perfil.puntosRankingLabel'),
            value:
              estadisticasMiPerfilLoading || !aliasStats
                ? '—'
                : Number(rowStats?.puntos_ranking_total) > 0
                  ? `${rowStats.puntos_ranking_total}`
                  : '—',
            sub: depsList.length > 1 ? 'Tabla (deporte seleccionado)' : t('perfil.totalTablaPuntos'),
          },
          {
            k: 'racha',
            label: t('perfil.rachaActual'),
            value:
              estadisticasMiPerfilLoading || !aliasStats
                ? '—'
                : Number(rowStats?.racha_victorias_consecutivas) > 0
                  ? `${rowStats.racha_victorias_consecutivas}`
                  : '—',
            sub:
              !aliasStats
                ? '—'
                : Number(rowStats?.racha_victorias_consecutivas) > 0
                  ? `Partido${rowStats.racha_victorias_consecutivas === 1 ? '' : 's'} ganado${
                      rowStats.racha_victorias_consecutivas === 1 ? '' : 's'
                    } seguidos`
                  : t('perfil.sinRachaActiva'),
          },
          {
            k: 'mejor',
            label: t('perfil.mejorResultado'),
            value:
              estadisticasMiPerfilLoading || !aliasStats ? '—' : rowStats?.mejor_resultado || '—',
            sub: depsList.length > 1 ? 'En este deporte' : t('perfil.mejorTorneoTabla'),
          },
          {
            k: 'deporte',
            label: depsList.length > 1 ? t('perfil.sportTab') : t('perfil.mainSport'),
            value:
              estadisticasMiPerfilLoading || !aliasStats ? '—' : rowStats?.deporte_mas_jugado || '—',
            sub: depsList.length > 1 ? t('perfil.activeTab') : t('perfil.porTorneosJugados'),
          },
          {
            k: 'sedeRes',
            label: t('perfil.mostFrequentVenue'),
            value:
              estadisticasMiPerfilLoading || !aliasStats
                ? '—'
                : rowStats?.sede_mas_frecuentada_reservas?.nombre || '—',
            sub:
              !aliasStats
                ? '—'
                : rowStats?.sede_mas_frecuentada_reservas?.reservas_en_sede != null
                  ? `${rowStats.sede_mas_frecuentada_reservas.reservas_en_sede} reserva${
                      rowStats.sede_mas_frecuentada_reservas.reservas_en_sede === 1 ? '' : 's'
                    }`
                  : t('perfil.porReservas'),
          },
        ];
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>{t('perfil.statsTitle')}</h4>
            {mostrarTabsDeporteStats ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                {depsList.map((d) => {
                  const active = estadisticasDeporteTab === d.deporte;
                  return (
                    <button
                      key={d.deporte}
                      type="button"
                      onClick={() => setEstadisticasDeporteTab(d.deporte)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: active ? 'rgba(225, 27, 34, 0.12)' : 'var(--bg-page)',
                        fontWeight: 800,
                        fontSize: '13px',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {etiquetaDeporteTorneo(d.deporte)}{' '}
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>({d.puntos})</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {hayPuntosNivel ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                {puntosAlcanceMiPerfil.club > 0 ? (
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <IconGeroUbicacion size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <span>
                      Puntos Club: <span style={{ color: '#15803d' }}>{puntosAlcanceMiPerfil.club}</span>
                    </span>
                  </div>
                ) : null}
                {puntosAlcanceMiPerfil.nacional > 0 ? (
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    🌎 Puntos Nacional: <span style={{ color: '#15803d' }}>{puntosAlcanceMiPerfil.nacional}</span>
                  </div>
                ) : null}
                {puntosAlcanceMiPerfil.fipa > 0 ? (
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    🌐 Puntos FIPA: <span style={{ color: '#15803d' }}>{puntosAlcanceMiPerfil.fipa}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {t('perfil.puntosRanking')}{' '}
                <span style={{ color: 'var(--text-secondary)' }}>—</span>
              </p>
            )}
            {!aliasStats ? (
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
                Define tu alias público en la ficha para calcular torneos, partidos y racha.
              </p>
            ) : null}
            <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '10px',
              }}
            >
              {gridItems.map((c) => (
                <div
                  key={c.k}
                  style={{
                    background: 'var(--bg-page)',
                    borderRadius: '12px',
                    padding: '14px 12px',
                    border: '1px solid var(--border)',
                    textAlign: 'center',
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{c.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '6px', lineHeight: 1.15 }}>{c.value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 600 }}>{c.sub}</div>
                </div>
              ))}
            </div>
            <p
              style={{
                margin: '14px 0 0',
                fontSize: '13px',
                color: estadisticasMiPerfilLoading ? 'var(--text-secondary)' : 'var(--text-secondary)',
                textAlign: 'center',
                fontWeight: 600,
              }}
            >
              {t('perfil.sedeHabitual')}{' '}
              <span style={{ color: 'var(--text-primary)' }}>
                {estadisticasMiPerfilLoading ? '…' : rowStats?.sede_habitual?.nombre || '—'}
              </span>
            </p>
            </>
            {flagTorneosPub ? (
              <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 600 }}>
                En tu perfil público también se muestran torneos con puntos:{' '}
                <span style={{ color: '#15803d' }}>{torneosUnicosConPuntosMiPerfil}</span>
              </p>
            ) : null}
          </div>
        );
      })() : null}

      {/* Credit balance */}
      {creditTotal > 0 && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 14px', color: '#15803d', borderBottom: '1px solid #bbf7d0', paddingBottom: '8px' }}>{t('perfil.creditsTitle')}</h4>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#16a34a', marginBottom: creditItems.length ? '14px' : 0 }}>
            ${creditTotal.toLocaleString('es-AR')} <span style={{ fontSize: '14px', fontWeight: 600, color: '#4ade80' }}>ARS</span>
          </div>
          {creditItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {creditItems.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#166534', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px' }}>
                  <span>📅 {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  <span style={{ fontWeight: 700 }}>+${Number(c.monto).toLocaleString('es-AR')}</span>
                  <span style={{ color: '#86efac' }}>vence {new Date(c.vence_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {torneosConPuntosMiPerfil.length > 0 && !ocultarUiJugadorPorAdmin ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>🏆 Mis Torneos</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(mostrarTodosTorneosMiPerfil ? torneosConPuntosMiPerfil : torneosConPuntosMiPerfil.slice(0, 5)).map((row) => {
              const med = emojiMedallaPosicionCompacta(row.posicion);
              const nivelTxt = formatNivelTorneo(row.nivel_torneo);
              const pts = row.puntos != null ? row.puntos : '—';
              return (
                <button
                  key={`${row.torneo_id}-${row.equipo_id}`}
                  type="button"
                  onClick={() => navigate(`/torneo/${row.torneo_id}`)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-page)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    overflow: 'hidden',
                    minHeight: 0,
                  }}
                >
                  <span style={{ flexShrink: 0, lineHeight: 1.2 }}>{med}</span>
                  <span
                    style={{
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {row.nombreTorneo}
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {` · ${nivelTxt} · ${pts} pts · ${row.fechaMostrar}`}
                  </span>
                </button>
              );
            })}
          </div>
          {torneosConPuntosMiPerfil.length > 5 ? (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setMostrarTodosTorneosMiPerfil((v) => !v)}
                style={{
                  padding: '10px 18px',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-page)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {mostrarTodosTorneosMiPerfil ? t('perfil.flow.showLess') : t('perfil.flow.showAll')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Próximas reservas (jugador) */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 20px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setMisReservasColapsado((v) => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            margin: 0,
            padding: '10px 0 12px',
            border: 'none',
            borderBottom: misReservasColapsado ? 'none' : '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          <span>
            📋 {t('perfil.misProximasReservas', { count: reservasProximasOrdenadas.length })}{' '}
            {misReservasColapsado ? '▼' : '▲'}
          </span>
        </button>
        {!misReservasColapsado && reservasProximasOrdenadas.length === 0 ? (
          <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 12px', fontSize: '14px', fontWeight: 600 }}>{t('perfil.noUpcomingBookings')}</p>
            <button
              type="button"
              onClick={() => navigate('/reservar')}
              style={{
                fontSize: '14px',
                fontWeight: 700,
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                background: '#E11B22',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Reservar ahora
            </button>
          </div>
        ) : null}
        {!misReservasColapsado && reservasProximasOrdenadas.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {reservasProximasOrdenadas.map((r) => {
              const horasHasta = (new Date(`${r.fecha}T${r.hora}:00-03:00`) - Date.now()) / (1000 * 60 * 60);
              const canCancel = horasHasta > 2 && r.estado !== 'cancelada';
              const mon = String(r.moneda || 'ARS').trim().toUpperCase();
              const montoNum = r.monto_pagado != null && r.monto_pagado !== '' ? Number(r.monto_pagado) : Number(r.precio) || 0;
              const mpId = String(r.mp_payment_id || '').trim();
              const esConfirmada = String(r.estado || '').trim().toLowerCase() === 'confirmada';
              return (
                <div key={r.id} style={{ background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        📅 {r.fecha} &nbsp;⏰ {r.hora}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginTop: '6px' }}>{r.sede}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>⚽ Cancha {r.cancha}</div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: r.estado === 'confirmada' ? '#dcfce7' : r.estado === 'cancelada' ? '#fee2e2' : r.estado === 'test' ? '#f3f4f6' : '#fef9c3',
                        color: r.estado === 'confirmada' ? '#16a34a' : r.estado === 'cancelada' ? '#dc2626' : r.estado === 'test' ? '#6b7280' : '#854d0e',
                      }}
                    >
                      {r.estado || 'reservada'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#b91c1c' }}>
                    Monto pagado: {montoNum > 0 ? `${Number(montoNum).toLocaleString('es-AR')} ${mon}` : '—'}
                  </div>
                  {mpId ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                      ID transacción MP: <span style={{ fontFamily: 'monospace' }}>{mpId}</span>
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {puedeMostrarComprobanteMp(r) ? (
                      <a
                        href={urlComprobanteMercadoPagoReserva(r)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: '#0ea5e9',
                          color: '#fff',
                          textDecoration: 'none',
                          display: 'inline-block',
                        }}
                      >
                        Ver comprobante
                      </a>
                    ) : null}
                    {esConfirmada ? (
                      <button
                        type="button"
                        onClick={() => setReservaQrModal(r)}
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontFamily: 'inherit',
                        }}
                      >
                        <span aria-hidden>▦</span>
                        {t('checkin.verQr')}
                      </button>
                    ) : null}
                    {canCancel ? (
                      <button
                        type="button"
                        onClick={() => setReservaCancelModal(r)}
                        disabled={cancelando === r.id}
                        style={{ fontSize: '11px', padding: '6px 10px', border: '1px solid #fca5a5', borderRadius: '6px', background: 'var(--bg-card)', color: '#dc2626', cursor: 'pointer', fontWeight: 600, opacity: cancelando === r.id ? 0.6 : 1 }}
                      >
                        {cancelando === r.id ? 'Cancelando...' : t('general.cancel')}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {session?.access_token && session?.user?.id ? (
        <InstructorFipaSection
          accessToken={session.access_token}
          userId={session.user.id}
          prefill={{
            nombre: formData.nombre || perfil?.nombre,
            apellido: formData.apellido || perfil?.apellido,
            genero: formData.genero || perfil?.genero,
            fecha_nacimiento: formData.fecha_nacimiento || perfil?.fecha_nacimiento,
            whatsappCodigo: waCodigoPais,
            whatsappLocal: waNumeroLocal,
            whatsappFull: perfil?.whatsapp || userProfile?.whatsapp,
          }}
        />
      ) : null}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 20px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setMisClasesColapsado((v) => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            margin: 0,
            padding: '10px 0 12px',
            border: 'none',
            borderBottom: misClasesColapsado ? 'none' : '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          <span>
            🎓 Mis clases ({misClases.length}) {misClasesColapsado ? '▼' : '▲'}
          </span>
        </button>
        {!misClasesColapsado && misClasesLoading ? (
          <p style={{ color: 'var(--text-secondary)', margin: '12px 0 0', fontSize: '14px' }}>{t('general.loading')}</p>
        ) : null}
        {!misClasesColapsado && !misClasesLoading && misClases.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: '12px 0 0', fontSize: '14px', fontWeight: 600 }}>
            No tenés clases inscriptas.
          </p>
        ) : null}
        {!misClasesColapsado && !misClasesLoading && misClases.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {misClases.map((c) => {
              const asistioLabel =
                c.asistio === true ? t('perfil.flow.attended') : c.asistio === false ? t('perfil.flow.notAttended') : t('perfil.flow.attendancePending');
              const hora = normalizeHoraClase(c.hora_inicio) || c.hora_inicio || '—';
              return (
                <div
                  key={c.id}
                  style={{
                    background: 'var(--bg-page)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '14px' }}>{c.clase_titulo || 'Clase'}</div>
                  <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                    {c.profesor_nombre || '—'}
                    {c.sede_nombre ? ` · ${c.sede_nombre}` : ''}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    📅 {c.fecha} · ⏰ {hora}
                  </div>
                  <div style={{ marginTop: '6px', fontWeight: 700 }}>{asistioLabel}</div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      </div>

      <ConfirmCancelReservaModal
        open={!!reservaCancelModal}
        title={t("perfil.cancelBookingTitle")}
        message={t("perfil.cancelBookingBody")}
        confirmLabel={t("perfil.cancelBookingConfirm")}
        dismissLabel={t('perfil.flow.keepBooking')}
        onDismiss={() => setReservaCancelModal(null)}
        onConfirm={() => {
          const r = reservaCancelModal;
          setReservaCancelModal(null);
          if (r) void handleCancelar(r);
        }}
      />

      <ReservaQrModal
        open={Boolean(reservaQrModal)}
        reserva={reservaQrModal}
        accessToken={session?.access_token ?? null}
        apiBaseUrl={API_BASE_URL}
        onClose={() => setReservaQrModal(null)}
        onTokenResolved={(reservaId, token) => {
          setReservas((prev) =>
            (Array.isArray(prev) ? prev : []).map((row) =>
              row.id === reservaId ? { ...row, qr_token: token } : row,
            ),
          );
        }}
      />

      {fotoAccionModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={fotoAccionModalStep === 'menu' ? 'mi-perfil-foto-accion-titulo' : undefined}
          aria-label={fotoAccionModalStep === 'avatars' ? 'Elige un avatar predeterminado' : undefined}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 19900,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box',
          }}
          onClick={(ev) => {
            if (ev.target === ev.currentTarget && !guardandoFoto) cerrarFotoAccionModal();
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: fotoAccionModalStep === 'avatars' ? 400 : 360,
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '20px 18px 16px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              boxSizing: 'border-box',
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            {fotoAccionModalStep === 'menu' ? (
              <>
                <h3 id="mi-perfil-foto-accion-titulo" style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', textAlign: 'center' }}>
                  Foto de perfil
                </h3>
                <button
                  type="button"
                  disabled={guardandoFoto}
                  onClick={() => {
                    cerrarFotoAccionModal();
                    window.setTimeout(() => fileInputRef.current?.click(), 0);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginBottom: '10px',
                    padding: '14px 16px',
                    fontSize: '15px',
                    fontWeight: 800,
                    textAlign: 'left',
                    borderRadius: '12px',
                    border: '2px solid #22c55e',
                    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                    color: '#14532d',
                    cursor: guardandoFoto ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Elegir foto
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, opacity: 0.9, marginTop: '4px' }}>
                    Sube una imagen desde tu dispositivo
                  </span>
                </button>
                <button
                  type="button"
                  disabled={guardandoFoto}
                  onClick={() => setFotoAccionModalStep('avatars')}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginBottom: '10px',
                    padding: '14px 16px',
                    fontSize: '15px',
                    fontWeight: 800,
                    textAlign: 'left',
                    borderRadius: '12px',
                    border: '2px solid #E11B22',
                    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                    color: '#991b1b',
                    cursor: guardandoFoto ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Usar avatar
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, opacity: 0.9, marginTop: '4px' }}>
                    Elige un dibujo predeterminado
                  </span>
                </button>
                <button
                  type="button"
                  disabled={guardandoFoto || !puedeEliminarFotoPerfil}
                  onClick={() => void aplicarFotoUrlASesion(null)}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginBottom: '12px',
                    padding: '14px 16px',
                    fontSize: '15px',
                    fontWeight: 800,
                    textAlign: 'left',
                    borderRadius: '12px',
                    border: '2px solid #fecaca',
                    background: puedeEliminarFotoPerfil ? '#fef2f2' : '#f1f5f9',
                    color: puedeEliminarFotoPerfil ? '#991b1b' : '#94a3b8',
                    cursor: guardandoFoto || !puedeEliminarFotoPerfil ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Eliminar foto
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, opacity: 0.9, marginTop: '4px' }}>
                    Vuelve al avatar por defecto
                  </span>
                </button>
                <button
                  type="button"
                  disabled={guardandoFoto}
                  onClick={cerrarFotoAccionModal}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: guardandoFoto ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Cancelar
                </button>
                {guardandoFoto ? (
                  <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Guardando…
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    disabled={guardandoFoto}
                    onClick={() => setFotoAccionModalStep('menu')}
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      fontWeight: 800,
                      cursor: guardandoFoto ? 'default' : 'pointer',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                    }}
                  >
                    ← Atrás
                  </button>
                  <h3 style={{ margin: 0, flex: 1, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', textAlign: 'center' }}>
                    Elige un avatar
                  </h3>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    marginBottom: '8px',
                  }}
                >
                  {PRESET_PROFILE_AVATAR_URLS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={guardandoFoto}
                      onClick={() => void aplicarFotoUrlASesion(url)}
                      style={{
                        aspectRatio: '1',
                        borderRadius: '14px',
                        border: '2px solid var(--border)',
                        padding: 0,
                        overflow: 'hidden',
                        cursor: guardandoFoto ? 'default' : 'pointer',
                        background: 'var(--bg-card)',
                      }}
                      aria-label={`Avatar predeterminado ${idx + 1}`}
                    >
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                  ))}
                </div>
                {guardandoFoto ? (
                  <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Guardando…
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {cropModalOpen && cropImageSrc ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-recorte-foto"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 20000,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) cerrarModalRecorte();
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: 'var(--bg-card)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)' }}>
              <h3 id="titulo-recorte-foto" style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                Recortar foto
              </h3>
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Mueve la imagen con el dedo y pellizca para acercar o alejar. Confirma cuando quede bien el rostro.
              </p>
            </div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 'min(56vh, 360px)',
                background: '#0f172a',
              }}
            >
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div style={{ padding: '14px 18px 18px' }}>
              <label
                htmlFor="mi-perfil-crop-zoom"
                style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}
              >
                Zoom
              </label>
              <input
                id="mi-perfil-crop-zoom"
                type="range"
                min={1}
                max={3}
                step={0.02}
                value={zoom}
                onChange={(ev) => setZoom(Number(ev.target.value))}
                style={{ width: '100%', marginBottom: '16px' }}
              />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={cerrarModalRecorte}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '12px 16px',
                    fontSize: '15px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!cropAreaListo}
                  onClick={() => void handleConfirmarRecorte()}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '12px 16px',
                    fontSize: '15px',
                    fontWeight: 700,
                    borderRadius: '10px',
                    border: 'none',
                    background: cropAreaListo ? '#15803d' : '#94a3b8',
                    color: '#fff',
                    cursor: cropAreaListo ? 'pointer' : 'default',
                  }}
                >
                  Confirmar recorte
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <JugadorPreviewModal
        open={Boolean(jugadorPreviewMiCompanero)}
        onClose={() => setJugadorPreviewMiCompanero(null)}
        data={jugadorPreviewMiCompanero}
      />

      {session?.user ? (
        <div style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '8px 16px 4px', boxSizing: 'border-box' }}>
          <button
            type="button"
            onClick={() => setModalConfirmarCerrarSesion(true)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 8px',
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '13px',
              fontWeight: 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'center',
            }}
          >
            {t('auth.cerrar_sesion')}
          </button>
        </div>
      ) : null}

      <ConfirmModal
        open={modalConfirmarCerrarSesion}
        title={t('auth.logoutConfirm')}
        confirmLabel={t('general.yes')}
        dismissLabel={t('general.cancel')}
        onDismiss={() => setModalConfirmarCerrarSesion(false)}
        onConfirm={() => {
          setModalConfirmarCerrarSesion(false);
          signOutAndClear();
          navigate('/');
        }}
        titleId="cerrar-sesion-titulo"
      />

      <BottomNav />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '9px 0',
        borderBottom: '1px solid var(--border)',
        gap: '12px',
      }}
    >
      <span style={{ color: 'var(--text-secondary)', fontSize: '13px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '14px', color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Badge({ text, color }) {
  return (
    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: 'white', background: color }}>
      {text}
    </span>
  );
}
