/**
 * Helpers para confirmar/cancelar reservas en Admin (bloqueo + errores controlados).
 */

export function sanitizeAdminReservaUserMessage(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/Bearer\s+\S+/gi, '[redacted]').trim();
  if (s.length > 280) s = `${s.slice(0, 277)}…`;
  // Evitar stacks / objetos serializados (no confundir con el marcador [redacted])
  if (/\n\s+at\s+/.test(s)) return null;
  if (s.startsWith('{') || (s.startsWith('[') && !s.startsWith('[redacted]'))) return null;
  return s;
}

/**
 * Extrae mensaje útil de una respuesta/error de fetch o axios-like.
 * Prioridad: data.message → message → response.data.message → error/mensaje.
 */
export function extractAdminReservaBackendMessage(payload) {
  if (payload == null) return null;
  if (typeof payload === 'string') return sanitizeAdminReservaUserMessage(payload);
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  return sanitizeAdminReservaUserMessage(
    data?.message
      || payload?.message
      || payload?.response?.data?.message
      || data?.error
      || data?.mensaje
      || null,
  );
}

/**
 * @param {number} status
 * @param {object} data
 * @param {'confirm'|'cancel'} action
 * @returns {{ code: string, message: string|null, fallbackKey: string }}
 */
export function parseAdminReservaActionError(status, data, action = 'cancel') {
  const backendMsg = extractAdminReservaBackendMessage(data);
  const fallbackKey =
    action === 'confirm'
      ? 'admin.reservas.confirmFailed'
      : 'admin.reservas.cancelFailed';

  if (status === 401) {
    return {
      code: 'unauthorized',
      message: backendMsg,
      fallbackKey: 'admin.reservas.actionUnauthorized',
    };
  }
  if (status === 403) {
    return {
      code: 'forbidden',
      message: backendMsg,
      fallbackKey: 'admin.reservas.actionForbidden',
    };
  }
  if (status === 404) {
    return {
      code: 'not_found',
      message: backendMsg,
      fallbackKey: 'admin.reservas.actionNotFound',
    };
  }
  if (status === 409 || status === 400) {
    return {
      code: 'conflict',
      message: backendMsg,
      fallbackKey: 'admin.reservas.actionConflict',
    };
  }
  return {
    code: 'error',
    message: backendMsg,
    fallbackKey,
  };
}

export function resolveAdminReservaActionErrorMessage(parsed, t) {
  if (parsed?.message) return parsed.message;
  const key = parsed?.fallbackKey || 'admin.alerts.genericError';
  const translated = typeof t === 'function' ? t(key) : null;
  if (translated && translated !== key) return translated;
  if (parsed?.fallbackKey === 'admin.reservas.confirmFailed') {
    return 'No se pudo confirmar la reserva.';
  }
  if (parsed?.fallbackKey === 'admin.reservas.cancelFailed') {
    return 'No se pudo cancelar la reserva.';
  }
  if (parsed?.fallbackKey === 'admin.reservas.actionForbidden') {
    return 'No tenés permiso para realizar esta acción.';
  }
  if (parsed?.fallbackKey === 'admin.reservas.actionNotFound') {
    return 'La reserva no existe o ya fue eliminada.';
  }
  if (parsed?.fallbackKey === 'admin.reservas.actionConflict') {
    return 'La reserva ya fue modificada. Actualizá la lista e intentá nuevamente.';
  }
  if (parsed?.fallbackKey === 'admin.reservas.actionUnauthorized') {
    return 'Sesión expirada. Volvé a iniciar sesión.';
  }
  return 'Ocurrió un error. Intentá nuevamente.';
}

/**
 * Intenta iniciar una acción sobre una reserva (mapa id → action).
 * Otras reservas siguen operables.
 * @returns {{ ok: true, next: Record<string,string> } | { ok: false, reason: string }}
 */
export function tryBeginReservaAction(pendingById, reservaId, action) {
  const id = reservaId == null ? '' : String(reservaId);
  if (!id) return { ok: false, reason: 'missing_id' };
  const current = pendingById && typeof pendingById === 'object' ? pendingById : {};
  if (current[id]) {
    return { ok: false, reason: 'busy' };
  }
  return { ok: true, next: { ...current, [id]: String(action || '') } };
}

export function clearReservaAction(pendingById, reservaId) {
  const id = reservaId == null ? '' : String(reservaId);
  const current = pendingById && typeof pendingById === 'object' ? { ...pendingById } : {};
  if (id) delete current[id];
  return current;
}

export function isReservaActionBusyFor(pendingById, reservaId, action = null) {
  if (!pendingById || reservaId == null) return false;
  const id = String(reservaId);
  const active = pendingById[id];
  if (!active) return false;
  if (action == null) return true;
  return String(active) === String(action);
}

export function mergeReservaAfterConfirm(list, reservaId, updatedRow) {
  const id = String(reservaId);
  const rows = Array.isArray(list) ? list : [];
  if (updatedRow && typeof updatedRow === 'object') {
    return rows.map((r) => (String(r?.id) === id ? { ...r, ...updatedRow } : r));
  }
  return rows.map((r) => (
    String(r?.id) === id ? { ...r, estado: 'confirmada' } : r
  ));
}

export function removeReservaAfterCancel(list, reservaId) {
  const id = String(reservaId);
  return (Array.isArray(list) ? list : []).filter((r) => String(r?.id) !== id);
}

/** Extrae fila de reserva de una respuesta PUT exitosa. */
export function pickReservaFromConfirmResponse(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.reserva && typeof body.reserva === 'object') return body.reserva;
  if (body.data && typeof body.data === 'object' && body.data.id != null) return body.data;
  if (body.id != null) return body;
  return null;
}
