import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';

const ALL_PAISES = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];

const WHATSAPP_EXAMPLES = {
  '+54': '+54 9 11 1234-5678',
  '+34': '+34 612 345 678',
  '+39': '+39 312 345 6789',
  '+33': '+33 6 12 34 56 78',
  '+49': '+49 151 12345678',
  '+1': '+1 202 555 0123',
  '+55': '+55 11 91234-5678',
  '+598': '+598 94 123 456',
  '+56': '+56 9 1234 5678',
  '+57': '+57 300 1234567',
  '+52': '+52 55 1234 5678',
};

function stripRegionalFlag(raw) {
  const s = String(raw || '').trim();
  const cps = [...s];
  const isRi = (ch) => {
    if (!ch) return false;
    const cp = ch.codePointAt(0);
    return cp >= 0x1f1e6 && cp <= 0x1f1ff;
  };
  if (cps.length >= 2 && isRi(cps[0]) && isRi(cps[1])) {
    return cps.slice(2).join('').trim();
  }
  return s;
}

function normalizePaisName(raw) {
  return stripRegionalFlag(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function digitsOnlyPhone(raw) {
  return String(raw || '').replace(/\D/g, '');
}

/** Código telefónico (+54) desde label de sede ("🇦🇷 Argentina" o "Argentina"). */
export function codigoTelefonicoDesdePaisLabel(paisLabel) {
  const key = normalizePaisName(paisLabel);
  if (!key) return null;
  // ISO corto (AR, ES…) — pocos casos legacy
  const isoMap = {
    ar: '+54', es: '+34', it: '+39', fr: '+33', de: '+49',
    us: '+1', br: '+55', uy: '+598', cl: '+56', co: '+57', mx: '+52',
  };
  if (isoMap[key]) return isoMap[key];
  const hit = ALL_PAISES.find((p) => normalizePaisName(p.nombre) === key);
  return hit?.codigo || null;
}

export function paisOptionValueFromStored(paisRaw, paisOptions) {
  const raw = String(paisRaw || '').trim();
  if (!raw) return '';
  const key = normalizePaisName(raw);
  const opts = Array.isArray(paisOptions) ? paisOptions : [];
  const hit = opts.find((o) => normalizePaisName(o.value || o.label || '') === key);
  if (hit) return hit.value;
  const cat = ALL_PAISES.find((p) => normalizePaisName(p.nombre) === key);
  if (cat) return `${cat.bandera} ${cat.nombre}`.trim();
  return raw;
}

export function phoneIsOnlyCountryPrefix(phone, codigo) {
  const d = digitsOnlyPhone(phone);
  const c = digitsOnlyPhone(codigo);
  if (!c || !d) return false;
  return d === c;
}

export function phoneStartsWithCountryPrefix(phone, codigo) {
  const trimmed = String(phone || '').trim();
  const c = String(codigo || '').trim();
  if (!c || !trimmed) return false;
  if (trimmed === c || trimmed.startsWith(`${c} `) || trimmed.startsWith(`${c}-`)) return true;
  const d = digitsOnlyPhone(trimmed);
  const cd = digitsOnlyPhone(c);
  return Boolean(cd) && d.startsWith(cd) && d.length > cd.length;
}

/** Quita el prefijo de país del WhatsApp, dejando el resto del número. */
export function stripCountryPrefix(phone, codigo) {
  const trimmed = String(phone || '').trim();
  const c = String(codigo || '').trim();
  if (!trimmed || !c) return trimmed;
  if (trimmed === c) return '';
  if (trimmed.startsWith(`${c} `) || trimmed.startsWith(`${c}-`)) {
    return trimmed.slice(c.length + 1).trim();
  }
  if (trimmed.startsWith(c)) {
    return trimmed.slice(c.length).trim();
  }
  const d = digitsOnlyPhone(trimmed);
  const cd = digitsOnlyPhone(c);
  if (cd && d.startsWith(cd) && d.length > cd.length) {
    return d.slice(cd.length);
  }
  return trimmed;
}

/**
 * Asegura prefijo de país en carga / país ya seleccionado.
 * Vacío → +54; local sin + → prepend; ya con prefijo → intacto.
 */
export function ensureWhatsappPrefixed(currentPhone, paisLabel) {
  const codigo = codigoTelefonicoDesdePaisLabel(paisLabel);
  const phone = String(currentPhone || '').trim();
  if (!codigo) {
    return { phone, warning: paisLabel ? 'no_code' : null };
  }
  if (!phone) {
    return { phone: codigo, warning: null };
  }
  if (phoneIsOnlyCountryPrefix(phone, codigo) || phoneStartsWithCountryPrefix(phone, codigo)) {
    return { phone, warning: null };
  }
  // Dígitos ya empiezan con el código país (ej. 54911…)
  const d = digitsOnlyPhone(phone);
  const cd = digitsOnlyPhone(codigo);
  if (cd && d.startsWith(cd) && d.length > cd.length) {
    return { phone: phone.startsWith('+') ? phone : `+${d}`, warning: null };
  }
  // Número local sin código internacional
  if (!phone.startsWith('+')) {
    return { phone: `${codigo} ${phone}`, warning: null };
  }
  return { phone, warning: 'mismatch' };
}

/**
 * Al cambiar el país del club, actualiza WhatsApp según reglas MEJ-01.
 * @returns {{ phone: string, warning: null|'mismatch'|'no_code' }}
 */
export function applyPaisChangeToWhatsapp({ prevPaisLabel, nextPaisLabel, currentPhone }) {
  const nextCodigo = codigoTelefonicoDesdePaisLabel(nextPaisLabel);
  const prevCodigo = codigoTelefonicoDesdePaisLabel(prevPaisLabel);
  const phone = String(currentPhone || '').trim();

  if (!nextCodigo) {
    return { phone, warning: nextPaisLabel ? 'no_code' : null };
  }

  if (!phone) {
    return { phone: nextCodigo, warning: null };
  }

  if (
    phoneIsOnlyCountryPrefix(phone, prevCodigo)
    || phoneIsOnlyCountryPrefix(phone, nextCodigo)
    || phone === String(prevCodigo || '').trim()
  ) {
    return { phone: nextCodigo, warning: null };
  }

  if (phoneStartsWithCountryPrefix(phone, nextCodigo)) {
    return { phone, warning: null };
  }

  // Reemplazar prefijo anterior por el nuevo (número ya internacional del país viejo)
  if (prevCodigo && phoneStartsWithCountryPrefix(phone, prevCodigo)) {
    const rest = stripCountryPrefix(phone, prevCodigo);
    return { phone: rest ? `${nextCodigo} ${rest}` : nextCodigo, warning: null };
  }

  // Local sin +: anteponer prefijo sin destruir dígitos
  if (!phone.startsWith('+')) {
    const d = digitsOnlyPhone(phone);
    const cd = digitsOnlyPhone(nextCodigo);
    if (cd && d.startsWith(cd) && d.length > cd.length) {
      return { phone: `+${d}`, warning: null };
    }
    return { phone: `${nextCodigo} ${phone}`, warning: null };
  }

  // Otro número internacional completo: no tocar
  return { phone, warning: 'mismatch' };
}

/** Caracteres admitidos: dígitos, +, espacios, guiones y paréntesis. */
export function sanitizeWhatsappInput(raw) {
  return String(raw || '').replace(/[^\d+\s\-()]/g, '');
}

/**
 * Normaliza a E.164 cuando hay dígitos suficientes.
 * Si se pasa paisLabel y el número es local, antepone el prefijo antes de guardar.
 */
export function normalizeWhatsappForStorage(raw, paisLabel) {
  let cleaned = sanitizeWhatsappInput(raw).trim();
  if (!cleaned) return null;

  const codigo = codigoTelefonicoDesdePaisLabel(paisLabel);
  if (codigo && !phoneStartsWithCountryPrefix(cleaned, codigo) && !cleaned.startsWith('+')) {
    const d = digitsOnlyPhone(cleaned);
    const cd = digitsOnlyPhone(codigo);
    if (!(cd && d.startsWith(cd))) {
      cleaned = `${codigo} ${cleaned}`;
    }
  }

  const d = digitsOnlyPhone(cleaned);
  if (!d) return null;
  // Con prefijo de país aplicado, persistir E.164 aunque sea corto (evita perder +54)
  if (codigo && d.startsWith(digitsOnlyPhone(codigo))) {
    return `+${d}`;
  }
  if (d.length >= 11) return `+${d}`;
  return cleaned;
}

/**
 * MEJ-04: divide el teléfono guardado en prefijo visual + número local.
 * mode 'split' → bloque de prefijo readonly + campo local editable.
 * mode 'full'  → sin código aplicable o internacional de otro país: campo único.
 * No modifica el dato: es solo para presentación.
 */
export function splitWhatsappForPhoneField(value, paisLabel) {
  const codigo = codigoTelefonicoDesdePaisLabel(paisLabel);
  const phone = String(value || '').trim();
  if (!codigo) return { mode: 'full', codigo: null, local: phone };
  if (!phone) return { mode: 'split', codigo, local: '' };
  if (phoneIsOnlyCountryPrefix(phone, codigo)) return { mode: 'split', codigo, local: '' };
  if (phoneStartsWithCountryPrefix(phone, codigo)) {
    return { mode: 'split', codigo, local: stripCountryPrefix(phone, codigo) };
  }
  if (phone.startsWith('+')) {
    // Internacional de otro país: no forzar el prefijo de la sede.
    return { mode: 'full', codigo, local: phone };
  }
  // Histórico local sin prefijo: se conserva como número local.
  return { mode: 'split', codigo, local: phone };
}

/**
 * MEJ-04: une el número local editado con el prefijo readonly sin duplicarlo.
 * Acepta pegado de números que ya incluyen el código de país (+54 …, 54911…).
 * `dedupDigits` controla la deduplicación de dígitos sin "+": debe activarse
 * solo en pegados, porque números locales legítimos pueden empezar con los
 * mismos dígitos del código de país (ej. móviles "39…" en Italia +39).
 * El resultado es compatible con normalizeWhatsappForStorage (contrato intacto).
 */
export function joinWhatsappLocalInput(localRaw, codigo, { dedupDigits = true } = {}) {
  const local = sanitizeWhatsappInput(localRaw).trim();
  const c = String(codigo || '').trim();
  if (!c) return local;
  if (!local) return c;
  if (local.startsWith('+')) {
    if (phoneIsOnlyCountryPrefix(local, c)) return c;
    if (phoneStartsWithCountryPrefix(local, c)) {
      const rest = stripCountryPrefix(local, c);
      return rest ? `${c} ${rest}` : c;
    }
    // Otro internacional pegado completo: conservar tal cual (el aviso lo maneja el form).
    return local;
  }
  if (dedupDigits) {
    // Dígitos que ya arrancan con el código país (ej. 54911…): no duplicar.
    const d = digitsOnlyPhone(local);
    const cd = digitsOnlyPhone(c);
    if (cd && d.startsWith(cd) && d.length > cd.length) {
      return `${c} ${d.slice(cd.length)}`;
    }
    if (cd && d === cd) return c;
  }
  return `${c} ${local}`;
}

/** MEJ-04: ejemplo de número local (sin prefijo) para placeholder del campo editable. */
export function exampleLocalForCodigo(codigo) {
  const c = String(codigo || '').trim();
  const full = WHATSAPP_EXAMPLES[c];
  if (!full) return '';
  return stripCountryPrefix(full, c);
}

export function exampleWhatsappForPaisLabel(paisLabel) {
  const codigo = codigoTelefonicoDesdePaisLabel(paisLabel);
  if (!codigo) return 'Ej: +54 9 11 1234-5678';
  return WHATSAPP_EXAMPLES[codigo] || `${codigo} …`;
}

export function exampleWhatsappForCodigo(codigo) {
  const c = String(codigo || '').trim();
  return WHATSAPP_EXAMPLES[c] || (c ? `${c} …` : 'Ej: +54 9 11 1234-5678');
}
