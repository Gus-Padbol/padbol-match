import React from 'react';
import SponsorPromoCard from './SponsorPromoCard';
import { isReservaBannerPaso3Active } from '../constants/hubJugarSponsorSlots';

/**
 * Banner publicitario paso 3 de reserva (sponsor_config.hub_reserva_banner_paso3).
 * @param {{ imagen_url?: string, titulo?: string, descripcion?: string, url_destino?: string }} banner
 */
export default function ReservaPaso3SponsorBanner({ banner }) {
  const b = banner && typeof banner === 'object' ? banner : {};
  if (!isReservaBannerPaso3Active(b)) return null;

  return (
    <SponsorPromoCard
      sponsor={{
        nombre: b.titulo,
        logo_url: b.imagen_url,
        tagline: b.descripcion,
        url_destino: b.url_destino,
      }}
      style={{ width: '100%', maxWidth: 390, marginBottom: 14 }}
    />
  );
}
