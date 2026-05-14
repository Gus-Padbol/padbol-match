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

/** Logo 28×28 o inicial si falla la carga / no hay URL. */
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
        width={28}
        height={28}
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
 * Marquee infinito: lista base + placeholders hasta mín. 6 ítems, duplicado y translateX(-50%).
 * @param {{ sponsors?: unknown[] }} props
 */
export default function HubSponsorsTicker({ sponsors }) {
  const raw = Array.isArray(sponsors) ? sponsors : [];
  const BASE_SPONSORS = raw.length > 0 ? raw : [];

  const placeholders = Array.from({ length: Math.max(0, 6 - BASE_SPONSORS.length) }, (_, i) => ({
    id: `placeholder-${i}`,
    isPlaceholder: true,
  }));

  const allItems = [...BASE_SPONSORS, ...placeholders];
  const tickerItems = [...allItems, ...allItems];

  return (
    <div className="hub-sponsors-ticker" aria-label="Patrocinadores">
      <div className="hub-sponsors-ticker__viewport">
        <div className="sponsor-track">
          {tickerItems.map((item, i) => {
            if (item.isPlaceholder) {
              return (
                <span key={`${item.id}-${i}`} className="sponsor-chip--placeholder">
                  Tu marca aquí
                </span>
              );
            }
            const nombre = String(item.nombre || '').trim();
            const logoRaw = item.logo_url ?? item.logoUrl;
            const url = item.url_destino != null ? String(item.url_destino).trim() : '';
            const inner = (
              <>
                <ChipAvatar nombre={nombre} logoRaw={logoRaw} />
                <span className="hub-sponsors-ticker__chip-label">{nombre}</span>
              </>
            );
            const key = `${item.id != null ? item.id : nombre}-${i}`;
            if (url) {
              return (
                <a
                  key={key}
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
              <span key={key} className="hub-sponsors-ticker__chip hub-sponsors-ticker__chip--static">
                {inner}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
