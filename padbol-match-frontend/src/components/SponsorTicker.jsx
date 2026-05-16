import React, { useMemo } from 'react';
import { sponsorItemMatchesTickerFormato } from '../utils/sponsorDisplayFormato';
import './SponsorTicker.css';

const TICKER_RED = '#e53935';
const TICKER_TEXT = '#d1d5db';
const PLACEHOLDER_GRAY = '#6b7280';

function sponsorInitials(nombre) {
  const parts = (String(nombre || '').trim().match(/\S+/g) || []).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase().slice(0, 2);
  }
  const w = parts[0] || '';
  return w.slice(0, 2).toUpperCase() || '?';
}

function TickerLogo({ item }) {
  const size = 28;
  if (item.isPlaceholder) {
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          flexShrink: 0,
          background: PLACEHOLDER_GRAY,
          opacity: 0.85,
        }}
      />
    );
  }
  if (item.imagen_url) {
    return (
      <img
        src={item.imagen_url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: TICKER_RED,
        color: '#fff',
        fontSize: 11,
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        letterSpacing: -0.02,
      }}
    >
      {sponsorInitials(item.nombre)}
    </span>
  );
}

function TickerRow({ items, dupKey }) {
  return (
    <div className="hub-jugar-ticker-row" aria-hidden={dupKey === 1}>
      {items.map((it, i) => {
        const inner = (
          <>
            <TickerLogo item={it} />
            <span
              style={{
                color: TICKER_TEXT,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {it.nombre}
            </span>
            <span className="hub-jugar-ticker-sep" style={{ color: '#6b7280', fontWeight: 700 }}>
              ·
            </span>
          </>
        );
        const url = String(it.url_destino || '').trim();
        if (!it.isPlaceholder && url) {
          const isHttp = /^https?:\/\//i.test(url);
          return (
            <a
              key={`${dupKey}-${i}`}
              href={url}
              className="hub-jugar-ticker-item"
              target={isHttp ? '_blank' : undefined}
              rel={isHttp ? 'noopener noreferrer' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              {inner}
            </a>
          );
        }
        return (
          <span key={`${dupKey}-${i}`} className="hub-jugar-ticker-item">
            {inner}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Ticker horizontal de sponsors (mismo componente que en el hub /jugar).
 * @param {{ nombre: string, imagen_url?: string, url_destino?: string }[]} items
 * @param {string|null} [deporte] Slug canónico del contexto (p. ej. selector hub); se refleja en `data-pm-deporte` para trazabilidad con GET /api/sponsors.
 */
export default function SponsorTicker({ items, deporte = null }) {
  const displayItems = useMemo(() => {
    if (items && items.length > 0) {
      const filtered = items.filter(sponsorItemMatchesTickerFormato);
      if (filtered.length > 0) return filtered;
    }
    return Array.from({ length: 5 }, () => ({
      nombre: 'Tu marca aquí',
      imagen_url: '',
      url_destino: '',
      isPlaceholder: true,
    }));
  }, [items]);

  return (
    <div
      className="hub-jugar-ticker-wrap"
      role="region"
      aria-label="Sponsors"
      data-pm-deporte={deporte != null && String(deporte).trim() !== '' ? String(deporte).trim().toLowerCase() : undefined}
    >
      <div className="hub-jugar-ticker-marquee">
        <div className="hub-jugar-ticker-track">
          <TickerRow dupKey={0} items={displayItems} />
          <TickerRow dupKey={1} items={displayItems} />
        </div>
      </div>
    </div>
  );
}
