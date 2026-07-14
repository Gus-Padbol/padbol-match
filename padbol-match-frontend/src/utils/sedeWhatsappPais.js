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
  // fallback: reconstruct from catalog
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

  // Número completo (o con otro prefijo): no tocar automáticamente.
  return { phone, warning: 'mismatch' };
}

/** Caracteres admitidos: dígitos, +, espacios, guiones y paréntesis. */
export function sanitizeWhatsappInput(raw) {
  return String(raw || '').replace(/[^\d+\s\-()]/g, '');
}

/** Normaliza a E.164 cuando hay ≥11 dígitos; si no, conserva texto saneado. */
export function normalizeWhatsappForStorage(raw) {
  const cleaned = sanitizeWhatsappInput(raw).trim();
  if (!cleaned) return null;
  const d = digitsOnlyPhone(cleaned);
  if (d.length >= 11) return `+${d}`;
  return cleaned;
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
