import React, { useMemo } from 'react';
import { useSedeTickerSponsors } from '../hooks/useSedeTickerSponsors';
import { sponsorItemMatchesTickerFormato } from '../utils/sponsorDisplayFormato';
import { SponsorPromoList } from './SponsorPromoCard';

/**
 * Lista de sponsors (antes ticker marquee). Sin sponsors asignados no ocupa espacio.
 * @param {{ nombre: string, imagen_url?: string, url_destino?: string, descripcion?: string }[]} [items]
 * @param {number|null} [sedeId] — si no hay `items`, carga sponsors de la sede (+ globales).
 * @param {string|null} [deporte]
 */
export default function SponsorTicker({ items, sedeId = null, deporte = null, compact = false }) {
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
      descripcion: String(row?.descripcion ?? row?.texto_boton ?? row?.tagline ?? '').trim(),
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
        tagline: String(it.descripcion ?? it.tagline ?? '').trim(),
      }))
      .filter((it) => it.nombre || it.logo_url);
  }, [sourceItems]);

  return <SponsorPromoList items={displayItems} deporte={deporte} compact={compact} />;
}
