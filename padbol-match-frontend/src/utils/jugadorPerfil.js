import { supabase } from '../supabaseClient';

export const JUGADOR_PERFIL_LS_KEY = 'jugadorPerfil';

export const PERFIL_CHANGE_EVENT = 'padbol-jugador-perfil';

export function readJugadorPerfil() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(JUGADOR_PERFIL_LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : null;
  } catch {
    return null;
  }
}

/** Nombre visible: nombre + apellido */
export function nombreCompletoJugadorPerfil(p) {
  const x = p || readJugadorPerfil();
  if (!x) return '';
  const n = String(x.nombre ?? '').trim();
  const a = String(x.apellido ?? '').trim();
  return [n, a].filter(Boolean).join(' ').trim();
}

function nombreApellidoEfectivos(p) {
  if (!p || typeof p !== 'object') return { nombre: '', apellido: '' };
  let nombre = String(p.nombre ?? '').trim();
  let apellido = String(p.apellido ?? '').trim();
  if (!apellido && nombre.includes(' ')) {
    const parts = nombre.split(/\s+/).filter(Boolean);
    nombre = parts[0] || '';
    apellido = parts.slice(1).join(' ') || '';
  }
  return { nombre, apellido };
}

/** Perfil mínimo torneo: nombre, apellido, categoría, WhatsApp o email */
export function isPerfilTorneoCompleto(perfil) {
  const p = perfil ?? readJugadorPerfil();
  if (!p || typeof p !== 'object') return false;
  const { nombre, apellido } = nombreApellidoEfectivos(p);
  const categoria = String(p.categoria ?? p.nivel ?? '').trim();
  const wa = String(p.whatsapp ?? '').trim();
  const em = String(p.email ?? '').trim();
  const contacto = wa || em;
  return nombre.length > 0 && apellido.length > 0 && categoria.length > 0 && contacto.length > 0;
}

/** Identidad de torneo sin cuenta Supabase */
export function tieneRegistroTorneo() {
  return isPerfilTorneoCompleto();
}

export function persistJugadorPerfil(partial) {
  if (typeof window === 'undefined') return;
  const prev = readJugadorPerfil() || {};
  const next = { ...prev };
  Object.entries(partial || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) next[k] = v;
  });
  try {
    localStorage.setItem(JUGADOR_PERFIL_LS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(PERFIL_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export async function refreshJugadorPerfilFromSupabase(email) {
  const em = String(email || '').trim();
  if (!em) return;
  try {
    const { data, error } = await supabase
      .from('jugadores_perfil')
      .select('nombre, nivel')
      .eq('email', em)
      .maybeSingle();
    if (error || !data) return;
    const { nombre: n0, apellido: a0 } = nombreApellidoEfectivos({
      nombre: data.nombre,
      apellido: '',
    });
    const nombre = n0;
    const apellido = a0;
    const categoria = String(data.nivel || '').trim();
    persistJugadorPerfil({
      ...(nombre ? { nombre } : {}),
      ...(apellido ? { apellido } : {}),
      ...(categoria ? { categoria } : {}),
      email: em,
    });
  } catch {
    /* ignore */
  }
}
