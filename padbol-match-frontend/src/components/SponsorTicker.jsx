import React, { useMemo } from 'react';
import { useSedeTickerSponsors } from '../hooks/useSedeTickerSponsors';
import { sponsorItemMatchesTickerFormato } from '../utils/sponsorDisplayFormato';
import './SponsorTicker.css';

function sponsorTickerImageUrl(item) {
  return String(item.banner_url ?? item.logo_url ?? item.imagen_url ?? '').trim();
}

function sponsorTickerLinkHref(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return u.startsWith('/') ? u : `/${u}`;
}

function SponsorTickerItem({ item }) {
  const imageUrl = sponsorTickerImageUrl(item);
  if (!imageUrl) return null;

  const url = String(item.url_destino ?? '').trim();
  const inner = (
    <img
      src={imageUrl}
      alt=""
      className="sponsor-ticker__logo"
      loading="lazy"
      decoding="async"
    />
  );

  if (url) {
    return (
      <a
        href={sponsorTickerLinkHref(url)}
        target="_blank"
        rel="noopener noreferrer"
        className="sponsor-ticker__item"
      >
        {inner}
      </a>
    );
  }

  return <span className="sponsor-ticker__item sponsor-ticker__item--static">{inner}</span>;
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
      logo_url: String(row?.logo_url ?? row?.logoUrl ?? row?.imagen_url ?? '').trim(),
      banner_url: String(row?.banner_url ?? '').trim(),
      url_destino: String(row?.url_destino ?? '').trim(),
    }));
  }, [items, sedeSponsors]);

  const displayItems = useMemo(() => {
    if (!sourceItems || sourceItems.length === 0) return [];
    return sourceItems
      .filter(sponsorItemMatchesTickerFormato)
      .map((it) => ({
        nombre: String(it.nombre ?? '').trim(),
        logo_url: String(it.logo_url ?? it.imagen_url ?? '').trim(),
        banner_url: String(it.banner_url ?? '').trim(),
        imagen_url: String(it.imagen_url ?? it.logo_url ?? '').trim(),
        url_destino: String(it.url_destino ?? '').trim(),
      }))
      .filter((it) => Boolean(sponsorTickerImageUrl(it)));
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
