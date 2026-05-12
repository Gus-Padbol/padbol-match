import * as T from './designTokens';

export const pageBackgroundStyle = {
  minHeight: '100vh',
  background: T.colorBg,
};

export const cardStyle = {
  background: T.colorCard,
  borderRadius: T.radiusCard,
  boxShadow: T.shadowCard,
  border: `1px solid ${T.colorBorder}`,
  padding: 16,
  boxSizing: 'border-box',
};

export const cardStyleCompact = {
  ...cardStyle,
  padding: 14,
};

/** Primario de marca — rojo */
export const buttonPrimaryStyle = {
  width: '100%',
  padding: '14px 24px',
  borderRadius: T.radiusButton,
  border: 'none',
  fontWeight: 600,
  fontSize: 16,
  color: '#fff',
  cursor: 'pointer',
  background: T.colorBrand,
  boxShadow: 'none',
};

/** Secundario — borde rojo */
export const buttonSecondaryStyle = {
  ...buttonPrimaryStyle,
  background: 'transparent',
  color: T.colorBrand,
  border: `2px solid ${T.colorBrand}`,
};

/** Positivo / confirmar — verde */
export const buttonAccentStyle = {
  ...buttonPrimaryStyle,
  background: T.colorSuccess,
  color: '#fff',
  border: 'none',
};

/** Terciario — sobre fondos oscuros o fotos */
export const buttonTertiaryStyle = {
  padding: '10px 18px',
  borderRadius: T.radiusButton,
  border: `1px solid ${T.colorBorder}`,
  fontWeight: 600,
  fontSize: 14,
  color: T.colorText,
  cursor: 'pointer',
  background: T.colorMutedBg,
};

export const status = {
  confirmed: { color: T.colorSuccessStrong, bg: 'rgba(22, 163, 74, 0.12)' },
  pending: { color: T.colorWarningSoft, bg: 'rgba(245, 158, 11, 0.15)' },
  complete: { color: T.colorPrimaryStrong, bg: 'rgba(21, 128, 61, 0.12)' },
  error: { color: T.colorErrorDark, bg: 'rgba(225, 27, 34, 0.1)' },
};
