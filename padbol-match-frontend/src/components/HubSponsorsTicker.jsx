import React from 'react';
import './HubSponsorsTicker.css';

function chipInitial(nombre) {
  const t = String(nombre || '').trim();
  if (!t) return '★';
  return t.charAt(0).toUpperCase();
}

/**
 * Banda horizontal con marquee infinito (lista duplicada + animación CSS).
 * @param {{ sponsors?: unknown[] }} props
 */
export default function HubSponsorsTicker({ sponsors }) {
  const list = Array.isArray(sponsors)
    ? sponsors.filter((s) => s && String(s.nombre || '').trim())
    : [];
  if (list.length === 0) return null;

  const loop = [...list, ...list];

  return (
    <div className="hub-sponsors-ticker" aria-label="Patrocinadores">
      <div className="hub-sponsors-ticker__viewport">
        <div className="hub-sponsors-ticker__track">
          {loop.map((s, i) => {
            const nombre = String(s.nombre || '').trim();
            const logo = s.logo_url != null ? String(s.logo_url).trim() : '';
            const url = s.url_destino != null ? String(s.url_destino).trim() : '';
            const inner = (
              <>
                {logo ? (
                  <img className="hub-sponsors-ticker__logo" src={logo} alt="" loading="lazy" />
                ) : (
                  <span className="hub-sponsors-ticker__initial" aria-hidden>
                    {chipInitial(nombre)}
                  </span>
                )}
                <span>{nombre}</span>
              </>
            );
            if (url) {
              return (
                <a
                  key={`${s.id}-${i}`}
                  className="hub-sponsors-ticker__chip"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {inner}
                </a>
              );
            }
            return (
              <span key={`${s.id}-${i}`} className="hub-sponsors-ticker__chip hub-sponsors-ticker__chip--static">
                {inner}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
