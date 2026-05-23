import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSedeTickerSponsors } from '../hooks/useSedeTickerSponsors';
import { sponsorItemMatchesTickerFormato } from '../utils/sponsorDisplayFormato';
import './SponsorTicker.css';

function sponsorInitials(nombre) {
  const parts = String(nombre || '').trim().match(/\S+/g) || [];
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase().slice(0, 2);
  }
  return String(parts[0] || '?').slice(0, 2).toUpperCase();
}

function SponsorTickerItem({ item }) {
  const nombre = String(item.nombre ?? '').trim() || 'Sponsor';
  const logo_url = String(item.logo_url ?? '').trim();
  const url = String(item.url_destino ?? '').trim();
  const isHttp = /^https?:\/\//i.test(url);

  const inner = (
    <>
      {logo_url ? (
        <img src={logo_url} alt="" className="sponsor-ticker__logo" loading="lazy" decoding="async" />
      ) : (
        <span
          className="sponsor-ticker__logo sponsor-ticker__logo--placeholder"
          aria-hidden
        >
          {sponsorInitials(nombre)}
        </span>
      )}
      <span className="sponsor-ticker__nombre">{nombre}</span>
    </>
  );

  if (url) {
    if (isHttp) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="sponsor-ticker__item">
          {inner}
        </a>
      );
    }
    const to = url.startsWith('/') ? url : `/${url}`;
    return (
      <Link to={to} className="sponsor-ticker__item">
        {inner}
      </Link>
    );
  }

  return <span className="sponsor-ticker__item">{inner}</span>;
}

/**
 * Banda horizontal de sponsors con scroll infinito (lista duplicada en el track).
 * @param {{ nombre: string, imagen_url?: string, url_destino?: string }[]} [items]
 * @param {number|null} [sedeId]
 * @param {string|null} [deporte]
 */
export default function SponsorTicker({ items, sedeId = null, deporte = null }) {
  const useSedeFetch = sedeId != null && (!items || items.length === 0);
  const { sponsors: sedeSponsors } = useSedeTickerSponsors(sedeId, {
    enabled: useSedeFetch,
    deporte,
  });

  const sourceItems = useMemo(() => {
    if (items?.length) return items;
    return (Array.isArray(sedeSponsors) ? sedeSponsors : []).map((row) => ({
      nombre: String(row?.nombre ?? '').trim(),
      imagen_url: String(row?.imagen_url ?? row?.logo_url ?? row?.logoUrl ?? '').trim(),
      url_destino: String(row?.url_destino ?? '').trim(),
    }));
  }, [items, sedeSponsors]);

  const displayItems = useMemo(() => {
    if (!sourceItems || sourceItems.length === 0) return [];
    return sourceItems
      .filter(sponsorItemMatchesTickerFormato)
      .map((it) => ({
        nombre: String(it.nombre ?? '').trim(),
        logo_url: String(it.imagen_url ?? it.logo_url ?? '').trim(),
        url_destino: String(it.url_destino ?? '').trim(),
      }))
      .filter((it) => it.nombre || it.logo_url);
  }, [sourceItems]);

  if (!displayItems.length) return null;

  return (
    <div className="sponsor-ticker" style={{ width: '100%' }}>
      <div className="sponsor-ticker__track">
        {displayItems.map((item, i) => (
          <SponsorTickerItem key={`a-${i}`} item={item} />
        ))}
        {displayItems.map((item, i) => (
          <SponsorTickerItem key={`b-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
