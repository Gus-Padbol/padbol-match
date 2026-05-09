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
import {
  APP_HEADER_OUTER_PADDING_PX,
  HUB_CONTENT_PADDING_BOTTOM_PX,
  HUB_FIXED_CHROME_SLACK_PX,
  hubContentPaddingTopCss,
  hubContentPaddingTopPx,
  hubInstagramColumnWrapStyle,
} from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import { supabase } from '../supabaseClient';
import { getDisplayName } from '../utils/displayName';
import { badgeTorneoEstadoPublico } from '../utils/torneoEstadoPublico';
import {
  esInscripcionAbiertaTorneo,
  esProximoTorneo,
} from '../utils/torneoEstadoFiltroPills';

const PHOTO_STRIP_H = 120;
const MAP_THUMB_MAX_H = 120;

const PADBOL_PAGE_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const FOTOS_DESTACADAS_MAX = 4;

/** Misma apariencia que el CTA inferior «Reservar cancha» en esta vista. */
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
  background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: '15px',
  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.45)',
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

function normalizeHexColor(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s;
  if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

function heroGradientSedePublica(sede) {
  const p = normalizeHexColor(sede?.color_hero_primario) || '#4C1D95';
  const s = normalizeHexColor(sede?.color_hero_secundario) || '#7C3AED';
  return `linear-gradient(135deg, ${p} 0%, ${s} 100%)`;
}

function heroBordeExteriorSede(sede) {
  return normalizeHexColor(sede?.color_borde_hero) || '#6D28D9';
}

function luminanciaRelativaHex(hex) {
  const h = normalizeHexColor(hex) || '#4C1D95';
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Texto principal del hero según luminosidad del color primario de la sede. */
function heroTextoTituloSede(sede) {
  const prim = normalizeHexColor(sede?.color_hero_primario) || '#4C1D95';
  return luminanciaRelativaHex(prim) < 0.5 ? '#ffffff' : '#0f172a';
}

function heroTextoFraseSede(sede) {
  return heroTextoTituloSede(sede) === '#ffffff' ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.88)';
}

function heroBordeBloqueDerechoSede(sede) {
  return heroTextoTituloSede(sede) === '#ffffff' ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.2)';
}

function colorFondoLogoSede(sedeRow) {
  return normalizeHexColor(sedeRow?.color_fondo_logo) || '#000000';
}

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
 * Incluye {@link APP_HEADER_OUTER_PADDING_PX} como en {@link hubContentPaddingTopCss} para que el hero no quede bajo la barra fija.
 */
const SEDE_PUBLIC_SCROLL_EXTRA_TOP_PX = 36;

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

function buildOpenMapsHref(direccion, ciudad, pais, latitud, longitud) {
  const lat = latitud != null && latitud !== '' ? Number(latitud) : NaN;
  const lon = longitud != null && longitud !== '' ? Number(longitud) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://maps.google.com/?q=${lat},${lon}`;
  }
  return buildMapsSearchHref(direccion, ciudad, pais);
}

function parseAnioFundacionSedePublica(raw) {
  const y = parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(y) || y < 1800 || y > 2100) return null;
  return y;
}

/** Al menos un dato útil para la sección «En números». */
function sedeTieneSeccionEnNumeros(stats, sedeRow) {
  if (parseAnioFundacionSedePublica(sedeRow?.anio_fundacion) != null) return true;
  if (!stats || typeof stats !== 'object') return false;
  if ((Number(stats.torneos_realizados_total) || 0) > 0) return true;
  if ((Number(stats.jugadores_reservaron_total) || 0) > 0) return true;
  const d = stats.deporte_mas_jugado;
  if (d && ((Number(d.torneos) || 0) > 0 || (Number(d.canchas_cantidad) || 0) > 0)) return true;
  return false;
}

/**
 * URLs del carrusel: `fotos_destacadas` en orden (máx. 4), solo si existen en `fotos_urls`;
 * si no, primeras 4 de la galería.
 */
function urlsCarruselSedePublica(sede) {
  const todas = Array.isArray(sede?.fotos_urls)
    ? sede.fotos_urls.map((u) => String(u || '').trim()).filter(Boolean)
    : [];
  const dest = Array.isArray(sede?.fotos_destacadas)
    ? sede.fotos_destacadas.map((u) => String(u || '').trim()).filter(Boolean)
    : [];
  const resolved = dest.filter((u) => todas.includes(u)).slice(0, FOTOS_DESTACADAS_MAX);
  if (resolved.length > 0) return { urls: resolved, usarOrden: true };
  return { urls: todas.slice(0, FOTOS_DESTACADAS_MAX), usarOrden: false };
}

/** Tres fotos visibles a la vez (~30% c/u + gap 8px); scroll horizontal si hay más. */
const CARRUSEL_GAP_PX = 8;
const CARRUSEL_SLIDE_BASIS = `calc((100% - ${2 * CARRUSEL_GAP_PX}px) / 3)`;

/** Primeras fotos en carrusel destacado (scroll-snap, sin autoplay). Sin badges numéricos. */
function SedeFotosCarruselDestacado({ urls, onOpenAtIndex }) {
  const slice = urls.slice(0, Math.min(FOTOS_DESTACADAS_MAX, urls.length));
  if (!slice.length) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div
        style={{
          display: 'flex',
          gap: `${CARRUSEL_GAP_PX}px`,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '6px',
          paddingLeft: '2px',
          paddingRight: '2px',
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        {slice.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => onOpenAtIndex(i)}
            style={{
              flex: `0 0 ${CARRUSEL_SLIDE_BASIS}`,
              maxWidth: CARRUSEL_SLIDE_BASIS,
              scrollSnapAlign: 'start',
              height: PHOTO_STRIP_H,
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#e2e8f0',
              boxShadow: '0 2px 10px rgba(15, 23, 42, 0.15)',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <img
              src={url}
              alt="Instalaciones de la sede"
              style={{
                width: '100%',
                height: PHOTO_STRIP_H,
                display: 'block',
                objectFit: 'cover',
              }}
            />
          </button>
        ))}
      </div>
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

  const url = fotos[index];

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
    () => buildOpenMapsHref(direccion, ciudad, pais, latitud, longitud),
    [direccion, ciudad, pais, latitud, longitud]
  );
  const embedSrc = useMemo(() => {
    const lat = latitud != null && latitud !== '' ? Number(latitud) : NaN;
    const lon = longitud != null && longitud !== '' ? Number(longitud) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return `https://maps.google.com/maps?q=${lat},${lon}&z=16&output=embed`;
    }
    const parts = [direccion, ciudad, pais].filter(Boolean);
    if (!parts.length) return null;
    return `https://maps.google.com/maps?q=${encodeURIComponent(parts.join(', '))}&output=embed`;
  }, [direccion, ciudad, pais, latitud, longitud]);

  if (!embedSrc && !openMapsHref) return null;

  return (
    <div style={{ position: 'relative' }}>
      {embedSrc ? (
        <div
          style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            maxHeight: MAP_THUMB_MAX_H,
            boxShadow: '0 1px 6px rgba(15, 23, 42, 0.12)',
            background: '#e2e8f0',
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
            src={embedSrc}
          />
          {openMapsHref ? (
            <a
              href={openMapsHref}
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
            href={openMapsHref}
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

/** Icono en fila de contacto: integrado al fondo púrpura, sin caja blanca. */
function iconWrapSedeContacto(emoji) {
  return (
    <span
      style={{
        flexShrink: 0,
        width: '24px',
        height: '24px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.2)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        lineHeight: 1,
      }}
    >
      {emoji}
    </span>
  );
}

/** Logo oficial WhatsApp (marca), color #25D366. */
function WhatsAppLogoSvg({ size = 20 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="#25D366"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
      />
    </svg>
  );
}

const SEDE_SOCIAL_CHIPS_META = [
  {
    key: 'instagram',
    name: 'Instagram',
    iconBg: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    iconColor: '#fff',
    iconLabel: 'IG',
    iconFontSize: '8px',
  },
  {
    key: 'facebook',
    name: 'Facebook',
    iconBg: '#1877f2',
    iconColor: '#fff',
    iconLabel: 'f',
    iconFontSize: '12px',
    iconFontWeight: 800,
    iconFontFamily: 'system-ui, "Helvetica Neue", Arial, sans-serif',
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    iconBg: '#010101',
    iconColor: '#fff',
    iconLabel: '♪',
    iconFontSize: '11px',
  },
  {
    key: 'twitter',
    name: 'X',
    iconBg: '#000',
    iconColor: '#fff',
    iconLabel: 'X',
    iconFontSize: '10px',
    iconFontWeight: 800,
  },
  {
    key: 'youtube',
    name: 'YouTube',
    iconBg: '#ff0000',
    iconColor: '#fff',
    iconLabel: '▶',
    iconFontSize: '9px',
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    iconBg: '#0a66c2',
    iconColor: '#fff',
    iconLabel: 'in',
    iconFontSize: '9px',
    iconFontWeight: 800,
    iconFontFamily: 'system-ui, sans-serif',
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    iconBg: '#25d366',
    iconColor: '#fff',
    iconLabel: 'W',
    iconFontSize: '10px',
    iconFontWeight: 800,
  },
  {
    key: 'website',
    name: 'Web',
    iconBg: '#475569',
    iconColor: '#fff',
    iconLabel: '🔗',
    iconFontSize: '10px',
  },
];

/** Chips de redes debajo de contacto; solo si hay al menos una URL. */
function SedeSocialChips({ sede }) {
  const items = SEDE_SOCIAL_CHIPS_META.filter((m) => {
    const v = sede[m.key];
    return v != null && String(v).trim() !== '';
  });
  if (!items.length) return null;

  return (
    <div style={{ marginBottom: '12px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#64748b',
          marginBottom: '6px',
        }}
      >
        Seguinos
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center',
        }}
      >
        {items.map((m) => (
          <a
            key={m.key}
            href={String(sede[m.key]).trim()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px 5px 5px',
              borderRadius: '999px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              textDecoration: 'none',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '6px',
                background: m.iconBg,
                color: m.iconColor,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: m.iconFontSize,
                fontWeight: m.iconFontWeight ?? 700,
                fontFamily: m.iconFontFamily ?? 'inherit',
                lineHeight: 1,
                flexShrink: 0,
              }}
              aria-hidden
            >
              {m.iconLabel}
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                whiteSpace: 'nowrap',
              }}
            >
              {m.name}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** Contacto: iconos + texto, mismo lenguaje visual que el bloque «Sobre el club». */
function CompactContactCard({ sede, horario, hasAddress }) {
  const waNumber = sede.telefono
    ? (() => {
        const digits = String(sede.telefono).replace(/\D/g, '');
        return digits.startsWith('0') ? `54${digits.slice(1)}` : digits;
      })()
    : '';

  const rowTextStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '24px',
    fontSize: '13px',
    color: 'rgba(248,250,252,0.92)',
    lineHeight: 1.45,
  };

  const line = (icon, content) => (
    <div style={rowTextStyle}>
      {iconWrapSedeContacto(icon)}
      <span style={{ flex: 1, minWidth: 0 }}>{content}</span>
    </div>
  );

  const rows = [];
  if (hasAddress) {
    rows.push(
      line('📍', [sede.direccion, sede.ciudad, sede.pais].filter(Boolean).join(', '))
    );
  }
  if (horario) rows.push(line('⏰', `Abierto ${horario}`));
  if (waNumber) {
    rows.push(
      <div key="wa-contact" style={rowTextStyle}>
        <span
          style={{
            flexShrink: 0,
            width: '24px',
            height: '24px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
          aria-hidden
        >
          <WhatsAppLogoSvg size={18} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <a
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#bbf7d0', fontWeight: 700, textDecoration: 'none' }}
          >
            Escribinos por WhatsApp
          </a>
        </span>
      </div>
    );
  }
  if (sede.email_contacto) {
    rows.push(
      line(
        '✉️',
        <a
          href={`mailto:${sede.email_contacto}`}
          style={{ color: '#bae6fd', fontWeight: 600, textDecoration: 'none', wordBreak: 'break-all' }}
        >
          {sede.email_contacto}
        </a>
      )
    );
  }

  if (!rows.length) {
    return (
      <div
        style={{
          marginBottom: '14px',
          fontSize: '13px',
          color: 'rgba(248,250,252,0.55)',
          fontStyle: 'italic',
        }}
      >
        Sin información de contacto cargada.
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <h3
        style={{
          margin: '4px 0 2px',
          fontSize: '14px',
          fontWeight: 800,
          color: '#e2e8f0',
          letterSpacing: '0.02em',
        }}
      >
        Contacto y ubicación
      </h3>
      {rows}
    </div>
  );
}

const API_BASE_RESENAS = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

function apiUrlResenas(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_RESENAS}${p}`;
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
            color: i <= v ? '#fbbf24' : 'rgba(226,232,240,0.35)',
          }}
        >
          ★
        </span>
      ))}
    </span>
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
            color: v >= n ? '#fbbf24' : 'rgba(248,250,252,0.28)',
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
  const foto = r?.autor?.foto_url;
  const ini = nombre ? nombre.charAt(0).toUpperCase() : '?';
  const showApodoSub = apodo && nombre && apodo.toLowerCase() !== nombre.toLowerCase();
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        padding: '12px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.12)',
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
          background: 'rgba(15,23,42,0.55)',
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
              color: '#e2e8f0',
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
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc' }}>{nombre}</span>
              <EstrellasSoloLectura value={r.estrellas} />
              <span style={{ fontSize: '12px', color: 'rgba(226,232,240,0.65)' }}>
                {formatFechaResenaPublica(r.created_at)}
              </span>
            </div>
            {showApodoSub ? (
              <div style={{ marginTop: '4px', fontSize: '12px', color: 'rgba(226,232,240,0.55)', fontWeight: 600 }}>
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
                border: '1px solid rgba(248,113,113,0.45)',
                background: 'rgba(127,29,29,0.35)',
                color: '#fecaca',
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
              color: 'rgba(248,250,252,0.9)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {r.comentario}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SedeResenasSeccion({ sedeId, accessToken, navigate, isSuperAdmin }) {
  const idNum = useMemo(() => parseInt(String(sedeId), 10), [sedeId]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
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
    setErr('');
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      const r = await fetch(apiUrlResenas(`/api/sedes/${idNum}/resenas?limit=5&offset=0`), { headers });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        const raw = String(body.error || '');
        const friendly =
          body.code === 'RESENAS_TABLE_MISSING' || body.code === 'SEDE_RESENAS_TABLE_MISSING'
            ? raw
            : /schema cache|public\.resenas|\bresenas\b/i.test(raw)
              ? 'Las reseñas no están disponibles: en Supabase debe existir y exponerse la tabla public.resenas. Ejecuta padbol-backend/sql/resenas_sedes.sql.'
              : raw || `Error ${r.status}`;
        throw new Error(friendly);
      }
      setPayload(body);
    } catch (e) {
      setErr(e.message || 'Error');
      setPayload(null);
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
              ? 'Las reseñas no están disponibles: creá o actualizá public.resenas en Supabase (ver resenas_sedes.sql).'
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
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.2)',
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
          color: '#f8fafc',
        }}
      >
        Reseñas
      </h2>
      {loading ? (
        <p style={{ margin: 0, color: 'rgba(248,250,252,0.65)', fontSize: '13px' }}>Cargando reseñas…</p>
      ) : err ? (
        <p style={{ margin: 0, color: '#fecaca', fontSize: '13px' }}>{err}</p>
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
              <span style={{ fontSize: '12px', color: 'rgba(226,232,240,0.75)' }}>
                {payload?.total
                  ? `${payload.total} reseña${payload.total === 1 ? '' : 's'}`
                  : 'Sin reseñas aún'}
              </span>
            </div>
          </div>

          {!accessToken ? (
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'rgba(248,250,252,0.88)' }}>
              <button
                type="button"
                onClick={() => navigate('/auth')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#93c5fd',
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
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'rgba(226,232,240,0.88)' }}>
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
                  border: '1px solid rgba(255,255,255,0.35)',
                  background: 'rgba(255,255,255,0.14)',
                  color: '#f8fafc',
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
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'rgba(226,232,240,0.82)', lineHeight: 1.45 }}>
              Solo jugadores con al menos una <strong>reserva confirmada</strong> en esta sede pueden dejar una reseña.
            </p>
          )}

          {lista.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: 'rgba(248,250,252,0.55)',
                fontStyle: 'italic',
              }}
            >
              Sé el primero en contar tu experiencia.
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
                border: '1px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.1)',
                color: '#f8fafc',
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
              background: 'linear-gradient(135deg, #4c1d95 0%, #5b21b6 100%)',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
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
                borderBottom: '1px solid rgba(255,255,255,0.15)',
                flexShrink: 0,
              }}
            >
              <span id="sede-resenas-modal-title" style={{ fontWeight: 800, color: '#f8fafc', fontSize: '16px' }}>
                Todas las reseñas
              </span>
              <button
                type="button"
                onClick={() => setVerTodasOpen(false)}
                style={{
                  border: 'none',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '20px',
                  lineHeight: 1,
                }}
                aria-label="Cerrar"
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
                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '14px' }}>Cargando…</p>
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
                    color: 'rgba(226,232,240,0.65)',
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
              background: 'linear-gradient(135deg, #4c1d95 0%, #5b21b6 100%)',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
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
              <span id="sede-resena-form-title" style={{ fontWeight: 800, color: '#f8fafc', fontSize: '16px' }}>
                Tu reseña
              </span>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setFormModalOpen(false)}
                style={{
                  border: 'none',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: '20px',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'rgba(226,232,240,0.85)', lineHeight: 1.4 }}>
              Elige las estrellas y, si quieres, escribe un comentario. Solo se publica cuando tocas «Publicar reseña».
            </p>
            <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
              Calificación <span style={{ color: '#fecaca' }}>*</span>
            </div>
            <EstrellasInteractivas value={estrellasForm} onChange={setEstrellasForm} disabled={submitting} />
            <label
              style={{ display: 'block', marginTop: '14px', fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}
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
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(15,23,42,0.45)',
                color: '#f8fafc',
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
              <span style={{ fontSize: '11px', color: 'rgba(226,232,240,0.55)' }}>
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
                    border: '1px solid rgba(255,255,255,0.35)',
                    background: 'transparent',
                    color: '#e2e8f0',
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
                    background: '#22c55e',
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
                  color: formMsg.startsWith('¡') ? '#bbf7d0' : '#fecaca',
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
  const { sedeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, userProfile } = useAuth();

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return {
      email: em,
      nombre: getDisplayName(userProfile, session) || '',
      whatsapp: String(userProfile?.whatsapp || '').trim(),
      foto: userProfile?.foto_url ?? userProfile?.foto ?? null,
    };
  }, [session, userProfile]);

  const { rol: userRol } = useUserRole(currentCliente);
  const isSuperAdmin = userRol === 'super_admin';
  /** Hueco bajo AppHeader + BottomNav fijos + safe-area + buffer (hero y resto del scroll). */
  const sedeScrollPaddingTopCss = useMemo(
    () =>
      `calc(${hubContentPaddingTopPx(location.pathname) + APP_HEADER_OUTER_PADDING_PX + HUB_FIXED_CHROME_SLACK_PX}px + env(safe-area-inset-top, 0px) + ${SEDE_PUBLIC_SCROLL_EXTRA_TOP_PX}px)`,
    [location.pathname]
  );
  const [sede, setSede] = useState(null);
  /** Viene en `GET /api/sedes/:id` como `estadisticas_publicas` (null si solo fallback Supabase). */
  const [estadisticasPublicas, setEstadisticasPublicas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fotosGalleryOpen, setFotosGalleryOpen] = useState(false);
  const [fotosGalleryIndex, setFotosGalleryIndex] = useState(0);
  const [proximosTorneos, setProximosTorneos] = useState([]);
  const [proximosTorneosLoading, setProximosTorneosLoading] = useState(false);
  const [sedeShareCopied, setSedeShareCopied] = useState(false);

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

  useEffect(() => {
    if (!sedeId) {
      setProximosTorneos([]);
      return;
    }
    const id = parseInt(String(sedeId), 10);
    if (!Number.isFinite(id)) {
      setProximosTorneos([]);
      return;
    }
    let cancelled = false;
    setProximosTorneosLoading(true);
    supabase
      .from('torneos')
      .select('id, nombre, fecha_inicio, fecha_fin, estado')
      .eq('sede_id', id)
      .order('fecha_inicio', { ascending: true })
      .limit(48)
      .then(({ data, error: qErr }) => {
        if (cancelled) return;
        if (qErr || !Array.isArray(data)) {
          setProximosTorneos([]);
          setProximosTorneosLoading(false);
          return;
        }
        const elegibles = data.filter(
          (t) =>
            esInscripcionAbiertaTorneo(t?.estado) || esProximoTorneo(t?.estado)
        );
        setProximosTorneos(elegibles.slice(0, 2));
        setProximosTorneosLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setProximosTorneos([]);
          setProximosTorneosLoading(false);
        }
      });
    return () => {
      cancelled = true;
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

    (async () => {
      try {
        const r = await fetch(apiUrlResenas(`/api/sedes/${idNum}`));
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.ok) {
          const { estadisticas_publicas: stats, ...rest } = j;
          if (!rest || rest.id == null) {
            setError(`Sede con id ${sedeId} no encontrada.`);
            setSede(null);
            setEstadisticasPublicas(null);
          } else {
            setError('');
            setSede(rest);
            setEstadisticasPublicas(stats ?? null);
          }
          return;
        }
      } catch {
        /* fallback */
      }
      if (cancelled) return;
      try {
        const { data, error: err } = await supabase.from('sedes').select('*').eq('id', idNum).maybeSingle();
        if (cancelled) return;
        if (err) setError(`Error al cargar sede: ${err.message}`);
        else if (!data) setError(`Sede con id ${sedeId} no encontrada.`);
        else {
          setError('');
          setSede(data);
          setEstadisticasPublicas(null);
        }
      } catch (err) {
        if (!cancelled) setError('Error inesperado: ' + (err?.message || String(err)));
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [sedeId]);

  const sedeViewReady = !loading && !error && sede;

  const rootPageStyle = sedeViewReady
    ? {
        height: '100dvh',
        maxHeight: '100dvh',
        minHeight: '100dvh',
        background: PADBOL_PAGE_GRADIENT,
        paddingTop: 0,
        paddingBottom: 0,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        overscrollBehaviorY: 'contain',
      }
    : {
        minHeight: '100dvh',
        background: PADBOL_PAGE_GRADIENT,
        paddingTop: hubContentPaddingTopCss(location.pathname),
        paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px`,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        overscrollBehaviorY: 'contain',
      };

  return (
    <div style={rootPageStyle}>
      <AppHeader title="" showBack hideLogout />

      {loading && (
        <div
          style={{
            minHeight: '50vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', fontWeight: 600 }}>Cargando sede…</p>
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
          <p style={{ color: '#fff', fontSize: '15px', fontWeight: 600, textAlign: 'center' }}>
            {error || 'Sede no encontrada.'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>sedeId: {sedeId ?? '(undefined)'}</p>
        </div>
      )}

      {!loading && !error && sede && (() => {
        const licenciaActiva = sede.licencia_activa === true && sede.numero_licencia;
        const fotos = Array.isArray(sede.fotos_urls) ? sede.fotos_urls : [];
        const { urls: fotosCarrusel } = urlsCarruselSedePublica(sede);
        const horario = formatHorario(sede.horario_apertura, sede.horario_cierre);
        const hasAddress = Boolean(sede.direccion || sede.ciudad || sede.pais);
        const desc = sede.descripcion ? String(sede.descripcion).trim() : '';
        const fraseHero = desc || SEDE_HERO_FRASE_DEFAULT;
        const nombreSedeCta = String(sede.nombre || 'esta sede').trim();
        const torneosCtaLabel = `Ver torneos de ${nombreSedeCta}`;
        return (
          <>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {/* paddingTop aquí: el scroll interno respeta el hueco bajo AppHeader + BottomNav fijos. */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                overscrollBehaviorY: 'contain',
                scrollPaddingTop: sedeScrollPaddingTopCss,
              }}
            >
            <div
              style={{
                ...hubInstagramColumnWrapStyle,
                overflowX: 'hidden',
                paddingTop: sedeScrollPaddingTopCss,
                paddingLeft: 'max(6px, env(safe-area-inset-left, 0px))',
                paddingRight: 'max(6px, env(safe-area-inset-right, 0px))',
              }}
            >
            <div
              style={{
                position: 'relative',
                borderRadius: '16px',
                marginLeft: '6px',
                marginRight: '6px',
                marginTop: '6px',
                boxShadow: '0 8px 28px rgba(0, 0, 0, 0.22)',
                overflow: 'visible',
                border: `2px solid ${heroBordeExteriorSede(sede)}`,
                boxSizing: 'border-box',
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: heroGradientSedePublica(sede),
                  borderRadius: '14px',
                  zIndex: 0,
                }}
              />

              {typeof window !== 'undefined' && sedeId ? (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    zIndex: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '4px',
                    pointerEvents: 'none',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void handleShareSede()}
                    aria-label="Compartir sede"
                    title="Compartir sede"
                    style={{
                      pointerEvents: 'auto',
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.38)',
                      background: 'rgba(15,23,42,0.32)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      color: '#ffffff',
                      lineHeight: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      margin: 0,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
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
                    <span
                      role="status"
                      style={{
                        pointerEvents: 'none',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#f8fafc',
                        background: 'rgba(15,23,42,0.72)',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.22)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Copiado
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  padding: '8px 10px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    gap: '10px',
                    width: '100%',
                    minHeight: '96px',
                  }}
                >
                  <div
                    style={{
                      width: 'min(32vw, 124px)',
                      minWidth: '92px',
                      maxWidth: '124px',
                      aspectRatio: '1',
                      flexShrink: 0,
                      alignSelf: 'center',
                      borderRadius: '16px',
                      background: colorFondoLogoSede(sede),
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
                    }}
                  >
                    {sede.logo_url ? (
                      <img
                        src={sede.logo_url}
                        alt=""
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          objectPosition: 'center center',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'rgba(248,250,252,0.35)',
                          fontSize: '40px',
                          lineHeight: 1,
                        }}
                        aria-hidden
                      >
                        ⚽
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: '8px',
                      background: heroGradientSedePublica(sede),
                      borderRadius: '12px',
                      padding: '10px 12px',
                      boxSizing: 'border-box',
                      border: `1px solid ${heroBordeBloqueDerechoSede(sede)}`,
                      justifyContent: 'center',
                    }}
                  >
                    <h1
                      style={{
                        color: heroTextoTituloSede(sede),
                        fontSize: `${heroClubNameFontSizePx(sede.nombre)}px`,
                        fontWeight: 800,
                        margin: 0,
                        lineHeight: 1.2,
                        minWidth: 0,
                        textAlign: 'center',
                        wordBreak: 'break-word',
                        textShadow:
                          heroTextoTituloSede(sede) === '#ffffff'
                            ? '0 1px 8px rgba(0,0,0,0.35)'
                            : '0 1px 4px rgba(255,255,255,0.35)',
                        boxSizing: 'border-box',
                      }}
                      title={sede.nombre || ''}
                    >
                      {sede.nombre || '(sin nombre)'}
                    </h1>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%',
                      }}
                    >
                      {licenciaActiva ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 11px',
                            borderRadius: '999px',
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            background: 'rgba(254, 243, 199, 0.92)',
                            color: '#92400e',
                            border: '1px solid rgba(217,119,6,0.45)',
                          }}
                        >
                          ⭐ Licencia PADBOL Activa
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '5px 11px',
                            borderRadius: '999px',
                            fontSize: '10px',
                            fontWeight: 600,
                            background: 'rgba(254,226,226,0.9)',
                            color: '#b91c1c',
                            border: '1px solid rgba(220,38,38,0.25)',
                          }}
                        >
                          No habilitado
                        </span>
                      )}
                    </div>

                    <p
                      style={{
                        margin: 0,
                        color: heroTextoFraseSede(sede),
                        fontSize: '13px',
                        lineHeight: 1.45,
                        fontStyle: 'italic',
                        textAlign: 'center',
                        width: '100%',
                        display: 'block',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {fraseHero}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                padding: '14px 8px 6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => navigate(`/reservar?sedeId=${sedeId}`)}
                style={{ ...SEDE_BTN_RESERVAR_CANCHA_STYLE, ...SEDE_CTA_NARROW_CENTERED }}
              >
                ⚽ Reservar cancha
              </button>
            </div>

            <div style={{ width: '100%', maxWidth: '100%', margin: 0, padding: '10px 14px 0', boxSizing: 'border-box' }}>
              <SedeFotosCarruselDestacado
                urls={fotosCarrusel}
                onOpenAtIndex={(i) => {
                  const url = fotosCarrusel[i];
                  const idxFull = url ? fotos.indexOf(url) : -1;
                  setFotosGalleryIndex(idxFull >= 0 ? idxFull : 0);
                  setFotosGalleryOpen(true);
                }}
              />
              {fotos.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setFotosGalleryIndex(0);
                    setFotosGalleryOpen(true);
                  }}
                  style={{
                    ...SEDE_CTA_NARROW_CENTERED,
                    marginBottom: '16px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.35)',
                    background: 'rgba(255,255,255,0.14)',
                    color: '#f8fafc',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Ver todas las fotos ({fotos.length})
                </button>
              ) : null}

              {sedeTieneSeccionEnNumeros(estadisticasPublicas, sede) ? (
                <div
                  style={{
                    marginTop: '6px',
                    marginBottom: '14px',
                    padding: '16px 14px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxSizing: 'border-box',
                  }}
                >
                  <h2
                    style={{
                      margin: '0 0 12px',
                      fontSize: '17px',
                      fontWeight: 800,
                      color: '#f8fafc',
                    }}
                  >
                    En números
                  </h2>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {(Number(estadisticasPublicas?.torneos_realizados_total) || 0) > 0 ? (
                      <li
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: '12px',
                          fontSize: '14px',
                          color: 'rgba(248,250,252,0.95)',
                          lineHeight: 1.45,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>Torneos realizados en esta sede</span>
                        <span style={{ fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
                          {(Number(estadisticasPublicas.torneos_realizados_total) || 0).toLocaleString('es-AR')}
                        </span>
                      </li>
                    ) : null}
                    {(Number(estadisticasPublicas?.jugadores_reservaron_total) || 0) > 0 ? (
                      <li
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: '12px',
                          fontSize: '14px',
                          color: 'rgba(248,250,252,0.95)',
                          lineHeight: 1.45,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>Jugadores que han reservado</span>
                        <span style={{ fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
                          {(Number(estadisticasPublicas.jugadores_reservaron_total) || 0).toLocaleString('es-AR')}
                        </span>
                      </li>
                    ) : null}
                    {(() => {
                      const d = estadisticasPublicas?.deporte_mas_jugado;
                      const nt = Number(d?.torneos) || 0;
                      const nc = Number(d?.canchas_cantidad) || 0;
                      if (!d?.label || (nt <= 0 && nc <= 0)) return null;
                      const sub =
                        nt > 0
                          ? `${nt.toLocaleString('es-AR')} torneo${nt === 1 ? '' : 's'}`
                          : `${nc.toLocaleString('es-AR')} cancha${nc === 1 ? '' : 's'} (configuración)`;
                      return (
                        <li
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            gap: '12px',
                            fontSize: '14px',
                            color: 'rgba(248,250,252,0.95)',
                            lineHeight: 1.45,
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>Deporte más jugado</span>
                          <span
                            style={{
                              fontWeight: 800,
                              color: '#fff',
                              textAlign: 'right',
                              maxWidth: '52%',
                            }}
                          >
                            {String(d.label)}
                            <span
                              style={{
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: 'rgba(226,232,240,0.85)',
                                marginTop: '2px',
                              }}
                            >
                              {sub}
                            </span>
                          </span>
                        </li>
                      );
                    })()}
                    {parseAnioFundacionSedePublica(sede?.anio_fundacion) != null ? (
                      <li
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: '12px',
                          fontSize: '14px',
                          color: 'rgba(248,250,252,0.95)',
                          lineHeight: 1.45,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>Año de fundación</span>
                        <span style={{ fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
                          {parseAnioFundacionSedePublica(sede.anio_fundacion)}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              <div
                style={{
                  marginTop: '6px',
                  marginBottom: '18px',
                  padding: '16px 14px',
                  borderRadius: '14px',
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxSizing: 'border-box',
                }}
              >
                <h2
                  style={{
                    margin: '0 0 10px',
                    fontSize: '17px',
                    fontWeight: 800,
                    color: '#f8fafc',
                  }}
                >
                  Sobre el club
                </h2>
                <div
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    lineHeight: 1.55,
                    color: 'rgba(248,250,252,0.92)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {String(sede.historia || '').trim() ? (
                    String(sede.historia).trim()
                  ) : (
                    <span style={{ fontStyle: 'italic', color: 'rgba(248,250,252,0.55)' }}>
                      El club aún no cargó una historia en el panel Mi Sede.
                    </span>
                  )}
                </div>

                <h3
                  style={{
                    margin: '18px 0 10px',
                    fontSize: '14px',
                    fontWeight: 800,
                    color: '#e2e8f0',
                    letterSpacing: '0.02em',
                  }}
                >
                  Próximos torneos
                </h3>
                {proximosTorneosLoading ? (
                  <p style={{ margin: 0, color: 'rgba(248,250,252,0.65)', fontSize: '13px' }}>Cargando torneos…</p>
                ) : proximosTorneos.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      color: 'rgba(248,250,252,0.55)',
                      fontSize: '13px',
                      fontStyle: 'italic',
                    }}
                  >
                    No hay torneos con inscripción abierta o en estado próximo en esta sede.
                  </p>
                ) : (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {proximosTorneos.map((t) => {
                      const badge = badgeTorneoEstadoPublico(t.estado);
                      const fi = formatFechaIsoPublicaSede(t.fecha_inicio);
                      const estadoLabel =
                        badge?.label ||
                        (String(t.estado || '').trim() ? String(t.estado).trim() : '—');
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => navigate(`/torneo/${encodeURIComponent(String(t.id))}`)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '12px 12px',
                              borderRadius: '12px',
                              border: '1px solid rgba(255,255,255,0.22)',
                              background: 'rgba(15,23,42,0.25)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              boxSizing: 'border-box',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: '14px',
                                color: '#f8fafc',
                                lineHeight: 1.3,
                              }}
                            >
                              {String(t.nombre || 'Torneo').trim()}
                            </span>
                            <span style={{ fontSize: '13px', color: 'rgba(226,232,240,0.95)' }}>
                              📅 {fi}
                            </span>
                            <span
                              style={{
                                alignSelf: 'flex-start',
                                marginTop: '2px',
                                padding: '3px 10px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: badge?.bg || 'rgba(148,163,184,0.35)',
                                color: badge?.color || '#f1f5f9',
                              }}
                            >
                              {estadoLabel}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!proximosTorneosLoading ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/torneos?sedeId=${encodeURIComponent(String(sedeId))}`)
                    }
                    style={{
                      marginTop: '14px',
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.35)',
                      background: 'rgba(255,255,255,0.12)',
                      color: '#f8fafc',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                  >
                    Ver todos los torneos
                  </button>
                ) : null}
              </div>

              <SedeResenasSeccion
                sedeId={sedeId}
                accessToken={session?.access_token ?? null}
                navigate={navigate}
                isSuperAdmin={isSuperAdmin}
              />

              <CompactContactCard sede={sede} horario={horario} hasAddress={hasAddress} />

              <SedeSocialChips sede={sede} />

              {hasAddress || (sede.latitud != null && sede.longitud != null) ? (
                <MapThumbnail
                  direccion={sede.direccion}
                  ciudad={sede.ciudad}
                  pais={sede.pais}
                  latitud={sede.latitud}
                  longitud={sede.longitud}
                />
              ) : null}
            </div>
            </div>
            </div>

            <div
              style={{
                flexShrink: 0,
                width: '100%',
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
                background: 'linear-gradient(to top, rgba(102,126,234,0.96) 55%, rgba(118,75,162,0.12) 100%)',
                paddingTop: '10px',
                boxShadow: '0 -6px 20px rgba(15, 23, 42, 0.08)',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  ...hubInstagramColumnWrapStyle,
                  padding: '0 12px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/torneos?sedeId=${encodeURIComponent(String(sedeId))}`)}
                  title={torneosCtaLabel}
                  style={{
                    ...SEDE_CTA_NARROW_CENTERED,
                    padding: '12px 16px',
                    background: '#fff',
                    color: '#15803d',
                    border: '2px solid #22c55e',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: '14px',
                    minWidth: 0,
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    {torneosCtaLabel}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/reservar?sedeId=${sedeId}`)}
                  style={{ ...SEDE_BTN_RESERVAR_CANCHA_STYLE, ...SEDE_CTA_NARROW_CENTERED }}
                >
                  ⚽ Reservar cancha
                </button>
              </div>
            </div>
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
