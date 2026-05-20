import React, { useMemo } from 'react';
import { sponsorItemMatchesTickerFormato } from '../utils/sponsorDisplayFormato';
import { SponsorPromoList } from './SponsorPromoCard';

/**
 * Lista de sponsors (antes ticker marquee). Sin sponsors asignados no ocupa espacio.
 * @param {{ nombre: string, imagen_url?: string, url_destino?: string, descripcion?: string }[]} items
 * @param {string|null} [deporte]
 */
export default function SponsorTicker({ items, deporte = null }) {
  const displayItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    return items
      .filter(sponsorItemMatchesTickerFormato)
      .map((it) => ({
        nombre: String(it.nombre ?? '').trim(),
        logo_url: String(it.imagen_url ?? it.logo_url ?? '').trim(),
        url_destino: String(it.url_destino ?? '').trim(),
        tagline: String(it.descripcion ?? it.tagline ?? '').trim(),
      }))
      .filter((it) => it.nombre || it.logo_url);
  }, [items]);

  return <SponsorPromoList items={displayItems} deporte={deporte} />;
}
