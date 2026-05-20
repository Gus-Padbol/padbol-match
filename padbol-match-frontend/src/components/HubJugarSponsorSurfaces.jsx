import React from 'react';
import SponsorPromoCard from './SponsorPromoCard';
import { sponsorPromoHasContent } from '../utils/sponsorDisplayFormato';

function slotToSponsor(slot) {
  if (!slot || typeof slot !== 'object') return null;
  return {
    nombre: String(slot.texto_corto || '').trim(),
    logo_url: String(slot.imagen_url || slot.logo_url || '').trim(),
    url_destino: String(slot.url_destino || '').trim(),
  };
}

/**
 * Banner rectangular de slot hub (confirmación, etc.). Sin contenido → no renderiza.
 */
export function HubJugarSlotRect({ slot, width = '100%', borderRadius = 12, style }) {
  const sponsor = slotToSponsor(slot);
  if (!sponsorPromoHasContent(sponsor)) return null;
  const w = typeof width === 'number' ? `${width}px` : width;
  return (
    <SponsorPromoCard
      sponsor={sponsor}
      style={{
        width: w,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        ...style,
      }}
    />
  );
}

/** Esquina overlay: solo si hay imagen (logo compacto en cards de acción). */
export function HubJugarSlotOverlayCorner({ slot }) {
  const img = String(slot?.imagen_url || '').trim();
  const url = String(slot?.url_destino || '').trim();
  if (!img) return null;

  const box = (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid var(--border, rgba(255,255,255,0.35))',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
        {box}
      </a>
    );
  }
  return box;
}

/** Franja horizontal bajo cards de jugar. */
export function HubJugarSlotStrip({ slot }) {
  const sponsor = slotToSponsor(slot);
  if (!sponsorPromoHasContent(sponsor)) return null;
  return <SponsorPromoCard sponsor={sponsor} />;
}
