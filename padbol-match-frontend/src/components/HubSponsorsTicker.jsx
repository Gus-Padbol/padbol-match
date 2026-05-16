import React, { useMemo } from 'react';
import SponsorTicker from './SponsorTicker';
import { sponsorRowMatchesTickerFormato } from '../utils/sponsorDisplayFormato';

/**
 * Normaliza filas de `sponsors` (logo_url / logoUrl / imagen_url) al formato de {@link SponsorTicker}.
 */
function normalizeSponsorTickerItems(sponsors) {
  const raw = Array.isArray(sponsors) ? sponsors : [];
  return raw
    .filter(sponsorRowMatchesTickerFormato)
    .map((row) => {
      const nombre = String(row?.nombre ?? '').trim();
      const imagen_url = String(row?.imagen_url ?? row?.logo_url ?? row?.logoUrl ?? '').trim();
      const url_destino = String(row?.url_destino ?? '').trim();
      return { nombre, imagen_url, url_destino };
    })
    .filter((it) => it.nombre || it.imagen_url);
}

/**
 * @param {{ sponsors?: unknown[], deporte?: string|null }} props
 */
export default function HubSponsorsTicker({ sponsors, deporte = null }) {
  const items = useMemo(() => normalizeSponsorTickerItems(sponsors), [sponsors]);
  return <SponsorTicker items={items} deporte={deporte} />;
}
