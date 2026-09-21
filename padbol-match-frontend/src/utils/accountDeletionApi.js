import { getApiBaseUrl } from './apiPublicBaseUrl';
import { LEGAL_DOCUMENTS } from './legalDocuments';

const API_BASE_URL = getApiBaseUrl();
const ACCOUNT_DELETION_RECEIPT_STORAGE_KEY = 'padbol_account_deletion_receipt';

export const ACCOUNT_DELETION_CONFIRMATION = 'ELIMINAR';

export function normalizeAccountDeletionResponse(payload) {
  const row = payload && typeof payload === 'object' ? payload : {};
  const request = row.request && typeof row.request === 'object' ? row.request : {};
  const rawStatus = String(row.status || request.estado || 'pending');
  return {
    ok: row.ok === true || Boolean(row.request),
    status: ['solicitada', 'en_proceso', 'retenida'].includes(rawStatus) ? 'pending' : rawStatus,
    requestedAt: row.requested_at || row.requestedAt || request.solicitado_at || null,
    requestId: row.request_id ?? row.requestId ?? request.id ?? null,
    nextStep: row.next_step || row.nextStep || null,
    idempotent: row.idempotent === true,
    message: String(row.message || ''),
  };
}

export function isValidAccountDeletionReceipt(receipt) {
  if (!receipt || receipt.ok !== true) return false;
  const requestId = receipt.requestId;
  const requestedAt = String(receipt.requestedAt || '');
  return (
    (typeof requestId === 'number' || (typeof requestId === 'string' && requestId.trim() !== ''))
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(requestedAt)
    && Number.isFinite(Date.parse(requestedAt))
  );
}

export function getStoredAccountDeletionReceipt() {
  try {
    const raw = localStorage.getItem(ACCOUNT_DELETION_RECEIPT_STORAGE_KEY);
    if (!raw) return null;
    const receipt = normalizeAccountDeletionResponse(JSON.parse(raw));
    return isValidAccountDeletionReceipt(receipt) ? receipt : null;
  } catch {
    return null;
  }
}

export function accountDeletionErrorMessage(payload, status) {
  const serverMessage = String(payload?.error || payload?.message || '').trim();
  if (serverMessage) return serverMessage;
  if (status === 401) return 'Tu sesión venció. Volvé a ingresar antes de solicitar la eliminación.';
  if (status === 503) return 'La eliminación de cuenta todavía no está disponible. Intentá nuevamente más tarde.';
  return 'No pudimos registrar la solicitud. Intentá nuevamente.';
}

export async function requestAccountDeletion({ accessToken, source = 'web', signal } = {}) {
  const token = String(accessToken || '').trim();
  if (!token) throw new Error('Necesitás iniciar sesión para eliminar tu cuenta.');

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/legal/eliminacion/solicitudes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
        source,
        app_version: process.env.REACT_APP_VERSION || 'web-local',
        idioma: typeof document !== 'undefined' ? document.documentElement.lang || null : null,
        legal_version: `terms:${LEGAL_DOCUMENTS.terms.version};privacy:${LEGAL_DOCUMENTS.privacy.version}`,
      }),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error('No pudimos conectarnos para registrar la solicitud. Revisá tu conexión e intentá nuevamente.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(accountDeletionErrorMessage(payload, response.status));
  const receipt = normalizeAccountDeletionResponse(payload);
  if (!isValidAccountDeletionReceipt(receipt)) {
    throw new Error('El servidor no devolvió un comprobante válido. Contactá a soporte antes de repetir la solicitud.');
  }
  try {
    localStorage.setItem(ACCOUNT_DELETION_RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
  } catch {
    // The receipt still remains visible in the current flow if storage is unavailable.
  }
  return receipt;
}

export { ACCOUNT_DELETION_RECEIPT_STORAGE_KEY };
