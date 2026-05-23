import React, { useEffect, useMemo, useState } from 'react';
import { useSedeTickerSponsors } from '../hooks/useSedeTickerSponsors';
import { sponsorRowApproved } from '../utils/hubSponsorsFilter';
import { fetchPublicSponsorsList } from '../utils/sponsorDeportePublic';
import { sponsorRowsMatchingContext } from '../utils/sponsorPick';
import { normalizeSponsorTipoMedia, sponsorRowHasBannerMedia } from '../utils/sponsorMedia';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import SponsorMedia from './SponsorMedia';
import './SponsorMedia.css';
import './SponsorBannerFade.css';

const ROTATE_MS = 4000;

function sponsorInitials(nombre) {
  const parts = String(nombre || '').trim().match(/\S+/g) || [];
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase().slice(0, 2);
  }
  return String(parts[0] || '?').slice(0, 2).toUpperCase();
}

function normalizeBannerRow(row) {
  if (!row) return null;
  const nombre = String(row.nombre ?? '').trim();
  const logo_url = String(row.logo_url ?? row.imagen_url ?? '').trim();
  const banner_url = String(row.banner_url ?? '').trim();
  const video_url = String(row.video_url ?? '').trim();
  const tipo_media = normalizeSponsorTipoMedia(row.tipo_media);
  const url_destino = String(row.url_destino ?? '').trim();
  const normalized = {
    id: row.id,
    nombre: nombre || 'Sponsor',
    logo_url,
    banner_url,
    video_url,
    tipo_media,
    url_destino,
  };
  if (sponsorRowHasBannerMedia(normalized)) return normalized;
  if (!nombre && !logo_url) return null;
  return normalized;
}

function wrapLink(url, className, ariaLabel, children) {
  const href = String(url || '').trim();
  if (href) {
    const isHttp = /^https?:\/\//i.test(href);
    const finalHref = isHttp ? href : href.startsWith('/') ? href : `/${href}`;
    return (
      <a
        href={finalHref}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }
  return (
    <div className={className} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

/**
 * Banner de publicidad con fade entre sponsors (sede / torneo).
 * @param {{ sedeId?: number|null, torneoId?: number|null }} props
 */
export default function SponsorBannerFade({ sedeId = null, torneoId = null }) {
  const { t } = useTranslation();
  const sid = sedeId != null && Number.isFinite(Number(sedeId)) ? Number(sedeId) : null;
  const tid = torneoId != null && Number.isFinite(Number(torneoId)) ? Number(torneoId) : null;

  const { sponsors: hookSponsors } = useSedeTickerSponsors(sid, { enabled: sid != null });

  const [contextSponsors, setContextSponsors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sid && !tid) {
        setContextSponsors([]);
        return;
      }
      try {
        const rows = await fetchPublicSponsorsList();
        if (cancelled) return;
        const matched = sponsorRowsMatchingContext(rows, { sedeId: sid, torneoId: tid }).filter(
          sponsorRowApproved,
        );
        setContextSponsors(matched);
      } catch {
        if (!cancelled) setContextSponsors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sid, tid]);

  const sponsors = useMemo(() => {
    const byId = new Map();
    [...contextSponsors, ...(hookSponsors || [])].forEach((row) => {
      if (row?.id == null) return;
      byId.set(String(row.id), row);
    });
    return [...byId.values()].map(normalizeBannerRow).filter(Boolean);
  }, [contextSponsors, hookSponsors]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [sponsors.length, sid, tid]);

  useEffect(() => {
    if (sponsors.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % sponsors.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [sponsors.length]);

  const current = sponsors[sponsors.length > 0 ? index % sponsors.length : 0];
  if (!current) return null;

  const fadeKey = String(current.id ?? index);
  const label = t('sponsors.publicidad', { defaultValue: 'Publicidad' });

  if (sponsorRowHasBannerMedia(current)) {
    const mediaBanner = (
      <>
        <span className="sponsor-banner-fade__label">{label}</span>
        <div className="sponsor-banner-fade__fade-wrap sponsor-banner-fade__media-wrap" key={fadeKey}>
          <SponsorMedia sponsor={current} />
        </div>
      </>
    );
    return wrapLink(current.url_destino, 'sponsor-banner-fade', current.nombre, mediaBanner);
  }

  const logoFallback = (
    <>
      <span className="sponsor-banner-fade__label sponsor-banner-fade__label--logo">{label}</span>
      <div className="sponsor-banner-fade__inner sponsor-banner-fade__fade-wrap" key={fadeKey}>
        {current.logo_url ? (
          <img src={current.logo_url} alt="" className="sponsor-banner-fade__logo" loading="lazy" decoding="async" />
        ) : (
          <span
            className="sponsor-banner-fade__logo sponsor-banner-fade__logo--placeholder"
            aria-hidden
          >
            {sponsorInitials(current.nombre)}
          </span>
        )}
        <span className="sponsor-banner-fade__nombre">{current.nombre}</span>
      </div>
    </>
  );

  return wrapLink(
    current.url_destino,
    'sponsor-banner-fade sponsor-banner-fade--logo',
    current.nombre,
    logoFallback,
  );
}
