import React from 'react';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';

const OPCIONES = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];

/**
 * Selector de país (bandera + código) + input de número local.
 * Usa los mismos datos que `constants/paisesTelefono.js`.
 */
export default function TelefonoPaisCodigoRow({
  codigoValue,
  onCodigoChange,
  localValue,
  onLocalChange,
  disabled = false,
  selectStyle = {},
  inputStyle = {},
  placeholderLocal = 'Número sin código de país',
  inputMode = 'numeric',
  autoCompleteLocal = 'tel-national',
  ariaLabelCodigo = 'País y código de área',
  ariaLabelLocal = 'Número de celular sin código de país',
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 8,
        alignItems: 'stretch',
        width: '100%',
      }}
    >
      <select
        value={codigoValue}
        onChange={(e) => onCodigoChange?.(e.target.value)}
        disabled={disabled}
        title="País / código"
        aria-label={ariaLabelCodigo}
        style={{
          flex: '0 0 auto',
          minWidth: 108,
          maxWidth: 140,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...selectStyle,
        }}
      >
        {OPCIONES.map((p) => (
          <option key={`${p.nombre}-${p.codigo}`} value={p.codigo} title={p.nombre}>
            {p.bandera} {p.codigo}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode={inputMode}
        value={localValue}
        onChange={(e) => onLocalChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholderLocal}
        aria-label={ariaLabelLocal}
        autoComplete={autoCompleteLocal}
        style={{
          flex: '1 1 0',
          minWidth: 0,
          ...inputStyle,
        }}
      />
    </div>
  );
}
