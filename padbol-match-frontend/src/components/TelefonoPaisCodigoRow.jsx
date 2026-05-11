import React, { useId } from 'react';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';

const OPCIONES = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];

const LABEL_BASE = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '6px',
};

const FULL_WIDTH = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
};

/**
 * Tres bloques verticales (100% ancho cada control): País → Número → [Confirmar número].
 * Sin fila horizontal; evita recortes en viewports estrechos.
 */
export default function TelefonoPaisCodigoRow({
  codigoValue,
  onCodigoChange,
  localValue,
  onLocalChange,
  disabled = false,
  selectStyle = {},
  inputStyle = {},
  /** Solo el input de confirmar (ej. borde de error distinto). */
  confirmInputStyle = {},
  placeholderLocal = 'Ej: 2213032019',
  inputMode = 'numeric',
  autoCompleteLocal = 'tel-national',
  ariaLabelCodigo = 'País y código de área',
  ariaLabelLocal = 'Número de celular sin código de país',
  confirmLocalValue,
  onConfirmLocalChange,
  autoCompleteConfirm = 'off',
  ariaLabelConfirmLocal = 'Confirmar número local',
  placeholderConfirm = '',
  confirmDisabled,
  /** Título opcional encima (ej. WhatsApp *). */
  sectionHeading = null,
  sectionHeadingStyle = {},
  /** Estilo base de las etiquetas País / Número / Confirmar. */
  labelStyle = {},
  labelPais = 'País',
  labelNumero = 'Número',
  /** Si hay confirmación, texto del label (sin asterisco). */
  labelConfirmarTexto = 'Confirmar número',
  /** Muestra * obligatorio en el label de confirmar. */
  confirmRequired = false,
  requiredAsteriskStyle = { color: '#dc2626' },
  /** Espacio entre bloques (px). */
  blockGapPx = 14,
}) {
  const confirmRow =
    typeof onConfirmLocalChange === 'function' && confirmLocalValue !== undefined && confirmLocalValue !== null;
  const confirmBusy = confirmDisabled !== undefined ? confirmDisabled : disabled;

  const uid = useId();
  const idPais = `${uid}-pais`;
  const idNumero = `${uid}-numero`;
  const idConfirmar = `${uid}-confirmar`;

  const mergedLabelStyle = { ...LABEL_BASE, ...labelStyle };

  const selectMerged = { ...FULL_WIDTH, ...selectStyle, ...FULL_WIDTH };
  const inputMerged = { ...FULL_WIDTH, ...inputStyle, ...FULL_WIDTH };
  const confirmInputMerged = { ...inputMerged, ...confirmInputStyle };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${blockGapPx}px`,
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {sectionHeading ? (
        <div style={{ marginBottom: 0, ...sectionHeadingStyle }}>{sectionHeading}</div>
      ) : null}

      <div style={{ width: '100%', minWidth: 0 }}>
        <label style={mergedLabelStyle} htmlFor={idPais}>
          {labelPais}
        </label>
        <select
          id={idPais}
          value={codigoValue}
          onChange={(e) => onCodigoChange?.(e.target.value)}
          disabled={disabled}
          title="País / código"
          aria-label={ariaLabelCodigo}
          style={{
            ...selectMerged,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {OPCIONES.map((p) => (
            <option key={`${p.nombre}-${p.codigo}`} value={p.codigo} title={p.nombre}>
              {p.bandera} {p.codigo}
            </option>
          ))}
        </select>
      </div>

      <div style={{ width: '100%', minWidth: 0 }}>
        <label style={mergedLabelStyle} htmlFor={idNumero}>
          {labelNumero}
        </label>
        <input
          id={idNumero}
          type="tel"
          inputMode={inputMode}
          value={localValue}
          onChange={(e) => onLocalChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholderLocal}
          aria-label={ariaLabelLocal}
          autoComplete={autoCompleteLocal}
          style={inputMerged}
        />
      </div>

      {confirmRow ? (
        <div style={{ width: '100%', minWidth: 0 }}>
          <label style={mergedLabelStyle} htmlFor={idConfirmar}>
            {labelConfirmarTexto}
            {confirmRequired ? <span style={requiredAsteriskStyle}> *</span> : null}
          </label>
          <input
            id={idConfirmar}
            type="tel"
            inputMode={inputMode}
            value={confirmLocalValue}
            onChange={(e) => onConfirmLocalChange?.(e.target.value)}
            disabled={confirmBusy}
            placeholder={placeholderConfirm}
            aria-label={ariaLabelConfirmLocal}
            autoComplete={autoCompleteConfirm}
            style={confirmInputMerged}
          />
        </div>
      ) : null}
    </div>
  );
}
