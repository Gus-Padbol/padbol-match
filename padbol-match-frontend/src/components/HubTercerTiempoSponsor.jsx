import React from 'react';

const PADBOL_RED = '#E11B22';

/**
 * Card compacta «3er Tiempo» — sponsor de sede con CTA personalizado.
 * @param {{ sponsor?: { nombre?: string, logo_url?: string|null, url_destino?: string|null, texto_boton?: string|null, descripcion?: string|null }|null }} props
 */
export default function HubTercerTiempoSponsor({ sponsor }) {
  if (!sponsor || !String(sponsor.nombre || '').trim()) return null;
  const nombre = String(sponsor.nombre).trim();
  const logo = sponsor.logo_url != null ? String(sponsor.logo_url).trim() : '';
  const url = sponsor.url_destino != null ? String(sponsor.url_destino).trim() : '';
  const descRaw = sponsor.descripcion != null ? String(sponsor.descripcion).trim() : '';
  const desc = descRaw.length > 140 ? `${descRaw.slice(0, 137)}…` : descRaw;
  const btn =
    sponsor.texto_boton != null && String(sponsor.texto_boton).trim()
      ? String(sponsor.texto_boton).trim()
      : 'Ver más';

  return (
    <div
      style={{
        marginTop: 8,
        width: '100%',
        flexShrink: 0,
        borderRadius: 12,
        border: '1px solid var(--border, #e2e8f0)',
        background: 'var(--bg-card, #fff)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        padding: '12px 14px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: '#fff',
            background: PADBOL_RED,
            padding: '4px 8px',
            borderRadius: 6,
            lineHeight: 1.2,
          }}
        >
          3er Tiempo
        </span>
        {logo ? (
          <img src={logo} alt="" style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
        ) : (
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: '#f1f5f9',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              color: '#64748b',
              flexShrink: 0,
            }}
            aria-hidden
          >
            {nombre.charAt(0).toUpperCase()}
          </span>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary, #0f172a)', lineHeight: 1.25 }}>{nombre}</div>
          {desc ? (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-secondary, #64748b)',
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {desc}
            </div>
          ) : null}
        </div>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink: 0,
            padding: '10px 16px',
            borderRadius: 10,
            background: PADBOL_RED,
            color: '#fff',
            fontWeight: 800,
            fontSize: 14,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {btn}
        </a>
      ) : null}
    </div>
  );
}
