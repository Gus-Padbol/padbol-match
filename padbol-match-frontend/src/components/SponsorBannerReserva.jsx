import React from 'react';

const PADBOL_RED = '#E11B22';

/**
 * Opción A — banner bajo el resumen de reserva confirmada.
 * @param {{ nombre?: string, logo_url?: string|null, url_destino?: string|null, texto_boton?: string|null }} sponsor
 */
export default function SponsorBannerReserva({ sponsor }) {
  if (!sponsor || !String(sponsor.nombre || '').trim()) return null;
  const nombre = String(sponsor.nombre).trim();
  const logo = sponsor.logo_url != null ? String(sponsor.logo_url).trim() : '';
  const url = sponsor.url_destino != null ? String(sponsor.url_destino).trim() : '';
  const btn =
    sponsor.texto_boton != null && String(sponsor.texto_boton).trim()
      ? String(sponsor.texto_boton).trim()
      : 'Ver oferta';

  return (
    <div
      style={{
        marginTop: 20,
        padding: '18px 16px 20px',
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        background: 'linear-gradient(180deg, #fafafa 0%, #fff 40%)',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.14em',
          color: '#64748b',
        }}
      >
        RESERVA PATROCINADA POR
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {logo ? (
          <img
            src={logo}
            alt=""
            style={{
              maxHeight: 52,
              maxWidth: 'min(220px, 85%)',
              objectFit: 'contain',
            }}
          />
        ) : null}
        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.25 }}>{nombre}</div>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.4, maxWidth: 320 }}>
          Gracias por apoyar a quienes hacen posible esta experiencia.
        </p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4,
              padding: '12px 22px',
              borderRadius: 10,
              background: PADBOL_RED,
              color: '#fff',
              fontWeight: 800,
              fontSize: 15,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(225,27,34,0.35)',
            }}
          >
            {btn}
          </a>
        ) : null}
      </div>
    </div>
  );
}
