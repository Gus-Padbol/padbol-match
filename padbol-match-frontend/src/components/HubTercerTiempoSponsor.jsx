import React from 'react';
import SponsorPromoCard from './SponsorPromoCard';

/**
 * Sponsor «3er Tiempo» en hub — misma tarjeta global que el resto de la app.
 * @param {{ sponsor?: { nombre?: string, logo_url?: string|null, url_destino?: string|null, texto_boton?: string|null, descripcion?: string|null }|null }} props
 */
export default function HubTercerTiempoSponsor({ sponsor }) {
  return <SponsorPromoCard sponsor={sponsor} style={{ marginTop: 8, width: '100%', flexShrink: 0 }} />;
}
