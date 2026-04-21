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

/** Concatena código país (+54 → 54) y número local solo dígitos. */
export function buildFullWhatsDigits(codigoPais, numeroLocal) {
  const c = digitsOnly(codigoPais);
  const n = digitsOnly(numeroLocal);
  if (!n) return '';
  return `${c}${n}`;
}

/** WhatsApp en formato E.164 con prefijo + (ej. +5491123456789). */
export function formatWhatsAppE164(codigoPais, numeroLocal) {
  const c = digitsOnly(codigoPais);
  const n = digitsOnly(numeroLocal);
  if (!c || !n) return '';
  return `+${c}${n}`;
}

export function whatsappNacionalValido(numeroLocal) {
  return digitsOnly(numeroLocal).length >= MIN_DIGITOS_WHATSAPP_NACIONAL;
}

/** Intenta separar un WhatsApp guardado (solo dígitos o con símbolos) en código + local. */
export function splitStoredWhatsapp(fullRaw) {
  const full = digitsOnly(fullRaw);
  if (!full) return { codigo: '+54', local: '' };
  const sorted = [...ALL_PAISES_TEL].sort(
    (a, b) => digitsOnly(b.codigo).length - digitsOnly(a.codigo).length
  );
  for (const p of sorted) {
    const c = digitsOnly(p.codigo);
    if (c && full.startsWith(c)) {
      return { codigo: p.codigo, local: full.slice(c.length) };
    }
  }
  return { codigo: '+54', local: full };
}

/** WhatsApp completo guardado o ingresado (internacional mínimo razonable). */
export function whatsappDigitsValido(raw) {
  const d = digitsOnly(raw);
  if (d.length >= MIN_DIGITOS_WHATSAPP_INTERNACIONAL) return true;
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
