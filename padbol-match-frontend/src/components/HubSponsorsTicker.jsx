import React, { useMemo } from 'react';
import SponsorTicker from './SponsorTicker';
import { sponsorRowMatchesTickerFormato } from '../utils/sponsorDisplayFormato';

/**
 * Normaliza filas de `sponsors` (logo_url / logoUrl / imagen_url) al formato de {@link SponsorTicker}.
 */
function normalizeSponsorTickerItems(sponsors) {
  const raw = Array.isArray(sponsors) ? sponsors : [];
  return raw
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .filter(sponsorRowMatchesTickerFormato)
    .map((row) => {
      const nombre = String(row?.nombre ?? '').trim();
      const logo_url = String(row?.logo_url ?? row?.logoUrl ?? row?.imagen_url ?? '').trim();
      const imagen_url = logo_url;
      const banner_url = String(row?.banner_url ?? '').trim();
      const video_url = String(row?.video_url ?? '').trim();
      const tipo_media = String(row?.tipo_media ?? 'imagen').trim();
      const url_destino = String(row?.url_destino ?? '').trim();
      const tagline = String(row?.descripcion ?? row?.texto_boton ?? row?.tagline ?? '').trim();
      return { nombre, imagen_url, logo_url, banner_url, video_url, tipo_media, url_destino, descripcion: tagline, tagline };
    })
    .filter((it) => it.nombre || it.imagen_url || it.logo_url || it.banner_url);
}

/**
 * @param {{ sponsors?: unknown[], deporte?: string|null }} props
 */
export default function HubSponsorsTicker({ sponsors, deporte = null, compact = false }) {
  const items = useMemo(() => normalizeSponsorTickerItems(sponsors), [sponsors]);
  if (items.length === 0) return null;
  return <SponsorTicker items={items} deporte={deporte} compact={compact} />;
}
