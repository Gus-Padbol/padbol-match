import React from 'react';
import SponsorPromoCard from './SponsorPromoCard';

/**
 * Banner de sponsor bajo resumen de reserva confirmada.
 * @param {{ nombre?: string, logo_url?: string|null, url_destino?: string|null, texto_boton?: string|null, descripcion?: string|null }} sponsor
 */
export default function SponsorBannerReserva({ sponsor }) {
  return (
    <SponsorPromoCard
      sponsor={sponsor}
      style={{ marginTop: 20 }}
    />
  );
}
