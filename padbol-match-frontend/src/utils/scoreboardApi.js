import { supabase } from '../supabaseClient';

const API_BASE = process.env.REACT_APP_API_URL || 'https://padbol-backend.onrender.com';
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

export async function fetchPartido(partidoId) {
  const res = await fetch(`${API_BASE}/api/scoreboard/partidos/${partidoId}`);
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

export async function fetchPartidoByCancha(sedeId, cancha) {
  const encodedCancha = encodeURIComponent(String(cancha || '').trim());
  const res = await fetch(`${API_BASE}/api/scoreboard/cancha/${sedeId}/${encodedCancha}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Error al cargar partido por cancha');
  return data;
}

export async function scoreboardAction(path, method = 'POST') {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { method, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error en la acción');
  return data;
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
