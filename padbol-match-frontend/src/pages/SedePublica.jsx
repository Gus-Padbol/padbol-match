import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
  hubContentPaddingTopPx,
} from '../constants/hubLayout';
import { supabase } from '../supabaseClient';

const PHOTO_STRIP_H = 120;
const MAP_THUMB_MAX_H = 120;

const PADBOL_PAGE_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const FOTOS_DESTACADAS_MAX = 4;

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

/** Marco exterior del hero: mismo gradiente violeta que el resto de la app. */
function heroBackgroundSedePublica() {
  return PADBOL_PAGE_GRADIENT;
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
 * Margen extra bajo AppHeader + BottomNav fijos (ref. hubLayout: 56 + 54 px + safe-area).
 * Buffer mayor que antes: el header real puede superar 56px por paddings verticales.
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

/**
 * URLs del carrusel: `fotos_destacadas` en orden (máx. 4), solo si existen en `fotos_urls`;
 * si no, primeras 4 de la galería (`usarOrden` false → sin badges 1–4).
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

/** Primeras fotos en carrusel destacado (scroll-snap, sin autoplay). */
function SedeFotosCarruselDestacado({ urls, onOpenAtIndex, showOrderNumbers = false }) {
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
              alt={`Foto ${i + 1}`}
              style={{
                width: '100%',
                height: PHOTO_STRIP_H,
                display: 'block',
                objectFit: 'cover',
              }}
            />
            {showOrderNumbers ? (
              <span
                style={{
                  position: 'absolute',
                  left: '8px',
                  bottom: '8px',
                  minWidth: '22px',
                  height: '22px',
                  padding: '0 6px',
                  borderRadius: '8px',
                  background: 'rgba(15,23,42,0.72)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {i + 1}
              </span>
            ) : null}
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
        Deslizá hacia los lados para cambiar de foto
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

function iconWrap(emoji) {
  return (
    <span
      style={{
        flexShrink: 0,
        width: '22px',
        height: '22px',
        borderRadius: '6px',
        background: '#f1f5f9',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
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

/** Contacto en una card compacta (~4 líneas). */
function CompactContactCard({ sede, horario, hasAddress }) {
  const waNumber = sede.telefono
    ? (() => {
        const digits = String(sede.telefono).replace(/\D/g, '');
        return digits.startsWith('0') ? `54${digits.slice(1)}` : digits;
      })()
    : '';

  const line = (icon, content) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minHeight: '22px',
        fontSize: '12px',
        color: '#334155',
        lineHeight: 1.35,
      }}
    >
      {iconWrap(icon)}
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
      <div
        key="wa-contact"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minHeight: '22px',
          fontSize: '12px',
          color: '#334155',
          lineHeight: 1.35,
        }}
      >
        <span
          style={{
            flexShrink: 0,
            width: '22px',
            height: '22px',
            borderRadius: '6px',
            background: '#f1f5f9',
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
            style={{ color: '#15803d', fontWeight: 600, textDecoration: 'none' }}
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
        <a href={`mailto:${sede.email_contacto}`} style={{ color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all' }}>
          {sede.email_contacto}
        </a>
      )
    );
  }

  if (!rows.length) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '14px',
          fontSize: '12px',
          color: '#94a3b8',
          boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
        }}
      >
        Sin información de contacto cargada.
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '10px 12px',
        marginBottom: '14px',
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.08)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {rows}
    </div>
  );
}

/** Perfil público de sede: ruta `/sede/:sedeId` en App.js → solo este componente (no hay SedeVista / SedePerfil). */
export default function SedePublica() {
  const { sedeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  /** Hueco bajo AppHeader + BottomNav fijos + safe-area + buffer (hero y resto del scroll). */
  const sedeScrollPaddingTopCss = useMemo(
    () =>
      `calc(${hubContentPaddingTopPx(location.pathname)}px + env(safe-area-inset-top, 0px) + ${SEDE_PUBLIC_SCROLL_EXTRA_TOP_PX}px)`,
    [location.pathname]
  );
  const [sede, setSede] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fotosGalleryOpen, setFotosGalleryOpen] = useState(false);
  const [fotosGalleryIndex, setFotosGalleryIndex] = useState(0);
  useEffect(() => {
    if (!sedeId) {
      setError('No se recibió un ID de sede.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    supabase
      .from('sedes')
      .select('*')
      .eq('id', parseInt(sedeId, 10))
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(`Error al cargar sede: ${err.message}`);
        else if (!data) setError(`Sede con id ${sedeId} no encontrada.`);
        else setSede(data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Error inesperado: ' + (err?.message || String(err)));
        setLoading(false);
      });
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
        const { urls: fotosCarrusel, usarOrden: carruselUsaDestacadas } = urlsCarruselSedePublica(sede);
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
                width: '100%',
                maxWidth: '100%',
                overflowX: 'hidden',
                boxSizing: 'border-box',
                /* Hueco bajo AppHeader + BottomNav: vive en el contenedor del hero / columna de contenido. */
                paddingTop: sedeScrollPaddingTopCss,
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
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: heroBackgroundSedePublica(),
                  borderRadius: '16px',
                  zIndex: 0,
                }}
              />

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
                      flexShrink: 0,
                      alignSelf: 'stretch',
                      borderRadius: '12px',
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
                          maxHeight: '140px',
                          objectFit: 'contain',
                          objectPosition: 'center center',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: '88px',
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
                      background: 'rgba(15, 23, 42, 0.2)',
                      borderRadius: '12px',
                      padding: '10px 12px',
                      boxSizing: 'border-box',
                      border: '1px solid rgba(255,255,255,0.14)',
                      justifyContent: 'center',
                    }}
                  >
                    <h1
                      style={{
                        color: normalizeHexColor(sede.color_nombre) ?? '#FFFFFF',
                        fontSize: `${heroClubNameFontSizePx(sede.nombre)}px`,
                        fontWeight: 800,
                        margin: 0,
                        lineHeight: 1.2,
                        minWidth: 0,
                        textAlign: 'center',
                        wordBreak: 'break-word',
                        textShadow: '0 1px 8px rgba(0,0,0,0.35)',
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
                        color: 'rgba(255,255,255,0.95)',
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

            <div style={{ maxWidth: '700px', margin: '0 auto', padding: '10px 14px 0' }}>
              <SedeFotosCarruselDestacado
                urls={fotosCarrusel}
                showOrderNumbers={carruselUsaDestacadas}
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
                    display: 'block',
                    width: '100%',
                    maxWidth: '100%',
                    marginBottom: '16px',
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
                  Ver todas las fotos ({fotos.length})
                </button>
              ) : null}

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
              <div style={{ padding: '0 12px 6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => navigate(`/torneos?sedeId=${encodeURIComponent(String(sedeId))}`)}
                  title={torneosCtaLabel}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#fff',
                    color: '#15803d',
                    border: '2px solid #22c55e',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    display: 'block',
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
                  style={{
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
                  }}
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
