import React from 'react';
import { Link } from 'react-router-dom';

const CARD_OVERLAY = 'rgba(180, 20, 20, 0.35)';

/**
 * Card publicitaria final del hub /jugar (clave hub_jugar_card_ad).
 * Misma altura visual que las cards de acción (140px vía .jugar-card-media).
 */
export default function HubJugarFinalSponsorCard({ slot }) {
  const img = String(slot?.imagen_url || '').trim();
  const url = String(slot?.url_destino || '').trim();
  const titulo = String(slot?.texto_corto || '').trim();

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
