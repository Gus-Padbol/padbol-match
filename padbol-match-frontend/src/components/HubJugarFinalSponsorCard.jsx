import React, { useMemo } from 'react';
import { pickHubCardSponsor } from '../utils/hubSponsorsFilter';
import {
  sponsorPromoHasContent,
  sponsorRowMatchesCardFormato,
  sponsorRowToCardSlot,
} from '../utils/sponsorDisplayFormato';
import SponsorPromoCard from './SponsorPromoCard';

/**
 * Card publicitaria del hub /jugar (formato card / ambos en sponsors o slot de config).
 * @param {{ slot?: object|null, sponsor?: object|null, sponsors?: unknown[], sedeId?: number|null, pais?: string|null }} props
 */
export default function HubJugarFinalSponsorCard({ slot, sponsor = null, sponsors = null, sedeId = null, pais = null }) {
  const effectiveSponsor = useMemo(() => {
    if (sponsor && sponsorRowMatchesCardFormato(sponsor)) {
      const fromSponsor = sponsorRowToCardSlot(sponsor);
      if (fromSponsor) {
        return {
          nombre: fromSponsor.texto_corto,
          logo_url: fromSponsor.imagen_url,
          url_destino: fromSponsor.url_destino,
        };
      }
    }
    const rows = Array.isArray(sponsors) ? sponsors : [];
    if (rows.length > 0) {
      const picked =
        rows.find((r) => sponsor && String(r?.id) === String(sponsor?.id) && sponsorRowMatchesCardFormato(r)) ||
        pickHubCardSponsor(rows, { sedeId, pais });
      const fromRows = sponsorRowToCardSlot(picked);
      if (fromRows) {
        return {
          nombre: fromRows.texto_corto,
          logo_url: fromRows.imagen_url,
          url_destino: fromRows.url_destino,
        };
      }
    }
    const s = slot && typeof slot === 'object' ? slot : null;
    if (!s) return null;
    return {
      nombre: String(s.texto_corto || '').trim(),
      logo_url: String(s.imagen_url || s.logo_url || '').trim(),
      url_destino: String(s.url_destino || '').trim(),
    };
  }, [slot, sponsor, sponsors, sedeId, pais]);

  if (!sponsorPromoHasContent(effectiveSponsor)) return null;

  return <SponsorPromoCard sponsor={effectiveSponsor} />;
}
