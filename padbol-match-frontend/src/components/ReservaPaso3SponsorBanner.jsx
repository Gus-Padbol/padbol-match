import React from 'react';
import { Link } from 'react-router-dom';
import { isReservaBannerPaso3Active } from '../constants/hubJugarSponsorSlots';

/**
 * @param {{ imagen_url?: string, titulo?: string, descripcion?: string, url_destino?: string }} banner
 */
export default function ReservaPaso3SponsorBanner({ banner }) {
  const b = banner && typeof banner === 'object' ? banner : {};
  const active = isReservaBannerPaso3Active(b);

  const baseWrap = {
    width: '100%',
    maxWidth: 390,
    height: 70,
    borderRadius: 10,
    marginBottom: 14,
    boxSizing: 'border-box',
    overflow: 'hidden',
    position: 'relative',
  };

  if (!active) {
    return (
      <div
        style={{
          ...baseWrap,
          border: '1px dashed #e53935',
          background: 'rgba(229, 57, 53, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 12px',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: '#e53935' }}>Tu marca aquí</div>
        <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>Espacio publicitario disponible</div>
      </div>
    );
  }

  const url = String(b.url_destino || '').trim();
  const bg = String(b.imagen_url || '').trim();

  const content = (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 14px',
          color: '#fff',
          textAlign: 'left',
          textShadow: '0 1px 2px rgba(0,0,0,0.45)',
        }}
      >
        {b.titulo ? (
          <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.2 }}>{b.titulo}</div>
        ) : null}
        {b.descripcion ? (
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.95, marginTop: 4, lineHeight: 1.25 }}>
            {b.descripcion}
          </div>
        ) : null}
      </div>
    </>
  );

  const shellStyle = {
    ...baseWrap,
    backgroundColor: '#1a1a1a',
    ...(bg
      ? {
          backgroundImage: `url(${bg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {}),
  };

  if (url) {
    if (/^https?:\/\//i.test(url)) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...shellStyle,
            display: 'block',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          {content}
        </a>
      );
    }
    const to = url.startsWith('/') ? url : `/${url}`;
    return (
      <Link
        to={to}
        style={{
          ...shellStyle,
          display: 'block',
          textDecoration: 'none',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        {content}
      </Link>
    );
  }

  return <div style={shellStyle}>{content}</div>;
}
