import { getApiBaseUrl } from './apiPublicBaseUrl';
import { supabase } from '../supabaseClient';

const API_BASE = getApiBaseUrl({ preferLegacy: true });
const SCOREBOARD_FOTOS_BUCKET = 'scoreboard-fotos';

export async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

export async function fetchSedes(accessToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(`${API_BASE}/api/sedes`, { headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error || res.statusText || 'Error al cargar sedes';
    throw new Error(msg);
  }
  return Array.isArray(data) ? data : [];
}

export async function fetchSponsors(sedeId) {
  const res = await fetch(`${API_BASE}/api/scoreboard/sponsors/${sedeId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error al cargar sponsors');
  return data.sponsors || [];
}

export async function fetchPartido(partidoId, {authenticated=false} = {}) {
  const url=`${API_BASE}/api/scoreboard/partidos/${partidoId}`;
  let res;
  if(authenticated){
    const headers=await getAuthHeaders();
    if(!headers.Authorization)throw new Error('Ingresa nuevamente para consultar el marcador privado.');
    res=await fetch(url,{headers});
  }else res=await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error al cargar partido');
  return data;
}

export async function fetchPartidosBySede(sedeId) {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/scoreboard/partidos?sede_id=${encodeURIComponent(String(sedeId))}`,
    { headers },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error al cargar partidos');
  if (Array.isArray(data.partidos)) return data.partidos;
  if (Array.isArray(data)) return data;
  return [];
}

/** Normaliza GET /api/scoreboard/cancha (bare partido, null, o { partido }). */
export function normalizeCanchaPartidoResponse(data) {
  if (data == null) return null;
  if (Object.prototype.hasOwnProperty.call(data, 'partido')) {
    return data.partido ?? null;
  }
  if (data.id != null) return data;
  return null;
}

export async function fetchPartidoByCancha(sedeId, cancha) {
  const encodedCancha = encodeURIComponent(String(cancha || '').trim());
  const res = await fetch(`${API_BASE}/api/scoreboard/cancha/${sedeId}/${encodedCancha}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Error al cargar partido por cancha');
  return normalizeCanchaPartidoResponse(data);
}

export async function fetchPartidoHistorial(partidoId) {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_BASE}/api/scoreboard/partidos/${encodeURIComponent(String(partidoId))}/historial`,
    { headers },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error al cargar historial');
  if (Array.isArray(data.historial)) {
    return { historial: data.historial, count: data.historial.length };
  }
  const count = Number(data.count);
  return {
    historial: Array.isArray(data.historial) ? data.historial : [],
    count: Number.isFinite(count) ? count : 0,
  };
}

export async function scoreboardAction(path, method = 'POST') {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { method, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error en la acción');
  return data;
}

export async function scoreboardSuspensionAction(partidoId, action, payload) {
  if (!['suspend','resume'].includes(action)) throw new Error('Acción inválida');
  const headers=await getAuthHeaders(); if (!headers.Authorization) throw new Error('Ingresá nuevamente.');
  const res=await fetch(`${API_BASE}/api/scoreboard/partidos/${encodeURIComponent(String(partidoId))}/${action}`,{method:'POST',headers,body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({})); if(!res.ok)throw new Error(data.error||'No se pudo confirmar la operación.'); return data;
}
export async function reconcileScoreboardSuspension(partidoId,action,actionId) {
  if (!['suspend','resume'].includes(action)) throw new Error('Acción inválida');
  const headers=await getAuthHeaders(); if(!headers.Authorization)throw new Error('Ingresá nuevamente.');
  const res=await fetch(`${API_BASE}/api/scoreboard/partidos/${encodeURIComponent(String(partidoId))}/reconcile`,{method:'POST',headers,body:JSON.stringify({action,action_id:actionId})});
  const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'No se pudo confirmar la operación.');return data;
}
export async function fetchScoreboardCourts(sedeId) {
  const headers=await getAuthHeaders();if(!headers.Authorization)throw new Error('Ingresá nuevamente.');
  const res=await fetch(`${API_BASE}/api/sedes/${encodeURIComponent(String(sedeId))}/canchas`,{headers});const data=await res.json().catch(()=>null);
  if(!res.ok)throw new Error(data?.error||'No se pudieron consultar las canchas.');const rows=Array.isArray(data)?data:data?.canchas;
  if(!Array.isArray(rows))throw new Error('No se pudo confirmar el catálogo de canchas.');return rows;
}

export async function createPartido(payload) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/scoreboard/partidos`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al crear partido');
  return data;
}

export async function fetchCanchaActiva(sedeId, cancha) {
  const encodedCancha = encodeURIComponent(String(cancha || '').trim());
  const res = await fetch(
    `${API_BASE}/api/scoreboard/cancha-activa/${encodeURIComponent(String(sedeId))}/${encodedCancha}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error al cargar cancha activa');
  return data;
}

export async function fetchJugadoresTemp(partidoId) {
  const res = await fetch(
    `${API_BASE}/api/scoreboard/jugadores-temp/${encodeURIComponent(String(partidoId))}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error al cargar jugadores temporales');
  return data.jugadores || [];
}

/** Sube foto al bucket público; no escribe en scoreboard_jugadores_temp. */
export async function uploadScoreboardJugadorFoto(file, partidoId, equipo, slot) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `jugadores/${partidoId}/${equipo}/${slot}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(SCOREBOARD_FOTOS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(SCOREBOARD_FOTOS_BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}

/** Persiste jugador temporal vía backend (service_role); nunca escribir la tabla desde el cliente. */
export async function postJugadorTemp(payload, accessToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(`${API_BASE}/api/scoreboard/jugador-temp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error al guardar jugador');
  return data.jugador || data;
}

export async function updatePartido(partidoId, payload) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/scoreboard/partidos/${encodeURIComponent(String(partidoId))}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error al actualizar partido');
  return data;
}

export { API_BASE };
