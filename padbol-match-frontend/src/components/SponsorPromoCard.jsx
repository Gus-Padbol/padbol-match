import React from 'react';
import { Link } from 'react-router-dom';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { normalizeSponsorPromo } from '../utils/sponsorDisplayFormato';
import './SponsorPromoCard.css';

function sponsorInitials(nombre) {
  const parts = (String(nombre || '').trim().match(/\S+/g) || []).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase().slice(0, 2);
  }
  const w = parts[0] || '';
  return w.slice(0, 2).toUpperCase() || '?';
}

/**
 * Tarjeta unificada de sponsor/publicidad en toda la app.
 * @param {{ sponsor?: unknown, sponsors?: unknown, contexto?: string, sedeId?: number|null, torneoId?: number|null, className?: string, style?: object, compact?: boolean }} props
 */
export default function SponsorPromoCard({
  sponsor,
  sponsors,
  contexto = null,
  sedeId = null,
  torneoId = null,
  className = '',
  style,
  compact = false,
}) {
  const { t } = useTranslation();
  const data = normalizeSponsorPromo(sponsor ?? sponsors);
  if (!data) return null;

  const { nombre, logo_url, tagline, url_destino } = data;
  const url = String(url_destino || '').trim();
  const isHttp = /^https?:\/\//i.test(url);

  const inner = (
    <>
      <span className="sponsor-promo-card__badge">{t('general.sponsorAdBadge')}</span>
      <div className="sponsor-promo-card__logo-wrap" aria-hidden={logo_url ? undefined : true}>
        {logo_url ? (
          <img src={logo_url} alt="" className="sponsor-promo-card__logo" loading="lazy" decoding="async" />
        ) : (
          <span className="sponsor-promo-card__logo-fallback">{sponsorInitials(nombre)}</span>
        )}
      </div>
      <div className="sponsor-promo-card__copy">
        <p className="sponsor-promo-card__name">{nombre}</p>
        {tagline ? <p className="sponsor-promo-card__tagline">{tagline}</p> : null}
      </div>
    </>
  );

  const classNames = ['sponsor-promo-card', compact ? 'sponsor-promo-card--compact' : '', className]
    .filter(Boolean)
    .join(' ');

  if (url) {
    if (isHttp) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${classNames} sponsor-promo-card--link`}
          style={style}
        >
          {inner}
        </a>
      );
    }
    const to = url.startsWith('/') ? url : `/${url}`;
    return (
      <Link to={to} className={`${classNames} sponsor-promo-card--link`} style={style}>
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={classNames}
      style={style}
      role="group"
      aria-label={nombre}
      data-sponsor-contexto={contexto != null && String(contexto).trim() !== '' ? String(contexto) : undefined}
      data-sponsor-sede-id={sedeId != null ? String(sedeId) : undefined}
      data-sponsor-torneo-id={torneoId != null ? String(torneoId) : undefined}
    >
      {inner}
    </div>
  );
}

/**
 * Lista de sponsors (ticker sustituido por cards desplazables si hay varios).
 * @param {{ items?: unknown[], deporte?: string|null, className?: string }} props
 */
export function SponsorPromoList({ items, deporte = null, className = '', compact = false }) {
  const list = (Array.isArray(items) ? items : [])
    .map((row) => normalizeSponsorPromo(row))
    .filter(Boolean);
  if (list.length === 0) return null;

  const layoutClass =
    list.length > 1 ? 'sponsor-promo-list sponsor-promo-list--scroll' : 'sponsor-promo-list';

  return (
    <div
      className={[layoutClass, className].filter(Boolean).join(' ')}
      role="region"
      aria-label="Sponsors"
      data-pm-deporte={
        deporte != null && String(deporte).trim() !== ''
          ? String(deporte).trim().toLowerCase()
          : undefined
      }
    >
      {list.map((data, i) => (
        <SponsorPromoCard key={`${data.nombre}-${i}`} sponsor={data} compact={compact} />
      ))}
    </div>
  );
}
