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
import { supabase } from '../supabaseClient';
import { IconGeroUbicacion } from '../components/icons/GeroIcons';
import { getDisplayName } from '../utils/displayName';
import { badgeTorneoEstadoPublico } from '../utils/torneoEstadoPublico';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import SportIcon from '../components/common/SportIcon';
import {
  esInscripcionAbiertaTorneo,
  esEstadoEnCursoTorneo,
  estadoTorneoNormalizado,
} from '../utils/torneoEstadoFiltroPills';
import { torneoFechaInicioYmd, ymdTodayTorneoTz } from '../utils/torneoFechaInicioArt';
import { fetchProfesores } from '../utils/clasesApi';
import { usePadbolI18n } from '../context/PadbolI18nContext';
import { authLoginRedirectPath } from '../utils/authLoginRedirect';
import { formatNivelTorneo } from '../utils/torneoFormatters';
import { etiquetaDeporteTorneo } from '../utils/torneoDeporteFormato';
import {
  PARTIDOS_ABIERTOS_PREVIEW_LIMIT,
  sortPartidosAbiertosPorFechaHora,
} from '../components/PartidoAbiertoCard';
import PartidoAbiertoSedeRow from '../components/PartidoAbiertoSedeRow';
import ResenasSede from '../components/ResenasSede';
import { resolveSedeAmenityChips } from '../constants/sedeAmenities';
import './SedePublica.css';

const PHOTO_STRIP_H = 120;
const MAP_THUMB_MAX_H = 120;

const PADBOL_PAGE_GRADIENT = 'var(--bg-page)';
const SEDE_FOTOS_GALERIA_MAX = 20;

const toHttps = (url) => (url ? url.replace(/^http:\/\//, 'https://') : url);

const SEDE_HTTPS_SCALAR_KEYS = [
  'logo_url',
  'foto_portada',
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

function pickProximoTorneoActivoApi(torneos) {
  const hoy = ymdTodayTorneoTz();
  if (!Array.isArray(torneos)) return null;
  const candidatos = torneos.filter((t) => {
    const ymd = torneoFechaInicioYmd(t?.fecha_inicio);
    return ymd && (!hoy || ymd >= hoy);
  });
  candidatos.sort((a, b) =>
    String(a?.fecha_inicio || '').localeCompare(String(b?.fecha_inicio || ''))
  );
  return candidatos[0] ?? null;
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

const SEDE_INFO_CHIP_ICON_SIZE = 16;
const SEDE_INFO_CHIP_ICON_COLOR = '#ffffff';

/** Chip de ubicación: solo ciudad (dirección completa en `title`). */
function formatSedeDireccionChipLabel(sede) {
  const ciudad = String(sede?.ciudad || '').trim();
  if (ciudad) return ciudad;
  const fallback = String(sede?.direccion || '').trim();
  return fallback.length > 18 ? `${fallback.slice(0, 16)}…` : fallback;
}

function SedeInfoChipHorarioIcon({ size = SEDE_INFO_CHIP_ICON_SIZE }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={SEDE_INFO_CHIP_ICON_COLOR}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function SedeInfoChip({ icon, label, title, className }) {
  return (
    <span
      className={['sede-publica-info-chip', className].filter(Boolean).join(' ')}
      title={title || undefined}
    >
      <span className="sede-publica-info-chip__icon" aria-hidden>
        {icon}
      </span>
      <span className="sede-publica-info-chip__text">{label}</span>
    </span>
  );
}

/** Deportes únicos para el chip de canchas (activos o inferidos de la sede). */
function deportesParaChipCanchas(deportesActivos, sede) {
  if (deportesActivos?.length) return deportesActivos;
  const keys = new Set();
  for (const d of Array.isArray(sede?.deportes_disponibles) ? sede.deportes_disponibles : []) {
    const k = String(d).trim().toLowerCase();
    if (k) keys.add(k);
  }
  for (const c of Array.isArray(sede?.canchas_activas) ? sede.canchas_activas : []) {
    if (String(c?.estado || 'activa').toLowerCase() === 'inactiva') continue;
    const k = String(c.deporte || 'padbol').trim().toLowerCase();
    if (k) keys.add(k);
  }
  const fromSede = DEPORTES_CANCHA_SEDE_OPTIONS.filter((o) => keys.has(o.key));
  return fromSede.length ? fromSede : [{ key: 'padbol', label: 'Padbol' }];
}

/** Etiqueta e icono del chip de canchas según deportes de la sede. */
function buildSedeCanchasInfoChip(deportesActivos, canchasCount, sede) {
  const n = Number(canchasCount) || 0;
  if (n <= 0) return null;
  const deportes = deportesParaChipCanchas(deportesActivos, sede);
  const sportIconStyle = { color: SEDE_INFO_CHIP_ICON_COLOR };
  const fullLabel =
    deportes.length === 1
      ? `${n} ${n === 1 ? 'cancha' : 'canchas'} de ${deportes[0].label}`
      : `${n} ${n === 1 ? 'cancha' : 'canchas'}`;

  if (deportes.length === 1) {
    const { key, label: depLabel } = deportes[0];
    return {
      icon: (
        <SportIcon
          deporte={key}
          size={SEDE_INFO_CHIP_ICON_SIZE}
          color={SEDE_INFO_CHIP_ICON_COLOR}
          style={sportIconStyle}
        />
      ),
      label: `${n} · ${depLabel}`,
      title: fullLabel,
    };
  }
  return {
    icon: (
      <SportIcon
        size={SEDE_INFO_CHIP_ICON_SIZE}
        color={SEDE_INFO_CHIP_ICON_COLOR}
        style={sportIconStyle}
      />
    ),
    label: String(n),
    title: fullLabel,
  };
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

function IconTrophy({ size = 20 }) {
  return (
    <SedeInfoTablerIcon size={size}>
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

/** Normaliza URL/handle guardado en Mi Sede a href https clickeable. */
function ensureSedeSocialHref(key, raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return toHttps(s);
  if (/^www\./i.test(s)) return `https://${s}`;
  const handle = s.startsWith('@') ? s.slice(1) : null;
  if (handle) {
    if (key === 'instagram') return `https://www.instagram.com/${handle}/`;
    if (key === 'tiktok') return `https://www.tiktok.com/@${handle}`;
    if (key === 'twitter') return `https://x.com/${handle}`;
    if (key === 'youtube') return `https://www.youtube.com/@${handle}`;
  }
  if (key === 'website' && /^[a-z0-9.-]+\.[a-z]{2,}/i.test(s)) {
    return `https://${s.replace(/^\/\//, '')}`;
  }
  if (/^[a-z0-9._-]+$/i.test(s) && !s.includes('.')) {
    if (key === 'instagram') return `https://www.instagram.com/${s}/`;
    if (key === 'tiktok') return `https://www.tiktok.com/@${s}`;
    if (key === 'twitter') return `https://x.com/${s}`;
    if (key === 'youtube') return `https://www.youtube.com/@${s}`;
  }
  if (s.includes('.') && !/\s/.test(s)) return `https://${s.replace(/^\/\//, '')}`;
  return null;
}

function buildSedeSocialItems(sede) {
  if (!sede || typeof sede !== 'object') return [];
  return SEDE_INFO_SOCIAL_META.map((m) => {
    const href = ensureSedeSocialHref(m.key, sede[m.key]);
    if (!href) return null;
    return { ...m, href };
  }).filter(Boolean);
}

function SedeSocialLinks({ sede, t, variant = 'hero' }) {
  const items = buildSedeSocialItems(sede);
  if (!items.length) return null;
  const isHero = variant === 'hero';
  const labelRaw = t('sedes.publica.seguinosEn', { defaultValue: 'Seguinos en' });
  const label = isHero ? labelRaw.toUpperCase() : labelRaw;
  const rootClass = isHero ? 'sede-publica-hero-social' : 'sede-publica-section sede-publica-social';
  const labelClass = isHero ? 'sede-publica-hero-social__label' : 'sede-publica-social__label';
  const iconsClass = isHero ? 'sede-publica-hero-social__icons' : 'sede-publica-social__icons';
  const linkClass = isHero ? 'sede-publica-hero-social__link' : 'sede-publica-social__link';
  return (
    <div className={rootClass} aria-label={label}>
      <p className={labelClass}>{label}</p>
      <div className={iconsClass}>
        {items.map((m) => {
          const Icon = m.Icon;
          return (
            <a
              key={m.key}
              href={m.href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
              aria-label={m.label}
              title={m.label}
            >
              <Icon />
            </a>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Margen extra bajo AppHeader + BottomNav + chrome del header (ref. hubLayout) + safe-area.
 * Incluye el mismo stack que {@link hubContentPaddingTopCss} más buffer de hero.
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


function sedeFotosLista(sede) {
  return Array.isArray(sede?.fotos_urls)
    ? sede.fotos_urls
        .map((u) => toHttps(String(u || '').trim()))
        .filter(Boolean)
        .slice(0, SEDE_FOTOS_GALERIA_MAX)
    : [];
}

function sedeFotoPortadaKey(sede) {
  const direct = sedePhotoUrlKey(sede?.foto_portada);
  if (direct) return direct;
  const legacy = Array.isArray(sede?.fotos_destacadas) ? sede.fotos_destacadas[0] : null;
  return sedePhotoUrlKey(legacy);
}

/** Carrusel público: `fotos_urls` en orden de subida, sin la foto del hero. */
function sedeFotosCarruselLista(sede) {
  const portadaKey = sedeFotoPortadaKey(sede);
  return sedeFotosLista(sede).filter((u) => sedePhotoUrlKey(u) !== portadaKey);
}

/** Hero: `foto_portada` elegida en admin; si no hay, primera foto de la galería. */
function sedeHeroImageUrl(sede) {
  const portadaKey = sedeFotoPortadaKey(sede);
  if (portadaKey) {
    const todas = sedeFotosLista(sede);
    if (todas.some((u) => sedePhotoUrlKey(u) === portadaKey)) return portadaKey;
    return portadaKey;
  }
  return sedeFotosLista(sede)[0] || null;
}

function sedeHeroCacheBustToken(sede) {
  const portadaKey = sedeFotoPortadaKey(sede);
  const updated = sede?.updated_at ? String(sede.updated_at) : '';
  return [portadaKey, updated].filter(Boolean).join('::') || String(Date.now());
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
          <SportIcon
            deporte={d.key}
            size={14}
            color="#ffffff"
            className="sede-publica-hero-immersive__deporte-icon"
          />
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

/** Fila de miniaturas (~100×80px), scroll horizontal; tap abre lightbox con swipe. */
function SedeGaleriaHorizontal({ fotos, onOpenAtIndex }) {
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncScrollArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    syncScrollArrows();
    const el = trackRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', syncScrollArrows, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncScrollArrows) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', syncScrollArrows);
      ro?.disconnect();
    };
  }, [fotos, syncScrollArrows]);

  const scrollGallery = useCallback((direction) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 108, behavior: 'smooth' });
  }, []);

  if (!fotos.length) return null;

  return (
    <div className="sede-publica-galeria">
      {canScrollLeft ? (
        <button
          type="button"
          className="sede-publica-galeria__nav sede-publica-galeria__nav--prev"
          aria-label="Ver fotos anteriores"
          onClick={() => scrollGallery(-1)}
        >
          ‹
        </button>
      ) : null}
      <div ref={trackRef} className="sede-publica-galeria__track">
        {fotos.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            className="sede-publica-galeria__thumb"
            onClick={() => onOpenAtIndex(i)}
            aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
          >
            <img src={toHttps(url)} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
      {canScrollRight ? (
        <button
          type="button"
          className="sede-publica-galeria__nav sede-publica-galeria__nav--next"
          aria-label="Ver fotos siguientes"
          onClick={() => scrollGallery(1)}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

function SedeProximoTorneoSection({ sedeId, sedeIdNum, session, navigate, location, t, padbolLang, apiBase }) {
  const [loading, setLoading] = useState(true);
  const [torneoActivo, setTorneoActivo] = useState(null);
  const [cuposDisponibles, setCuposDisponibles] = useState(null);
  const [interesLoading, setInteresLoading] = useState(false);
  const [interesChecked, setInteresChecked] = useState(false);
  const [enListaEspera, setEnListaEspera] = useState(false);
  const [interesError, setInteresError] = useState('');

  useEffect(() => {
    if (!sedeIdNum) {
      setTorneoActivo(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `${apiBase}/api/torneos?sede_id=${encodeURIComponent(String(sedeIdNum))}&estado=activo`
        );
        const data = await res.json().catch(() => []);
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data)) {
          setTorneoActivo(null);
          return;
        }
        setTorneoActivo(pickProximoTorneoActivoApi(data));
      } catch {
        if (!cancelled) setTorneoActivo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sedeIdNum, apiBase]);

  useEffect(() => {
    if (!torneoActivo?.id) {
      setCuposDisponibles(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const max =
        torneoActivo.cupos_maximos != null && String(torneoActivo.cupos_maximos).trim() !== ''
          ? Number(torneoActivo.cupos_maximos)
          : NaN;
      if (!Number.isFinite(max) || max <= 0) {
        if (!cancelled) setCuposDisponibles(null);
        return;
      }
      const { data, error } = await supabase
        .from('equipos')
        .select('inscripcion_estado')
        .eq('torneo_id', torneoActivo.id);
      if (cancelled) return;
      if (error) {
        setCuposDisponibles(null);
        return;
      }
      const conf = (data || []).filter(
        (r) => String(r.inscripcion_estado || '').toLowerCase() === 'confirmado'
      ).length;
      setCuposDisponibles(Math.max(0, max - conf));
    })();
    return () => {
      cancelled = true;
    };
  }, [torneoActivo?.id, torneoActivo?.cupos_maximos]);

  useEffect(() => {
    if (torneoActivo || !sedeIdNum) {
      setEnListaEspera(false);
      setInteresChecked(true);
      return undefined;
    }
    if (!session?.access_token) {
      setEnListaEspera(false);
      setInteresChecked(true);
      return undefined;
    }
    let cancelled = false;
    setInteresChecked(false);
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/sedes/${encodeURIComponent(String(sedeIdNum))}/torneo-interes/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setEnListaEspera(Boolean(res.ok && data.enrolled));
      } catch {
        if (!cancelled) setEnListaEspera(false);
      } finally {
        if (!cancelled) setInteresChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [torneoActivo, sedeIdNum, session?.access_token, apiBase]);

  const toggleListaEspera = useCallback(async () => {
    if (!sedeIdNum) return;
    if (!session?.access_token) {
      const dest = authLoginRedirectPath(location);
      navigate(`/acceso?redirect=${encodeURIComponent(dest)}`);
      return;
    }
    setInteresLoading(true);
    setInteresError('');
    try {
      if (enListaEspera) {
        const res = await fetch(`${apiBase}/api/sedes/${encodeURIComponent(String(sedeIdNum))}/torneo-interes`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo salir de la lista');
        setEnListaEspera(false);
      } else {
        const res = await fetch(`${apiBase}/api/sedes/${encodeURIComponent(String(sedeIdNum))}/torneo-interes`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo anotar en la lista');
        setEnListaEspera(true);
      }
    } catch (e) {
      setInteresError(e?.message || String(e));
    } finally {
      setInteresLoading(false);
    }
  }, [sedeIdNum, session?.access_token, enListaEspera, apiBase, navigate, location]);

  const verTorneosBtn =
    sedeId != null && String(sedeId).trim() !== '' ? (
      <div className="sede-publica-proximo-torneo__ver-todos-wrap">
        <button
          type="button"
          className="sede-publica-proximo-torneo__ver-todos"
          onClick={() => navigate(`/torneos?sedeId=${encodeURIComponent(String(sedeId))}`)}
        >
          <IconTrophy size={16} />
          <span>{t('sedes.publica.verTorneos', { defaultValue: 'Ver torneos' })}</span>
        </button>
      </div>
    ) : null;

  if (loading) return null;

  if (torneoActivo) {
    const fechaLabel = formatFechaDiaMesPublica(torneoActivo.fecha_inicio, padbolLang) || '—';
    const deporteLabel = etiquetaDeporteTorneo(torneoActivo.deporte);
    const nivelLabel = formatNivelTorneo(torneoActivo.nivel_torneo);
    return (
      <section className="sede-publica-section sede-publica-proximo-torneo" aria-labelledby="sede-proximo-torneo-title">
        <h2 id="sede-proximo-torneo-title" className="sede-publica-section__title">
          {t('sedes.publica.proximoTorneo', { defaultValue: 'Próximo torneo' })}
        </h2>
        <div className="sede-publica-proximo-torneo__card sede-publica-proximo-torneo__card--activo">
          <h3 className="sede-publica-proximo-torneo__nombre">{torneoActivo.nombre || 'Torneo'}</h3>
          <ul className="sede-publica-proximo-torneo__meta">
            <li>
              <span aria-hidden>📅</span> {fechaLabel}
            </li>
            <li>
              <SportIcon deporte={torneoActivo.deporte} size={14} color="var(--text-secondary)" />
              {deporteLabel}
            </li>
            <li>
              <span aria-hidden>⭐</span> {nivelLabel}
            </li>
            {cuposDisponibles != null ? (
              <li>
                <span aria-hidden>🎫</span>{' '}
                {t('torneos.listado.cupos', {
                  count: cuposDisponibles,
                  defaultValue: `${cuposDisponibles} cupo${cuposDisponibles === 1 ? '' : 's'} disponible${cuposDisponibles === 1 ? '' : 's'}`,
                })}
              </li>
            ) : null}
          </ul>
          <button
            type="button"
            className="sede-publica-proximo-torneo__cta"
            onClick={() => navigate(`/torneo/${encodeURIComponent(String(torneoActivo.id))}`)}
          >
            {t('sedes.publica.inscribirmeTorneo', { defaultValue: 'Inscribirme' })}
          </button>
        </div>
        {verTorneosBtn}
      </section>
    );
  }

  return (
    <section className="sede-publica-section sede-publica-proximo-torneo" aria-labelledby="sede-proximo-torneo-title">
      <h2 id="sede-proximo-torneo-title" className="sede-publica-section__title">
        {t('sedes.publica.proximoTorneo', { defaultValue: 'Próximo torneo' })}
      </h2>
      <div className="sede-publica-proximo-torneo__card sede-publica-proximo-torneo__card--empty">
        <p className="sede-publica-proximo-torneo__empty-icon" aria-hidden>
          🏆
        </p>
        <p className="sede-publica-proximo-torneo__empty-text">
          {t('sedes.publica.sinTorneoProximo', {
            defaultValue: 'No hay torneos próximos — ¿querés jugar uno?',
          })}
        </p>
        {enListaEspera ? (
          <div className="sede-publica-proximo-torneo__waitlist-ok">
            <p className="sede-publica-proximo-torneo__waitlist-ok-text">
              {t('sedes.publica.enListaEsperaTorneo', {
                defaultValue: '✓ Estás en lista de espera — te avisaremos cuando haya un torneo',
              })}
            </p>
            <button
              type="button"
              className="sede-publica-proximo-torneo__waitlist-remove"
              disabled={interesLoading || !interesChecked}
              onClick={() => void toggleListaEspera()}
            >
              {t('sedes.publica.salirListaEsperaTorneo', { defaultValue: 'Salir de la lista' })}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="sede-publica-proximo-torneo__cta sede-publica-proximo-torneo__cta--waitlist"
            disabled={interesLoading || !interesChecked}
            onClick={() => void toggleListaEspera()}
          >
            {t('sedes.publica.anotarmeListaEspera', { defaultValue: 'Anotarme en lista de espera' })}
          </button>
        )}
        {interesError ? (
          <p className="sede-publica-proximo-torneo__error" role="alert">
            {interesError}
          </p>
        ) : null}
      </div>
      {verTorneosBtn}
    </section>
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
                <SportIcon deporte={dep} size={14} color="var(--text-secondary)" />
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
        touchAction: 'none',
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

function parsePartidosSedeResponse(data) {
  if (Array.isArray(data?.partidos)) return data.partidos;
  if (Array.isArray(data)) return data;
  return [];
}

/** Primario: GET /api/sedes/:id/partidos; fallback: /api/partidos-abiertos filtrado por sede. */
async function fetchPartidosSedePublica(sedeIdNum, headers = {}) {
  const primaryUrl = apiUrlResenas(
    `/api/sedes/${sedeIdNum}/partidos?upcoming=true`,
  );
  console.log('[SedePublica] partidos URL (primary)', {
    url: primaryUrl,
    apiBase: API_BASE_RESENAS,
    sedeId: sedeIdNum,
    hasAuth: Boolean(headers.Authorization),
  });

  try {
    const r = await fetch(primaryUrl, { headers });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      const list = parsePartidosSedeResponse(data);
      console.log('[SedePublica] partidos primary ok', { url: primaryUrl, count: list.length });
      return { list, error: false, source: 'sedes/:id/partidos' };
    }
    console.warn('[SedePublica] partidos primary HTTP error, fallback', {
      url: primaryUrl,
      status: r.status,
      body: data,
    });
  } catch (e) {
    console.warn('[SedePublica] partidos primary fetch failed, fallback', { url: primaryUrl, error: e });
  }

  const fallbackUrl = apiUrlResenas('/api/partidos/abiertos');
  console.log('[SedePublica] partidos URL (fallback)', {
    url: fallbackUrl,
    apiBase: API_BASE_RESENAS,
    sedeId: sedeIdNum,
    hasAuth: Boolean(headers.Authorization),
  });

  try {
    const r2 = await fetch(fallbackUrl, { headers });
    const data2 = await r2.json().catch(() => ({}));
    if (!r2.ok) {
      console.error('[SedePublica] partidos fallback HTTP error', {
        url: fallbackUrl,
        status: r2.status,
        body: data2,
      });
      return { list: [], error: true, source: null };
    }
    const all = parsePartidosSedeResponse(data2);
    const list = all.filter((p) => Number(p?.sede_id) === sedeIdNum);
    console.log('[SedePublica] partidos fallback ok', {
      url: fallbackUrl,
      total: all.length,
      filtered: list.length,
    });
    return { list, error: false, source: 'partidos/abiertos' };
  } catch (e2) {
    console.error('[SedePublica] partidos fallback fetch failed', { url: fallbackUrl, error: e2 });
    return { list: [], error: true, source: null };
  }
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
  const [partidosSedeError, setPartidosSedeError] = useState(false);
  const [partidosSedeVerTodos, setPartidosSedeVerTodos] = useState(false);
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

  const sedeIdNumLoad = useMemo(() => {
    const n = parseInt(String(sedeId), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [sedeId]);

  const partidosSedeOrdenados = useMemo(
    () => sortPartidosAbiertosPorFechaHora(partidosSede),
    [partidosSede]
  );

  const partidosSedeVisibles = useMemo(
    () =>
      partidosSedeVerTodos
        ? partidosSedeOrdenados
        : partidosSedeOrdenados.slice(0, PARTIDOS_ABIERTOS_PREVIEW_LIMIT),
    [partidosSedeOrdenados, partidosSedeVerTodos]
  );

  useEffect(() => {
    setPartidosSedeVerTodos(false);
  }, [sedeIdNumLoad]);

  useEffect(() => {
    if (!sedeIdNumLoad) {
      setPartidosSede([]);
      setPartidosSedeError(false);
      return undefined;
    }
    let cancelled = false;
    setPartidosSedeLoading(true);
    setPartidosSedeError(false);
    const headers = {};
    const token = session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;

    fetchPartidosSedePublica(sedeIdNumLoad, headers)
      .then(({ list, error, source }) => {
        if (cancelled) return;
        console.log('[SedePublica] partidos result', {
          sedeId: sedeIdNumLoad,
          source,
          count: list.length,
          error,
        });
        setPartidosSede(list);
        setPartidosSedeError(error);
      })
      .catch((e) => {
        console.error('[SedePublica] partidos load unexpected error', { sedeId: sedeIdNumLoad, error: e });
        if (!cancelled) {
          setPartidosSede([]);
          setPartidosSedeError(true);
        }
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
      className={
        sedeViewReady
          ? `sede-publica-root sede-publica-root--immersive${navDock === 'bottom' ? ' sede-publica-root--nav-dock-bottom' : ''}`
          : undefined
      }
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
        const fotos = sedeFotosCarruselLista(sede);
        const horario = formatHorario(sede.horario_apertura, sede.horario_cierre);
        const hasAddress = Boolean(sede.direccion || sede.ciudad || sede.pais);
        const heroImgRaw = sedeHeroImageUrl(sede);
        const heroImg = heroImgRaw
          ? sedePhotoUrlWithCacheBust(heroImgRaw, sedeHeroCacheBustToken(sede))
          : null;
        const direccionLinea = [sede.direccion, sede.ciudad, sede.pais].filter(Boolean).join(', ');
        const direccionChipLabel = formatSedeDireccionChipLabel(sede);
        const deportesChips = deportesActivosSedePublica(sede, preciosDeporteRows);
        const amenityChips = resolveSedeAmenityChips(sede.amenities);
        const canchasCount = resolveSedeCanchasCount(sede, sedePerfilCanchasCount);
        const canchasInfoChip = buildSedeCanchasInfoChip(deportesChips, canchasCount, sede);
        return (
          <>
          <div
            className="sede-publica-page__column sede-publica-page__column--sticky-reservar"
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
                  <h1 className="sede-publica-hero-immersive__nombre">
                    {sede.nombre || '(sin nombre)'}
                  </h1>
                  {direccionLinea ? (
                    <p className="sede-publica-hero-immersive__direccion">{direccionLinea}</p>
                  ) : null}
                  {licenciaActiva ? (
                    <div className="sede-publica-hero-immersive__licencia-wrap">
                      <span className="sede-publica-hero-immersive__licencia">
                        {t('sedes.publica.licenciaBadge', { defaultValue: 'PADBOL' })}
                      </span>
                      <span className="sede-publica-hero-immersive__licencia-status">
                        {t('sedes.publica.licenciaActivaLine', { defaultValue: '✓ Licencia activa' })}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="sede-publica-hero-immersive__br-stack">
                  <SedeDeportesChipsHero deportes={deportesChips} t={t} />
                  <SedeSocialLinks sede={sede} t={t} variant="hero" />
                </div>
            </section>

            <article className="sede-publica-page">
            <div className="sede-publica-info-chips-row" aria-label="Información rápida">
              {direccionLinea ? (
                <SedeInfoChip
                  icon={<IconGeroUbicacion size={SEDE_INFO_CHIP_ICON_SIZE} color={SEDE_INFO_CHIP_ICON_COLOR} />}
                  label={direccionChipLabel || direccionLinea}
                  title={direccionLinea}
                />
              ) : null}
              {horario ? (
                <SedeInfoChip icon={<SedeInfoChipHorarioIcon />} label={horario} />
              ) : null}
              {canchasInfoChip ? (
                <SedeInfoChip
                  icon={canchasInfoChip.icon}
                  label={canchasInfoChip.label}
                  title={canchasInfoChip.title}
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

            {!partidosSedeLoading && partidosSedeOrdenados.length > 0 ? (
              <section className="sede-publica-section sede-publica-partidos">
                <h2 className="sede-publica-section__title">Partidos abiertos</h2>
                <div className="sede-publica-partidos__list">
                  {partidosSedeVisibles.map((p) => (
                    <PartidoAbiertoSedeRow key={p.id} partido={p} onJoin={() => navigate('/jugar/buscar')} />
                  ))}
                </div>
                {partidosSedeOrdenados.length > PARTIDOS_ABIERTOS_PREVIEW_LIMIT && !partidosSedeVerTodos ? (
                  <button
                    type="button"
                    className="partidos-abiertos-ver-mas"
                    onClick={() => setPartidosSedeVerTodos(true)}
                  >
                    Ver más partidos →
                  </button>
                ) : null}
              </section>
            ) : null}

            <SedeProximoTorneoSection
              sedeId={sedeId}
              sedeIdNum={sedeIdNumLoad}
              session={session}
              navigate={navigate}
              location={location}
              t={t}
              padbolLang={padbolLang}
              apiBase={API_BASE_RESENAS}
            />

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
              <ResenasSede
                sedeId={sedeId}
                accessToken={session?.access_token ?? null}
                navigate={navigate}
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
          <div className="sede-publica-reservar-sticky">
            <button
              type="button"
              className="sede-publica-btn sede-publica-btn--primary sede-publica-reservar-sticky__btn"
              onClick={() => navigate(`/reservar?sedeId=${encodeURIComponent(String(sedeId))}`)}
            >
              {t('sedes.publica.reservarCancha', { defaultValue: 'Reservar cancha' })}
            </button>
          </div>
          </>
        );
      })()}
      <BottomNav />
    </div>
  );
}
