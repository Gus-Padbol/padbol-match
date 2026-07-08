import React from 'react';
import {
  getPlayerCampaignBannerTitle,
  getPlayerCampaignBannerBody,
  getPlayerCampaignSlotLabel,
  getPlayerCampaignConfirmMessage,
  getPlayerCampaignSuccessMessage,
} from '../utils/padcoinsCampaignsPlayer';

const BADGE_STYLE = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 700,
  color: '#92400e',
  background: '#fef3c7',
  border: '1px solid #fde68a',
  borderRadius: '999px',
  padding: '3px 10px',
  lineHeight: 1.3,
};

const BANNER_STYLE = {
  margin: '0 0 16px',
  padding: '14px 16px',
  background: 'var(--bg-card)',
  border: '1px solid #fde68a',
  borderRadius: '12px',
  color: 'var(--text-primary)',
};

export function PadcoinsCampaignPlayerBadge({ campaign }) {
  if (!campaign) return null;
  const label = getPlayerCampaignSlotLabel(campaign);
  if (!label) return null;
  return (
    <span style={BADGE_STYLE} role="status">
      {label}
    </span>
  );
}

export function PadcoinsCampaignPlayerBanner({
  campaign,
  onCtaClick,
  ctaLabel = 'Reservar ahora',
}) {
  if (!campaign) return null;
  const title = getPlayerCampaignBannerTitle(campaign);
  const body = getPlayerCampaignBannerBody(campaign);
  const label = getPlayerCampaignSlotLabel(campaign);
  if (!title && !body) return null;

  return (
    <div style={BANNER_STYLE} role="status" aria-live="polite">
      {label ? (
        <span style={{ ...BADGE_STYLE, marginBottom: '10px' }}>
          {label}
        </span>
      ) : null}
      {title ? (
        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
          {title}
        </h3>
      ) : null}
      {body ? (
        <p style={{ margin: '0 0 12px', fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          {body}
        </p>
      ) : null}
      {onCtaClick ? (
        <button
          type="button"
          onClick={onCtaClick}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--accent, #E11B22)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}

export function PadcoinsCampaignPlayerHint({ campaign, variant = 'confirm' }) {
  if (!campaign) return null;
  const message = variant === 'success'
    ? getPlayerCampaignSuccessMessage(campaign)
    : getPlayerCampaignConfirmMessage(campaign);
  if (!message) return null;

  return (
    <p
      style={{
        margin: '0 0 14px',
        padding: '12px 14px',
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: '8px',
        fontSize: '13px',
        lineHeight: 1.55,
        color: '#78350f',
      }}
      role="status"
    >
      {message}
    </p>
  );
}
