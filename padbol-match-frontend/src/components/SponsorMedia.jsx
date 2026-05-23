import React from 'react';
import { normalizeSponsorTipoMedia } from '../utils/sponsorMedia';
import './SponsorMedia.css';

/**
 * Renderiza imagen o video de sponsor según `tipo_media`.
 * @param {{ sponsor?: Record<string, unknown>|null, className?: string }} props
 */
export default function SponsorMedia({ sponsor, className = '' }) {
  const row = sponsor && typeof sponsor === 'object' ? sponsor : {};
  const tipo = normalizeSponsorTipoMedia(row.tipo_media);
  const videoUrl = String(row.video_url || '').trim();
  const imageUrl = String(row.banner_url || row.logo_url || row.imagen_url || '').trim();
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
