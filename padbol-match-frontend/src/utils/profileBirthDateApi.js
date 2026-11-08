import { getApiBaseUrl } from './apiPublicBaseUrl';

const API_BASE = getApiBaseUrl();
function sessionError() { return new Error('La sesión cambió. Vuelve a abrir el perfil.'); }
async function requestBirthDate({ accessToken, isCurrent = () => true, method = 'GET', date }) {
  if (!accessToken || !isCurrent()) throw sessionError();
  const response = await fetch(`${API_BASE}/api/jugador/identidad`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}) },
    ...(method === 'PUT' ? { body: JSON.stringify({ fecha_nacimiento: date }) } : {}),
  });
  if (!isCurrent()) throw sessionError();
  const body = await response.json();
  if (!isCurrent()) throw sessionError();
  if (!response.ok) throw new Error('No se pudo confirmar la fecha de nacimiento. Los demás datos pueden haberse guardado; vuelve a abrir el perfil.');
  if (!body || !Object.prototype.hasOwnProperty.call(body, 'fecha_nacimiento')) throw new Error('No se pudo verificar la fecha de nacimiento.');
  const raw = body.fecha_nacimiento;
  if (raw !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) throw new Error('Respuesta de fecha de nacimiento inválida.');
  return raw;
}
export function fetchProfileBirthDate(options) { return requestBirthDate(options); }
export async function saveChangedProfileBirthDate({ value, initialDate, ...options }) {
  const date = value === '' || value == null ? null : String(value);
  if (date === initialDate) return initialDate;
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('La fecha debe tener formato AAAA-MM-DD.');
  const confirmed = await requestBirthDate({ ...options, method: 'PUT', date });
  if (confirmed !== date) throw new Error('La fecha guardada no coincide. Vuelve a abrir el perfil.');
  return confirmed;
}
