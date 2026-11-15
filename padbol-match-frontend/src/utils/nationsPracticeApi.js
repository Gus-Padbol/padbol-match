import {getApiBaseUrl} from './apiPublicBaseUrl';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function practiceBoardId(id) {
  const value = String(id || '');
  if (!UUID.test(value)) throw new Error('PRACTICE_INVALID_ID');
  return value;
}
export function practiceEventId(id) {
  const value = String(id || '');
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1e12) throw new Error('PRACTICE_INVALID_ID');
  return value;
}
export function consumePracticeControl(boardId, location = window.location, history = window.history, storage) {
  const id = practiceBoardId(boardId);
  const key = `nations-practice-control:${id}`;
  if (!storage) { try { storage = window.sessionStorage; } catch { /* private browsing may deny storage */ } }
  const fragment = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
  const supplied = fragment.get('control');
  const valid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{24,256}$/.test(value);
  if (supplied != null) {
    // The capability is removed before the first network request or any navigation.
    history.replaceState(history.state, '', `${location.pathname}${location.search || ''}`);
    if (!valid(supplied)) { try { storage?.removeItem(key); } catch { /* no storage */ } return null; }
    try { storage.setItem(key, supplied); } catch { /* memory-only session remains usable */ }
    return supplied;
  }
  try { const saved = storage.getItem(key); return valid(saved) ? saved : null; } catch { return null; }
}
export function createNationsPracticeApi({baseUrl = getApiBaseUrl(), fetchImpl = fetch} = {}) {
  const base = String(baseUrl).replace(/\/$/, '');
  async function request(path, {token, body, signal} = {}) {
    const response = await fetchImpl(`${base}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {...(token ? {Authorization: `Bearer ${token}`} : {}), ...(body ? {'Content-Type': 'application/json'} : {})},
      ...(body ? {body: JSON.stringify(body)} : {}), signal, cache: 'no-store', referrerPolicy: 'no-referrer',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error('PRACTICE_REQUEST_FAILED');
      error.status = response.status;
      error.code = ['PRACTICE_REVISION_CONFLICT','PRACTICE_EXPIRED','PRACTICE_CONTROL_EXPIRED'].includes(data.code) ? data.code : null;
      throw error;
    }
    return data;
  }
  return {
    async event(id, signal) {
      const eventId = practiceEventId(id);
      const [event, result] = await Promise.all([request(`/api/torneos/${eventId}`, {signal}), request(`/api/torneos/${eventId}/partidos`, {signal})]);
      const matches = Array.isArray(result) ? result : result.partidos;
      if (!Array.isArray(matches) || matches.length !== 3 || matches.some(match => String(match.torneo_id) !== eventId || !UUID.test(String(match.scoreboard_id)))) throw new Error('PRACTICE_INVALID_EVENT');
      return {event, matches};
    },
    async board(id, signal) { return request(`/api/scoreboard/partidos/${practiceBoardId(id)}`, {signal}); },
    async control(id, token, signal) {
      if (!token) throw new Error('PRACTICE_CONTROL_REQUIRED');
      return request(`/api/practice/boards/${practiceBoardId(id)}/control`, {token, signal});
    },
    async command(id, token, body, signal) {
      if (!token || !body?.requestId || (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0)) throw new Error('PRACTICE_CONTROL_REQUIRED');
      return request(`/api/practice/boards/${practiceBoardId(id)}/commands`, {token, body, signal});
    },
  };
}

export function practiceRequestId(crypto = window.crypto) {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
