import React, { useMemo } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { pickBannerSponsors, sponsorHasDisplayableMedia } from '../utils/sponsorMedia';
import SponsorMedia from './SponsorMedia';
import SponsorBannerSlotErrorBoundary from './SponsorBannerSlotErrorBoundary';
import './SponsorMedia.css';

function sponsorLinkHref(url) {
  const u = String(url ?? '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return u.startsWith('/') ? u : `/${u}`;
}

function SponsorBannerSlotInner({ sponsors, className = '', margin = true }) {
  const { t } = useTranslation();

  const banner = useMemo(() => {
    try {
      const list = pickBannerSponsors(sponsors);
      const first = list[0] ?? null;
      return sponsorHasDisplayableMedia(first) ? first : null;
    } catch (err) {
      console.warn('[SponsorBannerSlot] pick banner:', err);
      return null;
    }
  }, [sponsors]);

  if (!banner) return null;

  const href = sponsorLinkHref(banner.url_destino);
  const label = t('sponsors.publicidad', { defaultValue: 'Publicidad' });
  const ariaLabel = String(banner.nombre ?? label).trim() || label;

  const rootClass = [
    'sponsor-banner-slot',
    margin ? '' : 'sede-publica-sponsor-banner--flush',
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
          aria-label={ariaLabel}
        >
          {media}
        </a>
      ) : (
        <div className="sponsor-banner-slot__frame" role="group" aria-label={ariaLabel}>
          {media}
        </div>
      )}
    </div>
  );
}

/**
 * Banner publicitario (imagen o video) para sede / hub.
 * @param {{ sponsors?: unknown[], className?: string, margin?: boolean }} props
 */
export default function SponsorBannerSlot(props) {
  const sponsors = Array.isArray(props?.sponsors) ? props.sponsors : [];

  return (
    <SponsorBannerSlotErrorBoundary>
      <SponsorBannerSlotInner {...props} sponsors={sponsors} />
    </SponsorBannerSlotErrorBoundary>
  );
}
