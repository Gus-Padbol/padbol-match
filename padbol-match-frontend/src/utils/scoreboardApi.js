import { supabase } from '../supabaseClient';

const API_BASE = process.env.REACT_APP_API_URL || 'https://padbol-backend.onrender.com';

export async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
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

export { API_BASE };
