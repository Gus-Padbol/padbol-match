import React, { useMemo } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { pickBannerSponsors } from '../utils/sponsorMedia';
import SponsorMedia from './SponsorMedia';
import './SponsorMedia.css';

function sponsorLinkHref(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return u.startsWith('/') ? u : `/${u}`;
}

/**
 * Banner publicitario (imagen o video) para sede / hub.
 * @param {{ sponsors?: unknown[], className?: string, margin?: boolean }} props
 */
export default function SponsorBannerSlot({ sponsors, className = '', margin = true }) {
  const { t } = useTranslation();
  const banner = useMemo(() => {
    const list = pickBannerSponsors(sponsors);
    return list[0] ?? null;
  }, [sponsors]);

  if (!banner) return null;

  const href = sponsorLinkHref(banner.url_destino);
  const label = t('sponsors.publicidad', { defaultValue: 'Publicidad' });
  const rootClass = [
    'sponsor-banner-slot',
    margin ? '' : 'sponsor-banner-slot--flush',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const media = (
    <div className="sponsor-banner-slot__media-wrap">
      <SponsorMedia sponsor={banner} />
    </div>
  );

  return (
    <div className={rootClass}>
      <p className="sponsor-banner-slot__label">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="sponsor-banner-slot__frame"
          aria-label={String(banner.nombre || label).trim()}
        >
          {media}
        </a>
      ) : (
        <div className="sponsor-banner-slot__frame" role="group" aria-label={String(banner.nombre || label).trim()}>
          {media}
        </div>
      )}
    </div>
  );
}
