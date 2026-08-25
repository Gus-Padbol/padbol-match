import React from 'react';

const baseProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function AdminEditIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...baseProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function AdminCheckIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...baseProps}>
      <path d="m5 12 4.2 4.2L19 6.5" />
    </svg>
  );
}

export function AdminDeleteIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...baseProps}>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  );
}

export function AdminChartIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...baseProps}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16v-4M12 16V8M16 16v-7" />
    </svg>
  );
}

export function AdminSaveIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...baseProps}>
      <path d="M5 3h11l3 3v15H5Z" />
      <path d="M8 3v6h8V3M8 21v-7h8v7" />
    </svg>
  );
}

export function AdminLicenseIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...baseProps}>
      <circle cx="12" cy="8" r="5" />
      <path d="m8.5 12.2-1.4 8.3L12 18l4.9 2.5-1.4-8.3" />
      <path d="m10.2 8 1.2 1.2 2.4-2.5" />
    </svg>
  );
}

export function AdminGridIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...baseProps}>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

/** Moneda propia de PadCoins: evita depender del emoji del sistema operativo. */
export function AdminPadcoinsIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...baseProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 8.5h4a2 2 0 0 1 0 4H11a2 2 0 0 0 0 4h4" />
      <path d="M12 6.5v11" />
    </svg>
  );
}

export function AdminTrophyIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...baseProps}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3" />
      <path d="M12 13v4M8.5 20h7M10 17h4" />
    </svg>
  );
}
