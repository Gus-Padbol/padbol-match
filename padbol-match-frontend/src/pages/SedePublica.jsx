import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { canUseNavigatorShare } from '../components/ShareLinkButton';
import BottomNav from '../components/BottomNav';
import HubSponsorsTicker from '../components/HubSponsorsTicker';
import {
  hubContentPaddingTopCss,
  hubInstagramColumnWrapStyle,
  hubMainPaddingBottomCss,
  hubScrollChromeTopExtraPx,
  resolveSedePublicaBackToPath,
} from '../constants/hubLayout';
import { isUserHomeHubPath, scheduleHubEntryScrollReset } from '../utils/hubEntryScrollReset';
import { useAuth } from '../context/AuthContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { useSedeTickerSponsors } from '../hooks/useSedeTickerSponsors';
import useUserRole from '../hooks/useUserRole';
import { supabase } from '../supabaseClient';
import { IconGeroUbicacion } from '../components/icons/GeroIcons';
import { getDisplayName } from '../utils/displayName';
import { badgeTorneoEstadoPublico } from '../utils/torneoEstadoPublico';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { DeporteIcono } from '../utils/deporteIcono';
import {
  esInscripcionAbiertaTorneo,
  esEstadoEnCursoTorneo,
  estadoTorneoNormalizado,
} from '../utils/torneoEstadoFiltroPills';
import { torneoFechaInicioYmd, ymdTodayTorneoTz } from '../utils/torneoFechaInicioArt';
import { fetchProfesores } from '../utils/clasesApi';
import { usePadbolI18n } from '../context/PadbolI18nContext';
import PartidoAbiertoCard from '../components/PartidoAbiertoCard';
import { resolveSedeAmenityChips } from '../constants/sedeAmenities';
import './SedePublica.css';

const API_BASE_SEDE =
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com';

const PHOTO_STRIP_H = 120;
const MAP_THUMB_MAX_H = 120;

const PADBOL_PAGE_GRADIENT = 'var(--bg-page)';
const FOTOS_DESTACADAS_MAX = 4;

const toHttps = (url) => (url ? url.replace(/^http:\/\//, 'https://') : url);

const SEDE_HTTPS_SCALAR_KEYS = [
  'logo_url',
  'whatsapp_url',
  'whatsapp',
  'instagram',
  'facebook',
  'tiktok',
  'twitter',
  'youtube',
  'website',
];

function parseSedeCoord(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Normaliza URLs http→https al cargar sede (evita mixed content en /sede/:id). */
function normalizeSedeHttps(sede) {
  if (!sede || typeof sede !== 'object') return sede;
  const out = { ...sede };
  for (const k of SEDE_HTTPS_SCALAR_KEYS) {
    if (out[k] != null && String(out[k]).trim()) {
      out[k] = toHttps(String(out[k]).trim());
    }
  }
  if (Array.isArray(out.fotos_urls)) {
    out.fotos_urls = out.fotos_urls
      .map((u) => toHttps(String(u || '').trim()))
      .filter(Boolean);
  }
  if (Array.isArray(out.fotos_destacadas)) {
    out.fotos_destacadas = out.fotos_destacadas
      .map((u) => toHttps(String(u || '').trim()))
      .filter(Boolean);
  }
  out.latitud = parseSedeCoord(out.latitud);
  out.longitud = parseSedeCoord(out.longitud);
  return out;
}

function torneoImagenPublicaUrl(torneo) {
  if (!torneo) return null;
  const u = String(torneo.foto_url || torneo.imagen_url || '').trim();
  return u ? toHttps(u) : null;
}

function sedePhotoUrlKey(url) {
  return toHttps(String(url || '').trim());
}

/** Evita imagen en caché tras cambiar hero (misma URL en Storage). */
function sedePhotoUrlWithCacheBust(url, bust) {
  const u = sedePhotoUrlKey(url);
  if (!u) return u;
  const token =
    bust != null && String(bust).trim() !== '' ? String(bust).trim() : String(Date.now());
  const sep = u.includes('?') ? '&' : '?';
  return `${u}${sep}t=${encodeURIComponent(token)}`;
}

/** Design System Gero — perfil público de sede (tema claro/oscuro vía CSS variables). */
const SEDE_DS = {
  pageBg: 'var(--bg-page)',
  title: 'var(--text-primary)',
  subtitle: 'var(--text-secondary)',
  cardBg: 'var(--bg-card)',
  cardBorder: 'var(--border)',
  cardRadius: '12px',
  brand: 'var(--accent)',
};

/** CTAs principales: no al borde lateral, centrados. */
const SEDE_CTA_NARROW_CENTERED = {
  width: '85%',
  maxWidth: '100%',
  marginLeft: 'auto',
  marginRight: 'auto',
  display: 'block',
  boxSizing: 'border-box',
};

const SEDE_BTN_RESERVAR_CANCHA_STYLE = {
  width: '100%',
  padding: '14px 16px',
  background: SEDE_DS.brand,
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: '15px',
  boxShadow: '0 4px 14px rgba(225, 27, 34, 0.35)',
  boxSizing: 'border-box',
};

/** CTA secundario «Ver torneos»: borde y texto rojo, fondo blanco. */
const SEDE_BTN_VER_TORNEOS_STYLE = {
  padding: '12px 16px',
  background: 'var(--bg-card)',
  color: SEDE_DS.brand,
  border: `2px solid ${SEDE_DS.brand}`,
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: '14px',
  boxSizing: 'border-box',
};

function formatFechaIsoPublicaSede(iso) {
  const s = String(iso || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  if (![y, m, d].every((n) => Number.isFinite(n))) return '—';
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** «15 de mayo» para fila de próximo torneo en la ficha pública. */
function formatFechaDiaMesPublica(iso, lang) {
  const s = String(iso || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  if (![y, m, d].every((n) => Number.isFinite(n))) return '';
  const locale = String(lang || 'es').toLowerCase().startsWith('en') ? 'en-US' : 'es-AR';
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

function esEstadoTorneoProximoInfo(estadoRaw) {
  const e = estadoTorneoNormalizado(estadoRaw);
  if (e === 'finalizado' || e === 'cancelado') return false;
  return (
    e === 'activo' ||
    e === 'inscripcion' ||
    esEstadoEnCursoTorneo(estadoRaw) ||
    esInscripcionAbiertaTorneo(estadoRaw)
  );
}

function pickProximoTorneoInfoClub(torneos) {
  const hoy = ymdTodayTorneoTz();
  if (!hoy || !Array.isArray(torneos)) return null;
  const candidatos = torneos.filter((t) => {
    if (!esEstadoTorneoProximoInfo(t?.estado)) return false;
    const ymd = torneoFechaInicioYmd(t?.fecha_inicio);
    return ymd && ymd >= hoy;
  });
  candidatos.sort((a, b) =>
    String(a?.fecha_inicio || '').localeCompare(String(b?.fecha_inicio || ''))
  );
  return candidatos[0] ?? null;
}

function pickTorneosProximosSede(torneos, max = 3) {
  const hoy = ymdTodayTorneoTz();
  if (!hoy || !Array.isArray(torneos)) return [];
  return torneos
    .filter((t) => {
      if (String(t?.estado || '').toLowerCase() === 'finalizado') return false;
      const ymd = torneoFechaInicioYmd(t?.fecha_inicio);
      return ymd && ymd >= hoy;
    })
    .sort((a, b) => String(a?.fecha_inicio || '').localeCompare(String(b?.fecha_inicio || '')))
    .slice(0, max);
}

function SedeInfoChip({ emoji, label }) {
  return (
    <span className="sede-publica-info-chip">
      <span className="sede-publica-info-chip__emoji" aria-hidden>{emoji}</span>
      <span className="sede-publica-info-chip__text">{label}</span>
    </span>
  );
}

function SedeInfoTablerIcon({ children, size = 20 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function IconTrophy() {
  return (
    <SedeInfoTablerIcon>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10l1 7a4 4 0 0 1 -4 4h-4a4 4 0 0 1 -4 -4l1 -7z" />
      <path d="M12 11v-7" />
      <path d="M9 4v-3h6v3" />
    </SedeInfoTablerIcon>
  );
}

function IconLayoutGrid() {
  return (
    <SedeInfoTablerIcon>
      <path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      <path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      <path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      <path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
    </SedeInfoTablerIcon>
  );
}

function IconMapPin() {
  return (
    <SedeInfoTablerIcon>
      <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" />
    </SedeInfoTablerIcon>
  );
}

function IconClock() {
  return (
    <SedeInfoTablerIcon>
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M12 7v5l3 3" />
    </SedeInfoTablerIcon>
  );
}

function IconBrandWhatsapp() {
  return (
    <SedeInfoTablerIcon>
      <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9z" />
      <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
    </SedeInfoTablerIcon>
  );
}

function IconBrandInstagram() {
  return (
    <SedeInfoTablerIcon size={24}>
      <path d="M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z" />
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      <path d="M16.5 7.5v.01" />
    </SedeInfoTablerIcon>
  );
}

function IconBrandFacebook() {
  return (
    <SedeInfoTablerIcon size={24}>
      <path d="M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3z" />
    </SedeInfoTablerIcon>
  );
}

function IconBrandTiktok() {
  return (
    <SedeInfoTablerIcon size={24}>
      <path d="M9 12a4 4 0 1 0 4 4v-11a5 5 0 0 0 5 5" />
    </SedeInfoTablerIcon>
  );
}

function IconBrandX() {
  return (
    <SedeInfoTablerIcon size={24}>
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l7.272 -7.272" />
      <path d="M20 4l-16 16" />
    </SedeInfoTablerIcon>
  );
}

function IconBrandYoutube() {
  return (
    <SedeInfoTablerIcon size={24}>
      <path d="M2 8a4 4 0 0 1 4 -4h12a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-12a4 4 0 0 1 -4 -4z" />
      <path d="M10 9l5 3l-5 3z" />
    </SedeInfoTablerIcon>
  );
}

function IconWorld() {
  return (
    <SedeInfoTablerIcon size={24}>
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M3.6 9h16.8" />
      <path d="M3.6 15h16.8" />
      <path d="M11.5 3a17 17 0 0 0 0 18" />
      <path d="M12.5 3a17 17 0 0 1 0 18" />
    </SedeInfoTablerIcon>
  );
}

const SEDE_INFO_SOCIAL_META = [
  { key: 'instagram', Icon: IconBrandInstagram, label: 'Instagram' },
  { key: 'facebook', Icon: IconBrandFacebook, label: 'Facebook' },
  { key: 'tiktok', Icon: IconBrandTiktok, label: 'TikTok' },
  { key: 'twitter', Icon: IconBrandX, label: 'X' },
  { key: 'youtube', Icon: IconBrandYoutube, label: 'YouTube' },
  { key: 'website', Icon: IconWorld, label: 'Web' },
];

/** Tamaño del título del club en el hero según longitud del nombre. */
function heroClubNameFontSizePx(nombreRaw) {
  const len = String(nombreRaw ?? '').trim().length;
  if (len < 15) return 28;
  if (len <= 25) return 24;
  return 20;
}

/** Frase bajo el hero si la sede no tiene descripción en BD. */
const SEDE_HERO_FRASE_DEFAULT =
  'El primer Club de Padbol del Mundo, donde todo comenzó...';

/**
 * Margen extra bajo AppHeader + BottomNav + chrome del header (ref. hubLayout) + safe-area.
 * Incluye el mismo stack que {@link hubContentPaddingTopCss} más buffer de hero (`SEDE_PUBLIC_SCROLL_EXTRA_TOP_PX`).
 */
const SEDE_PUBLIC_SCROLL_EXTRA_TOP_PX = 52;

function formatHorario(apertura, cierre) {
  if (!apertura && !cierre) return null;
  if (apertura && cierre) return `${apertura} – ${cierre}`;
  return apertura || cierre;
}

function buildMapsSearchHref(direccion, ciudad, pais) {
  const parts = [direccion, ciudad, pais].filter(Boolean);
  if (!parts.length) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

/** Embed iframe: coordenadas WGS84 si existen; si no, búsqueda por dirección. */
function buildMapsEmbedSrc({ latitud, longitud, direccion, ciudad, pais, zoom = 16 }) {
  const lat = parseSedeCoord(latitud);
  const lon = parseSedeCoord(longitud);
  if (lat != null && lon != null) {
    return toHttps(`https://maps.google.com/maps?q=${lat},${lon}&z=${zoom}&output=embed`);
  }
  const parts = [direccion, ciudad, pais].filter(Boolean);
  if (!parts.length) return null;
  return toHttps(
    `https://maps.google.com/maps?q=${encodeURIComponent(parts.join(', '))}&z=${zoom}&output=embed`
  );
}

function buildOpenMapsHref(direccion, ciudad, pais, latitud, longitud) {
  const lat = parseSedeCoord(latitud);
  const lon = parseSedeCoord(longitud);
  if (lat != null && lon != null) {
    return `https://maps.google.com/?q=${lat},${lon}`;
  }
  return buildMapsSearchHref(direccion, ciudad, pais);
}

function sedeStatCountVisible(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}

/** Ítems visibles para «En números» (oculta ceros y null). */
function buildSedeEnNumerosItems(stats) {
  if (!stats || typeof stats !== 'object') return [];
  const items = [];
  const pushCount = (key, label, raw) => {
    if (!sedeStatCountVisible(raw)) return;
    items.push({
      key,
      label,
      value: Number(raw).toLocaleString('es-AR'),
    });
  };
  pushCount(
    'reservas',
    'Total reservas realizadas',
    stats.reservas_realizadas_total ?? stats.reservas_total,
  );
  pushCount('torneos', 'Total torneos jugados', stats.torneos_realizados_total);
  pushCount(
    'jugadores',
    'Total jugadores registrados en la sede',
    stats.jugadores_registrados_total ?? stats.jugadores_reservaron_total,
  );
  const promRaw = stats.promedio_resenas ?? stats.promedio;
  const prom = Number(promRaw);
  if (Number.isFinite(prom) && prom > 0) {
    items.push({ key: 'promedio', label: 'Promedio de reseñas', promedio: prom });
  }
  return items;
}

function sedeTieneSeccionEnNumeros(stats) {
  return buildSedeEnNumerosItems(stats).length > 0;
}

/** Misma prioridad que la app nativa: perfil → campos sede → canchas activas → deportes. */
function resolveSedeCanchasCount(sede, perfilCanchasCount = null) {
  const nPerfil = Number(perfilCanchasCount);
  if (Number.isFinite(nPerfil) && nPerfil > 0) return nPerfil;
  if (!sede || typeof sede !== 'object') return 0;
  const fromMeta = Number(sede.canchas_count ?? sede.canchas_activas_count ?? sede.num_canchas);
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;
  const cant = Number(sede.cantidad_canchas);
  if (Number.isFinite(cant) && cant > 0) return cant;
  const activas = Array.isArray(sede.canchas_activas) ? sede.canchas_activas : [];
  if (activas.length > 0) return activas.length;
  const deps = Array.isArray(sede.deportes_disponibles) ? sede.deportes_disponibles : [];
  if (deps.length > 0 && typeof deps[0] === 'object' && deps[0] != null) {
    const sum = deps.reduce((acc, row) => acc + (Number(row?.canchas_count) || 0), 0);
    if (sum > 0) return sum;
  }
  return 0;
}

const EMPTY_SEDE_RESENAS_PAYLOAD = {
  resenas: [],
  promedio: null,
  total: 0,
  ya_reseño: false,
  puede_reseñar: false,
};

/**
 * URLs del carrusel: `fotos_destacadas` en orden (máx. 4), solo si existen en `fotos_urls`;
 * si no, primeras 4 de la galería.
 */
function urlsCarruselSedePublica(sede) {
  const todas = Array.isArray(sede?.fotos_urls)
    ? sede.fotos_urls.map((u) => toHttps(String(u || '').trim())).filter(Boolean)
    : [];
  const dest = Array.isArray(sede?.fotos_destacadas)
    ? sede.fotos_destacadas.map((u) => toHttps(String(u || '').trim())).filter(Boolean)
    : [];
  const resolved = dest.filter((u) => todas.includes(u)).slice(0, FOTOS_DESTACADAS_MAX);
  if (resolved.length > 0) return { urls: resolved, usarOrden: true };
  return { urls: todas.slice(0, FOTOS_DESTACADAS_MAX), usarOrden: false };
}

/** Tres fotos visibles a la vez (~30% c/u + gap 8px); scroll horizontal si hay más. */
const CARRUSEL_GAP_PX = 8;
const CARRUSEL_SLIDE_BASIS = `calc((100% - ${2 * CARRUSEL_GAP_PX}px) / 3)`;

function sedeFotosLista(sede) {
  return Array.isArray(sede?.fotos_urls)
    ? sede.fotos_urls.map((u) => toHttps(String(u || '').trim())).filter(Boolean)
    : [];
}

/** Hero: `fotos_destacadas[0]` (elegida en admin); si no hay o no está en galería, primera foto. */
function sedeHeroImageUrl(sede) {
  const todas = sedeFotosLista(sede);
  const keys = new Set(todas.map(sedePhotoUrlKey));
  const dest = Array.isArray(sede?.fotos_destacadas)
    ? sede.fotos_destacadas.map((u) => sedePhotoUrlKey(u)).filter(Boolean)
    : [];
  if (dest.length > 0) {
    const heroKey = dest[0];
    if (keys.has(heroKey)) return heroKey;
    const loose = todas.find((u) => sedePhotoUrlKey(u) === heroKey);
    if (loose) return sedePhotoUrlKey(loose);
  }
  return todas[0] || null;
}

function sedeHeroCacheBustToken(sede) {
  const dest = Array.isArray(sede?.fotos_destacadas) ? sede.fotos_destacadas : [];
  const heroKey = dest[0] ? sedePhotoUrlKey(dest[0]) : '';
  const updated = sede?.updated_at ? String(sede.updated_at) : '';
  return [heroKey, updated, dest.join('|')].filter(Boolean).join('::') || String(Date.now());
}

/** Deportes activos: precios_por_deporte (activo) + canchas activas + API deportes_disponibles. */
function deportesActivosSedePublica(sede, preciosDeporteRows) {
  const keys = new Set();
  for (const row of preciosDeporteRows || []) {
    if (row?.activo === false) continue;
    const d = String(row.deporte || '').trim().toLowerCase();
    if (d) keys.add(d);
  }
  for (const c of Array.isArray(sede?.canchas_activas) ? sede.canchas_activas : []) {
    if (String(c?.estado || 'activa').toLowerCase() === 'inactiva') continue;
    const d = String(c.deporte || 'padbol').trim().toLowerCase();
    if (d) keys.add(d);
  }
  for (const d of Array.isArray(sede?.deportes_disponibles) ? sede.deportes_disponibles : []) {
    const k = String(d).trim().toLowerCase();
    if (k) keys.add(k);
  }
  return DEPORTES_CANCHA_SEDE_OPTIONS.filter((o) => keys.has(o.key));
}

/** Chips de deportes sobre el hero (esquina inferior derecha). */
function SedeDeportesChipsHero({ deportes, t }) {
  if (!deportes.length) return null;
  const aria = t('sedes.publica.deportesDisponibles', { defaultValue: 'Deportes disponibles' });
  return (
    <div className="sede-publica-hero-immersive__deportes" role="list" aria-label={aria}>
      {deportes.map((d) => (
        <span key={d.key} className="sede-publica-hero-immersive__deporte-chip" role="listitem">
          <DeporteIcono deporte={d.key} size={14} color="#fff" className="sede-publica-hero-immersive__deporte-icon" />
          {d.label}
        </span>
      ))}
    </div>
  );
}

function whatsappHrefSede(sede) {
  const link = String(sede?.whatsapp_url ?? sede?.whatsapp ?? '').trim();
  if (/^https?:\/\//i.test(link)) return toHttps(link);
  if (!sede?.telefono) return null;
  const digits = String(sede.telefono).replace(/\D/g, '');
  if (!digits) return null;
  const n = digits.startsWith('0') ? `54${digits.slice(1)}` : digits;
  return `https://wa.me/${n}`;
}

/** Galería horizontal: ~3 fotos visibles, flecha para ver más. */
function SedeGaleriaHorizontal({ fotos, onOpenAtIndex }) {
  const trackRef = useRef(null);
  const [canScrollMore, setCanScrollMore] = useState(false);

  const syncScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) {
      setCanScrollMore(false);
      return;
    }
    setCanScrollMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  }, []);

  useEffect(() => {
    syncScroll();
    const el = trackRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', syncScroll, { passive: true });
    window.addEventListener('resize', syncScroll);
    return () => {
      el.removeEventListener('scroll', syncScroll);
      window.removeEventListener('resize', syncScroll);
    };
  }, [fotos.length, syncScroll]);

  if (!fotos.length) return null;

  const scrollNext = () => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.querySelector('.sede-publica-galeria__slide');
    const step = (slide?.offsetWidth || 110) + 8;
    el.scrollBy({ left: step, behavior: 'smooth' });
  };

  return (
    <div className="sede-publica-galeria">
      <div ref={trackRef} className="sede-publica-galeria__track">
        {fotos.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            className="sede-publica-galeria__slide"
            onClick={() => onOpenAtIndex(i)}
            aria-label={`Ver foto ${i + 1}`}
          >
            <img src={toHttps(url)} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      {fotos.length > 3 ? (
        <button
          type="button"
          className="sede-publica-galeria__more"
          onClick={scrollNext}
          disabled={!canScrollMore}
          aria-label="Ver más fotos"
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

function SedeInfoRow({ icon, label, value }) {
  return (
    <div className="sede-publica-info-club__row">
      <div className="sede-publica-info-club__left">
        <span className="sede-publica-info-club__icon">{icon}</span>
        <span className="sede-publica-info-club__label">{label}</span>
      </div>
      <div className="sede-publica-info-club__value">{value}</div>
    </div>
  );
}

function instructorDisplayInitials(nombre) {
  const parts = String(nombre || '').trim().match(/\S+/g) || [];
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase().slice(0, 2);
  }
  return String(parts[0] || '?').slice(0, 2).toUpperCase();
}

function instructorDeportesList(deportes) {
  const list = Array.isArray(deportes) ? deportes : [];
  return list.map((d) => String(d || '').trim().toLowerCase()).filter(Boolean);
}

function instructorDeporteLabel(key) {
  const k = String(key || '').trim().toLowerCase();
  const opt = DEPORTES_CANCHA_SEDE_OPTIONS.find((o) => o.key === k);
  return opt?.label || k;
}

function instructorIncluyePadbol(deportes) {
  return instructorDeportesList(deportes).some((d) => d === 'padbol' || d.startsWith('padbol'));
}

function SedeInstructorCard({ instructor, t }) {
  const nombre = String(instructor?.nombre || '').trim();
  if (!nombre) return null;
  const foto = instructor?.foto_url ? toHttps(String(instructor.foto_url).trim()) : null;
  const deportes = instructorDeportesList(instructor.deportes);
  const certificadoFipa = Boolean(instructor.certificado_fipa);
  const badgeFipa = certificadoFipa && instructorIncluyePadbol(deportes);
  const badgeCert = certificadoFipa && !badgeFipa;

  return (
    <article className="sede-publica-instructores__card">
      {foto ? (
        <img
          src={foto}
          alt=""
          className="sede-publica-instructores__photo"
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="sede-publica-instructores__photo sede-publica-instructores__photo--initials" aria-hidden>
          {instructorDisplayInitials(nombre)}
        </span>
      )}
      <div className="sede-publica-instructores__body">
        <p className="sede-publica-instructores__name">{nombre}</p>
        {deportes.length > 0 ? (
          <div className="sede-publica-instructores__deportes">
            {deportes.map((dep) => (
              <span key={`${instructor.id}-${dep}`} className="sede-publica-instructores__deporte-chip">
                <DeporteIcono deporte={dep} size={14} />
                <span>{instructorDeporteLabel(dep)}</span>
              </span>
            ))}
          </div>
        ) : null}
        {badgeFipa ? (
          <span className="sede-publica-instructores__badge sede-publica-instructores__badge--fipa">
            {t('sedes.publica.instructorCertFipa', { defaultValue: 'Cert. FIPA' })}
          </span>
        ) : null}
        {badgeCert ? (
          <span className="sede-publica-instructores__badge sede-publica-instructores__badge--muted">
            {t('sedes.publica.instructorCertificadoBadge', { defaultValue: 'Certificado' })}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function SedeInstructoresSection({ instructores, t }) {
  const list = (Array.isArray(instructores) ? instructores : []).filter(
    (row) => row && String(row.nombre || '').trim(),
  );
  if (!list.length) return null;

  const trackClass =
    list.length === 1
      ? 'sede-publica-instructores__track sede-publica-instructores__track--single'
      : 'sede-publica-instructores__track';

  return (
    <section
      className="sede-publica-section sede-publica-instructores"
      aria-labelledby="sede-instructores-title"
    >
      <h2 id="sede-instructores-title" className="sede-publica-instructores__title">
        {t('sedes.publica.instructores', { defaultValue: 'Instructores' })}
      </h2>
      <div className={trackClass}>
        {list.map((inst) => (
          <SedeInstructorCard key={String(inst.id)} instructor={inst} t={t} />
        ))}
      </div>
    </section>
  );
}

function SedeInformacionClub({ sede, horario, proximoTorneo, lang, t, canchasCount: canchasCountProp }) {
  const canchasCount =
    Number.isFinite(Number(canchasCountProp)) && Number(canchasCountProp) > 0
      ? Number(canchasCountProp)
      : resolveSedeCanchasCount(sede);
  const ubicacion = [sede?.direccion, sede?.ciudad, sede?.pais].filter(Boolean).join(', ');
  const waHref = whatsappHrefSede(sede);

  const proximoTorneoNombre = proximoTorneo ? String(proximoTorneo.nombre || '').trim() : '';
  const proximoTorneoFecha = proximoTorneo
    ? formatFechaDiaMesPublica(proximoTorneo.fecha_inicio, lang)
    : '';
  const proximoTorneoValor =
    proximoTorneoNombre && proximoTorneoFecha
      ? `${proximoTorneoNombre} · ${proximoTorneoFecha}`
      : proximoTorneoNombre || proximoTorneoFecha || null;
  const proximoTorneoBanner = torneoImagenPublicaUrl(proximoTorneo);

  const socialItems = SEDE_INFO_SOCIAL_META.filter((m) => {
    const v = sede?.[m.key];
    return v != null && String(v).trim() !== '';
  });

  const canchasValor =
    canchasCount > 0
      ? t('sedes.publica.canchasDisponibles', {
          count: canchasCount,
          defaultValue: `${canchasCount} cancha${canchasCount === 1 ? '' : 's'} disponible${canchasCount === 1 ? '' : 's'}`,
        })
      : '—';

  return (
    <section
      className="sede-publica-section sede-publica-info-club"
      aria-labelledby="sede-info-club-title"
    >
      <h2 id="sede-info-club-title" className="sede-publica-info-club__title">
        {t('sedes.publica.infoTitulo', { defaultValue: 'Información' })}
      </h2>
      <div className="sede-publica-info-club__grid">
        <SedeInfoRow
          icon={<IconClock />}
          label={t('sedes.publica.infoHorario', { defaultValue: 'Horario' })}
          value={horario || '—'}
        />
        <SedeInfoRow
          icon={<IconLayoutGrid />}
          label={t('sedes.publica.infoCanchas', { defaultValue: 'Canchas' })}
          value={canchasValor}
        />
        {proximoTorneoValor ? (
          <div className="sede-publica-info-club__block">
            <SedeInfoRow
              icon={<IconTrophy />}
              label={t('sedes.publica.proximoTorneo', { defaultValue: 'Próximo torneo' })}
              value={proximoTorneoValor}
            />
            {proximoTorneoBanner ? (
              <img
                src={proximoTorneoBanner}
                alt=""
                className="sede-publica-info-club__torneo-banner"
                loading="lazy"
                decoding="async"
              />
            ) : null}
          </div>
        ) : null}
        <SedeInfoRow
          icon={<IconMapPin />}
          label={t('sedes.publica.infoDireccion', { defaultValue: 'Dirección' })}
          value={ubicacion || '—'}
        />
        <SedeInfoRow
          icon={<IconBrandWhatsapp />}
          label="WhatsApp"
          value={
            waHref ? (
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                {t('sedes.publica.whatsappCta', { defaultValue: 'Escribinos por WhatsApp' })}
              </a>
            ) : (
              '—'
            )
          }
        />
      </div>
      {socialItems.length > 0 ? (
        <div className="sede-publica-info-club__social">
          <div className="sede-publica-info-club__social-icons">
            {socialItems.map((m) => {
              const Icon = m.Icon;
              const href = toHttps(String(sede[m.key]).trim());
              return (
                <a
                  key={m.key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sede-publica-info-club__social-link"
                  aria-label={m.label}
                >
                  <Icon />
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SedeMapaFinal({ direccion, ciudad, pais, latitud, longitud }) {
  const openMapsHref = toHttps(buildOpenMapsHref(direccion, ciudad, pais, latitud, longitud));
  const embedSrc = useMemo(
    () => buildMapsEmbedSrc({ latitud, longitud, direccion, ciudad, pais }),
    [direccion, ciudad, pais, latitud, longitud]
  );

  if (!embedSrc && !openMapsHref) return null;

  return (
    <div className="sede-publica-map">
      {embedSrc ? (
        <iframe title="Ubicación en Google Maps" src={toHttps(embedSrc)} loading="lazy" />
      ) : null}
      {openMapsHref ? (
        <div className="sede-publica-map__link-wrap">
          <a
            className="sede-publica-map__link"
            href={toHttps(openMapsHref)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir en Google Maps
          </a>
        </div>
      ) : null}
    </div>
  );
}

function SedeFotosLightbox({ fotos, index, onClose, onIndexChange }) {
  const touchStartX = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndexChange((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') onIndexChange((i) => Math.min(fotos.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [fotos.length, onClose, onIndexChange]);

  if (!fotos.length || index < 0 || index >= fotos.length) return null;

  const url = toHttps(fotos[index]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Galería de fotos"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        flexDirection: 'column',
        touchAction: 'pan-y',
      }}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start == null) return;
        const end = e.changedTouches[0]?.clientX;
        if (end == null) return;
        const dx = end - start;
        if (dx < -48) onIndexChange(Math.min(fotos.length - 1, index + 1));
        else if (dx > 48) onIndexChange(Math.max(0, index - 1));
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        }}
      >
        <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 700 }}>
          {index + 1} / {fotos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(248,250,252,0.35)',
            background: 'rgba(15,23,42,0.5)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px calc(12px + env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
        }}
      >
        <img
          src={url}
          alt={`Foto ${index + 1}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
        />
      </div>
      <p
        style={{
          margin: 0,
          padding: '10px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
          textAlign: 'center',
          color: 'rgba(248,250,252,0.65)',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        Desliza hacia los lados para cambiar de foto
      </p>
    </div>
  );
}

/** Mapa miniatura (iframe pequeño, sin interacción) + abrir en Maps. */
function MapThumbnail({ direccion, ciudad, pais, latitud, longitud }) {
  const openMapsHref = useMemo(
    () => toHttps(buildOpenMapsHref(direccion, ciudad, pais, latitud, longitud)),
    [direccion, ciudad, pais, latitud, longitud]
  );
  const embedSrc = useMemo(
    () => buildMapsEmbedSrc({ latitud, longitud, direccion, ciudad, pais }),
    [direccion, ciudad, pais, latitud, longitud]
  );

  if (!embedSrc && !openMapsHref) return null;

  return (
    <div style={{ position: 'relative' }}>
      {embedSrc ? (
        <div
          style={{
            position: 'relative',
            borderRadius: SEDE_DS.cardRadius,
            overflow: 'hidden',
            maxHeight: MAP_THUMB_MAX_H,
            boxShadow: '0 1px 6px rgba(15, 23, 42, 0.08)',
            background: '#e2e8f0',
            border: `1px solid ${SEDE_DS.cardBorder}`,
            boxSizing: 'border-box',
          }}
        >
          <iframe
            title="Vista de mapa"
            width="100%"
            height={MAP_THUMB_MAX_H}
            style={{
              border: 0,
              display: 'block',
              pointerEvents: 'none',
              transform: 'scale(1.02)',
              transformOrigin: 'center center',
            }}
            loading="lazy"
            src={toHttps(embedSrc)}
          />
          {openMapsHref ? (
            <a
              href={toHttps(openMapsHref)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: 'absolute',
                right: '8px',
                bottom: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.88)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              Abrir en Maps
            </a>
          ) : null}
        </div>
      ) : (
        openMapsHref && (
          <a
            href={toHttps(openMapsHref)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#1e293b',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              textDecoration: 'none',
            }}
          >
            Abrir en Maps
          </a>
        )
      )}
    </div>
  );
}


const API_BASE_RESENAS = toHttps(
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

function apiUrlResenas(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return toHttps(`${API_BASE_RESENAS}${p}`);
}

const RESENA_MAX_CHARS = 200;

function formatFechaResenaPublica(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function EstrellasSoloLectura({ value }) {
  const v = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span
      style={{ display: 'inline-flex', gap: '1px', alignItems: 'center' }}
      title={`${v} de 5`}
      aria-label={`${v} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            fontSize: '13px',
            color: i <= v ? '#fbbf24' : 'rgba(107, 107, 107, 0.35)',
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function SedeEnNumerosBloque({ stats }) {
  const items = buildSedeEnNumerosItems(stats);
  if (!items.length) return null;

  return (
    <section
      className="sede-publica-section sede-publica-en-numeros"
      aria-labelledby="sede-en-numeros-title"
    >
      <h2 id="sede-en-numeros-title" className="sede-publica-section__title">
        En números
      </h2>
      <div className="sede-publica-en-numeros__grid">
        {items.map((item) => (
          <div key={item.key} className="sede-publica-en-numeros__item">
            {item.promedio != null ? (
              <>
                <div className="sede-publica-en-numeros__promedio-row">
                  <EstrellasSoloLectura value={item.promedio} />
                  <span className="sede-publica-en-numeros__value">{item.promedio.toFixed(1)}</span>
                </div>
                <span className="sede-publica-en-numeros__label">{item.label}</span>
              </>
            ) : (
              <>
                <span className="sede-publica-en-numeros__value">{item.value}</span>
                <span className="sede-publica-en-numeros__label">{item.label}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function EstrellasInteractivas({ value, onChange, disabled }) {
  const v = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} role="group" aria-label="Calificación en estrellas">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          aria-label={`${n} de 5 estrellas`}
          aria-pressed={v >= n}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '26px',
            lineHeight: 1,
            padding: 0,
            color: v >= n ? '#fbbf24' : 'rgba(107, 107, 107, 0.28)',
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ListaResenaCard({ r, isLast, isSuperAdmin, onDeleteResena, deletingId }) {
  const nombre = r?.autor?.nombre || 'Jugador';
  const apodo = String(r?.autor?.apodo || '').trim();
  const foto = toHttps(r?.autor?.foto_url);
  const ini = nombre ? nombre.charAt(0).toUpperCase() : '?';
  const showApodoSub = apodo && nombre && apodo.toLowerCase() !== nombre.toLowerCase();
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        padding: '12px 0',
        borderBottom: isLast ? 'none' : `1px solid ${SEDE_DS.cardBorder}`,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '999px',
          overflow: 'hidden',
          flexShrink: 0,
          background: '#F0F0F0',
          border: `1px solid ${SEDE_DS.cardBorder}`,
          boxSizing: 'border-box',
        }}
      >
        {foto ? (
          <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '16px',
              color: SEDE_DS.subtitle,
            }}
            aria-hidden
          >
            {ini}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '6px 10px',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '14px', color: SEDE_DS.title }}>{nombre}</span>
              <EstrellasSoloLectura value={r.estrellas} />
              <span style={{ fontSize: '12px', color: SEDE_DS.subtitle }}>
                {formatFechaResenaPublica(r.created_at)}
              </span>
            </div>
            {showApodoSub ? (
              <div style={{ marginTop: '4px', fontSize: '12px', color: SEDE_DS.subtitle, fontWeight: 600 }}>
                {apodo}
              </div>
            ) : null}
          </div>
          {isSuperAdmin && onDeleteResena ? (
            <button
              type="button"
              onClick={() => onDeleteResena(r.id)}
              disabled={deletingId === r.id}
              aria-label="Eliminar reseña"
              style={{
                flexShrink: 0,
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#b91c1c',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: deletingId === r.id ? 'wait' : 'pointer',
                opacity: deletingId === r.id ? 0.7 : 1,
              }}
            >
              {deletingId === r.id ? '…' : 'Eliminar'}
            </button>
          ) : null}
        </div>
        {String(r.comentario || '').trim() ? (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '13px',
              lineHeight: 1.45,
              color: SEDE_DS.subtitle,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {r.comentario}
          </p>
        ) : null}
        {String(r.respuesta_admin || '').trim() ? (
          <div
            style={{
              marginTop: '10px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(225, 27, 34, 0.06)',
              border: `1px solid ${SEDE_DS.cardBorder}`,
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 800, color: SEDE_DS.brand, marginBottom: '4px' }}>
              Respuesta del club
            </div>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.45, color: SEDE_DS.subtitle, whiteSpace: 'pre-wrap' }}>
              {r.respuesta_admin}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SedeResenasSeccion({ sedeId, accessToken, navigate, isSuperAdmin }) {
  const idNum = useMemo(() => parseInt(String(sedeId), 10), [sedeId]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verTodasOpen, setVerTodasOpen] = useState(false);
  const [todasRows, setTodasRows] = useState([]);
  const [todasLoading, setTodasLoading] = useState(false);
  const [deletingResenaId, setDeletingResenaId] = useState(null);
  /** 0 = aún no eligió estrellas (no se envía hasta que elija al menos 1). */
  const [estrellasForm, setEstrellasForm] = useState(0);
  const [comentarioForm, setComentarioForm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);

  const loadResenas = useCallback(async () => {
    if (!Number.isFinite(idNum)) return;
    setLoading(true);
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const url = apiUrlResenas(`/api/sedes/${idNum}/resenas?limit=5&offset=0`);
    try {
      const r = await fetch(url, { headers });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error('[SedePublica] GET /api/sedes/:id/resenas HTTP error', {
          sedeId: idNum,
          url,
          status: r.status,
          body,
        });
        setPayload({ ...EMPTY_SEDE_RESENAS_PAYLOAD });
        return;
      }
      setPayload({
        ...EMPTY_SEDE_RESENAS_PAYLOAD,
        ...body,
        resenas: Array.isArray(body.resenas) ? body.resenas : [],
        total: body.total ?? body.total_count ?? 0,
        ya_reseño: Boolean(body.ya_reseño),
        puede_reseñar: Boolean(body.puede_reseñar),
      });
    } catch (e) {
      console.error('[SedePublica] GET /api/sedes/:id/resenas fetch failed', {
        sedeId: idNum,
        url,
        error: e,
      });
      setPayload({ ...EMPTY_SEDE_RESENAS_PAYLOAD });
    } finally {
      setLoading(false);
    }
  }, [idNum, accessToken]);

  useEffect(() => {
    void loadResenas();
  }, [loadResenas]);

  useEffect(() => {
    if (!formModalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setFormModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [formModalOpen]);

  const openFormResena = useCallback(() => {
    setFormMsg('');
    setEstrellasForm(0);
    setComentarioForm('');
    setFormModalOpen(true);
  }, []);

  const openVerTodas = useCallback(async () => {
    if (!Number.isFinite(idNum)) return;
    setVerTodasOpen(true);
    setTodasLoading(true);
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      const r = await fetch(apiUrlResenas(`/api/sedes/${idNum}/resenas?limit=100&offset=0`), { headers });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        const raw = String(body.error || '');
        const friendly =
          body.code === 'RESENAS_TABLE_MISSING' || body.code === 'SEDE_RESENAS_TABLE_MISSING'
            ? raw
            : /schema cache|public\.resenas|\bresenas\b/i.test(raw)
              ? 'Las reseñas no están disponibles (tabla public.resenas).'
              : raw || `Error ${r.status}`;
        throw new Error(friendly);
      }
      setTodasRows(Array.isArray(body.resenas) ? body.resenas : []);
    } catch {
      setTodasRows([]);
    } finally {
      setTodasLoading(false);
    }
  }, [idNum, accessToken]);

  const submitResena = async (e) => {
    e.preventDefault();
    if (!accessToken) return;
    setFormMsg('');
    const est = parseInt(String(estrellasForm), 10);
    if (!Number.isFinite(est) || est < 1 || est > 5) {
      setFormMsg('Elige una calificación de 1 a 5 estrellas.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(apiUrlResenas(`/api/sedes/${idNum}/resenas`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ estrellas: est, comentario: comentarioForm.trim() }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        const raw = String(body.error || '');
        const friendly =
          body.code === 'RESENAS_TABLE_MISSING' || body.code === 'SEDE_RESENAS_TABLE_MISSING'
            ? raw
            : /schema cache|public\.resenas|\bresenas\b/i.test(raw)
              ? 'Las reseñas no están disponibles: crea o actualiza public.resenas en Supabase (ver resenas_sedes.sql).'
              : raw || `Error ${r.status}`;
        throw new Error(friendly);
      }
      setComentarioForm('');
      setEstrellasForm(0);
      setFormModalOpen(false);
      setFormMsg('');
      await loadResenas();
    } catch (e2) {
      setFormMsg(e2.message || 'No se pudo enviar');
    } finally {
      setSubmitting(false);
    }
  };

  const eliminarResenaAdmin = useCallback(
    async (resenaId) => {
      if (!isSuperAdmin || !accessToken || !Number.isFinite(idNum) || !resenaId) return;
      if (!window.confirm('¿Eliminar esta reseña de forma permanente?')) return;
      setDeletingResenaId(resenaId);
      try {
        const r = await fetch(apiUrlResenas(`/api/sedes/${idNum}/resenas/${encodeURIComponent(resenaId)}`), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(body?.error || `Error ${r.status}`);
        }
        setTodasRows((prev) => prev.filter((row) => row.id !== resenaId));
        await loadResenas();
      } catch (e) {
        window.alert(e?.message || 'No se pudo eliminar la reseña');
      } finally {
        setDeletingResenaId(null);
      }
    },
    [accessToken, idNum, isSuperAdmin, loadResenas],
  );

  if (!Number.isFinite(idNum)) return null;

  const cardStyle = {
    marginTop: '6px',
    marginBottom: '18px',
    padding: '16px 14px',
    borderRadius: SEDE_DS.cardRadius,
    background: SEDE_DS.cardBg,
    border: `1px solid ${SEDE_DS.cardBorder}`,
    boxSizing: 'border-box',
  };

  const lista = payload?.resenas || [];
  const promedioTxt =
    payload?.promedio != null && Number.isFinite(Number(payload.promedio))
      ? Number(payload.promedio).toFixed(1)
      : '—';
  const promedioNum = Number(payload?.promedio);
  const estrellasPromedio = Number.isFinite(promedioNum) ? Math.round(promedioNum) : 0;

  return (
    <div style={cardStyle}>
      <h2
        style={{
          margin: '0 0 10px',
          fontSize: '17px',
          fontWeight: 800,
          color: SEDE_DS.title,
        }}
      >
        Reseñas
      </h2>
      {loading ? (
        <p style={{ margin: 0, color: SEDE_DS.subtitle, fontSize: '13px' }}>Cargando reseñas…</p>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '10px 14px',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24' }}>{promedioTxt}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <EstrellasSoloLectura value={estrellasPromedio} />
              <span style={{ fontSize: '12px', color: SEDE_DS.subtitle }}>
                {payload?.total
                  ? `${payload.total} reseña${payload.total === 1 ? '' : 's'}`
                  : 'Sin reseñas aún'}
              </span>
            </div>
          </div>

          {!accessToken ? (
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: SEDE_DS.subtitle }}>
              <button
                type="button"
                onClick={() => navigate('/auth')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: SEDE_DS.brand,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontWeight: 700,
                  padding: 0,
                  fontSize: 'inherit',
                }}
              >
                Inicia sesión
              </button>{' '}
              para dejar tu reseña.
            </p>
          ) : payload?.ya_reseño ? (
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: SEDE_DS.subtitle }}>
              Ya dejaste tu reseña en esta sede. ¡Gracias!
            </p>
          ) : payload?.puede_reseñar ? (
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={openFormResena}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: `2px solid ${SEDE_DS.brand}`,
                  background: 'var(--bg-card)',
                  color: SEDE_DS.brand,
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                Dejar reseña
              </button>
            </div>
          ) : (
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: SEDE_DS.subtitle, lineHeight: 1.45 }}>
              Solo jugadores con al menos una <strong style={{ color: SEDE_DS.title }}>reserva confirmada</strong> en esta sede pueden dejar una reseña.
            </p>
          )}

          {lista.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: SEDE_DS.subtitle,
                fontStyle: 'italic',
              }}
            >
              Aún no hay reseñas
            </p>
          ) : (
            <div>
              {lista.map((row, idx) => (
                <ListaResenaCard
                  key={row.id}
                  r={row}
                  isLast={idx === lista.length - 1}
                  isSuperAdmin={Boolean(isSuperAdmin)}
                  onDeleteResena={eliminarResenaAdmin}
                  deletingId={deletingResenaId}
                />
              ))}
            </div>
          )}

          {(payload?.total ?? 0) > 5 ? (
            <button
              type="button"
              onClick={() => void openVerTodas()}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '11px',
                borderRadius: '12px',
                border: `1px solid ${SEDE_DS.cardBorder}`,
                background: '#F8F8F8',
                color: SEDE_DS.title,
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              Ver todas
            </button>
          ) : null}
        </>
      )}

      {verTodasOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(15,23,42,0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sede-resenas-modal-title"
          onClick={() => setVerTodasOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setVerTodasOpen(false);
          }}
        >
          <div
            style={{
              width: 'min(480px, 100%)',
              maxHeight: '82vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              background: 'var(--bg-card)',
              border: `1px solid ${SEDE_DS.cardBorder}`,
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                borderBottom: `1px solid ${SEDE_DS.cardBorder}`,
                flexShrink: 0,
              }}
            >
              <span id="sede-resenas-modal-title" style={{ fontWeight: 800, color: SEDE_DS.title, fontSize: '16px' }}>
                Todas las reseñas
              </span>
              <button
                type="button"
                onClick={() => setVerTodasOpen(false)}
                style={{
                  border: `1px solid ${SEDE_DS.cardBorder}`,
                  background: '#F5F5F5',
                  color: SEDE_DS.title,
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '20px',
                  lineHeight: 1,
                }}
                aria-label={t('general.close')}
              >
                ×
              </button>
            </div>
            <div
              style={{
                overflowY: 'auto',
                padding: '8px 16px 16px',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {todasLoading ? (
                <p style={{ margin: 0, color: SEDE_DS.subtitle, fontSize: '14px' }}>Cargando…</p>
              ) : (
                todasRows.map((row, idx) => (
                  <ListaResenaCard
                    key={row.id}
                    r={row}
                    isLast={idx === todasRows.length - 1}
                    isSuperAdmin={Boolean(isSuperAdmin)}
                    onDeleteResena={eliminarResenaAdmin}
                    deletingId={deletingResenaId}
                  />
                ))
              )}
              {(payload?.total ?? 0) > 100 ? (
                <p
                  style={{
                    margin: '10px 0 0',
                    fontSize: '11px',
                    color: SEDE_DS.subtitle,
                    textAlign: 'center',
                  }}
                >
                  Mostrando las 100 reseñas más recientes.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {formModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 55,
            background: 'rgba(15,23,42,0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sede-resena-form-title"
          onClick={() => {
            if (!submitting) setFormModalOpen(false);
          }}
        >
          <form
            onSubmit={submitResena}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              padding: '18px 16px 16px',
              borderRadius: '16px',
              background: 'var(--bg-card)',
              border: `1px solid ${SEDE_DS.cardBorder}`,
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '14px',
              }}
            >
              <span id="sede-resena-form-title" style={{ fontWeight: 800, color: SEDE_DS.title, fontSize: '16px' }}>
                Tu reseña
              </span>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setFormModalOpen(false)}
                style={{
                  border: `1px solid ${SEDE_DS.cardBorder}`,
                  background: '#F5F5F5',
                  color: SEDE_DS.title,
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: '20px',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                aria-label={t('general.close')}
              >
                ×
              </button>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: SEDE_DS.subtitle, lineHeight: 1.4 }}>
              Elige las estrellas y, si quieres, escribe un comentario. Solo se publica cuando tocas «Publicar reseña».
            </p>
            <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: SEDE_DS.title }}>
              Calificación <span style={{ color: SEDE_DS.brand }}>*</span>
            </div>
            <EstrellasInteractivas value={estrellasForm} onChange={setEstrellasForm} disabled={submitting} />
            <label
              style={{ display: 'block', marginTop: '14px', fontSize: '12px', fontWeight: 700, color: SEDE_DS.title }}
              htmlFor="sede-resena-comentario-modal"
            >
              Comentario (opcional, máx. {RESENA_MAX_CHARS} caracteres)
            </label>
            <textarea
              id="sede-resena-comentario-modal"
              value={comentarioForm}
              maxLength={RESENA_MAX_CHARS}
              disabled={submitting}
              onChange={(e) => setComentarioForm(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                marginTop: '6px',
                boxSizing: 'border-box',
                borderRadius: '10px',
                border: `1px solid ${SEDE_DS.cardBorder}`,
                background: 'var(--bg-card)',
                color: SEDE_DS.title,
                padding: '10px',
                fontSize: '13px',
                resize: 'vertical',
                minHeight: '72px',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '12px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '11px', color: SEDE_DS.subtitle }}>
                {comentarioForm.length}/{RESENA_MAX_CHARS}
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setFormModalOpen(false)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${SEDE_DS.cardBorder}`,
                    background: 'var(--bg-card)',
                    color: SEDE_DS.title,
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: SEDE_DS.brand,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: submitting ? 'wait' : 'pointer',
                  }}
                >
                  {submitting ? 'Enviando…' : 'Publicar reseña'}
                </button>
              </div>
            </div>
            {formMsg ? (
              <p
                style={{
                  margin: '12px 0 0',
                  fontSize: '12px',
                  color: formMsg.startsWith('¡') ? '#15803d' : '#b91c1c',
                }}
              >
                {formMsg}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}

/** Perfil público de sede: ruta `/sede/:sedeId` en App.js → solo este componente (no hay SedeVista / SedePerfil). */
export default function SedePublica() {
  const { t } = useTranslation();
  const { language: padbolLang } = usePadbolI18n();
  const { sedeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const { session, userProfile } = useAuth();

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return {
      email: em,
      nombre: getDisplayName(userProfile, session) || '',
      whatsapp: String(userProfile?.whatsapp || '').trim(),
      foto: toHttps(userProfile?.foto_url ?? userProfile?.foto ?? null),
    };
  }, [session, userProfile]);

  const { rol: userRol } = useUserRole(currentCliente);
  const isSuperAdmin = userRol === 'super_admin';

  const sedeIdNumTicker = useMemo(() => {
    const n = parseInt(String(sedeId), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [sedeId]);
  const { sponsors: sedeTickerSponsors } = useSedeTickerSponsors(sedeIdNumTicker, {
    enabled: Boolean(sedeIdNumTicker),
  });
  const sedeTickerSponsorsHttps = useMemo(() => {
    const list = Array.isArray(sedeTickerSponsors) ? sedeTickerSponsors : [];
    return list
      .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
      .map((row) => {
        const next = { ...row };
        if (next.imagen_url != null) next.imagen_url = toHttps(String(next.imagen_url).trim());
        if (next.logo_url != null) next.logo_url = toHttps(String(next.logo_url).trim());
        if (next.logoUrl != null) next.logoUrl = toHttps(String(next.logoUrl).trim());
        if (next.url_destino != null) next.url_destino = toHttps(String(next.url_destino).trim());
        if (next.video_url != null) next.video_url = toHttps(String(next.video_url).trim());
        if (next.banner_url != null) next.banner_url = toHttps(String(next.banner_url).trim());
        return next;
      });
  }, [sedeTickerSponsors]);
  /** Hueco bajo AppHeader + BottomNav fijos + buffer (hero y resto del scroll). Safe-area en `--pm-app-header-stack-height`. */
  const sedeScrollPaddingTopCss = useMemo(
    () =>
      `calc(var(--pm-app-header-stack-height) + ${hubScrollChromeTopExtraPx(location.pathname, navDock) + SEDE_PUBLIC_SCROLL_EXTRA_TOP_PX}px)`,
    [location.pathname, navDock]
  );
  const [sede, setSede] = useState(null);
  /** Viene en `GET /api/sedes/:id` como `estadisticas_publicas` (null si solo fallback Supabase). */
  const [estadisticasPublicas, setEstadisticasPublicas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fotosGalleryOpen, setFotosGalleryOpen] = useState(false);
  const [fotosGalleryIndex, setFotosGalleryIndex] = useState(0);
  const [torneosSedeLista, setTorneosSedeLista] = useState([]);
  const [instructoresAprobados, setInstructoresAprobados] = useState([]);
  const [sedeShareCopied, setSedeShareCopied] = useState(false);
  const [duracionesOferta, setDuracionesOferta] = useState([]);
  const [preciosDeporteRows, setPreciosDeporteRows] = useState([]);
  const [partidosSede, setPartidosSede] = useState([]);
  const [partidosSedeLoading, setPartidosSedeLoading] = useState(false);
  const [sedePerfilCanchasCount, setSedePerfilCanchasCount] = useState(null);

  const handleSedePublicaBack = useCallback(() => {
    const dest = resolveSedePublicaBackToPath(location.state);
    navigate(dest);
    if (isUserHomeHubPath(dest)) scheduleHubEntryScrollReset();
  }, [location.state, navigate]);

  useEffect(() => {
    if (!sedeShareCopied) return undefined;
    const t = window.setTimeout(() => setSedeShareCopied(false), 2200);
    return () => clearTimeout(t);
  }, [sedeShareCopied]);

  const handleShareSede = useCallback(async () => {
    if (typeof window === 'undefined' || !sedeId) return;
    const url = `${window.location.origin}/sede/${encodeURIComponent(String(sedeId))}`;
    const nombreSede = String(sede?.nombre || 'Sede').trim() || 'Sede';
    const title = nombreSede;
    const text = `¡Reserva tu cancha en ${nombreSede}! 🏆⚽`;
    if (canUseNavigatorShare()) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setSedeShareCopied(true);
      return;
    } catch {
      /* legacy */
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setSedeShareCopied(true);
    } catch {
      window.prompt('Copia este link:', url);
    }
  }, [sedeId, sede]);

  const proximoTorneoInfo = useMemo(
    () => pickProximoTorneoInfoClub(torneosSedeLista),
    [torneosSedeLista]
  );

  const torneosProximosSede = useMemo(
    () => pickTorneosProximosSede(torneosSedeLista, 3),
    [torneosSedeLista]
  );

  const sedeIdNumLoad = useMemo(() => {
    const n = parseInt(String(sedeId), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [sedeId]);

  useEffect(() => {
    if (!sedeIdNumLoad) {
      setPartidosSede([]);
      return undefined;
    }
    let cancelled = false;
    setPartidosSedeLoading(true);
    const headers = {};
    const token = session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
    const partidosUrl = `${API_BASE_SEDE}/api/sedes/${sedeIdNumLoad}/partidos?upcoming=true&limit=3`;
    console.log('[SedePublica] partidos fetch start', { sedeId: sedeIdNumLoad, url: partidosUrl, hasToken: Boolean(token) });
    fetch(partidosUrl, { headers })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          console.warn('[SedePublica] partidos fetch HTTP error', {
            sedeId: sedeIdNumLoad,
            status: r.status,
            data,
          });
          setPartidosSede([]);
          return;
        }
        const list = Array.isArray(data?.partidos)
          ? data.partidos
          : Array.isArray(data)
            ? data
            : [];
        console.log('[SedePublica] partidos fetch ok', {
          sedeId: sedeIdNumLoad,
          count: list.length,
          sectionVisible: list.length > 0,
          partidos: list,
        });
        setPartidosSede(list);
        if (list.length === 0) {
          console.log('[SedePublica] partidos section hidden (empty list)', { sedeId: sedeIdNumLoad });
        }
      })
      .catch((e) => {
        console.error('[SedePublica] partidos fetch failed', { sedeId: sedeIdNumLoad, url: partidosUrl, error: e });
        if (!cancelled) setPartidosSede([]);
      })
      .finally(() => {
        if (!cancelled) setPartidosSedeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sedeIdNumLoad, session?.access_token]);

  useEffect(() => {
    if (!sedeId) {
      setTorneosSedeLista([]);
      return;
    }
    const id = parseInt(String(sedeId), 10);
    if (!Number.isFinite(id)) {
      setTorneosSedeLista([]);
      return;
    }
    let cancelled = false;
    const torneoSelectBase = 'id, nombre, fecha_inicio, fecha_fin, estado';
    const loadTorneos = async () => {
      const q = (fields) =>
        supabase
          .from('torneos')
          .select(fields)
          .eq('sede_id', id)
          .order('fecha_inicio', { ascending: true })
          .limit(48);
      let { data, error: qErr } = await q(`${torneoSelectBase}, foto_url, imagen_url`);
      if (qErr) {
        ({ data, error: qErr } = await q(torneoSelectBase));
      }
      if (cancelled) return;
      if (qErr || !Array.isArray(data)) {
        setTorneosSedeLista([]);
        return;
      }
      setTorneosSedeLista(
        data.map((row) => ({
          ...row,
          foto_url: row.foto_url ? toHttps(String(row.foto_url).trim()) : row.foto_url,
          imagen_url: row.imagen_url ? toHttps(String(row.imagen_url).trim()) : row.imagen_url,
        }))
      );
    };
    loadTorneos().catch(() => {
      if (!cancelled) setTorneosSedeLista([]);
    });
    return () => {
      cancelled = true;
    };
  }, [sedeId]);

  useEffect(() => {
    if (!sedeId) {
      setInstructoresAprobados([]);
      return undefined;
    }
    const id = parseInt(String(sedeId), 10);
    if (!Number.isFinite(id)) {
      setInstructoresAprobados([]);
      return undefined;
    }
    let cancelled = false;
    const ac = new AbortController();
    fetchProfesores({ sedeId: id, signal: ac.signal })
      .then((list) => {
        if (cancelled) return;
        const arr = (Array.isArray(list) ? list : [])
          .filter((p) => p && String(p.nombre || '').trim())
          .map((p) => ({
            ...p,
            foto_url: p.foto_url ? toHttps(String(p.foto_url).trim()) : null,
          }));
        setInstructoresAprobados(arr);
      })
      .catch(() => {
        if (!cancelled) setInstructoresAprobados([]);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [sedeId]);

  useEffect(() => {
    if (!sedeId) {
      setError('No se recibió un ID de sede.');
      setLoading(false);
      return;
    }
    const idNum = parseInt(String(sedeId), 10);
    if (!Number.isFinite(idNum)) {
      setError('ID de sede inválido.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setEstadisticasPublicas(null);
    setSedePerfilCanchasCount(null);

    (async () => {
      let sedeLoaded = false;
      try {
        const r = await fetch(apiUrlResenas(`/api/sedes/${idNum}`));
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.ok) {
          const { estadisticas_publicas: stats, duraciones_oferta: durOferta, ...rest } = j;
          if (!rest || rest.id == null) {
            setError(`Sede con id ${sedeId} no encontrada.`);
            setSede(null);
            setEstadisticasPublicas(null);
            setDuracionesOferta([]);
          } else {
            setError('');
            setSede(normalizeSedeHttps(rest));
            setEstadisticasPublicas(stats ?? null);
            setDuracionesOferta(Array.isArray(durOferta) ? durOferta : []);
            sedeLoaded = true;
          }
        }
      } catch {
        /* fallback Supabase */
      }
      if (!cancelled && !sedeLoaded) {
        try {
          const { data, error: err } = await supabase.from('sedes').select('*').eq('id', idNum).maybeSingle();
          if (cancelled) return;
          if (err) setError(`Error al cargar sede: ${err.message}`);
          else if (!data) setError(`Sede con id ${sedeId} no encontrada.`);
          else {
            setError('');
            setSede(normalizeSedeHttps(data));
            setEstadisticasPublicas(null);
            setDuracionesOferta([]);
          }
        } catch (err) {
          if (!cancelled) setError('Error inesperado: ' + (err?.message || String(err)));
        }
      }
      if (cancelled) return;
      try {
        const pr = await fetch(apiUrlResenas(`/api/sedes/${idNum}/precios-deporte`));
        const pj = await pr.json().catch(() => ({}));
        if (!cancelled) {
          setPreciosDeporteRows(Array.isArray(pj.precios) ? pj.precios : []);
        }
      } catch {
        if (!cancelled) setPreciosDeporteRows([]);
      }
      const tokenPerfil = session?.access_token;
      if (!cancelled && tokenPerfil) {
        try {
          const perfilUrl = apiUrlResenas(`/api/sedes/${idNum}/perfil`);
          const perfilRes = await fetch(perfilUrl, {
            headers: { Authorization: `Bearer ${tokenPerfil}` },
          });
          const perfilBody = await perfilRes.json().catch(() => ({}));
          if (perfilRes.ok && perfilBody?.canchas_count != null) {
            const cc = Number(perfilBody.canchas_count);
            if (Number.isFinite(cc) && cc > 0) {
              setSedePerfilCanchasCount(cc);
              console.log('[SedePublica] perfil canchas_count', { sedeId: idNum, canchas_count: cc });
            }
          } else if (!perfilRes.ok) {
            console.warn('[SedePublica] GET /api/sedes/:id/perfil', {
              sedeId: idNum,
              status: perfilRes.status,
              body: perfilBody,
            });
          }
        } catch (perfilErr) {
          console.warn('[SedePublica] GET /api/sedes/:id/perfil failed', { sedeId: idNum, error: perfilErr });
        }
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [sedeId, session?.access_token]);

  const sedeViewReady = !loading && !error && sede;

  const rootPageStyle = sedeViewReady
    ? {
        minHeight: '100dvh',
        background: PADBOL_PAGE_GRADIENT,
        paddingTop: 0,
        paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
      }
    : {
        minHeight: '100dvh',
        background: PADBOL_PAGE_GRADIENT,
        paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
        paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
      };

  return (
    <div
      className={sedeViewReady ? 'sede-publica-root sede-publica-root--immersive' : undefined}
      style={rootPageStyle}
    >
      {!sedeViewReady ? (
        <AppHeader
          title=""
          showBack
          hideLogout
          onBack={handleSedePublicaBack}
        />
      ) : null}

      {loading && (
        <div
          style={{
            minHeight: '50vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ color: SEDE_DS.subtitle, fontSize: '15px', fontWeight: 600 }}>Cargando sede…</p>
        </div>
      )}

      {!loading && (error || !sede) && (
        <div
          style={{
            minHeight: '50vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '20px',
          }}
        >
          <p style={{ color: '#b91c1c', fontSize: '15px', fontWeight: 600, textAlign: 'center' }}>
            {error || 'Sede no encontrada.'}
          </p>
          <p style={{ color: '#64748b', fontSize: '12px' }}>sedeId: {sedeId ?? '(undefined)'}</p>
        </div>
      )}

      {!loading && !error && sede && (() => {
        const licenciaActiva = sede.licencia_activa === true && sede.numero_licencia;
        const fotos = sedeFotosLista(sede);
        const horario = formatHorario(sede.horario_apertura, sede.horario_cierre);
        const hasAddress = Boolean(sede.direccion || sede.ciudad || sede.pais);
        const heroImgRaw = sedeHeroImageUrl(sede);
        const heroImg = heroImgRaw
          ? sedePhotoUrlWithCacheBust(heroImgRaw, sedeHeroCacheBustToken(sede))
          : null;
        const direccionLinea = [sede.direccion, sede.ciudad, sede.pais].filter(Boolean).join(', ');
        const deportesChips = deportesActivosSedePublica(sede, preciosDeporteRows);
        const sloganLinea = String(sede.slogan || '').trim();
        const descripcionLinea = String(sede.descripcion || sede.historia || '').trim();
        const amenityChips = resolveSedeAmenityChips(sede.amenities);
        const canchasCount = resolveSedeCanchasCount(sede, sedePerfilCanchasCount);
        return (
          <>
          <div
            className="sede-publica-page__column"
            style={hubInstagramColumnWrapStyle}
          >
            <section
              className={`sede-publica-hero-immersive${heroImg ? '' : ' sede-publica-hero-immersive--placeholder'}`}
              aria-label={sede.nombre || 'Sede'}
            >
                <div
                  className="sede-publica-hero-immersive__media"
                  style={heroImg ? { backgroundImage: `url(${heroImg})` } : undefined}
                  role="img"
                  aria-hidden
                />
                <div className="sede-publica-hero-immersive__overlay" aria-hidden />

                <div className="sede-publica-hero-immersive__top">
                  <button
                    type="button"
                    className="sede-publica-hero-immersive__back"
                    onClick={handleSedePublicaBack}
                  >
                    ← {t('general.back', { defaultValue: 'Volver' })}
                  </button>
                  {typeof window !== 'undefined' && sedeId ? (
                    <div className="sede-publica-hero-immersive__top-actions">
                      <button
                        type="button"
                        className="sede-publica-hero-immersive__share"
                        onClick={() => void handleShareSede()}
                        aria-label={t('general.share', { defaultValue: 'Compartir' })}
                        title={t('general.share', { defaultValue: 'Compartir' })}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <circle cx="18" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.75" />
                          <circle cx="6" cy="12" r="2.25" stroke="currentColor" strokeWidth="1.75" />
                          <circle cx="18" cy="19" r="2.25" stroke="currentColor" strokeWidth="1.75" />
                          <path
                            d="M15.4 6.35L8.6 10.45M8.6 13.55L15.4 17.65"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                      {sedeShareCopied ? (
                        <span className="sede-publica-hero-immersive__share-copied" role="status">
                          {t('general.success', { defaultValue: 'Copiado' })}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="sede-publica-hero-immersive__bottom">
                  <div className="sede-publica-hero-immersive__logo">
                    {sede.logo_url ? (
                      <img src={toHttps(sede.logo_url)} alt="" />
                    ) : (
                      <span className="sede-publica-hero-immersive__logo-fallback" aria-hidden>
                        ⚽
                      </span>
                    )}
                  </div>
                  <h1 className="sede-publica-hero-immersive__nombre">{sede.nombre || '(sin nombre)'}</h1>
                  {sloganLinea ? (
                    <p className="sede-publica-hero-immersive__slogan">{sloganLinea}</p>
                  ) : null}
                  {direccionLinea ? (
                    <p className="sede-publica-hero-immersive__direccion">
                      <IconGeroUbicacion size={14} aria-hidden />
                      <span>{direccionLinea}</span>
                    </p>
                  ) : null}
                  {licenciaActiva ? (
                    <span className="sede-publica-hero-immersive__licencia">
                      {t('sedes.publica.licenciaActiva', { defaultValue: 'Licencia Padbol activa' })}
                    </span>
                  ) : null}
                </div>

                <SedeDeportesChipsHero deportes={deportesChips} t={t} />
            </section>

            <article className="sede-publica-page">
            <div className="sede-publica-info-chips-row" aria-label="Información rápida">
              {direccionLinea ? <SedeInfoChip emoji="📍" label={direccionLinea} /> : null}
              {horario ? <SedeInfoChip emoji="🕐" label={horario} /> : null}
              {canchasCount > 0 ? (
                <SedeInfoChip
                  emoji="🎾"
                  label={`${canchasCount} cancha${canchasCount === 1 ? '' : 's'}`}
                />
              ) : null}
            </div>

            <SedeGaleriaHorizontal
              fotos={fotos}
              onOpenAtIndex={(i) => {
                setFotosGalleryIndex(i);
                setFotosGalleryOpen(true);
              }}
            />

            <div className="sede-publica-ctas">
              <button
                type="button"
                className="sede-publica-btn sede-publica-btn--primary"
                onClick={() => navigate(`/reservar?sedeId=${encodeURIComponent(String(sedeId))}`)}
              >
                {t('sedes.publica.reservarCancha', { defaultValue: 'Reservar cancha' })}
              </button>
              <button
                type="button"
                className="sede-publica-btn sede-publica-btn--outline"
                onClick={() => navigate(`/torneos?sedeId=${encodeURIComponent(String(sedeId))}`)}
              >
                {t('sedes.publica.verTorneos', { defaultValue: 'Ver torneos' })}
              </button>
            </div>

            {partidosSedeLoading || partidosSede.length > 0 ? (
              <section className="sede-publica-section sede-publica-partidos">
                <h2 className="sede-publica-section__title">Partidos abiertos</h2>
                {partidosSedeLoading ? (
                  <p className="sede-publica-section__muted">Cargando partidos…</p>
                ) : (
                  <div className="sede-publica-partidos__list">
                    {partidosSede.map((p) => (
                      <PartidoAbiertoCard key={p.id} partido={p} compact onJoin={() => navigate('/jugar/buscar')} />
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {torneosProximosSede.length > 0 ? (
              <section className="sede-publica-section sede-publica-torneos-list">
                <h2 className="sede-publica-section__title">Próximos torneos</h2>
                <div className="sede-publica-torneos-list__items">
                  {torneosProximosSede.map((tor) => (
                    <button
                      key={tor.id}
                      type="button"
                      className="sede-publica-torneo-row"
                      onClick={() => navigate(`/torneo/${encodeURIComponent(String(tor.id))}`)}
                    >
                      <span className="sede-publica-torneo-row__name">{tor.nombre || 'Torneo'}</span>
                      <span className="sede-publica-torneo-row__date">
                        {formatFechaDiaMesPublica(tor.fecha_inicio, padbolLang) || '—'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {descripcionLinea ? (
              <section className="sede-publica-section sede-publica-descripcion">
                <h2 className="sede-publica-section__title">Descripción</h2>
                <p className="sede-publica-descripcion__text">{descripcionLinea}</p>
              </section>
            ) : null}

            {amenityChips.length > 0 ? (
              <section className="sede-publica-section sede-publica-instalaciones">
                <h2 className="sede-publica-section__title">Instalaciones</h2>
                <div className="sede-publica-instalaciones__pills">
                  {amenityChips.map((item) => (
                    <span key={item.key} className="sede-publica-instalaciones__pill">
                      <span aria-hidden>{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {sedeTieneSeccionEnNumeros(estadisticasPublicas) ? (
              <SedeEnNumerosBloque stats={estadisticasPublicas} />
            ) : null}

            <SedeInformacionClub
              sede={sede}
              horario={horario}
              proximoTorneo={proximoTorneoInfo}
              lang={padbolLang}
              t={t}
              canchasCount={canchasCount}
            />

            <SedeInstructoresSection instructores={instructoresAprobados} t={t} />

            {sedeTickerSponsorsHttps?.length > 0 ? (
              <div className="sede-publica-sponsors">
                <HubSponsorsTicker sponsors={sedeTickerSponsorsHttps} />
              </div>
            ) : null}

            <div className="sede-publica-resenas">
              <SedeResenasSeccion
                sedeId={sedeId}
                accessToken={session?.access_token ?? null}
                navigate={navigate}
                isSuperAdmin={isSuperAdmin}
              />
            </div>

            {hasAddress || (sede.latitud != null && sede.longitud != null) ? (
              <SedeMapaFinal
                direccion={sede.direccion}
                ciudad={sede.ciudad}
                pais={sede.pais}
                latitud={sede.latitud}
                longitud={sede.longitud}
              />
            ) : null}
            </article>
          </div>

          {fotosGalleryOpen ? (
            <SedeFotosLightbox
              fotos={fotos}
              index={fotosGalleryIndex}
              onClose={() => setFotosGalleryOpen(false)}
              onIndexChange={setFotosGalleryIndex}
            />
          ) : null}
          </>
        );
      })()}
      <BottomNav />
    </div>
  );
}
