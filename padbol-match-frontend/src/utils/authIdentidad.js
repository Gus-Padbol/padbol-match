import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { supabase } from '../supabaseClient';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';

/** Compatibilidad con validaciones antiguas (solo dígitos). */
export const MIN_WHATSAPP_DIGITS = 8;

/** Dígitos del número sin código país (Argentina: típicamente 10, ej. 9 11 …). */
export const MIN_DIGITOS_WHATSAPP_NACIONAL = 10;

/** Mínimo dígitos del número internacional completo (código + nacional). */
export const MIN_DIGITOS_WHATSAPP_INTERNACIONAL = 11;

const ALL_PAISES_TEL = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];

export function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

/**
 * Email sintético para Supabase (no visible al usuario).
 * Formato local válido con plus-tag: usuario+{número completo en dígitos}@padbolmatch.com
 * (ej. usuario+542213032019@padbolmatch.com). Evita prefijos tipo wa_ y dominios .local.
 */
export function syntheticAuthEmailFromDigits(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return '';
  return `usuario+${d}@padbolmatch.com`;
}

/** Resolve national, +country and 00-country inputs without adding a prefix twice. */
export function normalizedWhatsApp(codigoPais, numeroLocal) {
  const c = digitsOnly(codigoPais).replace(/^00/, '');
  const raw = String(numeroLocal || '').trim();
  const n = digitsOnly(raw);
  if (!c || !n) return null;
  const possible = value => {
    const parsed = parsePhoneNumberFromString(value);
    return parsed?.countryCallingCode === c && parsed.isPossible() ? parsed : null;
  };
  if (raw.startsWith('+') || n.startsWith('00')) {
    return possible(`+${n.replace(/^00/, '')}`);
  }
  // Prefer a national number. Only strip a bare pasted country code when
  // concatenating it would not be a possible number for the selected country.
  return possible(`+${c}${n}`) || possible(`+${n}`);
}

export function buildFullWhatsDigits(codigoPais, numeroLocal) {
  return normalizedWhatsApp(codigoPais, numeroLocal)?.number.slice(1) || '';
}

export function formatWhatsAppE164(codigoPais, numeroLocal) {
  return normalizedWhatsApp(codigoPais, numeroLocal)?.number || '';
}

export function whatsappNacionalValido(numeroLocal, codigoPais = '+54') {
  return Boolean(normalizedWhatsApp(codigoPais, numeroLocal));
}

/** Read historic international prefixes, including an accidental +34 0034. */
export function splitStoredWhatsapp(fullRaw) {
  const full = digitsOnly(fullRaw).replace(/^00/, '');
  if (!full) return { codigo: '+54', local: '' };
  const sorted = [...ALL_PAISES_TEL].sort((a,b) => digitsOnly(b.codigo).length-digitsOnly(a.codigo).length);
  for (const p of sorted) {
    const c = digitsOnly(p.codigo);
    if (c && full.startsWith(c)) {
      const local = full.slice(c.length);
      const normalized = normalizedWhatsApp(p.codigo, local);
      return { codigo: p.codigo, local: normalized?.nationalNumber || local };
    }
  }
  return { codigo: '+54', local: full };
}

/**
 * WhatsApp completo guardado o ingresado.
 * Acepta internacional (código + número, típ. ≥11 dígitos) o número local argentino típico (10 dígitos, ej. 2213032019).
 */
export function whatsappDigitsValido(raw) {
  const d = digitsOnly(raw);
  if (d.length > 15) return false;
  if (d.length >= MIN_DIGITOS_WHATSAPP_INTERNACIONAL) return true;
  if (d.length >= MIN_DIGITOS_WHATSAPP_NACIONAL) return true;
  return d.length >= MIN_WHATSAPP_DIGITS;
}

/**
 * Resuelve el email de autenticación Supabase a partir de email o WhatsApp.
 */
export async function resolveAuthEmailForLogin(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return { error: 'empty', authEmail: null };
  if (raw.includes('@')) {
    return { authEmail: raw.toLowerCase() };
  }
  const digits = digitsOnly(raw);
  if (digits.length < MIN_WHATSAPP_DIGITS) {
    return { error: 'short_phone', authEmail: null };
  }
  const synth = syntheticAuthEmailFromDigits(digits);
  const { data: bySynth } = await supabase.from('clientes').select('email').eq('email', synth).maybeSingle();
  if (bySynth?.email) return { authEmail: String(bySynth.email).trim().toLowerCase() };

  const { data: rows, error } = await supabase.from('clientes').select('email, whatsapp').limit(3000);
  if (error || !Array.isArray(rows)) {
    return { authEmail: synth };
  }
  const match = rows.find((r) => digitsOnly(r.whatsapp) === digits && digits.length >= MIN_WHATSAPP_DIGITS);
  if (match?.email) return { authEmail: String(match.email).trim().toLowerCase() };
  return { authEmail: synth };
}

/** Email usado en signUp: email real si viene, si no sintético desde WhatsApp. */
export function authEmailForRegistro(emailOpcional, whatsappCompleto) {
  const em = String(emailOpcional || '').trim();
  if (em && em.includes('@')) return em.toLowerCase();
  const d = digitsOnly(whatsappCompleto);
  return syntheticAuthEmailFromDigits(d);
}
