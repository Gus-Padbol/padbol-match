import React from 'react';
import { buttonPrimaryStyle, buttonSecondaryStyle, buttonTertiaryStyle, buttonAccentStyle } from '../theme/uiStyles';

const VARIANT = {
  primary: buttonPrimaryStyle,
  secondary: buttonSecondaryStyle,
  tertiary: buttonTertiaryStyle,
  accent: buttonAccentStyle,
};

export default function AppButton({
  variant = 'primary',
  fullWidth = true,
  type = 'button',
  disabled = false,
  style,
  children,
  ...rest
}) {
  const base = VARIANT[variant] || buttonPrimaryStyle;
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        ...base,
        ...(fullWidth && variant !== 'tertiary' ? { width: '100%', maxWidth: '100%', boxSizing: 'border-box' } : {}),
        opacity: disabled ? 0.65 : 1,
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
