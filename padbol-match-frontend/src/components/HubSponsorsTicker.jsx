import React, { useCallback, useState } from 'react';
import './HubSponsorsTicker.css';

function chipInitial(nombre) {
  const t = String(nombre || '').trim();
  if (!t) return '★';
  return t.charAt(0).toUpperCase();
}

function logoUrlValid(raw) {
  if (raw == null) return '';
  const u = String(raw).trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return `https:${u}`;
  return u;
}

/** Logo 26×26 o inicial si falla la carga / no hay URL. */
function ChipAvatar({ nombre, logoRaw }) {
  const logo = logoUrlValid(logoRaw);
  const [imgFailed, setImgFailed] = useState(false);
  const onErr = useCallback(() => setImgFailed(true), []);

  if (logo && !imgFailed) {
    return (
      <img
        className="hub-sponsors-ticker__logo"
        src={logo}
        alt=""
        width={26}
        height={26}
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer-when-downgrade"
        onError={onErr}
      />
    );
  }
  return (
    <span className="hub-sponsors-ticker__initial" aria-hidden title={nombre}>
      {chipInitial(nombre)}
    </span>
  );
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
            const logoRaw = s.logo_url ?? s.logoUrl;
            const url = s.url_destino != null ? String(s.url_destino).trim() : '';
            const inner = (
              <>
                <ChipAvatar nombre={nombre} logoRaw={logoRaw} />
                <span className="hub-sponsors-ticker__chip-label">{nombre}</span>
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
