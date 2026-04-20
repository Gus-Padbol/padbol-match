import * as T from './designTokens';

export const pageBackgroundStyle = {
  minHeight: '100vh',
  background: `linear-gradient(135deg, ${T.gradientStart}, ${T.gradientEnd})`,
};

export const cardStyle = {
  background: T.colorCard,
  borderRadius: T.radiusCard,
  boxShadow: T.shadowCard,
  padding: 24,
  boxSizing: 'border-box',
};

export const cardStyleCompact = {
  ...cardStyle,
  padding: 18,
};

/** A) Primario — acción principal */
export const buttonPrimaryStyle = {
  width: '100%',
  padding: '16px 20px',
  borderRadius: T.radiusButton,
  border: 'none',
  fontWeight: 800,
  fontSize: 16,
  color: '#fff',
  cursor: 'pointer',
  background: `linear-gradient(135deg, ${T.colorPrimary}, ${T.colorPrimaryDark})`,
  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
};

/** B) Secundario — navegación / alternativa fuerte */
export const buttonSecondaryStyle = {
  ...buttonPrimaryStyle,
  background: `linear-gradient(135deg, ${T.colorSecondary}, ${T.colorSecondaryDark})`,
  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
};

export const buttonAccentStyle = {
  ...buttonPrimaryStyle,
  background: `linear-gradient(135deg, ${T.colorAccent}, ${T.colorAccentDark})`,
  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
};

/** C) Terciario — Volver / acciones suaves */
export const buttonTertiaryStyle = {
  padding: '10px 18px',
  borderRadius: T.radiusButton,
  border: '1px solid rgba(255,255,255,0.35)',
  fontWeight: 700,
  fontSize: 13,
  color: '#fff',
  cursor: 'pointer',
  background: 'rgba(0,0,0,0.35)',
  backdropFilter: 'blur(4px)',
};

export const status = {
  confirmed: { color: T.colorSuccessStrong, bg: 'rgba(22, 163, 74, 0.12)' },
  pending: { color: T.colorWarningSoft, bg: 'rgba(245, 158, 11, 0.15)' },
  complete: { color: T.colorPrimaryStrong, bg: 'rgba(21, 128, 61, 0.12)' },
  error: { color: T.colorErrorDark, bg: 'rgba(239, 68, 68, 0.12)' },
};
