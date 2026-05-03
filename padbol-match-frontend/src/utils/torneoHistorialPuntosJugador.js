import { supabase } from '../supabaseClient';
import { normalizeEmailStr } from './jugadorNombreTorneo';
import { nombreCompletoJugadorPerfil } from './jugadorPerfil';

function normalizeJugadorEquipo(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    id: p.id != null && p.id !== '' ? String(p.id) : null,
    email: normalizeEmailStr(p.email),
    alias: String(p.alias || '').trim().toLowerCase(),
    nombre: String(p.nombre || '').trim().toLowerCase(),
  };
}

function idsJugadorEquipoCoinciden(idJson, userIdPerfil) {
  const a = idJson != null && idJson !== '' ? String(idJson).trim() : '';
  const b = userIdPerfil != null && String(userIdPerfil).trim() !== '' ? String(userIdPerfil).trim() : '';
  return Boolean(a && b && a === b);
}

function jugadorEnEquipo(jugadoresArr, perfil) {
  if (!Array.isArray(jugadoresArr) || !perfil) return false;
  const uid = String(perfil.user_id || '').trim();
  const em = normalizeEmailStr(perfil.email);
  const rawEm = String(perfil.email || '').trim().toLowerCase();
  const al = String(perfil.alias || '').trim().toLowerCase();
  const nomFull = String(nombreCompletoJugadorPerfil(perfil) || perfil.nombre || '')
    .trim()
    .toLowerCase();

  for (const raw of jugadoresArr) {
    const p = normalizeJugadorEquipo(raw);
    if (!p) continue;
    if (uid && p.id && idsJugadorEquipoCoinciden(p.id, uid)) return true;
    const emailJugadorLower = String(raw?.email || '').trim().toLowerCase();
    if (rawEm && emailJugadorLower && emailJugadorLower === rawEm) return true;
    if (em && p.email && p.email === em) return true;
    if (rawEm && p.email && p.email === rawEm) return true;
    if (al && p.alias && p.alias === al) return true;
    if (nomFull && p.nombre && p.nombre === nomFull) return true;
  }
  return false;
}

async function fetchEquiposJugadorTodosTorneos(perfil) {
  const { data: equiposRows, error: equiposErr } = await supabase
    .from('equipos')
    .select('id, torneo_id, nombre, jugadores');
  if (equiposErr) {
    console.warn('[torneoHistorialPuntosJugador] equipos', equiposErr);
    return [];
  }
  const matched = [];
  for (const eq of equiposRows || []) {
    if (jugadorEnEquipo(eq.jugadores, perfil)) matched.push(eq);
  }
  return matched;
}

export function formatFechaTorneoPublico(fin, ini) {
  const f = String(fin || '').trim();
  const i = String(ini || '').trim();
  const raw = f || i;
  if (!raw) return '—';
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function posicionConMedalla(pos) {
  const n = Number(pos);
  if (!Number.isFinite(n) || n < 1) return '—';
  if (n === 1) return '🥇 1';
  if (n === 2) return '🥈 2';
  if (n === 3) return '🥉 3';
  return String(n);
}

/** Solo emoji top 3; desde 4° texto `4°` (una línea en pills de perfil). */
export function emojiMedallaPosicionCompacta(pos) {
  const n = Number(pos);
  if (!Number.isFinite(n) || n < 1) return '';
  if (n === 1) return '🥇';
  if (n === 2) return '🥈';
  if (n === 3) return '🥉';
  return `${n}°`;
}

/**
 * Torneos con `tabla_puntos.puntos > 0` donde el jugador pertenece al equipo (`jugadores` JSONB).
 * @param {object} perfil Fila `jugadores_perfil` o equivalente (user_id, email, alias, nombre…)
 */
export async function fetchTorneosConPuntosParaPerfil(perfil) {
  try {
    return await fetchTorneosConPuntosParaPerfilInner(perfil);
  } catch (e) {
    console.error('[torneoHistorialPuntosJugador] fetchTorneosConPuntosParaPerfil', e);
    return [];
  }
}

async function fetchTorneosConPuntosParaPerfilInner(perfil) {
  const equiposJugador = await fetchEquiposJugadorTodosTorneos(perfil);
  const equipoIds = [...new Set(equiposJugador.map((e) => e.id).filter((x) => x != null))];
  if (!equipoIds.length) return [];

  const { data: tpRows, error: errTp } = await supabase
    .from('tabla_puntos')
    .select('torneo_id, equipo_id, posicion, puntos')
    .in('equipo_id', equipoIds)
    .gt('puntos', 0);

  if (errTp) {
    console.error('[torneoHistorialPuntosJugador] tabla_puntos', errTp);
    return [];
  }

  const eqById = {};
  equiposJugador.forEach((e) => {
    eqById[e.id] = e;
  });

  const misFilas = [];
  for (const pr of tpRows || []) {
    if (Number(pr.puntos) <= 0) continue;
    const eq = eqById[pr.equipo_id];
    if (!eq || !jugadorEnEquipo(eq.jugadores, perfil)) continue;
    misFilas.push({
      torneo_id: pr.torneo_id,
      equipo_id: pr.equipo_id,
      posicion: pr.posicion,
      puntos: pr.puntos,
    });
  }

  if (!misFilas.length) return [];

  const tids = [...new Set(misFilas.map((r) => r.torneo_id).filter((x) => x != null))];
  const { data: torneosRows, error: errT } = await supabase
    .from('torneos')
    .select('id, nombre, fecha_inicio, fecha_fin, nivel_torneo, sede_id')
    .in('id', tids);

  if (errT) {
    console.error('[torneoHistorialPuntosJugador] torneos', errT);
  }

  const torById = {};
  (torneosRows || []).forEach((t) => {
    torById[t.id] = t;
  });

  const items = misFilas.map((row) => {
    const t = torById[row.torneo_id] || {};
    const fin = t.fecha_fin;
    const ini = t.fecha_inicio;
    const fechaSort = String(fin || ini || '').trim();
    return {
      torneo_id: row.torneo_id,
      equipo_id: row.equipo_id,
      nombreTorneo: String(t.nombre || '').trim() || `Torneo #${row.torneo_id}`,
      fecha_inicio: ini,
      fecha_fin: fin,
      fechaMostrar: formatFechaTorneoPublico(fin, ini),
      fechaSort,
      posicion: row.posicion,
      puntos: row.puntos,
      nivel_torneo: t.nivel_torneo,
    };
  });

  items.sort((a, b) => {
    const da = Date.parse(a.fechaSort ? `${a.fechaSort}T12:00:00` : '') || 0;
    const db = Date.parse(b.fechaSort ? `${b.fechaSort}T12:00:00` : '') || 0;
    if (db !== da) return db - da;
    return (Number(b.torneo_id) || 0) - (Number(a.torneo_id) || 0);
  });

  return items;
}
