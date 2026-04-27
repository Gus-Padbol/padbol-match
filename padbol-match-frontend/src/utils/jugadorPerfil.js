import { supabase } from '../supabaseClient';
import { whatsappDigitsValido } from './authIdentidad';

export const JUGADOR_PERFIL_LS_KEY = 'jugadorPerfil';

/** Clave legacy / alias; limpiar junto con {@link JUGADOR_PERFIL_LS_KEY}. */
export const JUGADOR_PERFIL_LS_KEY_ALT = 'jugadores_perfil';

export const PERFIL_CHANGE_EVENT = 'padbol-jugador-perfil';

/** Borra perfil de jugador en localStorage (evita identidad fantasma sin sesión). */
export function clearJugadorPerfilLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(JUGADOR_PERFIL_LS_KEY);
    localStorage.removeItem(JUGADOR_PERFIL_LS_KEY_ALT);
  } catch {
    /* ignore */
  }
}

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

/** Nombre visible: nombre + apellido (solo el objeto pasado; no leer localStorage). */
export function nombreCompletoJugadorPerfil(p) {
  const x = p && typeof p === 'object' ? p : null;
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

/** WhatsApp obligatorio (notificaciones); formato internacional o legacy. */
export function whatsappPerfilValido(perfil) {
  const p = perfil ?? readJugadorPerfil();
  if (!p || typeof p !== 'object') return false;
  const wa = String(p.whatsapp ?? '').trim();
  return whatsappDigitsValido(wa);
}

/** Perfil mínimo torneo: nombre, apellido, categoría y WhatsApp válido (obligatorio). */
export function isPerfilTorneoCompleto(perfil) {
  const p = perfil ?? readJugadorPerfil();
  if (!p || typeof p !== 'object') return false;
  const { nombre, apellido } = nombreApellidoEfectivos(p);
  const categoria = String(p.categoria ?? p.nivel ?? '').trim();
  if (!whatsappPerfilValido(p)) return false;
  return nombre.length > 0 && apellido.length > 0 && categoria.length > 0;
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

/**
 * Garantiza fila en jugadores_perfil para el email (nombre desde perfil local, sin usar email como nombre).
 * Usa upsert por email. Si falta nombre completo en LS, devuelve error.
 */
export async function ensureJugadorPerfilRowForEmail(email) {
  const em = String(email || '').trim();
  if (!em) return { error: null };
  const jp = readJugadorPerfil();
  const full = nombreCompletoJugadorPerfil(jp).trim();
  if (!full) {
    return { error: new Error('Completa nombre y apellido en tu perfil antes de crear un equipo.') };
  }
  const wa = String(jp?.whatsapp || '').trim();
  if (!whatsappPerfilValido(jp)) {
    return { error: new Error('Completa un WhatsApp válido en tu perfil.') };
  }
  const { data: yaExiste, error: selErr } = await supabase
    .from('jugadores_perfil')
    .select('email')
    .eq('email', em)
    .maybeSingle();
  if (selErr) return { error: selErr };
  if (yaExiste?.email) return { error: null };

  const row = {
    email: em,
    nombre: full,
    whatsapp: wa,
    nivel: String(jp?.categoria || jp?.nivel || '5ta').trim() || '5ta',
    lateralidad: 'Diestro',
    pendiente_validacion: true,
    es_federado: false,
  };
  const { error } = await supabase.from('jugadores_perfil').insert([row]);
  return { error };
}

export async function refreshJugadorPerfilFromSupabase(email) {
  const em = String(email || '').trim();
  if (!em) return;
  try {
    const [{ data, error }, { data: cli }] = await Promise.all([
      supabase.from('jugadores_perfil').select('nombre, nivel, whatsapp, foto_url').eq('email', em).maybeSingle(),
      supabase.from('clientes').select('whatsapp').eq('email', em).maybeSingle(),
    ]);
    const waCli = String(cli?.whatsapp || '').trim();
    const waJp = String(data?.whatsapp || '').trim();
    const wa = waJp || waCli;
    if (error || !data) {
      if (waCli) {
        persistJugadorPerfil({ whatsapp: waCli, email: em });
      }
      return;
    }
    const { nombre: n0, apellido: a0 } = nombreApellidoEfectivos({
      nombre: data.nombre,
      apellido: '',
    });
    const nombre = n0;
    const apellido = a0;
    const categoria = String(data.nivel || '').trim();
    const fotoUrl = String(data?.foto_url || '').trim();
    persistJugadorPerfil({
      ...(nombre ? { nombre } : {}),
      ...(apellido ? { apellido } : {}),
      ...(categoria ? { categoria } : {}),
      ...(wa ? { whatsapp: wa } : {}),
      ...(fotoUrl ? { foto_url: fotoUrl } : {}),
      email: em,
    });
  } catch {
    /* ignore */
  }
}
