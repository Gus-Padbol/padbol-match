import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { pickHubCardSponsor } from '../utils/hubSponsorsFilter';
import { sponsorRowMatchesCardFormato, sponsorRowToCardSlot } from '../utils/sponsorDisplayFormato';

const CARD_OVERLAY = 'rgba(180, 20, 20, 0.35)';

/**
 * Card publicitaria full-bleed del hub /jugar.
 * Prioriza sponsors con formato `card` o `ambos`; si no hay, usa slot de sponsor_config.
 * @param {{ slot?: object|null, sponsor?: object|null, sponsors?: unknown[], sedeId?: number|null, pais?: string|null }} props
 */
export default function HubJugarFinalSponsorCard({ slot, sponsor = null, sponsors = null, sedeId = null, pais = null }) {
  const effectiveSlot = useMemo(() => {
    if (sponsor && sponsorRowMatchesCardFormato(sponsor)) {
      return sponsorRowToCardSlot(sponsor) || slot;
    }
    const rows = Array.isArray(sponsors) ? sponsors : [];
    if (rows.length > 0) {
      const picked =
        rows.find((r) => sponsor && String(r?.id) === String(sponsor?.id) && sponsorRowMatchesCardFormato(r)) ||
        pickHubCardSponsor(rows, { sedeId, pais });
      const fromRows = sponsorRowToCardSlot(picked);
      if (fromRows) return fromRows;
    }
    return slot;
  }, [slot, sponsor, sponsors, sedeId, pais]);

  const img = String(effectiveSlot?.imagen_url || '').trim();
  const url = String(effectiveSlot?.url_destino || '').trim();
  const titulo = String(effectiveSlot?.texto_corto || '').trim();

  const isEmpty = !img && !titulo && !url;
  if (isEmpty) {
    return (
      <div
        style={{
          height: 140,
          borderRadius: 12,
          border: '1px dashed #e53935',
          background: 'rgba(229, 57, 53, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e53935' }}>Tu marca aquí</span>
      </div>
    );
  }

  const inner = (
    <div
      className="jugar-card-media"
      style={
        img
          ? { backgroundImage: `url(${img})` }
          : { background: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)' }
      }
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: CARD_OVERLAY,
        }}
      />
      {titulo ? (
        <div className="jugar-card-copy">
          <strong className="jugar-card-title">{titulo}</strong>
        </div>
      ) : null}
    </div>
  );

  const shell = { borderRadius: 12, overflow: 'hidden', display: 'block', textDecoration: 'none' };

  if (!url) {
    return <div style={shell}>{inner}</div>;
  }

  if (/^https?:\/\//i.test(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...shell, color: 'inherit' }}>
        {inner}
      </a>
    );
  }

  const to = url.startsWith('/') ? url : `/${url}`;
  return (
    <Link to={to} style={{ ...shell, color: 'inherit' }}>
      {inner}
    </Link>
  );
}
