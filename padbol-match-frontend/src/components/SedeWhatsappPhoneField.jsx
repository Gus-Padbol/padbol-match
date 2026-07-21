import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import {
  exampleLocalForCodigo,
  exampleWhatsappForPaisLabel,
  joinWhatsappLocalInput,
  sanitizeWhatsappInput,
  splitWhatsappForPhoneField,
} from '../utils/sedeWhatsappPais';
import './SedeWhatsappPhoneField.css';

/**
 * MEJ-04 — Campo de WhatsApp de la sede con prefijo internacional separado.
 * Muestra el código de país (derivado del país de la sede) como bloque de solo
 * lectura y deja editable únicamente el número local, evitando que el usuario
 * duplique el prefijo. El valor que emite `onChange` conserva el contrato
 * actual (string completo tipo "+54 221 555 1234"), por lo que la
 * normalización y el guardado existentes no cambian.
 *
 * Si el país no tiene código en el catálogo, o el valor guardado es un número
 * internacional de otro país, se muestra el campo único de siempre.
 */
export default function SedeWhatsappPhoneField({
  id,
  value,
  paisLabel,
  onChange,
  inputClassName = '',
  disabled = false,
}) {
  const { t } = useTranslation();
  const { mode, codigo, local } = splitWhatsappForPhoneField(value, paisLabel);

  if (mode === 'full') {
    return (
      <>
        <input
          id={id}
          type="tel"
          value={String(value || '')}
          placeholder={exampleWhatsappForPaisLabel(paisLabel)}
          onChange={(e) => onChange(sanitizeWhatsappInput(e.target.value))}
          className={`sede-wa-phone-input sede-wa-phone-input--full ${inputClassName}`.trim()}
          autoComplete="tel"
          disabled={disabled}
        />
        <p className="sede-wa-phone-help" id={id ? `${id}-help` : undefined}>
          {t('admin.sedes.whatsappPrefixHint', { example: exampleWhatsappForPaisLabel(paisLabel) })}
        </p>
      </>
    );
  }

  const helpId = id ? `${id}-help` : undefined;
  const handleLocalChange = (e) => {
    const raw = sanitizeWhatsappInput(e.target.value);
    // Solo deduplicar dígitos de país en inserciones múltiples (pegado); al
    // tipear de a un carácter, números locales legítimos pueden empezar con
    // los mismos dígitos del código (ej. móviles italianos "39…" con +39).
    const pasted = raw.length - local.length > 1;
    onChange(joinWhatsappLocalInput(raw, codigo, { dedupDigits: pasted }));
  };
  const localExample = exampleLocalForCodigo(codigo);

  return (
    <>
      <div className="sede-wa-phone-group">
        <span className="sede-wa-phone-prefix">
          <span className="sede-wa-phone-sr-only">
            {t('admin.sedes.whatsappCountryCodeAria')}{' '}
          </span>
          {codigo}
        </span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          value={local}
          placeholder={localExample}
          onChange={handleLocalChange}
          className={`sede-wa-phone-input sede-wa-phone-input--local ${inputClassName}`.trim()}
          autoComplete="tel-national"
          aria-label={t('admin.sedes.whatsappLocalAria')}
          aria-describedby={helpId}
          disabled={disabled}
        />
      </div>
      <p className="sede-wa-phone-help" id={helpId}>
        {t('admin.sedes.whatsappLocalHelp')}
      </p>
    </>
  );
}
