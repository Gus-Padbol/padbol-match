import { supabase } from '../supabaseClient';

export const LEGAL_DOCUMENTS = Object.freeze({
  terms: Object.freeze({ version: '2026-09-05', url: '/terminos' }),
  privacy: Object.freeze({ version: '2026-09-10', url: '/legal/privacidad-2026-09-10.html' }),
});

const PENDING_OAUTH_ACCEPTANCE_KEY = 'padbol_pending_legal_acceptance_v1';

function auditValue(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function getSignUpLegalMetadata(source = 'web_email', { birthDate, ageBand } = {}) {
  return {
    legal_terms_version: LEGAL_DOCUMENTS.terms.version,
    legal_privacy_version: LEGAL_DOCUMENTS.privacy.version,
    legal_terms_accepted: true,
    legal_privacy_acknowledged: true,
    legal_notice_acknowledged: true,
    legal_acceptance_source: auditValue(source, 40) || 'web_email',
    legal_app_version: auditValue(process.env.REACT_APP_VERSION, 40) || 'web',
    legal_locale: auditValue(navigator.language, 20) || null,
    legal_birth_date: auditValue(birthDate, 10) || null,
    legal_age_band: auditValue(ageBand, 30) || null,
  };
}

export function markPendingOAuthLegalAcceptance({ birthDate, ageBand } = {}) {
  sessionStorage.setItem(
    PENDING_OAUTH_ACCEPTANCE_KEY,
    JSON.stringify({
      source: 'web_oauth',
      termsVersion: LEGAL_DOCUMENTS.terms.version,
      privacyVersion: LEGAL_DOCUMENTS.privacy.version,
      termsAccepted: true,
      privacyAcknowledged: true,
      birthDate: auditValue(birthDate, 10) || null,
      ageBand: auditValue(ageBand, 30) || null,
    }),
  );
}

export function clearPendingOAuthLegalAcceptance() {
  sessionStorage.removeItem(PENDING_OAUTH_ACCEPTANCE_KEY);
}

export function hasPendingOAuthLegalAcceptance() {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_OAUTH_ACCEPTANCE_KEY) || 'null');
    return Boolean(
      pending
      && pending.termsVersion === LEGAL_DOCUMENTS.terms.version
      && pending.privacyVersion === LEGAL_DOCUMENTS.privacy.version
      && pending.termsAccepted === true
      && pending.privacyAcknowledged === true
    );
  } catch {
    return false;
  }
}

function pendingOAuthLegalAcceptance() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_OAUTH_ACCEPTANCE_KEY) || 'null'); } catch { return null; }
}

export async function registerCurrentAccountEligibility(birthDate, source = 'web_gate') {
  const { data, error } = await supabase.rpc('registrar_elegibilidad_cuenta_actual', {
    p_fecha_nacimiento: auditValue(birthDate, 10) || null,
    p_fuente: auditValue(source, 40) || 'web_gate',
  });
  if (error) throw error;
  if (!data?.allowed) throw new Error(data?.age_band === 'requires_verified_parent' ? 'verified_parental_authorization_required' : 'account_not_available_under_13');
  return data;
}

export function hasCurrentLegalAcceptance(data) {
  return Boolean(
    data?.terms_accepted === true
    && data?.privacy_acknowledged === true
    && data?.terms_version === LEGAL_DOCUMENTS.terms.version
    && data?.privacy_version === LEGAL_DOCUMENTS.privacy.version
  );
}

export async function fetchCurrentLegalAcceptance() {
  const { data, error } = await supabase.rpc('estado_aceptacion_legal_actual');
  if (error) throw error;
  return data;
}

export async function acceptCurrentLegalDocuments(source = 'web_gate') {
  const { data, error } = await supabase.rpc('registrar_aceptacion_legal_actual', {
    p_fuente: auditValue(source, 40) || 'web_gate',
    p_version_app: auditValue(process.env.REACT_APP_VERSION, 40) || 'web',
    p_locale: auditValue(navigator.language, 20) || null,
  });
  if (error) throw error;
  if (!hasCurrentLegalAcceptance(data)) throw new Error('legal_acceptance_not_verified');
  return data;
}

export async function flushPendingOAuthLegalAcceptance() {
  if (!hasPendingOAuthLegalAcceptance()) return false;
  const pending = pendingOAuthLegalAcceptance();
  // La edad se valida inmediatamente después de crear la sesión, dentro del
  // flujo obligatorio de completar perfil. Las cuentas antiguas que todavía
  // envían fecha aquí conservan el comportamiento previo.
  if (pending?.birthDate) {
    await registerCurrentAccountEligibility(pending.birthDate, 'web_oauth');
  }

  const { data, error } = await supabase.rpc('registrar_aceptacion_legal_actual', {
    p_fuente: 'web_oauth',
    p_version_app: auditValue(process.env.REACT_APP_VERSION, 40) || 'web',
    p_locale: auditValue(navigator.language, 20) || null,
  });
  if (error) throw error;

  if (!hasCurrentLegalAcceptance(data)) throw new Error('legal_acceptance_not_verified');

  clearPendingOAuthLegalAcceptance();
  return true;
}
