import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  useCallback,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopPx,
} from '../constants/hubLayout';
import { supabase } from '../supabaseClient';

const PHOTO_STRIP_H = 120;
const MAP_THUMB_MAX_H = 120;

const PADBOL_PAGE_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const DEFAULT_HERO_BG = 'linear-gradient(160deg, #1a1a2e 0%, #16213e 72%, #0f3460 100%)';

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

function heroBackgroundFromSede(sede) {
  const hex = normalizeHexColor(sede?.color_primario);
  if (!hex) return DEFAULT_HERO_BG;
  return `linear-gradient(160deg, ${hex} 0%, rgba(15, 23, 42, 0.82) 78%, rgba(15, 23, 42, 0.94) 100%)`;
}

/** Tamaño del título del club en el hero según longitud del nombre. */
function heroClubNameFontSizePx(nombreRaw) {
  const len = String(nombreRaw ?? '').trim().length;
  if (len < 15) return 26;
  if (len <= 25) return 22;
  return 18;
}

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
    return `https://www.google.com/maps?q=${lat},${lon}`;
  }
  return buildMapsSearchHref(direccion, ciudad, pais);
}

/** Carrusel horizontal: fotos altura fija, ancho proporcional. */
function PhotoStrip({ fotos }) {
  if (!fotos.length) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        marginBottom: '16px',
        paddingBottom: '2px',
        paddingLeft: '4px',
        paddingRight: '4px',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      {fotos.map((url, i) => (
        <div
          key={`${url}-${i}`}
          style={{
            flexShrink: 0,
            height: PHOTO_STRIP_H,
            borderRadius: '10px',
            overflow: 'hidden',
            background: '#e2e8f0',
            boxShadow: '0 1px 4px rgba(15, 23, 42, 0.12)',
          }}
        >
          <img
            src={url}
            alt={`Foto ${i + 1}`}
            style={{
              height: PHOTO_STRIP_H,
              width: 'auto',
              maxWidth: 'min(78vw, 280px)',
              display: 'block',
              objectFit: 'cover',
            }}
          />
        </div>
      ))}
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
      return `https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`;
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
      line(
        '💬',
        <a
          href={`https://wa.me/${waNumber}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#15803d', fontWeight: 600, textDecoration: 'none' }}
        >
          WhatsApp
        </a>
      )
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

export default function SedePublica() {
  const { sedeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [sede, setSede] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const [ctaBarHeightPx, setCtaBarHeightPx] = useState(0);
  const ctaFixedRef = useRef(null);

  const measureCtaBar = useCallback(() => {
    const el = ctaFixedRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    setCtaBarHeightPx(Math.ceil(h));
  }, []);

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

  useEffect(() => {
    setDescExpanded(false);
  }, [sedeId]);

  useLayoutEffect(() => {
    if (loading || error || !sede) {
      setCtaBarHeightPx(0);
      return;
    }
    measureCtaBar();
    const raf = requestAnimationFrame(() => {
      measureCtaBar();
    });
    const onResize = () => measureCtaBar();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [loading, error, sede, descExpanded, measureCtaBar]);

  const mainPaddingBottom =
    loading || error || !sede
      ? `${HUB_CONTENT_PADDING_BOTTOM_PX}px`
      : `calc(${ctaBarHeightPx}px + env(safe-area-inset-bottom, 0px))`;

  const pageMinHeight =
    !loading && !error && sede ? 'auto' : '100dvh';

  return (
    <div
      style={{
        minHeight: pageMinHeight,
        background: PADBOL_PAGE_GRADIENT,
        paddingTop: `${hubContentPaddingTopPx(location.pathname)}px`,
        paddingBottom: mainPaddingBottom,
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
      }}
    >
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
        const horario = formatHorario(sede.horario_apertura, sede.horario_cierre);
        const hasAddress = Boolean(sede.direccion || sede.ciudad || sede.pais);
        const desc = sede.descripcion ? String(sede.descripcion).trim() : '';
        const descLong = desc.length > 140;
        const nombreSedeCta = String(sede.nombre || 'esta sede').trim();
        const torneosCtaLabel = `Ver torneos de ${nombreSedeCta}`;

        return (
          <>
            <div
              style={{
                width: '100%',
                maxWidth: '100%',
                overflowX: 'hidden',
                boxSizing: 'border-box',
              }}
            >
            <div
              style={{
                position: 'relative',
                background: heroBackgroundFromSede(sede),
                padding: '6px 8px 7px',
                overflow: 'hidden',
                borderRadius: '16px',
                marginLeft: '6px',
                marginRight: '6px',
                marginTop: '2px',
                boxShadow: '0 8px 28px rgba(0, 0, 0, 0.22)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-40px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '110px',
                  height: '110px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(102,126,234,0.22) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />

              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    flexShrink: 0,
                  }}
                >
                  {sede.logo_url ? (
                    <img
                      src={sede.logo_url}
                      alt=""
                      style={{
                        width: '110px',
                        height: '110px',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        background: '#fff',
                        padding: '4px',
                        flexShrink: 0,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '110px',
                        height: '110px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.12)',
                        flexShrink: 0,
                      }}
                    />
                  )}

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <h1
                      style={{
                        color: normalizeHexColor(sede.color_nombre) ?? '#FFFFFF',
                        fontSize: `${heroClubNameFontSizePx(sede.nombre)}px`,
                        fontWeight: 800,
                        margin: 0,
                        lineHeight: 1.2,
                        width: '100%',
                        textAlign: 'center',
                        wordBreak: 'break-word',
                        textShadow: '0 1px 8px rgba(0,0,0,0.45)',
                      }}
                      title={sede.nombre || ''}
                    >
                      {sede.nombre || '(sin nombre)'}
                    </h1>

                    {licenciaActiva ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '2px 4px',
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
                          padding: '2px 4px',
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
                </div>

                {desc ? (
                  <div
                    style={{
                      marginTop: '10px',
                      width: '100%',
                      maxWidth: '100%',
                      alignSelf: 'stretch',
                      boxSizing: 'border-box',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        color: 'rgba(255,255,255,0.9)',
                        fontSize: '14px',
                        lineHeight: 1.45,
                        fontStyle: 'italic',
                        textAlign: 'center',
                        width: '100%',
                        display: descExpanded ? 'block' : '-webkit-box',
                        WebkitLineClamp: descExpanded ? 'unset' : 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: descExpanded ? 'visible' : 'hidden',
                      }}
                    >
                      {desc}
                    </p>
                    {descLong ? (
                      <button
                        type="button"
                        onClick={() => setDescExpanded((v) => !v)}
                        style={{
                          marginTop: '4px',
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          color: 'rgba(255,255,255,0.95)',
                          fontSize: '11px',
                          fontWeight: 700,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          display: 'block',
                          width: '100%',
                          textAlign: 'center',
                        }}
                      >
                        {descExpanded ? 'Ver menos' : 'Ver más'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ maxWidth: '700px', margin: '0 auto', padding: '10px 14px 0' }}>
              <PhotoStrip fotos={fotos} />

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

            <div
              ref={ctaFixedRef}
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 'env(safe-area-inset-bottom, 0px)',
                width: '100%',
                maxWidth: '100%',
                zIndex: 1010,
                display: 'flex',
                flexDirection: 'column',
                paddingBottom: '8px',
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
          </>
        );
      })()}
      <BottomNav />
    </div>
  );
}
