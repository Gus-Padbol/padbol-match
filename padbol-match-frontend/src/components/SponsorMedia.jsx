import React from 'react';
import { normalizeSponsorTipoMedia, sponsorHasDisplayableMedia } from '../utils/sponsorMedia';
import './SponsorMedia.css';

function safeUrl(v) {
  if (v == null) return '';
  const s = String(v).trim();
  return s;
}

/**
 * Renderiza imagen o video de sponsor según `tipo_media`.
 * @param {{ sponsor?: Record<string, unknown>|null, className?: string }} props
 */
export default function SponsorMedia({ sponsor = null, className = '' }) {
  if (!sponsorHasDisplayableMedia(sponsor)) return null;

  const row = sponsor && typeof sponsor === 'object' && !Array.isArray(sponsor) ? sponsor : {};
  const tipo = normalizeSponsorTipoMedia(row.tipo_media);
  const videoUrl = safeUrl(row.video_url);
  const imageUrl = safeUrl(row.banner_url) || safeUrl(row.logo_url) || safeUrl(row.imagen_url);
  const extraClass = className ? ` ${className}` : '';

  if (tipo === 'video' && videoUrl) {
    return (
      <video
        src={videoUrl}
        autoPlay
        loop
        muted
        playsInline
        className={`sponsor-media sponsor-media--video${extraClass}`}
      />
    );
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`sponsor-media sponsor-media--image${extraClass}`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return null;
}
