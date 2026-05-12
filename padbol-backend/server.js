import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import cron from 'node-cron';
import multer from 'multer';
import Stripe from 'stripe';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkMorasSedes } from './suscripciones/checkMorasSedes.js';
import { createCheckSuscripcionActiva } from './suscripciones/checkSuscripcionActiva.js';
import { sendMakeEvent } from './make/sendMakeEvent.js';
import { DateTime } from 'luxon';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3001;

/** Lista base; `CORS_ORIGIN` / `CORS_ORIGINS` en Render (coma-separado) se añaden encima. */
const allowedOrigins = [
  'https://padbolmatch.com',
  'https://www.padbolmatch.com',
  'https://padbol-match.netlify.app',
  'https://padbol-match-9abn.vercel.app',
  'http://localhost:3000',
];

function buildCorsAllowedOrigins() {
  const raw = String(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '').trim();
  const fromEnv = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return [...new Set([...fromEnv, ...allowedOrigins])];
}

// CORS + JSON parser primero: ningún app.get/post ni headers CORS manuales deben ir encima.
// CORS (Render: CORS_ORIGIN=https://www.padbolmatch.com,https://padbolmatch.com,https://padbol-match-9abn.vercel.app)
app.use((req, res, next) => {
  console.log('CORS DEBUG - Origin:', req.headers.origin, '| Allowed:', buildCorsAllowedOrigins());
  next();
});
app.use(cors({
  origin: function (origin, callback) {
    const allowed = buildCorsAllowedOrigins();
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}));
app.use(
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      const u = req.originalUrl || '';
      if (u.startsWith('/api/stripe/webhook')) {
        req.rawBody = buf;
      }
    },
  })
);

// Supabase (desde .env)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const uploadContrato = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const TZ_TORNEO_CALENDARIO = 'America/Argentina/Buenos_Aires';
const MSG_TORNEO_INSCRIPCION_FECHA_PASADA =
  'Este torneo ya finalizó o su fecha de juego ha pasado';

/** yyyy-LL-dd “hoy” en ART (torneos / fecha_referencia del chat-IA). Sin `new Date()` directo. */
function ymdTodayInTorneoTz() {
  const dt = DateTime.now().setZone(TZ_TORNEO_CALENDARIO);
  return dt.isValid ? dt.toFormat('yyyy-LL-dd') : null;
}

const TZ_SEDE_DEFAULT = 'America/Argentina/Buenos_Aires';

function normalizePaisKeyReserva(pais) {
  return String(pais || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeCiudadKeyReserva(ciudad) {
  return String(ciudad || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Valida IANA; si no, default AR. */
function normalizeSedeTimezone(raw) {
  const s = String(raw || '').trim();
  if (!s) return TZ_SEDE_DEFAULT;
  const probe = DateTime.now().setZone(s);
  return probe.isValid ? s : TZ_SEDE_DEFAULT;
}

function inferTimezoneFromCiudadPais(ciudad, pais) {
  const c = normalizeCiudadKeyReserva(ciudad);
  const p = normalizePaisKeyReserva(pais);
  if (c === 'miami') return 'America/New_York';
  if (c === 'madrid') return 'Europe/Madrid';
  if (p.includes('argentina')) return TZ_SEDE_DEFAULT;
  return TZ_SEDE_DEFAULT;
}

/** yyyy-LL-dd en la zona IANA de la sede. */
function ymdTodayInSedeTimezone(iana) {
  const z = normalizeSedeTimezone(iana);
  return DateTime.now().setZone(z).toFormat('yyyy-LL-dd');
}

/** Inicio del slot (fecha + HH:mm en pared local de la sede) como ms UTC. */
function reservaWallStartUtcMs(fechaYmd, horaStr, zone) {
  const fy = String(fechaYmd || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fy)) return null;
  const fh = String(horaStr || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!fh) return null;
  const z = normalizeSedeTimezone(zone);
  const [yy, mo, dd] = fy.split('-').map((x) => parseInt(x, 10));
  const dt = DateTime.fromObject(
    { year: yy, month: mo, day: dd, hour: parseInt(fh[1], 10), minute: parseInt(fh[2], 10), second: 0 },
    { zone: z },
  );
  return dt.isValid ? dt.toMillis() : null;
}

/** No permitir fecha u hora ya pasadas según `sedes.timezone` (fallback ciudad/país / ART). */
async function assertReservaHorarioNoPasadoParaSede(sedeNombre, fecha, hora) {
  const nombre = String(sedeNombre || '').trim();
  if (!nombre) return;
  const { data: row, error } = await supabase
    .from('sedes')
    .select('timezone, ciudad, pais')
    .eq('nombre', nombre)
    .maybeSingle();
  if (error) throw error;
  const tz = normalizeSedeTimezone(row?.timezone || inferTimezoneFromCiudadPais(row?.ciudad, row?.pais));

  const f = String(fecha || '').trim().slice(0, 10);
  const hoySede = ymdTodayInSedeTimezone(tz);
  if (!hoySede) return;
  if (f < hoySede) {
    const e = new Error('La fecha de la reserva ya pasó');
    e.status = 400;
    throw e;
  }
  if (f !== hoySede) return;

  const slotMs = reservaWallStartUtcMs(f, hora, tz);
  if (slotMs == null || !Number.isFinite(slotMs)) {
    const e = new Error('Hora de reserva inválida');
    e.status = 400;
    throw e;
  }
  if (slotMs <= Date.now()) {
    const e = new Error('Este horario ya no está disponible');
    e.status = 400;
    throw e;
  }
}

function torneoFechaInicioYmdFromStr(fechaInicioStr) {
  const d = String(fechaInicioStr || '').trim();
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Calendario ART: `fecha_inicio` (YYYY-MM-DD) estrictamente anterior a hoy. */
function torneoFechaInicioEsAnteriorAHoyArt(fechaInicioStr) {
  const inicio = torneoFechaInicioYmdFromStr(fechaInicioStr);
  const hoy = ymdTodayInTorneoTz();
  if (!inicio || !hoy) return false;
  return inicio < hoy;
}

/**
 * Reseñas por sede en PostgREST: la tabla expuesta en este proyecto es `public.resenas`
 * (no `sede_resenas`; el OpenAPI de Supabase lista `resenas`).
 */
const PUBLIC_RESENAS_TABLE = 'resenas';

const RESENAS_SELECT_ROW = 'id, estrellas, comentario, user_id, created_at, nombre';
const RESENAS_SELECT_ROW_FALLBACK = 'id, estrellas, comentario, user_id, created_at';

function isResenasPublicTableConfigError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || '');
  const mentionsResenas =
    msg.includes('public.resenas') ||
    msg.includes("'resenas'") ||
    msg.includes('"resenas"') ||
    msg.includes('sede_resenas') ||
    /\bresenas\b/.test(msg);
  if (!mentionsResenas) return false;
  return (
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    code === '42P01' ||
    code === 'PGRST205'
  );
}

function respondResenasPublicUnavailable(res, err) {
  console.error('❌ Tabla public.resenas no disponible:', err?.message || err);
  return res.status(503).json({
    error:
      'Las reseñas no están disponibles: falta o no está expuesta la tabla public.resenas. Ejecutá padbol-backend/sql/resenas_sedes.sql en el SQL Editor de Supabase.',
    code: 'RESENAS_TABLE_MISSING',
  });
}

async function selectResenasRowsForSede(sedeId, offset, limit) {
  const end = offset + limit - 1;
  let r = await supabase
    .from(PUBLIC_RESENAS_TABLE)
    .select(RESENAS_SELECT_ROW)
    .eq('sede_id', sedeId)
    .order('created_at', { ascending: false })
    .range(offset, end);
  if (r.error && String(r.error.message || '').includes('nombre')) {
    r = await supabase
      .from(PUBLIC_RESENAS_TABLE)
      .select(RESENAS_SELECT_ROW_FALLBACK)
      .eq('sede_id', sedeId)
      .order('created_at', { ascending: false })
      .range(offset, end);
  }
  return r;
}

async function fetchNombreAutorResenaInsert(user) {
  const uid = user?.id;
  if (!uid) return 'Jugador';
  const email = String(user.email || '').trim().toLowerCase();
  let perfil = null;
  const q1 = await supabase.from('jugadores_perfil').select('nombre, apellido, alias, apodo').eq('user_id', uid).maybeSingle();
  if (!q1.error) perfil = q1.data;
  if (!perfil?.nombre && email) {
    const q2 = await supabase.from('jugadores_perfil').select('nombre, apellido, alias, apodo').eq('email', email).maybeSingle();
    if (!q2.error) perfil = q2.data;
  }
  const n = nombreAutorResenaDesdePerfil(perfil);
  return n && String(n).trim() ? String(n).trim() : 'Jugador';
}

/** Al menos una reserva con estado confirmada en la sede (match por nombre de sede en `reservas.sede`). */
async function jugadorTieneReservaConfirmadaEnSede(user, sedeIdNum) {
  const uid = user?.id;
  const email = String(user?.email || '').trim().toLowerCase();
  if (!uid && !email) return false;
  const sid = parseInt(String(sedeIdNum), 10);
  if (!Number.isFinite(sid)) return false;
  const { data: sedeRow, error: se } = await supabase.from('sedes').select('nombre').eq('id', sid).maybeSingle();
  if (se || !sedeRow?.nombre) return false;
  const nombreSede = String(sedeRow.nombre).trim();
  if (!nombreSede) return false;

  if (uid) {
    const { data: r1 } = await supabase
      .from('reservas')
      .select('id')
      .eq('sede', nombreSede)
      .eq('estado', 'confirmada')
      .eq('user_id', uid)
      .limit(1)
      .maybeSingle();
    if (r1?.id != null) return true;
  }
  if (email) {
    const { data: r2 } = await supabase
      .from('reservas')
      .select('id')
      .eq('sede', nombreSede)
      .eq('estado', 'confirmada')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    if (r2?.id != null) return true;
  }
  return false;
}

function nombreVisibleAutorResenaListado(perfil, nombreGuardado) {
  const g = String(nombreGuardado || '').trim();
  if (g && g.toLowerCase() !== 'jugador') return g;
  const ap = String(perfil?.apodo || '').trim();
  if (ap) return ap.charAt(0).toUpperCase() + ap.slice(1);
  const n = String(perfil?.nombre || '').trim();
  const a = String(perfil?.apellido || '').trim();
  const full = [n, a].filter(Boolean).join(' ').trim();
  if (full) return full;
  return nombreAutorResenaDesdePerfil(perfil);
}

// ─── JWT + user_roles (GET torneos/reservas con alcance, rutas /api/admin/*) ──
const LEGACY_SUPER_ADMIN_EMAILS_API = [
  'padbolinternacional@gmail.com',
  'admin@padbol.com',
  'sm@padbol.com',
  'juanpablo@padbol.com',
];

async function authUserFromBearer(req) {
  const auth = String(req.headers.authorization || '');
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) return null;
  return data.user;
}

async function fetchUserRoleRow(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return null;
  let q = await supabase
    .from('user_roles')
    .select('role, alcance, sede_id, nombre, pais, provincia, ciudad')
    .eq('email', em)
    .maybeSingle();
  if (q.error && /colum|column/i.test(String(q.error.message || ''))) {
    q = await supabase
      .from('user_roles')
      .select('role, sede_id, nombre, pais')
      .eq('email', em)
      .maybeSingle();
  }
  if (q.error) return null;
  return q.data;
}

function isSuperAdminApi(userEmail, role) {
  const em = String(userEmail || '').trim().toLowerCase();
  if (LEGACY_SUPER_ADMIN_EMAILS_API.includes(em)) return true;
  return role === 'super_admin';
}

const checkSuscripcionActiva = createCheckSuscripcionActiva({
  supabase,
  authUserFromBearer,
  fetchUserRoleRow,
  isSuperAdminApi,
});

/** Alineado con el front (user_role_data): quita bandera emoji al comparar país. */
function normalizeAdminPaisLabel(raw) {
  if (raw == null || raw === '') return '';
  return String(raw).replace(/^[\p{Emoji_Presentation}\s]*/u, '').trim();
}

function normalizeMetodoPago(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'stripe') return 'stripe';
  if (v === 'manual') return 'manual';
  if (v === 'efectivo') return 'efectivo';
  return 'mercadopago';
}

async function sedePaymentConfigBySedeId(sedeId) {
  const sid = Number(sedeId);
  if (!Number.isFinite(sid)) return null;
  const { data, error } = await supabase
    .from('sedes')
    .select('id, nombre, metodo_pago, stripe_account_id, mp_access_token, pago_manual_instrucciones')
    .eq('id', sid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    metodo_pago: normalizeMetodoPago(data.metodo_pago),
  };
}

async function sedePaymentConfigByNombre(sedeNombre) {
  const n = String(sedeNombre || '').trim();
  if (!n) return null;
  const { data, error } = await supabase
    .from('sedes')
    .select('id, nombre, metodo_pago, stripe_account_id, mp_access_token, pago_manual_instrucciones')
    .eq('nombre', n)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    metodo_pago: normalizeMetodoPago(data.metodo_pago),
  };
}

function normalizeGeoText(raw) {
  return String(raw || '')
    .replace(/^[\p{Emoji_Presentation}\s]*/u, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function resolveAlcanceFromRoleRow(row) {
  const raw = String(row?.alcance || '').trim().toLowerCase();
  if (['sede', 'ciudad', 'provincia', 'pais', 'global'].includes(raw)) return raw;
  const role = String(row?.role || '').trim().toLowerCase();
  if (role === 'super_admin') return 'global';
  if (role === 'admin_nacional') return 'pais';
  if (role === 'admin_club') return 'sede';
  if (role === 'empleado') return 'sede';
  return null;
}

async function sedesPermitidasPorScope(scope) {
  if (!scope) return { mode: 'none', sedes: [] };
  if (scope.superA || scope.alcance === 'global') {
    const { data, error } = await supabase.from('sedes').select('*');
    if (error) throw error;
    return { mode: 'global', sedes: data || [] };
  }
  const alcance = scope.alcance || 'sede';
  if (alcance === 'sede' && scope.sedeId != null) {
    const { data, error } = await supabase.from('sedes').select('*').eq('id', scope.sedeId);
    if (error) throw error;
    return { mode: 'sede', sedes: data || [] };
  }
  const { data: allSedes, error } = await supabase.from('sedes').select('*');
  if (error) throw error;
  const rows = allSedes || [];
  if (alcance === 'ciudad' && scope.ciudadNorm) {
    return {
      mode: 'ciudad',
      sedes: rows.filter((s) => normalizeGeoText(s.ciudad) === scope.ciudadNorm),
    };
  }
  if (alcance === 'provincia' && scope.provinciaNorm) {
    return {
      mode: 'provincia',
      sedes: rows.filter((s) => normalizeGeoText(s.provincia) === scope.provinciaNorm),
    };
  }
  if (alcance === 'pais' && scope.paisNorm) {
    return {
      mode: 'pais',
      sedes: rows.filter((s) => normalizeGeoText(s.pais) === scope.paisNorm),
    };
  }
  return { mode: alcance, sedes: [] };
}

/**
 * JWT (Authorization Bearer) + fila `user_roles` en Supabase.
 * Sin Bearer válido → null (listados sin filtro de rol, compat. anónima).
 */
async function adminListScopeFromRequest(req) {
  const user = await authUserFromBearer(req);
  if (!user?.email) return null;
  const email = String(user.email).trim().toLowerCase();
  const row = await fetchUserRoleRow(user.email);
  const rol = row?.role || null;
  const alcance = resolveAlcanceFromRoleRow(row);
  const sedeIdRaw = row?.sede_id;
  const sedeId = sedeIdRaw != null && sedeIdRaw !== '' ? Number(sedeIdRaw) : null;
  const ciudadNorm = normalizeGeoText(row?.ciudad || '');
  const provinciaNorm = normalizeGeoText(row?.provincia || '');
  const paisNorm = normalizeGeoText(row?.pais || '');
  return {
    email,
    rol,
    alcance,
    sedeId: Number.isFinite(sedeId) ? sedeId : null,
    pais: row?.pais || null,
    ciudad: row?.ciudad || null,
    provincia: row?.provincia || null,
    ciudadNorm,
    provinciaNorm,
    paisNorm,
    superA: isSuperAdminApi(email, rol),
    row,
    authUserId: user.id ?? null,
  };
}

/** Admin (JWT): super_admin o alcance que incluya la sede (mismo criterio que listados). */
async function assertUsuarioPuedeAdministrarSede(req, sedeIdNum) {
  const scope = await adminListScopeFromRequest(req);
  if (!scope) {
    const e = new Error('No autorizado');
    e.status = 401;
    throw e;
  }
  if (scope.superA) return scope;
  const sid = Number(sedeIdNum);
  if (!Number.isFinite(sid)) {
    const e = new Error('ID de sede inválido');
    e.status = 400;
    throw e;
  }
  const allowed = await sedesPermitidasPorScope(scope);
  const ok = (allowed.sedes || []).some((s) => Number(s.id) === sid);
  if (!ok) {
    const e = new Error('No tienes permiso para esta sede');
    e.status = 403;
    throw e;
  }
  return scope;
}

function normalizeEstadoCancha(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'inactiva' || s === 'inactive' || s === 'false') return 'inactiva';
  return 'activa';
}

function canchasConNumeroReserva(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => Number(a.id) - Number(b.id));
  return list.map((c, i) => {
    const o = c.orden != null && c.orden !== '' ? Number(c.orden) : NaN;
    const numero_reserva = Number.isFinite(o) && o > 0 ? o : i + 1;
    return { ...c, numero_reserva };
  });
}

async function fetchCanchasRowsForSede(sedeId) {
  const sid = Number(sedeId);
  if (!Number.isFinite(sid)) return [];
  const { data, error } = await supabase
    .from('canchas')
    .select('*')
    .eq('sede_id', sid)
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function numerosCanchaActivasParaReservaPorSedeId(sedeId) {
  const rows = await fetchCanchasRowsForSede(sedeId);
  if (!rows.length) return null;
  const enriched = canchasConNumeroReserva(rows);
  return enriched
    .filter((c) => normalizeEstadoCancha(c.estado) === 'activa')
    .map((c) => c.numero_reserva)
    .sort((a, b) => a - b);
}

async function assertCanchaPermitidaParaReservaPorNombreSede(sedeNombre, canchaNum) {
  const nombre = String(sedeNombre || '').trim();
  const n = parseInt(String(canchaNum), 10);
  if (!nombre || !Number.isFinite(n)) {
    const e = new Error('Datos de cancha inválidos');
    e.status = 400;
    throw e;
  }
  const { data: sedeRow, error } = await supabase
    .from('sedes')
    .select('id, cantidad_canchas')
    .eq('nombre', nombre)
    .maybeSingle();
  if (error) throw error;
  if (!sedeRow) {
    const e = new Error('Sede no encontrada');
    e.status = 404;
    throw e;
  }
  const sid = Number(sedeRow.id);
  const activas = await numerosCanchaActivasParaReservaPorSedeId(sid);
  if (activas == null) {
    const max = Math.max(1, Number(sedeRow.cantidad_canchas) || 2);
    if (n < 1 || n > max) {
      const e = new Error('Número de cancha no disponible en esta sede');
      e.status = 400;
      throw e;
    }
    return;
  }
  if (!activas.includes(n)) {
    const e = new Error('Esta cancha no está disponible para reservas');
    e.status = 400;
    throw e;
  }
}

function sedeResponseConCanchasActivas(sedeRow, canchasRows) {
  if (!sedeRow || !canchasRows?.length) return sedeRow;
  const enriched = canchasConNumeroReserva(canchasRows);
  const activas = enriched.filter((c) => normalizeEstadoCancha(c.estado) === 'activa');
  return {
    ...sedeRow,
    canchas_activas: activas
      .map((c) => ({
        numero: c.numero_reserva,
        nombre: String(c.nombre || `Cancha ${c.numero_reserva}`).trim(),
        deporte: c.deporte != null && String(c.deporte).trim() !== '' ? String(c.deporte).trim() : null,
        tipo: c.tipo != null && String(c.tipo).trim() !== '' ? String(c.tipo).trim() : null,
      }))
      .sort((a, b) => a.numero - b.numero),
  };
}

function enrichSingleCanchaAdminDto(row, allRowsSameSede) {
  const enriched = canchasConNumeroReserva(allRowsSameSede);
  const hit = enriched.find((c) => Number(c.id) === Number(row.id));
  return {
    id: row.id,
    sede_id: row.sede_id,
    nombre: String(row.nombre || '').trim(),
    estado: normalizeEstadoCancha(row.estado),
    descripcion: row.descripcion != null && String(row.descripcion).trim() !== '' ? String(row.descripcion).trim() : null,
    orden: hit ? hit.numero_reserva : null,
  };
}

function paisAdminCoincideSedeSorteo(paisAdminRaw, paisSedeRaw) {
  const strip = (p) =>
    String(p || '')
      .replace(/^[\p{Emoji_Presentation}\s]+/u, '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const a = strip(paisAdminRaw);
  const b = strip(paisSedeRaw);
  if (!a || !b) return false;
  return b.includes(a) || a.includes(b);
}

/** JWT + rol: puede definir sorteo de grupos en un torneo (misma idea que el front). */
async function assertUsuarioPuedeSortearTorneo(req, torneo) {
  const user = await authUserFromBearer(req);
  if (!user?.email) {
    const e = new Error('Se requiere sesión');
    e.status = 401;
    throw e;
  }
  const email = String(user.email).trim().toLowerCase();
  const row = await fetchUserRoleRow(user.email);
  const rol = row?.role || null;
  if (isSuperAdminApi(email, rol)) return;

  const tsede = torneo?.sede_id != null && torneo.sede_id !== '' ? Number(torneo.sede_id) : null;
  if (tsede != null) {
    const scope = {
      rol,
      alcance: resolveAlcanceFromRoleRow(row),
      sedeId: row?.sede_id != null && row.sede_id !== '' ? Number(row.sede_id) : null,
      paisNorm: normalizeGeoText(row?.pais || ''),
      provinciaNorm: normalizeGeoText(row?.provincia || ''),
      ciudadNorm: normalizeGeoText(row?.ciudad || ''),
      superA: false,
    };
    const allowed = await sedesPermitidasPorScope(scope);
    const ids = new Set((allowed.sedes || []).map((s) => Number(s.id)).filter((id) => Number.isFinite(id)));
    if (ids.has(tsede)) return;
  }

  const e = new Error('No autorizado para sortear grupos en este torneo');
  e.status = 403;
  throw e;
}

/** Partidos round-robin por grupo con letra A, B, … */
function partidosDesdeGruposSorteo(gruposIds, torneoId, sedeId) {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const tid = parseInt(String(torneoId), 10);
  const sid = sedeId != null && sedeId !== '' ? sedeId : null;
  const out = [];
  gruposIds.forEach((arrRaw, gIdx) => {
    const letra = letras[gIdx] || `G${gIdx + 1}`;
    const ids = arrRaw.map((id) => parseInt(String(id), 10)).filter((n) => Number.isFinite(n));
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        out.push({
          torneo_id: tid,
          equipo_a_id: ids[i],
          equipo_b_id: ids[j],
          sede_id: sid,
          estado: 'pendiente',
          ronda: 1,
          grupo: letra,
        });
      }
    }
  });
  return out;
}

// Mercado Pago: cada sede usa su propio `mp_access_token` en DB (panel Mi sede).
// `MP_ACCESS_TOKEN` en entorno solo se usa como respaldo al consultar webhooks / pagos legacy.
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn('⚠️  MP_ACCESS_TOKEN global no definido — webhooks MP pueden no resolver pagos antiguos');
}

// Frontend URL for MP redirect callbacks
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://padbol-match.netlify.app';
if (!process.env.FRONTEND_URL) {
  console.warn(`⚠️  FRONTEND_URL no está configurado — usando fallback: ${FRONTEND_URL}`);
}

const STRIPE_SECRET_KEY = String(process.env.STRIPE_SECRET_KEY || '').trim();
const stripeClient = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
if (!STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY no está configurado — pagos Stripe / Connect no funcionarán');
}

const ANTHROPIC_API_KEY = String(process.env.ANTHROPIC_API_KEY || '').trim();
if (!ANTHROPIC_API_KEY) {
  console.warn(
    '⚠️  ANTHROPIC_API_KEY no definido — POST /api/chat-ia no funcionará. Clave en https://console.anthropic.com'
  );
}

function getStripeOrThrow() {
  if (!stripeClient) {
    const e = new Error('Stripe no está configurado en el servidor');
    e.status = 503;
    throw e;
  }
  return stripeClient;
}

/**
 * Asegura Product + Price mensual para Billing. Orden: env → archivo cache → buscar en Stripe → crear.
 * Persiste en `.stripe-subscription-price-id`, intenta añadir a `.env` en cwd, o crea `.env.stripe-subscription`.
 */
async function ensureStripeSubscriptionPriceId() {
  const fromEnv = String(process.env.STRIPE_SUBSCRIPTION_PRICE_ID || '').trim();
  if (fromEnv.startsWith('price_')) return fromEnv;

  const cacheFile = path.join(__dirname, '.stripe-subscription-price-id');
  try {
    const cached = fs.readFileSync(cacheFile, 'utf8').trim();
    if (cached.startsWith('price_')) {
      process.env.STRIPE_SUBSCRIPTION_PRICE_ID = cached;
      return cached;
    }
  } catch {
    /* sin cache */
  }

  if (!stripeClient) {
    console.warn(
      '⚠️ STRIPE_SUBSCRIPTION_PRICE_ID no definido y sin STRIPE_SECRET_KEY: no se puede crear el precio de suscripción'
    );
    return null;
  }

  const listed = await stripeClient.products.list({ limit: 100, active: true });
  const existingProd = (listed.data || []).find((p) => p.metadata?.padbol_match_subscription === '1');
  let productId = existingProd?.id;
  if (!productId) {
    const p = await stripeClient.products.create({
      name: 'Suscripción Padbol Match',
      metadata: { padbol_match_subscription: '1' },
    });
    productId = p.id;
    console.log(`✓ Stripe Product «Suscripción Padbol Match»: ${productId}`);
  }

  const priceList = await stripeClient.prices.list({ product: productId, active: true, limit: 30 });
  const monthly = (priceList.data || []).find(
    (pr) => pr.type === 'recurring' && pr.recurring?.interval === 'month'
  );
  let priceId = monthly?.id;
  if (!priceId) {
    const unitAmount = parseInt(String(process.env.STRIPE_SUBSCRIPTION_UNIT_AMOUNT || '1000'), 10);
    const currency = String(process.env.STRIPE_SUBSCRIPTION_CURRENCY || 'usd').toLowerCase();
    const pr = await stripeClient.prices.create({
      product: productId,
      unit_amount: Number.isFinite(unitAmount) && unitAmount > 0 ? unitAmount : 1000,
      currency,
      recurring: { interval: 'month' },
    });
    priceId = pr.id;
    console.log(
      `✓ Stripe Price recurrente mensual: ${priceId} (${Number.isFinite(unitAmount) && unitAmount > 0 ? unitAmount : 1000} ${currency})`
    );
  }

  process.env.STRIPE_SUBSCRIPTION_PRICE_ID = priceId;
  try {
    fs.writeFileSync(cacheFile, `${priceId}\n`, 'utf8');
  } catch (e) {
    console.warn('⚠️ No se pudo escribir .stripe-subscription-price-id:', e?.message || e);
  }

  const envPath = path.join(process.cwd(), '.env');
  try {
    if (fs.existsSync(envPath)) {
      let raw = fs.readFileSync(envPath, 'utf8');
      if (!/^\s*STRIPE_SUBSCRIPTION_PRICE_ID\s*=/m.test(raw)) {
        raw = `${raw.replace(/\s*$/, '')}\nSTRIPE_SUBSCRIPTION_PRICE_ID=${priceId}\n`;
        fs.writeFileSync(envPath, raw, 'utf8');
        console.log(`✓ STRIPE_SUBSCRIPTION_PRICE_ID añadido a .env`);
      }
    } else {
      const stub = path.join(__dirname, '.env.stripe-subscription');
      fs.writeFileSync(stub, `STRIPE_SUBSCRIPTION_PRICE_ID=${priceId}\n`, 'utf8');
      console.log(`✓ Creado ${stub} — copia STRIPE_SUBSCRIPTION_PRICE_ID al entorno de producción`);
    }
  } catch (e) {
    console.warn('⚠️ No se pudo actualizar .env:', e?.message || e);
  }

  return priceId;
}

function getStripeSubscriptionPriceIdOrThrow() {
  const id = String(process.env.STRIPE_SUBSCRIPTION_PRICE_ID || '').trim();
  if (!id.startsWith('price_')) {
    const e = new Error(
      'Precio de suscripción no disponible. Configura STRIPE_SUBSCRIPTION_PRICE_ID o reinicia el servidor tras crear el Product/Price.'
    );
    e.status = 503;
    throw e;
  }
  return id;
}

async function fetchAdminClubEmailForSede(sedeIdNum) {
  const sid = Number(sedeIdNum);
  const { data: row, error } = await supabase
    .from('user_roles')
    .select('email')
    .eq('role', 'admin_club')
    .eq('sede_id', sid)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const em = row?.email != null ? String(row.email).trim().toLowerCase() : '';
  return em || null;
}

async function resolveSedeIdFromStripeContext({ subscriptionId, customerId }) {
  const sidMeta = async (subId) => {
    if (!subId) return null;
    try {
      const st = getStripeOrThrow();
      const sub = await st.subscriptions.retrieve(String(subId));
      const raw = sub?.metadata?.sede_id;
      const n = parseInt(String(raw), 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  };

  if (subscriptionId) {
    const fromSub = await sidMeta(subscriptionId);
    if (fromSub) return fromSub;
  }
  const cust = String(customerId || '').trim();
  if (cust.startsWith('cus_')) {
    const { data, error } = await supabase.from('sedes').select('id').eq('stripe_customer_id', cust).limit(1).maybeSingle();
    if (!error && data?.id != null) return Number(data.id);
  }
  return null;
}

async function sendSuscripcionPagoFallidoWhatsApp({ sedeNombre, sedeId }) {
  const to = resolveSuperAdminNotifyWhatsAppTo();
  if (!to || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('⚠️ Suscripción: no se pudo avisar por WhatsApp (Twilio o SUPER_ADMIN_NOTIFY_WHATSAPP)');
    return;
  }
  const body =
    `⚠️ Suscripción Padbol Match: pago fallido\n` +
    `Sede: ${String(sedeNombre || '').trim() || '—'} (id ${sedeId})\n` +
    `Revisa Stripe y el panel de sedes.`;
  await twilioClient.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body });
  console.log(`✓ WhatsApp super_admin: pago suscripción fallido (sede ${sedeId})`);
}

// Twilio (desde .env)
const TWILIO_ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/** URL base del front para el link de inscripción al torneo (debe coincidir con el dominio público de la app). */
const TORNEO_EQUIPOS_INVITE_BASE_URL =
  process.env.TORNEO_EQUIPOS_INVITE_BASE_URL || 'https://padbol-match-9abn.vercel.app';

/**
 * Twilio WhatsApp exige destino en E.164: `whatsapp:+[código país][número]` sin espacios ni guiones.
 * `jugadores_perfil.whatsapp` debería estar ya en E.164 (ej. +5492213032019).
 * Si llega sin +, se normaliza con heurística de país (WHATSAPP_DEFAULT_COUNTRY_CODE, default 54).
 */
function normalizePhoneToE164ForTwilioWhatsApp(raw) {
  const rawStr = String(raw || '').trim();
  if (!rawStr) return null;
  const digits = rawStr.replace(/\D/g, '');
  if (!digits) return null;
  const DEFAULT_CC = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '54').replace(/\D/g, '') || '54';

  if (rawStr.startsWith('+')) {
    return `whatsapp:+${digits}`;
  }
  if (digits.startsWith(DEFAULT_CC) && digits.length >= DEFAULT_CC.length + 8) {
    return `whatsapp:+${digits}`;
  }
  if (DEFAULT_CC === '54' && digits.length === 10) {
    return `whatsapp:+${DEFAULT_CC}9${digits}`;
  }
  return `whatsapp:+${DEFAULT_CC}${digits}`;
}

function buildTorneoEquipoInvitacionBody(nombreDestinatario, nombreTorneo, torneoId, equipoId) {
  const nombre = String(nombreDestinatario || '').trim() || 'jugador';
  const torneoNombre = String(nombreTorneo || '').trim() || 'el torneo';
  const tid = Number(torneoId);
  const slugTid = Number.isFinite(tid) ? tid : String(torneoId);
  const eid = Number(equipoId);
  const q =
    equipoId != null && equipoId !== '' && Number.isFinite(eid) ? `?equipo=${eid}` : '';
  const link = `${TORNEO_EQUIPOS_INVITE_BASE_URL}/torneo/${slugTid}/equipos${q}`;
  return `Hola ${nombre}, te invito a jugar el torneo "${torneoNombre}". Confirma tu lugar en el equipo: ${link}`;
}

/** Invitación a equipo de torneo (Twilio WhatsApp). Requiere credenciales Twilio y teléfono normalizable. */
async function sendWhatsAppTorneoEquipoInvitacion(telefono, { nombreDestinatario, nombreTorneo, torneoId, equipoId }) {
  const to = normalizePhoneToE164ForTwilioWhatsApp(telefono);
  if (!to) {
    console.warn('⚠️ Invitación torneo: teléfono vacío o no normalizable a E.164');
    return;
  }
  const body = buildTorneoEquipoInvitacionBody(nombreDestinatario, nombreTorneo, torneoId, equipoId);
  await twilioClient.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body });
  console.log(`✓ WhatsApp invitación torneo enviado a ${to}`);
}

/** Fecha YYYY-MM-DD → texto legible en español para el mensaje de confirmación. */
function formatFechaReservaConfirmacion(fechaIso) {
  if (!fechaIso || typeof fechaIso !== 'string') return String(fechaIso || '');
  const [y, m, d] = fechaIso.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return fechaIso;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return fechaIso;
  return dt
    .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** "HH:MM" + minutos → "HH:MM" fin (misma lógica que el front en AdminDashboard). */
function computeHoraFinDesdeDuracion(horaInicio, duracionMinutos) {
  if (!horaInicio) return '';
  const dur = parseInt(duracionMinutos, 10) || 90;
  const [hh, mm] = String(horaInicio).split(':').map(Number);
  const mins = (mm || 0) + dur;
  const endH = String(hh + Math.floor(mins / 60)).padStart(2, '0');
  const endM = String(mins % 60).padStart(2, '0');
  return `${endH}:${endM}`;
}

/** Si `hora` ya viene como rango "HH:MM - HH:MM", lo respeta; si no, calcula el fin con duración. */
function horaInicioYFinParaMensaje(hora, duracionMinutos) {
  const h = String(hora || '').trim();
  if (h.includes(' - ')) {
    const parts = h.split(' - ').map((s) => s.trim());
    return { horaInicio: parts[0] || h, horaFin: parts[1] || parts[0] || h };
  }
  return {
    horaInicio: h,
    horaFin: computeHoraFinDesdeDuracion(h, duracionMinutos),
  };
}

/** Twilio / saludo: `apodo` si existe; si no, primer token de `nombre` o de `nombreFallback` (nunca nombre completo). */
function nombreWhatsappJugadorDesdePerfil(perfil, nombreFallback = '') {
  const ap = String(perfil?.apodo ?? '').trim();
  if (ap) return ap;
  const n = String(perfil?.nombre ?? '').trim();
  if (n) {
    const first = n.split(/\s+/).filter(Boolean)[0] || '';
    if (first) {
      return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }
  }
  const fb = String(nombreFallback ?? '').trim();
  if (fb) {
    const first = fb.split(/\s+/).filter(Boolean)[0] || '';
    if (first) {
      return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }
  }
  return 'jugador';
}

async function enviarTwilioWhatsappAJugadorConNumeroPerfil(rawWa, body, warnLabel) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    if (warnLabel) console.warn(`⚠️ ${warnLabel}: Twilio no configurado`);
    return;
  }
  if (!rawWa || !String(rawWa).trim()) {
    if (warnLabel) {
      console.warn(`⚠️ ${warnLabel}: sin WhatsApp en jugadores_perfil para el jugador — no se envía mensaje`);
    }
    return;
  }
  const to = normalizePhoneToE164ForTwilioWhatsApp(rawWa);
  if (!to) {
    if (warnLabel) console.warn(`⚠️ ${warnLabel}: WhatsApp no normalizable a E.164:`, rawWa);
    return;
  }
  await twilioClient.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body: String(body || '').trim() });
  console.log(`✓ WhatsApp jugador (perfil) enviado a ${to}`);
}

/**
 * Envía WhatsApp (Twilio) usando solo `whatsapp` de `jugadores_perfil` por email (misma regla que confirmación de reserva).
 * @param {{ email: string; body: string; warnSinWhatsapp?: string }} opts warnSinWhatsapp: prefijo log si no hay número
 */
async function enviarTwilioWhatsappJugadorPorEmailPerfilReserva({ email, body, warnSinWhatsapp }) {
  const emailNorm = String(email || '').trim().toLowerCase();
  if (!emailNorm) {
    if (warnSinWhatsapp) console.warn(`⚠️ ${warnSinWhatsapp}: sin email`);
    return;
  }

  const { data: perfil, error: pErr } = await supabase
    .from('jugadores_perfil')
    .select('nombre, apodo, whatsapp')
    .ilike('email', emailNorm)
    .maybeSingle();

  if (pErr) {
    console.warn(`⚠️ ${warnSinWhatsapp || 'WhatsApp jugador'}: error consultando jugadores_perfil:`, pErr.message);
    return;
  }

  await enviarTwilioWhatsappAJugadorConNumeroPerfil(perfil?.whatsapp, body, warnSinWhatsapp);
}

function horaLegibleUnPuntoReserva(horaRaw) {
  const h = String(horaRaw || '').trim();
  if (!h) return '—';
  if (h.includes(' - ')) return h.split(' - ')[0].trim() || h;
  const m = h.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return h;
  return `${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}`;
}

/** Admin pasó la reserva a cancelada (PUT o mismo aviso si DELETE por admin). */
async function sendReservaAdminCanceladaWhatsAppTwilio({ email, nombreSede, fecha, hora }) {
  const sedeTxt = String(nombreSede || '').trim() || 'la sede';
  const fechaTxt = formatFechaReservaConfirmacion(String(fecha || '').trim().slice(0, 10)) || String(fecha || '').trim() || '—';
  const horaTxt = horaLegibleUnPuntoReserva(hora);
  const body = `❌ Tu reserva en ${sedeTxt} el ${fechaTxt} a las ${horaTxt} fue cancelada por el administrador. Si tienes dudas, contacta al club.`;
  await enviarTwilioWhatsappJugadorPorEmailPerfilReserva({
    email,
    body,
    warnSinWhatsapp: 'Cancelación reserva (admin)',
  });
}

/** Admin cambió fecha u hora del turno. */
async function sendReservaAdminFechaHoraModificadaWhatsAppTwilio({ email, nombreSede, fecha, hora }) {
  const sedeTxt = String(nombreSede || '').trim() || 'la sede';
  const fechaTxt = formatFechaReservaConfirmacion(String(fecha || '').trim().slice(0, 10)) || String(fecha || '').trim() || '—';
  const horaTxt = horaLegibleUnPuntoReserva(hora);
  const body = `📝 Tu reserva en ${sedeTxt} fue modificada. Nueva fecha: ${fechaTxt} a las ${horaTxt}. Si tienes dudas, contacta al club.`;
  await enviarTwilioWhatsappJugadorPorEmailPerfilReserva({
    email,
    body,
    warnSinWhatsapp: 'Cambio fecha/hora reserva (admin)',
  });
}

/**
 * WhatsApp (Twilio) al confirmar reserva: teléfono desde `jugadores_perfil.whatsapp` por email del usuario.
 * Si no hay WhatsApp en perfil, solo loguea warning (no usa el número enviado en el body de la reserva).
 */
async function sendReservaConfirmadaWhatsAppTwilio({
  email,
  nombreFallback,
  fecha,
  hora,
  duracionMinutos,
  nombreSede,
}) {
  const emailNorm = String(email || '').trim().toLowerCase();
  if (!emailNorm) {
    console.warn('⚠️ Confirmación reserva: sin email — no se busca jugadores_perfil');
    return;
  }

  const { data: perfil, error: pErr } = await supabase
    .from('jugadores_perfil')
    .select('nombre, apodo, whatsapp')
    .ilike('email', emailNorm)
    .maybeSingle();

  if (pErr) {
    console.warn('⚠️ Confirmación reserva: error consultando jugadores_perfil:', pErr.message);
    return;
  }

  const nombre = nombreWhatsappJugadorDesdePerfil(perfil, nombreFallback);
  const { horaInicio, horaFin } = horaInicioYFinParaMensaje(hora, duracionMinutos);
  const fechaTxt = formatFechaReservaConfirmacion(fecha);
  const sedeTxt = String(nombreSede || '').trim() || 'la sede';
  const body = `¡Hola ${nombre}! ✅ Tu reserva está confirmada. Te esperamos el ${fechaTxt} en horario ${horaInicio} - ${horaFin} en ${sedeTxt}. ⚽ ¡Nos vemos en la cancha!`;

  await enviarTwilioWhatsappAJugadorConNumeroPerfil(perfil?.whatsapp, body, 'Confirmación reserva');
}

async function resolveNotificacionUserId({ userId = null, email = '' } = {}) {
  const uid = String(userId || '').trim();
  if (uid) return uid;
  const em = String(email || '').trim().toLowerCase();
  if (!em) return null;
  const { data, error } = await supabase
    .from('jugadores_perfil')
    .select('user_id')
    .ilike('email', em)
    .maybeSingle();
  if (error) {
    console.warn('⚠️ Notificación: no se pudo resolver user_id:', error.message);
    return null;
  }
  return data?.user_id ? String(data.user_id) : null;
}

async function crearNotificacionJugador({ userId = null, email = '', tipo, titulo, mensaje, link = null }) {
  try {
    const uid = await resolveNotificacionUserId({ userId, email });
    if (!uid) {
      console.warn('⚠️ Notificación omitida: sin user_id destinatario', { tipo, email });
      return null;
    }
    const row = {
      user_id: uid,
      tipo: String(tipo || 'general').trim() || 'general',
      titulo: String(titulo || '').trim().slice(0, 160),
      mensaje: String(mensaje || '').trim().slice(0, 800),
      link: String(link || '').trim() || null,
      leida: false,
    };
    if (!row.titulo || !row.mensaje) return null;
    const { data, error } = await supabase.from('notificaciones').insert([row]).select('*').single();
    if (error) {
      console.warn('⚠️ Notificación: error insertando:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('⚠️ Notificación: error inesperado:', err.message);
    return null;
  }
}

async function crearNotificacionReservaConfirmada({ userId = null, email = '', sede, fecha, hora }) {
  const fechaTxt = formatFechaReservaConfirmacion(String(fecha || '').slice(0, 10));
  return crearNotificacionJugador({
    userId,
    email,
    tipo: 'reserva_confirmada',
    titulo: 'Reserva confirmada',
    mensaje: `Tu reserva en ${String(sede || 'la sede').trim()} quedó confirmada para ${fechaTxt} a las ${horaLegibleUnPuntoReserva(hora)}.`,
    link: '/mi-perfil?tab=reservas',
  });
}

async function getDestinatariosEquipoNotificaciones(equipoRow) {
  const out = new Map();
  const add = (userId, email) => {
    const uid = String(userId || '').trim();
    const em = String(email || '').trim().toLowerCase();
    const key = uid || em;
    if (!key) return;
    out.set(key, { userId: uid || null, email: em });
  };
  add(equipoRow?.creador_id, equipoRow?.creador_email);
  for (const j of Array.isArray(equipoRow?.jugadores) ? equipoRow.jugadores : []) {
    add(j?.id || j?.user_id, j?.email);
  }
  return [...out.values()];
}

async function crearNotificacionesEquipoTorneo(equipoRow, { tipo, titulo, mensaje, link }) {
  const destinatarios = await getDestinatariosEquipoNotificaciones(equipoRow);
  await Promise.all(destinatarios.map((d) => crearNotificacionJugador({ ...d, tipo, titulo, mensaje, link })));
}

app.get('/api/notificaciones', async (req, res) => {
  try {
    const authUser = await authUserFromBearer(req);
    if (!authUser?.id) return res.status(401).json({ error: 'No autorizado' });
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('❌ GET /api/notificaciones:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.patch('/api/notificaciones/leer', async (req, res) => {
  try {
    const authUser = await authUserFromBearer(req);
    if (!authUser?.id) return res.status(401).json({ error: 'No autorizado' });
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id) => parseInt(String(id), 10)).filter((id) => Number.isFinite(id) && id > 0)
      : [];
    if (!ids.length) {
      return res.json({ ok: true, skipped: true });
    }
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('user_id', authUser.id)
      .eq('leida', false)
      .in('id', ids);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ PATCH /api/notificaciones/leer:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

const PADBOL_SEDE_CRITICO_NOTIFY_SECRET = process.env.PADBOL_SEDE_CRITICO_NOTIFY_SECRET;

function resolveSuperAdminNotifyWhatsAppTo() {
  const raw = String(process.env.SUPER_ADMIN_NOTIFY_WHATSAPP || '').trim();
  if (!raw) return null;
  if (raw.toLowerCase().startsWith('whatsapp:')) return raw;
  return normalizePhoneToE164ForTwilioWhatsApp(raw);
}

/** Aviso a super admin (Twilio) por cambios críticos en una sede (ubicación, nombre, licencia, etc.). */
async function sendSedeCambioCriticoWhatsAppTwilio({ sedeNombre, actorEmail, cambios }) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('⚠️ Notificación sede crítica: Twilio no configurado');
    return;
  }
  const to = resolveSuperAdminNotifyWhatsAppTo();
  if (!to) {
    console.warn('⚠️ Notificación sede crítica: defina SUPER_ADMIN_NOTIFY_WHATSAPP en .env (E.164 o whatsapp:+...)');
    return;
  }
  const when = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const nm = String(sedeNombre || '(sin nombre)').trim();
  const actor = String(actorEmail || '').trim() || '—';
  for (const c of cambios) {
    const campo = String(c.campo || 'campo').trim();
    const anterior = c.anterior == null || c.anterior === '' ? '—' : String(c.anterior);
    const nuevo = c.nuevo == null || c.nuevo === '' ? '—' : String(c.nuevo);
    const body =
      `⚠️ Cambio en sede ${nm}: Se modificó ${campo}\n` +
      `Por: ${actor}\n` +
      `Fecha: ${when}\n` +
      `Valor anterior: ${anterior} → Nuevo valor: ${nuevo}`;
    await twilioClient.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body });
    console.log(`✓ WhatsApp notificación sede crítica (${campo}) → ${to}`);
  }
}

app.post('/api/notify/sede-cambio-critico', async (req, res) => {
  try {
    if (!PADBOL_SEDE_CRITICO_NOTIFY_SECRET) {
      return res.status(503).json({ error: 'Notificaciones sede no configuradas' });
    }
    const { secret, sedeNombre, actorEmail, cambios } = req.body || {};
    if (secret !== PADBOL_SEDE_CRITICO_NOTIFY_SECRET) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (!Array.isArray(cambios) || cambios.length === 0) {
      return res.status(400).json({ error: 'Sin cambios' });
    }
    await sendSedeCambioCriticoWhatsAppTwilio({ sedeNombre, actorEmail, cambios });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /api/notify/sede-cambio-critico:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET sedes
app.get('/api/sedes', async (req, res) => {
  try {
    console.log('📡 GET /api/sedes - Conectando a Supabase...');
    const { data, error } = await supabase
      .from('sedes')
      .select('*');
    
    console.log('📊 Respuesta Supabase:', { data, error });
    
    if (error) {
      console.error('❌ Error Supabase:', error);
      throw error;
    }
    
    console.log('SEDES RESPONSE:', data);
    res.json(data || []);
  } catch (err) {
    console.error('❌ Error GET /api/sedes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function parseLatLngFromMapsUrl(rawUrl) {
  const src = String(rawUrl || '').trim();
  if (!src) return { latitud: null, longitud: null };
  const directMatch = src.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (directMatch) {
    return { latitud: Number(directMatch[1]), longitud: Number(directMatch[2]) };
  }
  try {
    const u = new URL(src);
    const q = u.searchParams.get('q') || u.searchParams.get('ll') || '';
    const qm = q.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (qm) return { latitud: Number(qm[1]), longitud: Number(qm[2]) };
    const at = src.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at) return { latitud: Number(at[1]), longitud: Number(at[2]) };
  } catch {
    /* ignore malformed URLs */
  }
  return { latitud: null, longitud: null };
}

/** GET /api/sedes/todas — super_admin: devuelve todas las sedes con campos completos. */
app.get('/api/sedes/todas', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.email) return res.status(401).json({ error: 'No autorizado' });
    const rowRole = await fetchUserRoleRow(user.email);
    const role = rowRole?.role || null;
    if (!isSuperAdminApi(user.email, role)) {
      return res.status(403).json({ error: 'Solo super admin' });
    }
    const { data, error } = await supabase.from('sedes').select('*').order('id', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('❌ GET /api/sedes/todas:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** Planes de precio por tramo de canchas (tabla plan_pricing). */
async function fetchPlanesPricingActivos(client = supabase) {
  const { data, error } = await client
    .from('plan_pricing')
    .select('*')
    .eq('activo', true)
    .order('canchas_min', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Devuelve el plan activo y precio USD para una cantidad de canchas, o null.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {number} cantidad
 */
async function getPlanParaCanchas(client, cantidad) {
  const n = Math.max(0, Math.floor(Number(cantidad) || 0));
  const list = await fetchPlanesPricingActivos(client);
  for (const p of list) {
    const min = Number(p.canchas_min);
    const maxRaw = p.canchas_max;
    const max = maxRaw == null || maxRaw === '' ? null : Number(maxRaw);
    if (!Number.isFinite(min) || min < 0) continue;
    if (n < min) continue;
    if (max != null && Number.isFinite(max) && n > max) continue;
    return { plan: p, precio_usd: Number(p.precio_usd) };
  }
  return null;
}

/** GET /api/plan-pricing — planes activos ordenados por canchas_min. */
app.get('/api/plan-pricing', async (req, res) => {
  try {
    const rows = await fetchPlanesPricingActivos();
    res.json(rows);
  } catch (err) {
    console.error('❌ GET /api/plan-pricing:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/plan-pricing/:id — super_admin: actualiza precio_usd. */
app.patch('/api/plan-pricing/:id', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.email) return res.status(401).json({ error: 'No autorizado' });
    const rowRole = await fetchUserRoleRow(user.email);
    if (!isSuperAdminApi(user.email, rowRole?.role)) {
      return res.status(403).json({ error: 'Solo super admin' });
    }
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    const raw = req.body?.precio_usd;
    const precio = raw != null && raw !== '' ? Number(String(raw).replace(',', '.')) : NaN;
    if (!Number.isFinite(precio) || precio < 0) {
      return res.status(400).json({ error: 'precio_usd inválido' });
    }
    const rounded = Math.round(precio * 100) / 100;
    const { data, error } = await supabase
      .from('plan_pricing')
      .update({ precio_usd: rounded })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json({ plan: data });
  } catch (err) {
    console.error('❌ PATCH /api/plan-pricing/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/sedes — super_admin: crea una sede manualmente para gestión. */
app.post('/api/sedes', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.email) return res.status(401).json({ error: 'No autorizado' });
    const rowRole = await fetchUserRoleRow(user.email);
    const role = rowRole?.role || null;
    if (!isSuperAdminApi(user.email, role)) {
      return res.status(403).json({ error: 'Solo super admin' });
    }

    const b = req.body || {};
    const nombre = String(b.nombre || '').trim();
    const ciudad = String(b.ciudad || '').trim();
    const pais = String(b.pais || '').trim();
    if (!nombre) return res.status(400).json({ error: 'Nombre de la sede obligatorio' });
    if (!ciudad) return res.status(400).json({ error: 'Ciudad obligatoria' });
    if (!pais) return res.status(400).json({ error: 'País obligatorio' });

    const latitudBody = b.latitud != null && String(b.latitud).trim() !== '' ? Number(b.latitud) : null;
    const longitudBody = b.longitud != null && String(b.longitud).trim() !== '' ? Number(b.longitud) : null;
    const mapsParsed = parseLatLngFromMapsUrl(b.google_maps_url || b.maps_url || b.googleMapsUrl || '');
    const latitud = Number.isFinite(latitudBody) ? latitudBody : mapsParsed.latitud;
    const longitud = Number.isFinite(longitudBody) ? longitudBody : mapsParsed.longitud;

    const precioTurno = b.precio_turno != null && b.precio_turno !== '' ? Number(b.precio_turno) : null;
    const canchasActivas = b.canchas_activas != null && b.canchas_activas !== '' ? parseInt(String(b.canchas_activas), 10) : null;
    const cantidadCanchasTotal =
      b.cantidad_canchas != null && String(b.cantidad_canchas).trim() !== ''
        ? parseInt(String(b.cantidad_canchas), 10)
        : null;
    const skipAutogenCanchas = Boolean(b.skip_autogen_canchas);
    const emailContacto = String(b.email_contacto || '').trim();
    const telefonoBody = String(b.telefono || b.whatsapp || '').trim();
    if (!emailContacto) return res.status(400).json({ error: 'Email de contacto obligatorio' });
    if (!telefonoBody) return res.status(400).json({ error: 'Teléfono / WhatsApp obligatorio' });

    const timezoneSede = normalizeSedeTimezone(
      b.timezone != null && String(b.timezone).trim()
        ? String(b.timezone).trim()
        : inferTimezoneFromCiudadPais(ciudad, pais),
    );

    const payload = {
      nombre,
      pais,
      provincia: String(b.provincia || b.estado || '').trim() || null,
      ciudad,
      timezone: timezoneSede,
      direccion: String(b.direccion || '').trim() || null,
      email_contacto: emailContacto,
      telefono: telefonoBody,
      horario_apertura: String(b.horario_apertura || '').trim() || null,
      horario_cierre: String(b.horario_cierre || '').trim() || null,
      precio_turno: Number.isFinite(precioTurno) ? precioTurno : null,
      moneda: String(b.moneda || 'ARS').trim().toUpperCase() || 'ARS',
      metodo_pago: normalizeMetodoPago(b.metodo_pago || 'mercadopago'),
      stripe_account_id: String(b.stripe_account_id || '').trim() || null,
      mp_access_token: String(b.mp_access_token || '').trim() || null,
      pago_manual_instrucciones: String(b.pago_manual_instrucciones || '').trim() || null,
      latitud: Number.isFinite(latitud) ? latitud : null,
      longitud: Number.isFinite(longitud) ? longitud : null,
      google_maps_url: String(b.google_maps_url || b.maps_url || '').trim() || null,
    };
    if (Number.isFinite(cantidadCanchasTotal) && cantidadCanchasTotal >= 0) {
      payload.cantidad_canchas = cantidadCanchasTotal;
    }

    const { data: created, error } = await supabase.from('sedes').insert(payload).select('*').single();
    if (error) throw error;

    if (!skipAutogenCanchas && Number.isFinite(canchasActivas) && canchasActivas > 0) {
      const rows = Array.from({ length: canchasActivas }, (_, idx) => ({
        sede_id: created.id,
        nombre: `Cancha ${idx + 1}`,
        estado: 'activa',
      }));
      const { error: canErr } = await supabase.from('canchas').insert(rows);
      if (canErr) {
        console.warn(`⚠️ POST /api/sedes: sede creada (${created.id}) pero canchas no insertadas:`, canErr.message);
      }
    }

    const deportesBody = Array.isArray(b.deportes)
      ? b.deportes
      : Array.isArray(b.deportes_canchas?.deportes)
        ? b.deportes_canchas.deportes
        : null;
    void sendMakeEvent('sede_creada', {
      nombre_sede: String(created?.nombre || nombre || '').trim() || null,
      pais: String(created?.pais || pais || '').trim() || null,
      ciudad: String(created?.ciudad || ciudad || '').trim() || null,
      email_contacto: String(created?.email_contacto || emailContacto || '').trim().toLowerCase() || null,
      deportes: deportesBody,
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('❌ POST /api/sedes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const DEPORTES_SEDE_VALID = new Set(['padbol', 'padel', 'pickleball', 'squash', 'tenis', 'futbol_5', 'futbol_7']);

/** GET /api/sedes/:id/deportes — filas canchas_por_deporte (JWT admin de la sede o super_admin). */
app.get('/api/sedes/:id/deportes', async (req, res) => {
  try {
    const sedeId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(sedeId)) return res.status(400).json({ error: 'ID de sede inválido' });
    await assertUsuarioPuedeAdministrarSede(req, sedeId);
    const { data, error } = await supabase
      .from('canchas_por_deporte')
      .select('id, sede_id, deporte, cantidad, activo, created_at')
      .eq('sede_id', sedeId)
      .order('deporte', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
    console.error('❌ GET /api/sedes/:id/deportes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sedes/:id/deportes — reemplaza deportes/cantidades (JWT admin de la sede o super_admin).
 * Body: { deportes: [{ deporte: 'padbol', cantidad: 2 }, ...] }
 */
app.post('/api/sedes/:id/deportes', async (req, res) => {
  try {
    const sedeId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(sedeId)) return res.status(400).json({ error: 'ID de sede inválido' });
    await assertUsuarioPuedeAdministrarSede(req, sedeId);
    const arr = Array.isArray(req.body?.deportes) ? req.body.deportes : null;
    if (!arr || arr.length === 0) {
      return res.status(400).json({ error: 'deportes debe ser un array no vacío' });
    }
    const rows = [];
    for (const raw of arr) {
      const dep = String(raw?.deporte || '').trim().toLowerCase();
      const n = parseInt(String(raw?.cantidad ?? ''), 10);
      if (!DEPORTES_SEDE_VALID.has(dep)) {
        return res.status(400).json({ error: `Deporte no permitido: ${dep || '(vacío)'}` });
      }
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ error: `Cantidad inválida para ${dep}` });
      }
      if (n === 0) continue;
      rows.push({ sede_id: sedeId, deporte: dep, cantidad: n, activo: true });
    }
    if (!rows.length) {
      return res.status(400).json({ error: 'Al menos un deporte con cantidad mayor a 0' });
    }
    const { error: delErr } = await supabase.from('canchas_por_deporte').delete().eq('sede_id', sedeId);
    if (delErr) throw delErr;
    const { data: ins, error: insErr } = await supabase.from('canchas_por_deporte').insert(rows).select('*');
    if (insErr) throw insErr;
    res.status(201).json({ deportes: ins || [] });
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
    console.error('❌ POST /api/sedes/:id/deportes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/sedes/:id/contrato — sube archivo a Storage y registra metadata en contratos_sedes. */
app.post('/api/sedes/:id/contrato', uploadContrato.single('archivo'), async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const sedeId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(sedeId)) return res.status(400).json({ error: 'ID de sede inválido' });

    const { data: sedeRow, error: sedeErr } = await supabase.from('sedes').select('id').eq('id', sedeId).maybeSingle();
    if (sedeErr) throw sedeErr;
    if (!sedeRow) return res.status(404).json({ error: 'Sede no encontrada' });

    const fechaInicio = String(req.body?.fecha_inicio || req.body?.fecha_inicio_contrato || '').trim();
    const fechaVenc = String(req.body?.fecha_vencimiento || req.body?.fecha_vencimiento_contrato || '').trim();
    const referencia = String(req.body?.referencia || req.body?.referencia_contrato || '').trim() || null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
      return res.status(400).json({ error: 'fecha_inicio es obligatoria (YYYY-MM-DD)' });
    }

    let archivoUrl = null;
    if (req.file?.buffer && req.file.originalname) {
      const safeName = String(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `contratos/${sedeId}/${Date.now()}_${safeName}`;
      const up = await supabase.storage.from('contratos').upload(path, req.file.buffer, {
        contentType: req.file.mimetype || 'application/octet-stream',
        upsert: false,
      });
      if (up.error) throw up.error;
      const pub = supabase.storage.from('contratos').getPublicUrl(path);
      archivoUrl = pub?.data?.publicUrl || null;
    }

    const payload = {
      sede_id: sedeId,
      fecha_inicio: fechaInicio,
      fecha_vencimiento: /^\d{4}-\d{2}-\d{2}$/.test(fechaVenc) ? fechaVenc : null,
      referencia,
      archivo_url: archivoUrl,
    };
    const { data, error } = await supabase.from('contratos_sedes').insert(payload).select('*').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('❌ POST /api/sedes/:id/contrato:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /api/contratos-sedes — super_admin: contratos (último por sede para panel). */
app.get('/api/contratos-sedes', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const rawIds = String(req.query.sede_ids || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
    let q = supabase.from('contratos_sedes').select('*').order('created_at', { ascending: false });
    if (rawIds.length) q = q.in('sede_id', rawIds);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('❌ GET /api/contratos-sedes:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Etiqueta corta para deporte (sede / torneos / analytics). */
function etiquetaDeporteCorta(dep) {
  const d = String(dep || '').trim().toLowerCase();
  const map = {
    padbol: 'Padbol',
    padel: 'Pádel',
    pickleball: 'Pickleball',
    squash: 'Squash',
    tenis: 'Tenis',
    futbol_5: 'Fútbol 5',
    futbol_7: 'Fútbol 7',
  };
  if (map[d]) return map[d];
  if (d === 'pádel') return 'Pádel';
  return d ? d.charAt(0).toUpperCase() + d.slice(1) : 'Padbol';
}

/** Etiqueta corta para deporte en estadísticas públicas de sede. */
function etiquetaDeporteEstadisticaSedePublica(dep) {
  return etiquetaDeporteCorta(dep);
}

/**
 * Métricas agregadas para la ficha pública `/sede/:id` (torneos, reservas, deporte).
 * No incluye `anio_fundacion` (viene en la fila `sedes`).
 */
async function computeEstadisticasPublicasSede(sedeIdNum, nombreSedeRaw) {
  const sid = Number(sedeIdNum);
  const nombreSede = String(nombreSedeRaw || '').trim();

  const tornFinPromise = supabase
    .from('torneos')
    .select('id', { count: 'exact', head: true })
    .eq('sede_id', sid)
    .eq('estado', 'finalizado');

  const tornDepsPromise = supabase.from('torneos').select('deporte').eq('sede_id', sid).limit(25000);

  const [tFinRes, tornDepsRes] = await Promise.all([tornFinPromise, tornDepsPromise]);
  if (tFinRes.error) throw tFinRes.error;
  if (tornDepsRes.error) throw tornDepsRes.error;

  const torneos_realizados_total = tFinRes.count ?? 0;
  const depRows = tornDepsRes.data || [];

  let deporte_mas_jugado = null;
  const depMap = {};
  for (const row of depRows) {
    const k = normalizeTorneoDeporteForDb(row.deporte);
    depMap[k] = (depMap[k] || 0) + 1;
  }
  const depEntries = Object.entries(depMap).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (depEntries.length && depEntries[0][1] > 0) {
    const [bestKey, bestN] = depEntries[0];
    deporte_mas_jugado = {
      deporte: bestKey,
      label: etiquetaDeporteEstadisticaSedePublica(bestKey),
      torneos: bestN,
    };
  } else {
    const invMap = await deportePrincipalPorSedeIdsStats(supabase, [sid]);
    const row = invMap.get(sid) ?? invMap.get(String(sid));
    const c = Number(row?.cantidad) || 0;
    if (row?.deporte && c > 0) {
      const dk = String(row.deporte).trim().toLowerCase();
      deporte_mas_jugado = {
        deporte: dk,
        label: etiquetaDeporteEstadisticaSedePublica(dk),
        canchas_cantidad: c,
      };
    }
  }

  let jugadores_reservaron_total = 0;
  if (nombreSede) {
    const keys = new Set();
    const pageSize = 1000;
    let from = 0;
    for (let guard = 0; guard < 250; guard += 1) {
      const { data: rows, error: rvErr } = await supabase
        .from('reservas')
        .select('user_id,email')
        .eq('sede', nombreSede)
        .neq('estado', 'cancelada')
        .range(from, from + pageSize - 1);
      if (rvErr) break;
      if (!rows?.length) break;
      for (const r of rows) {
        const uidRaw = r.user_id != null && String(r.user_id).trim() !== '' ? String(r.user_id).trim().toLowerCase() : '';
        const uid = uidRaw ? `u:${uidRaw}` : null;
        const em = String(r.email || '').trim().toLowerCase();
        const k = uid || (em ? `e:${em}` : null);
        if (k) keys.add(k);
      }
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    jugadores_reservaron_total = keys.size;
  }

  return {
    torneos_realizados_total,
    jugadores_reservaron_total,
    deporte_mas_jugado,
  };
}

/** Una sede con todos los campos de `sedes` (precio_turno, franjas, etc.) para reserva / detalle. */
app.get('/api/sedes/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID de sede inválido' });
    }
    const { data: sede, error } = await supabase.from('sedes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!sede) return res.status(404).json({ error: 'Sede no encontrada' });
    console.log('Precio sede:', sede.precio_turno);
    let out = sede;
    try {
      const cr = await fetchCanchasRowsForSede(id);
      if (cr.length) out = sedeResponseConCanchasActivas(sede, cr);
    } catch (e) {
      console.warn('GET /api/sedes/:id canchas_activas:', e?.message || e);
    }
    let estadisticas_publicas = null;
    try {
      estadisticas_publicas = await computeEstadisticasPublicasSede(id, sede.nombre);
    } catch (e) {
      console.warn('GET /api/sedes/:id estadisticas_publicas:', e?.message || e);
    }
    res.json({ ...out, estadisticas_publicas });
  } catch (err) {
    console.error('❌ Error GET /api/sedes/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/sedes/:id — actualización parcial (JWT).
 * Permisos: super_admin o admin con alcance que incluya la sede (admin_club / nacional según sedesPermitidasPorScope).
 */
app.patch('/api/sedes/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID de sede inválido' });
    }
    const scope = await assertUsuarioPuedeAdministrarSede(req, id);

    const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b)) {
      return res.status(400).json({ error: 'Body JSON inválido' });
    }

    const patch = {};
    const hop = (k) => Object.prototype.hasOwnProperty.call(b, k);

    if (hop('nombre')) {
      const n = String(b.nombre ?? '').trim();
      if (!n) return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
      patch.nombre = n;
    }
    if (hop('direccion')) patch.direccion = String(b.direccion || '').trim() || null;
    if (hop('ciudad')) patch.ciudad = String(b.ciudad || '').trim() || null;
    if (hop('provincia')) patch.provincia = String(b.provincia || '').trim() || null;
    if (hop('pais')) patch.pais = String(b.pais || '').trim() || null;
    if (hop('timezone')) patch.timezone = normalizeSedeTimezone(b.timezone);
    if (hop('telefono')) patch.telefono = String(b.telefono || '').trim() || null;
    if (hop('email_contacto')) patch.email_contacto = String(b.email_contacto || '').trim() || null;
    if (hop('horario_apertura')) patch.horario_apertura = String(b.horario_apertura || '').trim() || null;
    if (hop('horario_cierre')) patch.horario_cierre = String(b.horario_cierre || '').trim() || null;

    if (hop('precio_turno')) {
      if (b.precio_turno === null || b.precio_turno === '') {
        patch.precio_turno = null;
      } else {
        const p = Number(String(b.precio_turno).replace(/\./g, '').replace(',', '.'));
        if (!Number.isFinite(p) || p < 0) {
          return res.status(400).json({ error: 'precio_turno inválido' });
        }
        patch.precio_turno = p;
      }
    }
    if (hop('moneda')) {
      const m = String(b.moneda || 'ARS').trim().toUpperCase().slice(0, 8);
      patch.moneda = m || 'ARS';
    }
    if (hop('descripcion')) {
      const d = String(b.descripcion ?? '').trim();
      patch.descripcion = d ? d.slice(0, 300) : null;
    }
    if (hop('historia')) {
      const h = String(b.historia ?? '').trim();
      patch.historia = h ? h.slice(0, 500) : null;
    }
    if (hop('anio_fundacion')) {
      if (b.anio_fundacion === null || b.anio_fundacion === '') {
        patch.anio_fundacion = null;
      } else {
        const y = parseInt(String(b.anio_fundacion).trim(), 10);
        if (!Number.isFinite(y) || y < 1800 || y > 2100) {
          return res.status(400).json({ error: 'anio_fundacion debe ser un año entre 1800 y 2100' });
        }
        patch.anio_fundacion = y;
      }
    }
    if (hop('metodo_pago')) patch.metodo_pago = normalizeMetodoPago(b.metodo_pago);
    if (hop('stripe_account_id')) patch.stripe_account_id = String(b.stripe_account_id || '').trim() || null;
    if (hop('mp_access_token')) patch.mp_access_token = String(b.mp_access_token || '').trim() || null;
    if (hop('pago_manual_instrucciones')) {
      patch.pago_manual_instrucciones = String(b.pago_manual_instrucciones || '').trim() || null;
    }

    if (hop('latitud')) {
      if (b.latitud === null || b.latitud === '') patch.latitud = null;
      else {
        const lat = Number(b.latitud);
        if (!Number.isFinite(lat)) return res.status(400).json({ error: 'latitud inválida' });
        patch.latitud = lat;
      }
    }
    if (hop('longitud')) {
      if (b.longitud === null || b.longitud === '') patch.longitud = null;
      else {
        const lng = Number(b.longitud);
        if (!Number.isFinite(lng)) return res.status(400).json({ error: 'longitud inválida' });
        patch.longitud = lng;
      }
    }

    if (hop('instagram')) patch.instagram = String(b.instagram || '').trim() || null;
    if (hop('facebook')) patch.facebook = String(b.facebook || '').trim() || null;
    if (hop('tiktok')) patch.tiktok = String(b.tiktok || '').trim() || null;
    if (hop('twitter')) patch.twitter = String(b.twitter || '').trim() || null;
    if (hop('youtube')) patch.youtube = String(b.youtube || '').trim() || null;
    if (hop('website')) patch.website = String(b.website || '').trim() || null;

    if (hop('color_fondo_logo')) {
      const s = String(b.color_fondo_logo || '').trim().slice(0, 16);
      patch.color_fondo_logo = s || null;
    }
    if (hop('color_hero_primario')) {
      const s = String(b.color_hero_primario || '').trim().slice(0, 16);
      patch.color_hero_primario = s || null;
    }
    if (hop('color_hero_secundario')) {
      const s = String(b.color_hero_secundario || '').trim().slice(0, 16);
      patch.color_hero_secundario = s || null;
    }
    if (hop('color_borde_hero')) {
      const s = String(b.color_borde_hero || '').trim().slice(0, 16);
      patch.color_borde_hero = s || null;
    }

    if (hop('suscripcion_estado')) {
      if (!scope?.superA) {
        return res.status(403).json({ error: 'Solo super_admin puede cambiar suscripcion_estado' });
      }
      const allowed = new Set([
        'activa',
        'aviso',
        'segundo_aviso',
        'suspendido',
        'cancelado',
        'sin_suscripcion',
        'pendiente_pago',
        'vencida',
        'cancelada',
      ]);
      const se = String(b.suscripcion_estado ?? '').trim().toLowerCase();
      if (!allowed.has(se)) {
        return res.status(400).json({ error: 'suscripcion_estado inválido' });
      }
      patch.suscripcion_estado = se;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Ningún campo reconocido para actualizar' });
    }

    const { data: updated, error } = await supabase.from('sedes').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    if (!updated) return res.status(404).json({ error: 'Sede no encontrada' });

    res.json({ sede: updated });
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) {
      return res.status(st).json({ error: err.message || String(err) });
    }
    console.error('❌ PATCH /api/sedes/:id:', err?.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

/** Listado de canchas (JWT: admin de la sede o super_admin). */
app.get('/api/sedes/:id/canchas', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID de sede inválido' });
    await assertUsuarioPuedeAdministrarSede(req, id);
    const rows = await fetchCanchasRowsForSede(id);
    const canchas = rows.map((r) => enrichSingleCanchaAdminDto(r, rows));
    res.json({ canchas });
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
    console.error('❌ GET /api/sedes/:id/canchas:', err?.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

/** Alta de cancha (JWT). Body: nombre, estado?, descripcion? */
app.post('/api/sedes/:id/canchas', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID de sede inválido' });
    await assertUsuarioPuedeAdministrarSede(req, id);
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const estado = normalizeEstadoCancha(b.estado != null ? b.estado : 'activa');
    const descripcion =
      b.descripcion != null && String(b.descripcion).trim() !== '' ? String(b.descripcion).trim() : null;

    const existing = await fetchCanchasRowsForSede(id);
    const enriched = canchasConNumeroReserva(existing);
    const nextOrden =
      enriched.length > 0 ? Math.max(...enriched.map((c) => c.numero_reserva)) + 1 : 1;

    const insertPayload = { sede_id: id, nombre, estado, orden: nextOrden };
    if (descripcion) insertPayload.descripcion = descripcion;

    const { data: created, error } = await supabase.from('canchas').insert(insertPayload).select('*').single();
    if (error) throw error;
    const all = await fetchCanchasRowsForSede(id);
    res.status(201).json({ cancha: enrichSingleCanchaAdminDto(created, all) });
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
    console.error('❌ POST /api/sedes/:id/canchas:', err?.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

/** Actualización parcial de cancha (JWT). Body: nombre?, estado?, descripcion? */
app.patch('/api/canchas/:id', async (req, res) => {
  try {
    const cid = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(cid)) return res.status(400).json({ error: 'ID de cancha inválido' });
    const { data: row, error: e1 } = await supabase.from('canchas').select('id, sede_id').eq('id', cid).maybeSingle();
    if (e1) throw e1;
    if (!row) return res.status(404).json({ error: 'Cancha no encontrada' });
    await assertUsuarioPuedeAdministrarSede(req, row.sede_id);

    const b = req.body || {};
    if (!b || typeof b !== 'object' || Array.isArray(b)) {
      return res.status(400).json({ error: 'Body JSON inválido' });
    }
    const patch = {};
    const hop = (k) => Object.prototype.hasOwnProperty.call(b, k);
    if (hop('nombre')) {
      const n = String(b.nombre ?? '').trim();
      if (!n) return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
      patch.nombre = n;
    }
    if (hop('estado')) patch.estado = normalizeEstadoCancha(b.estado);
    if (hop('descripcion')) {
      patch.descripcion =
        b.descripcion == null || String(b.descripcion).trim() === '' ? null : String(b.descripcion).trim();
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Ningún campo reconocido para actualizar' });
    }

    const { data: updated, error } = await supabase.from('canchas').update(patch).eq('id', cid).select('*').single();
    if (error) throw error;
    if (!updated) return res.status(404).json({ error: 'Cancha no encontrada' });
    const all = await fetchCanchasRowsForSede(row.sede_id);
    res.json({ cancha: enrichSingleCanchaAdminDto(updated, all) });
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
    console.error('❌ PATCH /api/canchas/:id:', err?.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

function nombreAutorResenaDesdePerfil(row) {
  if (!row) return 'Jugador';
  const n = String(row.nombre || '').trim();
  const a = String(row.apellido || '').trim();
  const full = [n, a].filter(Boolean).join(' ');
  if (full) return full;
  const al = String(row.alias || '').trim();
  if (al) return al.startsWith('@') ? al : `@${al}`;
  return 'Jugador';
}

/** Lista de filas reseñas sede + join lógico a `jugadores_perfil` (foto y nombre). */
async function enrichSedeResenasConPerfil(reviews) {
  const rows = Array.isArray(reviews) ? reviews : [];
  const uids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  let map = {};
  if (uids.length) {
    const { data: perfiles, error } = await supabase
      .from('jugadores_perfil')
      .select('user_id, foto_url, nombre, apellido, alias, apodo')
      .in('user_id', uids);
    if (error) console.warn('enrichSedeResenasConPerfil jugadores_perfil:', error.message);
    (perfiles || []).forEach((p) => {
      if (p?.user_id) map[p.user_id] = p;
    });
  }
  return rows.map((r) => {
    const p = map[r.user_id];
    const nombreGuardado = String(r.nombre ?? '').trim();
    const apodo = p?.apodo != null && String(p.apodo).trim() ? String(p.apodo).trim() : null;
    const nombreVis = nombreVisibleAutorResenaListado(p, nombreGuardado);
    return {
      id: r.id,
      estrellas: r.estrellas,
      comentario: r.comentario,
      created_at: r.created_at,
      autor: {
        nombre: nombreVis,
        apodo: apodo || null,
        foto_url: p?.foto_url ? String(p.foto_url).trim() || null : null,
      },
    };
  });
}

/**
 * GET reseñas de una sede: promedio, total, página (orden por más recientes).
 * Query: limit (default 5, max 100), offset (default 0).
 * Con Bearer: incluye `ya_reseño` y `puede_reseñar` (reserva confirmada en la sede y aún sin reseña).
 */
app.get('/api/sedes/:id/resenas', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID de sede inválido' });
    }
    const limitRaw = parseInt(String(req.query.limit ?? '5'), 10);
    const offsetRaw = parseInt(String(req.query.offset ?? '0'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 5;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

    const { data: sedeRow, error: sedeErr } = await supabase.from('sedes').select('id').eq('id', id).maybeSingle();
    if (sedeErr) throw sedeErr;
    if (!sedeRow) return res.status(404).json({ error: 'Sede no encontrada' });

    const { data: allStars, error: e1 } = await supabase.from(PUBLIC_RESENAS_TABLE).select('estrellas').eq('sede_id', id);
    if (e1) throw e1;
    const total = allStars?.length ?? 0;
    const promedio =
      total > 0
        ? Math.round((allStars.reduce((s, r) => s + Number(r.estrellas), 0) / total) * 10) / 10
        : null;

    const { data: pageRows, error: e2 } = await selectResenasRowsForSede(id, offset, limit);
    if (e2) throw e2;

    const resenas = await enrichSedeResenasConPerfil(pageRows || []);

    let ya_reseño = false;
    let puede_reseñar = false;
    const user = await authUserFromBearer(req);
    if (user?.id) {
      const { data: mine } = await supabase
        .from(PUBLIC_RESENAS_TABLE)
        .select('id')
        .eq('sede_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      ya_reseño = Boolean(mine);
      if (!ya_reseño) {
        puede_reseñar = await jugadorTieneReservaConfirmadaEnSede(user, id);
      }
    }

    res.json({
      promedio,
      total,
      resenas,
      ya_reseño: Boolean(ya_reseño),
      puede_reseñar: Boolean(user?.id && puede_reseñar),
    });
  } catch (err) {
    if (isResenasPublicTableConfigError(err)) return respondResenasPublicUnavailable(res, err);
    console.error('❌ Error GET /api/sedes/:id/resenas:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST reseña (jugador logueado, una por sede).
 * Body: { estrellas: 1-5, comentario?: string (max 200) }
 */
app.post('/api/sedes/:id/resenas', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) {
      return res.status(401).json({ error: 'Inicia sesión para dejar una reseña' });
    }

    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID de sede inválido' });
    }

    const { data: sedeRow, error: sedeErr } = await supabase.from('sedes').select('id').eq('id', id).maybeSingle();
    if (sedeErr) throw sedeErr;
    if (!sedeRow) return res.status(404).json({ error: 'Sede no encontrada' });

    const estrellas = parseInt(String(req.body?.estrellas), 10);
    if (!Number.isFinite(estrellas) || estrellas < 1 || estrellas > 5) {
      return res.status(400).json({ error: 'Las estrellas deben ser un número entre 1 y 5' });
    }
    const comentario = String(req.body?.comentario ?? '').trim();
    if (comentario.length > 200) {
      return res.status(400).json({ error: 'El comentario no puede superar los 200 caracteres' });
    }

    const { data: dup } = await supabase
      .from(PUBLIC_RESENAS_TABLE)
      .select('id')
      .eq('sede_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (dup) {
      return res.status(409).json({ error: 'Ya dejaste una reseña en esta sede' });
    }

    const puede = await jugadorTieneReservaConfirmadaEnSede(user, id);
    if (!puede) {
      return res.status(403).json({
        error: 'Solo puedes dejar una reseña si tienes al menos una reserva confirmada en esta sede.',
      });
    }

    const nombreAutor = await fetchNombreAutorResenaInsert(user);
    let insertPayload = { sede_id: id, user_id: user.id, estrellas, comentario, nombre: nombreAutor };
    let { data: inserted, error: insErr } = await supabase
      .from(PUBLIC_RESENAS_TABLE)
      .insert([insertPayload])
      .select(RESENAS_SELECT_ROW)
      .single();
    if (insErr && String(insErr.message || '').includes('nombre')) {
      insertPayload = { sede_id: id, user_id: user.id, estrellas, comentario };
      ({ data: inserted, error: insErr } = await supabase
        .from(PUBLIC_RESENAS_TABLE)
        .insert([insertPayload])
        .select(RESENAS_SELECT_ROW_FALLBACK)
        .single());
    }
    if (insErr) throw insErr;

    const [enriched] = await enrichSedeResenasConPerfil(inserted ? [inserted] : []);
    res.status(201).json(enriched || null);
  } catch (err) {
    if (isResenasPublicTableConfigError(err)) return respondResenasPublicUnavailable(res, err);
    console.error('❌ Error POST /api/sedes/:id/resenas:', err.message);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya dejaste una reseña en esta sede' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE reseña (moderación): solo super_admin.
 */
app.delete('/api/sedes/:id/resenas/:resenaId', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const sedeId = parseInt(String(req.params.id), 10);
    const resenaId = String(req.params.resenaId || '').trim();
    if (!Number.isFinite(sedeId)) {
      return res.status(400).json({ error: 'ID de sede inválido' });
    }
    if (!resenaId) {
      return res.status(400).json({ error: 'ID de reseña inválido' });
    }
    const { data: row, error: fErr } = await supabase
      .from(PUBLIC_RESENAS_TABLE)
      .select('id')
      .eq('id', resenaId)
      .eq('sede_id', sedeId)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!row?.id) {
      return res.status(404).json({ error: 'Reseña no encontrada' });
    }
    const { error: dErr } = await supabase.from(PUBLIC_RESENAS_TABLE).delete().eq('id', resenaId).eq('sede_id', sedeId);
    if (dErr) throw dErr;
    res.json({ ok: true });
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
    if (isResenasPublicTableConfigError(err)) return respondResenasPublicUnavailable(res, err);
    console.error('❌ Error DELETE /api/sedes/:id/resenas/:resenaId:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET disponibilidad
app.get('/api/disponibilidad/:sede/:fecha', async (req, res) => {
  try {
    const { sede, fecha } = req.params;
    
    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('sede', sede)
      .eq('fecha', fecha);
    
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Slots libres por id de sede (misma lógica que ReservaForm y tool consultar_disponibilidad). Query: fecha=YYYY-MM-DD, duracion=60|90|120 (default 90), deporte opcional (mismo criterio que el tool). */
app.get('/api/sedes/:id/disponibilidad-slots', async (req, res) => {
  try {
    const sid = parseInt(String(req.params.id || '').trim(), 10);
    const fecha = String(req.query?.fecha || '').trim().slice(0, 10);
    const durRaw = parseInt(String(req.query?.duracion ?? '90'), 10);
    const dur = [60, 90, 120].includes(durRaw) ? durRaw : 90;
    const depCanon = normalizeChatIaDeporteToolInput(req.query?.deporte);
    if (!Number.isFinite(sid) || sid <= 0) return res.status(400).json({ error: 'sede_id inválido' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: 'Query fecha requerida (YYYY-MM-DD)' });
    }
    const sedeFull = await chatIaFetchSedeFullForTool(supabase, sid);
    if (!sedeFull) return res.status(404).json({ error: 'Sede no encontrada' });
    const { slots, error } = await computeChatIaSlotsReales(supabase, sedeFull, fecha, dur, depCanon || null);
    if (error) return res.status(500).json({ error });
    const out = {
      sede_id: sid,
      sede_nombre: String(sedeFull.nombre || '').trim(),
      fecha,
      duracion_minutos: dur,
      deporte_filtro: depCanon || null,
      slots,
    };
    console.log('[disponibilidad-slots] GET ok', {
      sede_id: sid,
      fecha,
      duracion_minutos: dur,
      slots_count: Array.isArray(slots) ? slots.length : 0,
      primeras_horas: (Array.isArray(slots) ? slots : []).slice(0, 5).map((s) => s?.hora_inicio),
    });
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

function minutosDesdeHoraReservaBackend(horaRaw) {
  const t = String(horaRaw || '').split(' - ')[0].trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function duracionReservaRowBackend(row) {
  const d = parseInt(String(row?.duracion_minutos ?? row?.duracion ?? ''), 10);
  return Number.isFinite(d) && d > 0 ? d : 90;
}

function reservaEstadoBloqueaSlotBackend(row) {
  return String(row?.estado || '').trim().toLowerCase() !== 'cancelada';
}

function reservasSolapanBackend(aInicio, aDuracion, bRow) {
  const bInicio = minutosDesdeHoraReservaBackend(bRow?.hora);
  if (bInicio == null) return false;
  const aFin = aInicio + aDuracion;
  const bFin = bInicio + duracionReservaRowBackend(bRow);
  return aInicio < bFin && aFin > bInicio;
}

async function assertReservaSinSolapeBackend({ sede, fecha, hora, cancha, duracionMin, excludeId = null }) {
  const inicioMin = minutosDesdeHoraReservaBackend(hora);
  if (inicioMin == null) {
    const e = new Error('Horario inválido');
    e.status = 400;
    throw e;
  }
  const canchaNum = parseInt(String(cancha), 10);
  const duracion = Number.isFinite(Number(duracionMin)) && Number(duracionMin) > 0 ? parseInt(String(duracionMin), 10) : 90;
  let q = supabase
    .from('reservas')
    .select('id,hora,duracion,duracion_minutos,estado')
    .eq('sede', sede)
    .eq('fecha', fecha)
    .eq('cancha', canchaNum);
  if (excludeId != null && String(excludeId).trim() !== '') q = q.neq('id', excludeId);
  const { data, error } = await q;
  if (error) throw error;
  const conflict = (data || []).find((row) => reservaEstadoBloqueaSlotBackend(row) && reservasSolapanBackend(inicioMin, duracion, row));
  if (conflict) {
    const e = new Error('Este horario se solapa con otra reserva');
    e.status = 409;
    throw e;
  }
}

// POST reserva
app.post('/api/reservas', checkSuscripcionActiva, async (req, res) => {
  try {
    const { sede, fecha, hora, cancha, nombre, email, whatsapp, nivel, precio, estado, duracion } = req.body;

    // Validar campos
    if (!sede || !fecha || !hora || !cancha || !nombre || !email || !whatsapp) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const authUser = await authUserFromBearer(req);
    const emailNorm = String(email).trim().toLowerCase();
    const user_id =
      authUser?.id &&
      String(authUser.email || '')
        .trim()
        .toLowerCase() === emailNorm
        ? authUser.id
        : null;

    await assertCanchaPermitidaParaReservaPorNombreSede(sede, cancha);
    await assertReservaHorarioNoPasadoParaSede(sede, fecha, hora);

    // Sin `estado` en el body (p. ej. pagos MP viejos en external_reference) → confirmada tras pago exitoso.
    const estadoExplicito =
      Object.prototype.hasOwnProperty.call(req.body, 'estado') &&
      estado != null &&
      String(estado).trim() !== '';
    const estadoFinal = estadoExplicito ? String(estado).trim() : 'confirmada';
    let duracionMin = duracion != null && duracion !== '' ? parseInt(duracion, 10) : null;
    if (!Number.isFinite(duracionMin) || duracionMin <= 0) {
      const { data: sedeDur } = await supabase
        .from('sedes')
        .select('duracion_reserva_minutos')
        .eq('nombre', sede)
        .maybeSingle();
      duracionMin = parseInt(sedeDur?.duracion_reserva_minutos, 10) || 90;
    }

    await assertReservaSinSolapeBackend({ sede, fecha, hora, cancha, duracionMin });

    // Crear reserva
    const { data, error } = await supabase
      .from('reservas')
      .insert([{
        sede,
        fecha,
        hora,
        cancha: parseInt(cancha),
        nombre,
        email,
        telefono: whatsapp,
        whatsapp,
        nivel: nivel || 'Principiante',
        precio: parseInt(precio),
        estado: estadoFinal,
        duracion: duracionMin,
        duracion_minutos: duracionMin,
        ...(user_id ? { user_id } : {}),
      }])
      .select();

    if (error) throw error;

    console.log('✓ Reserva creada:', data);

    if (String(estadoFinal).toLowerCase() === 'confirmada') {
      sendReservaConfirmadaWhatsAppTwilio({
        email,
        nombreFallback: nombre,
        fecha,
        hora,
        duracionMinutos: duracionMin,
        nombreSede: sede,
      }).catch((err) => console.warn('⚠️ WhatsApp confirmación reserva:', err.message));
      void crearNotificacionReservaConfirmada({
        userId: user_id,
        email,
        sede,
        fecha,
        hora,
      });
    }

    const createdReserva = Array.isArray(data) ? data[0] : data;
    if (createdReserva?.id != null) {
      await insertReservaHistorialEstado(supabase, {
        reserva_id: createdReserva.id,
        estado_anterior: null,
        estado_nuevo: String(estadoFinal || '').trim() || null,
        changed_by: 'sistema',
      });
    }
    const estReserva = String(createdReserva?.estado || estadoFinal || '').trim().toLowerCase();
    if (estReserva === 'confirmada' || estReserva === 'pendiente_pago_manual' || estReserva === 'pendiente_pago_efectivo') {
      const estEv = String(createdReserva?.estado || '').toLowerCase();
      void sendMakeEvent('reserva_confirmada', {
        nombre: String(createdReserva?.nombre || nombre || '').trim() || null,
        email: String(createdReserva?.email || email || '').trim().toLowerCase() || null,
        telefono: String(createdReserva?.telefono || createdReserva?.whatsapp || whatsapp || '').trim() || null,
        sede: String(createdReserva?.sede || sede || '').trim() || null,
        fecha: createdReserva?.fecha || fecha || null,
        hora: createdReserva?.hora || hora || null,
        cancha: createdReserva?.cancha ?? (cancha != null ? parseInt(cancha, 10) : null),
        monto: createdReserva?.precio ?? (precio != null ? parseInt(precio, 10) : null),
        metodo_pago:
          estEv === 'pendiente_pago_manual'
            ? 'manual'
            : estEv === 'pendiente_pago_efectivo'
              ? 'efectivo'
              : (createdReserva?.metodo_pago ?? null),
      });
    }

    res.json(data);
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) {
      return res.status(st).json({ error: err.message || String(err) });
    }
    console.error('❌ Error POST reserva:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/reservas/manual', async (req, res) => {
  try {
    const scope = await adminListScopeFromRequest(req);
    if (!scope) return res.status(401).json({ error: 'No autorizado' });
    if (!scope.superA && !['admin_club', 'empleado'].includes(String(scope.rol || ''))) {
      return res.status(403).json({ error: 'No tienes permiso para crear reservas manuales' });
    }

    const b = req.body || {};
    const sedeIdRaw = b.sede_id != null && String(b.sede_id).trim() !== '' ? b.sede_id : scope.sedeId;
    const sedeIdNum = Number(sedeIdRaw);
    if (!Number.isFinite(sedeIdNum)) return res.status(400).json({ error: 'Selecciona una sede' });

    await assertUsuarioPuedeAdministrarSede(req, sedeIdNum);

    const { data: sedeRow, error: sedeErr } = await supabase
      .from('sedes')
      .select('id,nombre,moneda')
      .eq('id', sedeIdNum)
      .maybeSingle();
    if (sedeErr) throw sedeErr;
    if (!sedeRow) return res.status(404).json({ error: 'Sede no encontrada' });

    const sede = String(sedeRow.nombre || '').trim();
    const fecha = String(b.fecha || '').trim().slice(0, 10);
    const hora = String(b.hora || '').trim().slice(0, 5);
    const cancha = parseInt(String(b.cancha), 10);
    const nombre = String(b.nombre || '').trim();
    const telefono = String(b.telefono || b.whatsapp || '').trim();
    const estadoRaw = String(b.estado || 'confirmada').trim().toLowerCase();
    const estado = ['confirmada', 'reservada', 'completada'].includes(estadoRaw) ? estadoRaw : 'confirmada';
    const duracionParsed = parseInt(String(b.duracion_minutos ?? b.duracion ?? 90), 10);
    const duracionMin = [60, 90, 120].includes(duracionParsed) ? duracionParsed : 90;

    if (!sede || !fecha || !hora || !Number.isFinite(cancha) || !nombre) {
      return res.status(400).json({ error: 'Completa sede, cancha, fecha, hora y nombre del jugador' });
    }

    await assertCanchaPermitidaParaReservaPorNombreSede(sede, cancha);
    await assertReservaHorarioNoPasadoParaSede(sede, fecha, hora);
    await assertReservaSinSolapeBackend({ sede, fecha, hora, cancha, duracionMin });

    const { data, error } = await supabase
      .from('reservas')
      .insert([
        {
          sede,
          fecha,
          hora,
          cancha,
          nombre,
          email: null,
          telefono: telefono || null,
          whatsapp: telefono || null,
          nivel: 'Manual',
          precio: 0,
          moneda: String(sedeRow.moneda || 'ARS').trim().toUpperCase() || 'ARS',
          estado,
          duracion: duracionMin,
          duracion_minutos: duracionMin,
        },
      ])
      .select()
      .single();
    if (error) throw error;

    if (data?.id != null) {
      await insertReservaHistorialEstado(supabase, {
        reserva_id: data.id,
        estado_anterior: null,
        estado_nuevo: estado,
        changed_by: `admin:${scope.email}`,
      });
    }

    res.status(201).json(data);
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
    console.error('❌ Error POST /api/admin/reservas/manual:', err.message);
    res.status(500).json({ error: err.message || 'No se pudo crear la reserva manual' });
  }
});

const RESERVAS_JUGADOR_WHATSAPP_CHUNK = 120;

/**
 * Lista de reservas (admin): agrega `jugador_whatsapp_perfil` desde `jugadores_perfil.whatsapp`
 * por `user_id` y, si falta, por `email` (coincidencia exacta en email normalizado a minúsculas).
 */
function slugJugadorPerfilPublicoDesdeReservaEnrich(r, perfMatch) {
  const alias = String(perfMatch?.alias || '').trim();
  if (alias) return alias;
  const uidRes = r?.user_id != null ? String(r.user_id).trim() : '';
  if (esUuidAuthProbableJugadorSlug(uidRes)) return uidRes;
  const uidPerf = perfMatch?.user_id != null ? String(perfMatch.user_id).trim() : '';
  if (esUuidAuthProbableJugadorSlug(uidPerf)) return uidPerf;
  return '';
}

async function enrichReservasConJugadorWhatsappPerfil(clienteSupa, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const userIds = [...new Set(rows.map((r) => r?.user_id).filter(Boolean))];
  const perfByUserId = new Map();
  for (let i = 0; i < userIds.length; i += RESERVAS_JUGADOR_WHATSAPP_CHUNK) {
    const chunk = userIds.slice(i, i + RESERVAS_JUGADOR_WHATSAPP_CHUNK);
    const { data, error } = await clienteSupa
      .from('jugadores_perfil')
      .select('user_id, whatsapp, alias')
      .in('user_id', chunk);
    if (error) {
      console.warn('enrichReservas jugador_whatsapp (user_id):', error.message);
      continue;
    }
    for (const p of data || []) {
      if (!p?.user_id) continue;
      perfByUserId.set(p.user_id, {
        wa: String(p?.whatsapp || '').trim(),
        alias: String(p?.alias || '').trim(),
        user_id: p.user_id,
      });
    }
  }

  const emails = [
    ...new Set(rows.map((r) => String(r?.email || '').trim().toLowerCase()).filter((e) => e.includes('@'))),
  ];
  const perfByEmail = new Map();
  for (let i = 0; i < emails.length; i += RESERVAS_JUGADOR_WHATSAPP_CHUNK) {
    const chunk = emails.slice(i, i + RESERVAS_JUGADOR_WHATSAPP_CHUNK);
    const { data, error } = await clienteSupa
      .from('jugadores_perfil')
      .select('email, whatsapp, alias, user_id')
      .in('email', chunk);
    if (error) {
      console.warn('enrichReservas jugador_whatsapp (email):', error.message);
      continue;
    }
    for (const p of data || []) {
      const em = String(p?.email || '').trim().toLowerCase();
      if (!em) continue;
      perfByEmail.set(em, {
        wa: String(p?.whatsapp || '').trim(),
        alias: String(p?.alias || '').trim(),
        user_id: p?.user_id,
      });
    }
  }

  return rows.map((r) => {
    const uid = r?.user_id;
    const em = String(r?.email || '').trim().toLowerCase();
    const pm = (uid && perfByUserId.get(uid)) || (em && perfByEmail.get(em)) || null;
    const jugador_whatsapp_perfil = pm ? String(pm.wa || '').trim() : '';
    const slug = slugJugadorPerfilPublicoDesdeReservaEnrich(r, pm);
    return {
      ...r,
      jugador_whatsapp_perfil: jugador_whatsapp_perfil || null,
      jugador_perfil_public_slug: slug || null,
    };
  });
}

/** Auditoría de cambio de estado (tabla reservas_historial). No relanza si falla inserción. */
async function insertReservaHistorialEstado(client, { reserva_id, estado_anterior, estado_nuevo, changed_by }) {
  const rid = Number(reserva_id);
  if (!Number.isFinite(rid)) return;
  const prev =
    estado_anterior == null || String(estado_anterior).trim() === '' ? null : String(estado_anterior).trim();
  const next = estado_nuevo == null || String(estado_nuevo).trim() === '' ? null : String(estado_nuevo).trim();
  if (prev === next) return;
  const by = String(changed_by || 'sistema').trim().slice(0, 200) || 'sistema';
  const { error } = await client.from('reservas_historial').insert({
    reserva_id: rid,
    estado_anterior: prev,
    estado_nuevo: next,
    changed_by: by,
  });
  if (error) console.warn('insertReservaHistorialEstado:', error.message);
}

/** Misma visibilidad que listados de reservas para leer historial. */
async function assertReservaAccesibleHistorial(req, reservaId) {
  const rid = Number(String(reservaId).trim(), 10);
  if (!Number.isFinite(rid)) {
    const e = new Error('ID inválido');
    e.status = 400;
    throw e;
  }
  const scope = await adminListScopeFromRequest(req);
  if (!scope) {
    const e = new Error('No autorizado');
    e.status = 401;
    throw e;
  }
  const { data: r, error } = await supabase.from('reservas').select('id, sede, user_id').eq('id', rid).maybeSingle();
  if (error) throw error;
  if (!r) {
    const e = new Error('Reserva no encontrada');
    e.status = 404;
    throw e;
  }
  if (scope.superA || scope.alcance === 'global') return r;
  if (scope.rol === 'admin_club' || scope.rol === 'admin_nacional' || scope.rol === 'empleado') {
    const allowed = await sedesPermitidasPorScope(scope);
    const nombres = new Set((allowed.sedes || []).map((s) => String(s?.nombre || '').trim()).filter(Boolean));
    if (nombres.has(String(r.sede || '').trim())) return r;
    const e = new Error('No tienes permiso para ver esta reserva');
    e.status = 403;
    throw e;
  }
  if (scope.authUserId && String(r.user_id || '') === String(scope.authUserId)) return r;
  const e = new Error('No tienes permiso para ver esta reserva');
  e.status = 403;
  throw e;
}

// GET reservas — con Bearer aplica alcance: sede / ciudad / provincia / país / global.
app.get('/api/reservas', async (req, res) => {
  try {
    const scope = await adminListScopeFromRequest(req);
    const logLine = scope
      ? { rol: scope.rol, alcance: scope.alcance, email: scope.email, sedeId: scope.sedeId }
      : { rol: null, alcance: null, email: null, sedeId: null };
    console.log('GET /reservas:', logLine);

    let query = supabase.from('reservas').select('*');

    if (scope) {
      if (scope.superA || scope.alcance === 'global') {
        // sin filtro
      } else if (scope.rol === 'admin_club' || scope.rol === 'admin_nacional' || scope.rol === 'empleado') {
        const allowed = await sedesPermitidasPorScope(scope);
        const nombres = [
          ...new Set((allowed.sedes || []).map((s) => String(s?.nombre || '').trim()).filter(Boolean)),
        ];
        if (!nombres.length) return res.json([]);
        query = query.in('sede', nombres);
      } else if (scope.authUserId) {
        query = query.eq('user_id', scope.authUserId);
      } else {
        return res.json([]);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    const enriched = await enrichReservasConJugadorWhatsappPerfil(supabase, data || []);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET historial de estados de una reserva (admin / alcance sede o dueño por user_id). */
app.get('/api/reservas/:id/historial', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    await assertReservaAccesibleHistorial(req, id);
    const { data, error } = await supabase
      .from('reservas_historial')
      .select('id, reserva_id, estado_anterior, estado_nuevo, changed_by, created_at')
      .eq('reserva_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
    console.error('❌ GET /api/reservas/:id/historial:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET ingresos
app.get('/api/ingresos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reservas')
      .select('precio')
      .eq('estado', 'confirmada');

    if (error) throw error;

    const total = data.reduce((sum, r) => sum + (r.precio || 0), 0);
    res.json({ total, reservas: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT reserva
app.put('/api/reservas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sede, fecha, hora, cancha, nombre, email, precio, duracion, estado } = req.body;

    const { data: prevRow, error: prevErr } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (prevErr) throw prevErr;

    const updates = {};
    if (sede     !== undefined) updates.sede     = sede;
    if (fecha    !== undefined) updates.fecha    = fecha;
    if (hora     !== undefined) updates.hora     = hora;
    if (cancha   !== undefined) updates.cancha   = cancha !== null ? parseInt(cancha) : null;
    if (nombre   !== undefined) updates.nombre   = nombre;
    if (email    !== undefined) updates.email    = email;
    if (precio   !== undefined) updates.precio   = precio !== null ? parseInt(precio) : null;
    if (duracion !== undefined) {
      const duracionEdit = duracion !== null ? parseInt(duracion, 10) : null;
      updates.duracion = duracionEdit;
      updates.duracion_minutos = duracionEdit;
    }
    if (estado   !== undefined) updates.estado   = estado;

    const sedeEff = updates.sede !== undefined ? updates.sede : prevRow?.sede;
    const fechaEff = updates.fecha !== undefined ? updates.fecha : prevRow?.fecha;
    const horaEff = updates.hora !== undefined ? updates.hora : prevRow?.hora;
    const canchaEff = updates.cancha !== undefined ? updates.cancha : prevRow?.cancha;
    const duracionEff = updates.duracion !== undefined ? updates.duracion : duracionReservaRowBackend(prevRow);
    if (sedeEff && fechaEff && horaEff && canchaEff != null && String(updates.estado ?? prevRow?.estado ?? '').trim().toLowerCase() !== 'cancelada') {
      await assertReservaSinSolapeBackend({
        sede: sedeEff,
        fecha: fechaEff,
        hora: horaEff,
        cancha: canchaEff,
        duracionMin: duracionEff,
        excludeId: id,
      });
    }

    const { data, error } = await supabase
      .from('reservas')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (
      row &&
      Object.prototype.hasOwnProperty.call(req.body, 'estado') &&
      estado !== undefined
    ) {
      const oldE = String(prevRow?.estado ?? '').trim();
      const newE = String(row?.estado ?? '').trim();
      if (oldE !== newE) {
        const scopeH = await adminListScopeFromRequest(req);
        let changedByHist = 'sistema';
        if (
          scopeH &&
          (scopeH.superA ||
            scopeH.rol === 'admin_club' ||
            scopeH.rol === 'empleado' ||
            scopeH.rol === 'admin_nacional' ||
            scopeH.alcance === 'global')
        ) {
          changedByHist = `admin:${scopeH.email}`;
        } else {
          const user = await authUserFromBearer(req);
          if (user?.email) changedByHist = `jugador:${String(user.email).trim().toLowerCase()}`;
        }
        await insertReservaHistorialEstado(supabase, {
          reserva_id: id,
          estado_anterior: oldE || null,
          estado_nuevo: newE || null,
          changed_by: changedByHist,
        });
      }
    }

    const oldEst = String(prevRow?.estado || '').toLowerCase();
    const newEst = String(row?.estado ?? prevRow?.estado ?? '').toLowerCase();
    if (row && newEst === 'confirmada' && oldEst !== 'confirmada') {
      let dmin = parseInt(row.duracion, 10);
      if (!Number.isFinite(dmin) || dmin <= 0) {
        const { data: sedeDur } = await supabase
          .from('sedes')
          .select('duracion_reserva_minutos')
          .eq('nombre', row.sede)
          .maybeSingle();
        dmin = parseInt(sedeDur?.duracion_reserva_minutos, 10) || 90;
      }
      sendReservaConfirmadaWhatsAppTwilio({
        email: row.email,
        nombreFallback: row.nombre,
        fecha: row.fecha,
        hora: row.hora,
        duracionMinutos: dmin,
        nombreSede: row.sede,
      }).catch((err) => console.warn('⚠️ WhatsApp confirmación reserva (PUT):', err.message));
    }

    const scopePut = await adminListScopeFromRequest(req);
    const isAdminReservaPut =
      scopePut &&
      (scopePut.superA ||
        scopePut.rol === 'admin_club' ||
        scopePut.rol === 'empleado' ||
        scopePut.rol === 'admin_nacional' ||
        scopePut.alcance === 'global');
    if (row && isAdminReservaPut) {
      const newEstLc = String(row.estado || '').toLowerCase();
      const oldEstLc = String(prevRow?.estado || '').toLowerCase();
      const becameCancelada = newEstLc === 'cancelada' && oldEstLc !== 'cancelada';

      const fechaCambiada =
        Object.prototype.hasOwnProperty.call(req.body, 'fecha') &&
        fecha !== undefined &&
        String(prevRow?.fecha ?? '').trim() !== String(row?.fecha ?? '').trim();
      const horaCambiada =
        Object.prototype.hasOwnProperty.call(req.body, 'hora') &&
        hora !== undefined &&
        String(prevRow?.hora ?? '').trim() !== String(row?.hora ?? '').trim();

      if (becameCancelada) {
        sendReservaAdminCanceladaWhatsAppTwilio({
          email: row.email || prevRow?.email,
          nombreSede: String(prevRow?.sede || row.sede || '').trim(),
          fecha: prevRow?.fecha,
          hora: prevRow?.hora,
        }).catch((err) => console.warn('⚠️ WhatsApp cancelación admin (PUT):', err.message));
      } else if (fechaCambiada || horaCambiada) {
        sendReservaAdminFechaHoraModificadaWhatsAppTwilio({
          email: row.email,
          nombreSede: String(row.sede || '').trim(),
          fecha: row.fecha,
          hora: row.hora,
        }).catch((err) => console.warn('⚠️ WhatsApp cambio fecha/hora admin (PUT):', err.message));
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE reserva
app.delete('/api/reservas/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const scopeDel = await adminListScopeFromRequest(req);
    const isAdminReservaDel =
      scopeDel &&
      (scopeDel.superA ||
        scopeDel.rol === 'admin_club' ||
        scopeDel.rol === 'empleado' ||
        scopeDel.rol === 'admin_nacional' ||
        scopeDel.alcance === 'global');

    let prevReserva = null;
    if (isAdminReservaDel) {
      const { data: pr, error: prErr } = await supabase.from('reservas').select('*').eq('id', id).maybeSingle();
      if (prErr) throw prErr;
      prevReserva = pr;
    }

    const { error } = await supabase
      .from('reservas')
      .delete()
      .eq('id', id);

    if (error) throw error;

    if (isAdminReservaDel && prevReserva) {
      sendReservaAdminCanceladaWhatsAppTwilio({
        email: prevReserva.email,
        nombreSede: String(prevReserva.sede || '').trim(),
        fecha: prevReserva.fecha,
        hora: prevReserva.hora,
      }).catch((err) => console.warn('⚠️ WhatsApp cancelación admin (DELETE):', err.message));
    }

    res.json({ mensaje: 'Reserva eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Libera turnos ocupados solo por reservas pendientes de pago (manual / MP),
 * para que otro usuario pueda reservar el mismo slot.
 * Body: { sede, fecha, hora, cancha, email? } — si viene email, solo filas con ese email.
 */
app.post('/api/reservas/liberar-slot-pendiente', async (req, res) => {
  try {
    const b = req.body || {};
    const sede = String(b.sede || '').trim();
    const fecha = String(b.fecha || '').trim();
    const hora = String(b.hora || '').trim();
    const cancha = parseInt(String(b.cancha), 10);
    const emailNorm = b.email != null ? String(b.email).trim().toLowerCase() : '';
    if (!sede || !fecha || !hora || !Number.isFinite(cancha)) {
      return res.status(400).json({ error: 'Faltan sede, fecha, hora o cancha' });
    }
    const estadosPend = [
      'pendiente_pago_manual',
      'pendiente_pago_efectivo',
      'pendiente_pago_mercadopago',
      'pendiente_mercadopago',
    ];
    let q = supabase
      .from('reservas')
      .select('id')
      .eq('sede', sede)
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', cancha)
      .in('estado', estadosPend);
    if (emailNorm) {
      q = q.eq('email', emailNorm);
    }
    const { data: rows, error: selErr } = await q;
    if (selErr) throw selErr;
    const ids = (rows || []).map((r) => r.id).filter((id) => id != null);
    if (!ids.length) {
      return res.json({ ok: true, deleted: 0 });
    }
    const { error: delErr } = await supabase.from('reservas').delete().in('id', ids);
    if (delErr) throw delErr;
    res.json({ ok: true, deleted: ids.length });
  } catch (err) {
    console.error('❌ POST /api/reservas/liberar-slot-pendiente:', err?.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ===== GENERADORES DE PARTIDOS =====

function generarRoundRobin(equipos, torneoId, sedeId) {
  const partidos = [];
  for (let i = 0; i < equipos.length; i++) {
    for (let j = i + 1; j < equipos.length; j++) {
      partidos.push({
        torneo_id: parseInt(torneoId),
        equipo_a_id: equipos[i].id,
        equipo_b_id: equipos[j].id,
        sede_id: sedeId || null,
        estado: 'pendiente',
        ronda: 1,
      });
    }
  }
  return partidos;
}

function generarKnockout(equipos, torneoId, sedeId) {
  // Random bracket seeding
  const shuffled = [...equipos].sort(() => Math.random() - 0.5);
  const partidos = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    partidos.push({
      torneo_id: parseInt(torneoId),
      equipo_a_id: shuffled[i].id,
      equipo_b_id: shuffled[i + 1].id,
      sede_id: sedeId || null,
      estado: 'pendiente',
      ronda: 1,
    });
  }
  // If odd number of teams, the last one gets a bye (no match generated for it)
  return partidos;
}

function generarGruposKnockout(equipos, torneoId, sedeId) {
  // Aim for ~4 teams per group, minimum 2 groups
  const numGrupos = Math.max(2, Math.round(equipos.length / 4));
  const grupos = Array.from({ length: numGrupos }, () => []);

  // Snake-draft distribution across groups
  equipos.forEach((eq, idx) => {
    grupos[idx % numGrupos].push(eq);
  });

  const letras = 'ABCDEFGH';
  const partidos = [];

  grupos.forEach((grupo, gIdx) => {
    const letra = letras[gIdx] || `G${gIdx + 1}`;
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        partidos.push({
          torneo_id: parseInt(torneoId),
          equipo_a_id: grupo[i].id,
          equipo_b_id: grupo[j].id,
          sede_id: sedeId || null,
          estado: 'pendiente',
          ronda: 1,
          grupo: letra,
        });
      }
    }
  });

  return partidos;
}

/** Valores válidos en columna `torneos.estado` (alineado con el admin / TorneoCrear). */
function normalizeTorneoEstadoForDb(raw) {
  const e = String(raw ?? '').trim().toLowerCase();
  if (e === 'proximo' || e === 'planificacion') return 'planificacion';
  if (e === 'abierto' || e === 'inscripcion_abierta') return 'abierto';
  if (e === 'en_curso' || e === 'activo') return 'en_curso';
  if (e === 'finalizado') return 'finalizado';
  if (e === 'cancelado') return 'cancelado';
  return null;
}

/** Transiciones permitidas sin rol super_admin (PATCH/PUT estado). */
function torneoTransicionEstadoPermitidaNonSuper(prevDb, nextDb) {
  const p = normalizeTorneoEstadoForDb(prevDb) || 'planificacion';
  const n = normalizeTorneoEstadoForDb(nextDb);
  if (!n) return false;
  if (p === n) return true;
  return (p === 'planificacion' && n === 'abierto') || (p === 'abierto' && n === 'en_curso');
}

/** Body → columna timestamptz o null; `omit` si no vino la clave. */
function normalizeFechaAperturaInscripcionInput(v) {
  if (v === undefined) return { action: 'omit' };
  if (v === null || v === '') return { action: 'set', value: null };
  const d = new Date(String(v).trim());
  if (Number.isNaN(d.getTime())) return { action: 'invalid' };
  return { action: 'set', value: d.toISOString() };
}

function parseTorneoOptionalAmount(value) {
  if (value === undefined) return { action: 'omit' };
  if (value === null || String(value).trim() === '') return { action: 'set', value: null };
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? { action: 'set', value: n } : { action: 'set', value: null };
}

function parseTorneoOptionalInteger(value) {
  if (value === undefined) return { action: 'omit' };
  if (value === null || String(value).trim() === '') return { action: 'set', value: null };
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) && n >= 0 ? { action: 'set', value: n } : { action: 'set', value: null };
}

function normalizeTorneoInscripcionMoneda(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'ARS' || raw === 'USD' || raw === 'EUR') return raw;
  return null;
}

/** Busca dupla: torneo aún no en curso / finalizado y fecha de inicio no pasada (calendario ART). */
function torneoBackendPermiteBuscaDupla(estadoRaw, fechaInicio) {
  if (torneoFechaInicioEsAnteriorAHoyArt(fechaInicio)) return false;
  const n = normalizeTorneoEstadoForDb(estadoRaw);
  if (!n) return false;
  if (n === 'finalizado' || n === 'cancelado' || n === 'en_curso') return false;
  return true;
}

const BUSCA_DUPLA_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buscaDuplaEsUuidValido(s) {
  return BUSCA_DUPLA_UUID_RE.test(String(s || '').trim());
}

async function usuarioEstaEnAlgunEquipoTorneo(torneoIdNum, userId, emailLower) {
  const tid = Number(torneoIdNum);
  const { data: equipos, error } = await supabase
    .from('equipos')
    .select('id, jugadores, creador_id')
    .eq('torneo_id', tid);
  if (error) throw error;
  const uid = userId != null ? String(userId) : '';
  const em = String(emailLower || '').trim().toLowerCase();
  for (const eq of equipos || []) {
    if (uid && String(eq.creador_id || '') === uid) return true;
    const arr = Array.isArray(eq.jugadores) ? eq.jugadores : [];
    for (const j of arr) {
      const jid = j?.id != null && String(j.id).trim() !== '' ? String(j.id) : '';
      if (uid && jid === uid) return true;
      const je = String(j?.email || '').trim().toLowerCase();
      if (em && je && je === em) return true;
    }
  }
  return false;
}

async function obtenerEmailAuthPorUserIdBuscaDupla(userId) {
  const uid = String(userId || '').trim();
  if (!buscaDuplaEsUuidValido(uid)) return null;
  try {
    const { data, error } = await supabase.auth.admin.getUserById(uid);
    if (error || !data?.user?.email) return null;
    return String(data.user.email).trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

async function fetchJugadoresPerfilParaBuscaDupla(userId, emailLower) {
  const uid = String(userId || '').trim();
  let q = await supabase
    .from('jugadores_perfil')
    .select('user_id, email, nombre, apellido, alias, foto_url, whatsapp, nivel')
    .eq('user_id', uid)
    .maybeSingle();
  if (q.error) throw q.error;
  let row = q.data;
  if (!row && emailLower) {
    const q2 = await supabase
      .from('jugadores_perfil')
      .select('user_id, email, nombre, apellido, alias, foto_url, whatsapp, nivel')
      .ilike('email', String(emailLower).trim())
      .maybeSingle();
    if (q2.error) throw q2.error;
    row = q2.data;
  }
  return row;
}

function nombreCompletoDesdePerfilBuscaDupla(perfil) {
  const n = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(' ').trim();
  if (n) return n;
  return String(perfil?.nombre || '').trim() || 'Jugador';
}

function buildJugadorJsonEquipoDupla(perfil, userId, emailAuth, rolTag) {
  const uid = String(userId);
  const em = String(emailAuth || perfil?.email || '').trim();
  const jug = {
    id: uid,
    email: em,
    nombre: nombreCompletoDesdePerfilBuscaDupla(perfil),
    estado: 'confirmado',
    rol: rolTag,
  };
  const aliasTrim = String(perfil?.alias || '').trim();
  if (aliasTrim) jug.alias = aliasTrim;
  const foto = String(perfil?.foto_url || '').trim();
  if (foto) jug.foto_url = foto;
  return jug;
}

async function cancelarInvitacionesPendientesBuscaDuplaTorneo(torneoIdNum, userIds) {
  const ids = [...new Set((userIds || []).map((x) => String(x)).filter(buscaDuplaEsUuidValido))];
  for (const uid of ids) {
    await supabase
      .from('busca_dupla_invitacion')
      .update({ estado: 'cancelada' })
      .eq('torneo_id', torneoIdNum)
      .eq('estado', 'pendiente')
      .or(`from_user_id.eq.${uid},to_user_id.eq.${uid}`);
  }
}

function jugadorRegistradoEnEquipoJsonBuscaDupla(j) {
  if (!j || typeof j !== 'object') return false;
  if (String(j.estado || '').toLowerCase() === 'pendiente') return false;
  if (String(j.email || '').trim()) return true;
  if (j.id != null && String(j.id).trim() !== '') return true;
  return false;
}

function userIdsRegistradosDesdeEquipoRowBuscaDupla(equipoRow) {
  const out = new Set();
  const arr = Array.isArray(equipoRow?.jugadores) ? equipoRow.jugadores : [];
  for (const j of arr) {
    if (!jugadorRegistradoEnEquipoJsonBuscaDupla(j)) continue;
    const jid = j.id != null && String(j.id).trim() !== '' ? String(j.id).trim() : '';
    if (buscaDuplaEsUuidValido(jid)) out.add(jid);
  }
  return [...out];
}

function jugadoresRegistradosCountBuscaDupla(equipoRow) {
  const arr = Array.isArray(equipoRow?.jugadores) ? equipoRow.jugadores : [];
  return arr.filter(jugadorRegistradoEnEquipoJsonBuscaDupla).length;
}

// ===== TORNEOS =====

const TORNEO_GENERO_COMP_VALID = new Set(['masculino', 'femenino', 'mixto']);
const TORNEO_CATEGORIA_EDAD_VALID = new Set(['sub_18', 'open', 'master_40', 'master_50']);

function normalizeTorneoTipoCompetencia(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  return TORNEO_GENERO_COMP_VALID.has(s) ? s : null;
}

function normalizeTorneoCategoriaEdad(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (TORNEO_CATEGORIA_EDAD_VALID.has(s)) return s;
  return null;
}

const TORNEO_DEPORTE_VALID = new Set([
  'padbol',
  'padel',
  'pickleball',
  'squash',
  'tenis',
  'futbol_5',
  'futbol_7',
]);

function normalizeTorneoDeporteForDb(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'futbol5') return 'futbol_5';
  if (s === 'futbol7') return 'futbol_7';
  if (s === 'pádel' || s === 'padel') return 'padel';
  if (TORNEO_DEPORTE_VALID.has(s)) return s;
  return 'padbol';
}

/** Claves DB para canchas_por_deporte / filtro (fútbol genérico → 5 y 7). */
function chatIaDeporteDbKeysForFilter(deporteCanon) {
  const c = String(deporteCanon || '').trim();
  if (!c) return [];
  if (c === '__futbol_any__') return ['futbol_5', 'futbol_7'];
  if (TORNEO_DEPORTE_VALID.has(c)) return [c];
  return [];
}

/** Normaliza el parámetro deporte del tool chat-IA; vacío = sin filtro. */
function normalizeChatIaDeporteToolInput(raw) {
  const s0 = String(raw ?? '').trim();
  if (!s0) return '';
  const s = chatIaFoldText(s0).replace(/\s+/g, ' ').trim();
  if (TORNEO_DEPORTE_VALID.has(s)) return s;
  const t = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\bfutbol\s*7\b|\bf7\b/.test(t)) return 'futbol_7';
  if (/\bfutbol\s*5\b|\bf5\b/.test(t)) return 'futbol_5';
  if (/\bfutbol\b|\bfootball\b|futsal/.test(t)) return '__futbol_any__';
  if (/\bpadel\b|\bpaddle\b/.test(t)) return 'padel';
  if (/\bpadbol\b/.test(t)) return 'padbol';
  if (/\bpickleball\b|\bpickle\b/.test(t)) return 'pickleball';
  if (/\bsquash\b/.test(t)) return 'squash';
  if (/\btenis\b|\btennis\b/.test(t)) return 'tenis';
  return '';
}

/** Plegado del mensaje del usuario para reconocer frases rápidas (sin deporte explícito). */
function chatIaFoldUsuarioDisponibilidadPhrase(raw) {
  let t = chatIaFoldText(String(raw || '').trim());
  t = t.replace(/[''`´]/g, '');
  t = t.replace(/[\uFE0F]/g, '');
  try {
    t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  } catch {
    t = t.replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '');
  }
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/** Mensajes tipo chip "ver horarios hoy" (es/en/pt): no filtrar por deporte aunque el modelo envíe deporte. */
function chatIaShouldOmitDeporteDisponibilidadParaUltimoUsuario(ultimoUsuarioTexto) {
  const k = chatIaFoldUsuarioDisponibilidadPhrase(ultimoUsuarioTexto);
  if (!k) return false;
  return new Set(['ver horarios hoy', 'see todays court times', 'ver horarios hoje']).has(k);
}

/** Sede implícita para consultas genéricas "hoy": página actual > habitual > ninguna. */
function chatIaResolveDisponibilidadSedeImplicita(ctx, clientSedeIdRaw) {
  const sidPage = parseInt(String(clientSedeIdRaw ?? '').trim(), 10);
  if (Number.isFinite(sidPage) && sidPage > 0) {
    const sh = (ctx.sedes_hora_local || []).find((x) => Number(x.sede_id) === sidPage);
    const ymd = sh?.ymd_hoy || ctx.fecha_referencia || null;
    const nombre = chatIaSedeNombreDesdeCtx(ctx, sidPage) || (sh?.nombre ? String(sh.nombre).trim() : '') || null;
    return {
      sede_id: sidPage,
      sede_nombre: nombre,
      fuente: 'pagina_actual',
      ymd_hoy_local: ymd,
    };
  }
  const h = ctx?.usuario_logueado?.sede_habitual;
  const sidH = h?.sede_id != null ? Number(h.sede_id) : NaN;
  if (Number.isFinite(sidH) && sidH > 0) {
    const sh = (ctx.sedes_hora_local || []).find((x) => Number(x.sede_id) === sidH);
    const ymd = sh?.ymd_hoy || ctx.fecha_referencia || null;
    const nombre = String(h.nombre || '').trim() || chatIaSedeNombreDesdeCtx(ctx, sidH) || null;
    return {
      sede_id: sidH,
      sede_nombre: nombre,
      fuente: 'habitual',
      ymd_hoy_local: ymd,
    };
  }
  return { sede_id: null, sede_nombre: null, fuente: 'ninguna', ymd_hoy_local: null };
}

function chatIaPreguntaLugarSinSedeResuelta(loc) {
  if (loc === 'en') return 'Which city or club would you like to play at?';
  if (loc === 'pt') return 'Em qual cidade ou clube você quer jogar?';
  return '¿En qué ciudad o club quieres jugar?';
}

function chatIaFormatHorariosHoyRespuestaLineas(loc, sedeNombre, slots) {
  const nom = String(sedeNombre || '').trim() || 'la sede';
  const arr = Array.isArray(slots) ? slots : [];
  const times = arr.slice(0, 12).map((s) => s.hora_inicio).filter(Boolean);
  if (loc === 'en') {
    if (!times.length) return `No free court slots today at ${nom}.`;
    const more = arr.length > times.length ? ' …' : '';
    return `Today's openings at ${nom}:\n${times.join(', ')}${more}`;
  }
  if (loc === 'pt') {
    if (!times.length) return `Não há horários livres hoje em ${nom}.`;
    const more = arr.length > times.length ? ' …' : '';
    return `Horários livres hoje em ${nom}:\n${times.join(', ')}${more}`;
  }
  if (!times.length) return `No hay turnos libres hoy en ${nom}.`;
  const more = arr.length > times.length ? ' …' : '';
  return `Turnos libres hoy en ${nom}:\n${times.join(', ')}${more}`;
}

async function chatIaFetchCanchasPorDeporteRows(supabaseClient, sedeId) {
  const sid = Number(sedeId);
  if (!Number.isFinite(sid) || sid <= 0) return { rows: [], error: null };
  const { data, error } = await supabaseClient
    .from('canchas_por_deporte')
    .select('deporte, cantidad, activo')
    .eq('sede_id', sid);
  if (error) return { rows: [], error: error.message };
  return { rows: Array.isArray(data) ? data : [], error: null };
}

function chatIaCanchaRowMatchesDeporteKeys(c, keys) {
  const keysSet = new Set(keys);
  const d1 = String(c?.deporte || '').trim() ? normalizeTorneoDeporteForDb(c.deporte) : '';
  const d2 = String(c?.tipo || '').trim() ? normalizeTorneoDeporteForDb(c.tipo) : '';
  if (d1 && keysSet.has(d1)) return true;
  if (d2 && keysSet.has(d2)) return true;
  return false;
}

function chatIaCanchaNombreSugiereDeporte(c, keys) {
  const blob = chatIaFoldText(`${c?.nombre || ''} ${c?.descripcion || ''}`);
  if (!blob.trim()) return false;
  const hayFutbol = keys.includes('futbol_5') || keys.includes('futbol_7');
  if (hayFutbol && /\bfutbol\b|futbol|football|futsal|(^|[^a-z])f5([^a-z]|$)|(^|[^a-z])f7([^a-z]|$)/.test(blob)) return true;
  if (keys.includes('padbol') && /padbol/.test(blob)) return true;
  if (keys.includes('padel') && /padel|paddle/.test(blob)) return true;
  if (keys.includes('tenis') && /tenis|tennis/.test(blob)) return true;
  if (keys.includes('pickleball') && /pickle/.test(blob)) return true;
  if (keys.includes('squash') && /squash/.test(blob)) return true;
  return false;
}

async function chatIaResolveNumerosCanchaParaDeporte(supabaseClient, sedeRow, deporteCanon) {
  const keys = chatIaDeporteDbKeysForFilter(deporteCanon);
  if (!keys.length) return { numeros: null };

  const sid = Number(sedeRow?.id);
  if (!Number.isFinite(sid) || sid <= 0) return { numeros: null };

  const { rows: cpdRows, error: cpdErr } = await chatIaFetchCanchasPorDeporteRows(supabaseClient, sid);
  if (cpdErr) return { numeros: [], error: cpdErr };

  const cpdActive = (cpdRows || []).filter((r) => r.activo !== false && Number(r.cantidad) > 0);
  const cpdForSport = cpdActive.filter((r) => keys.includes(normalizeTorneoDeporteForDb(r.deporte)));
  if (!cpdForSport.length) return { numeros: [] };

  const fullRows = await fetchCanchasRowsForSede(sid);
  const enriched = canchasConNumeroReserva(fullRows);
  const activas = enriched
    .filter((c) => normalizeEstadoCancha(c.estado) === 'activa')
    .sort((a, b) => Number(a.numero_reserva) - Number(b.numero_reserva));

  const fromRow = [];
  for (const c of activas) {
    if (chatIaCanchaRowMatchesDeporteKeys(c, keys)) fromRow.push(Number(c.numero_reserva));
  }
  if (fromRow.length) return { numeros: [...new Set(fromRow)].sort((a, b) => a - b) };

  const nameHits = activas.filter((c) => chatIaCanchaNombreSugiereDeporte(c, keys)).map((c) => Number(c.numero_reserva));
  if (nameHits.length) return { numeros: [...new Set(nameHits)].sort((a, b) => a - b) };

  const orderedCpd = [...cpdActive].sort((a, b) => String(a.deporte || '').localeCompare(String(b.deporte || '')));
  let cursor = 0;
  const byDep = {};
  for (const row of orderedCpd) {
    const dep = normalizeTorneoDeporteForDb(row.deporte);
    let k = Math.max(0, Number(row.cantidad) || 0);
    k = Math.min(k, Math.max(0, activas.length - cursor));
    byDep[dep] = byDep[dep] || [];
    for (let i = 0; i < k; i++) {
      if (cursor < activas.length) byDep[dep].push(Number(activas[cursor++].numero_reserva));
    }
  }
  const merged = [];
  for (const k of keys) merged.push(...(byDep[k] || []));
  const out = [...new Set(merged)].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  return { numeros: out };
}

/** Pickleball / squash / tenis: singles o dobles; fútbol 5/7: equipo fijo; padbol/pádel: dobles. */
function resolveTorneoFormatoEquipoForDb(deporteNorm, formatoRaw) {
  const f = String(formatoRaw || '').trim().toLowerCase();
  if (deporteNorm === 'pickleball' || deporteNorm === 'squash' || deporteNorm === 'tenis') {
    if (f === 'singles' || f === '1v1') return 'singles';
    return 'dobles';
  }
  if (deporteNorm === 'futbol_5') return 'equipo_5';
  if (deporteNorm === 'futbol_7') return 'equipo_7';
  return 'dobles';
}

const MAX_WHATSAPP_JUGADORES_NUEVO_TORNEO = 50;

/**
 * Tras crear un torneo: avisa por WhatsApp (Twilio) a jugadores con sede habitual = sede del torneo,
 * opt-in notificaciones_whatsapp y número cargado. Máx. 50 destinos; no bloquea el POST.
 */
async function notifyJugadoresPerfilSedeNuevoTorneoWhatsApp(torneoRow) {
  try {
    const sedeIdRaw = torneoRow?.sede_id;
    const sedeId = sedeIdRaw != null && sedeIdRaw !== '' ? Number(sedeIdRaw) : null;
    if (!Number.isFinite(sedeId)) return;

    const { data: sedeRow, error: sedeErr } = await supabase
      .from('sedes')
      .select('nombre')
      .eq('id', sedeId)
      .maybeSingle();
    if (sedeErr) {
      console.warn('⚠️ Nuevo torneo WhatsApp: sede', sedeErr.message);
      return;
    }
    const nombreSede = String(sedeRow?.nombre || '').trim() || 'tu club';
    const nombreTorneo = String(torneoRow?.nombre || '').trim() || 'Torneo';
    const fiRaw = torneoRow?.fecha_inicio;
    const fiStr =
      fiRaw != null && String(fiRaw).trim()
        ? String(fiRaw).trim().slice(0, 10)
        : '';
    const fechaTxt = fiStr && /^\d{4}-\d{2}-\d{2}$/.test(fiStr) ? formatFechaReservaConfirmacion(fiStr) : fiStr || '—';

    const body =
      `🏆 ¡Nuevo torneo en ${nombreSede}! ${nombreTorneo} — ${fechaTxt}. Inscríbete en padbolmatch.com`;

    const { data: perfiles, error: jpErr } = await supabase
      .from('jugadores_perfil')
      .select('whatsapp')
      .eq('sede_id', sedeId)
      .eq('notificaciones_whatsapp', true)
      .limit(120);

    if (jpErr) {
      console.warn('⚠️ Nuevo torneo WhatsApp: jugadores_perfil', jpErr.message);
      return;
    }

    const seenTo = new Set();
    let sent = 0;
    for (const p of perfiles || []) {
      if (sent >= MAX_WHATSAPP_JUGADORES_NUEVO_TORNEO) break;
      const raw = p?.whatsapp != null ? String(p.whatsapp).trim() : '';
      if (!raw) continue;
      const toNorm = normalizePhoneToE164ForTwilioWhatsApp(raw);
      if (!toNorm) continue;
      if (seenTo.has(toNorm)) continue;
      seenTo.add(toNorm);
      try {
        await sendTwilioWhatsAppBodyToRaw(raw, body);
        sent += 1;
      } catch (e) {
        console.warn('⚠️ Nuevo torneo WhatsApp envío falló:', e?.message || e);
      }
    }
    if (sent > 0) {
      console.log(`✓ Nuevo torneo ${torneoRow?.id}: WhatsApp a ${sent} jugador(es) (sede ${sedeId})`);
    }
  } catch (e) {
    console.warn('⚠️ notifyJugadoresPerfilSedeNuevoTorneoWhatsApp:', e?.message || e);
  }
}

const CHUNK_JUGADORES_PERFIL_IN = 80;

function recolectarEmailsYUserIdsJugadoresEquiposTorneo(equiposRows) {
  const emails = new Set();
  const userIds = new Set();
  for (const eq of equiposRows || []) {
    const ce = String(eq.creador_email || '').trim().toLowerCase();
    if (ce) emails.add(ce);
    const cid = String(eq.creador_id || '').trim();
    if (cid && buscaDuplaEsUuidValido(cid)) userIds.add(cid);
    const arr = Array.isArray(eq.jugadores) ? eq.jugadores : [];
    for (const j of arr) {
      if (!jugadorRegistradoEnEquipoJsonBuscaDupla(j)) continue;
      const em = String(j.email || '').trim().toLowerCase();
      if (em) emails.add(em);
      const jid = String(j.id || '').trim();
      if (jid && buscaDuplaEsUuidValido(jid)) userIds.add(jid);
    }
  }
  return { emails: [...emails], userIds: [...userIds] };
}

/**
 * Tras publicar fixture (generar-partidos o sorteo de grupos): avisa por WhatsApp a jugadores
 * inscriptos (roster en equipos + creador), usando `jugadores_perfil.whatsapp`. No bloquea la respuesta HTTP.
 */
async function notifyJugadoresInscriptosTorneoFixtureWhatsApp(torneoIdNum) {
  try {
    const tid = parseInt(String(torneoIdNum), 10);
    if (!Number.isFinite(tid)) return;

    const { data: torneoRow, error: tErr } = await supabase.from('torneos').select('nombre').eq('id', tid).maybeSingle();
    if (tErr || !torneoRow) return;

    const nombreTorneo = String(torneoRow.nombre || '').trim() || 'el torneo';
    const body = `🏆 ¡El torneo ${nombreTorneo} ya tiene fixture! Entra a ver tu zona y tus fechas 👉 https://www.padbolmatch.com`;

    const { data: equiposRows, error: eErr } = await supabase
      .from('equipos')
      .select('jugadores, creador_email, creador_id')
      .eq('torneo_id', tid);
    if (eErr || !Array.isArray(equiposRows) || equiposRows.length === 0) return;

    const { emails, userIds } = recolectarEmailsYUserIdsJugadoresEquiposTorneo(equiposRows);
    if (!emails.length && !userIds.length) return;

    const seenDestinos = new Set();
    const enviarSiNuevo = async (rawWa) => {
      const raw = String(rawWa || '').trim();
      if (!raw) return;
      const toNorm = normalizePhoneToE164ForTwilioWhatsApp(raw);
      if (!toNorm || seenDestinos.has(toNorm)) return;
      seenDestinos.add(toNorm);
      try {
        await sendTwilioWhatsAppBodyToRaw(raw, body);
      } catch {
        /* silencioso */
      }
    };

    for (let i = 0; i < emails.length; i += CHUNK_JUGADORES_PERFIL_IN) {
      const chunk = emails.slice(i, i + CHUNK_JUGADORES_PERFIL_IN);
      const { data: rows, error: qErr } = await supabase.from('jugadores_perfil').select('whatsapp').in('email', chunk);
      if (qErr) continue;
      for (const row of rows || []) {
        await enviarSiNuevo(row?.whatsapp);
      }
    }
    for (let i = 0; i < userIds.length; i += CHUNK_JUGADORES_PERFIL_IN) {
      const chunk = userIds.slice(i, i + CHUNK_JUGADORES_PERFIL_IN);
      const { data: rows, error: qErr } = await supabase.from('jugadores_perfil').select('whatsapp').in('user_id', chunk);
      if (qErr) continue;
      for (const row of rows || []) {
        await enviarSiNuevo(row?.whatsapp);
      }
    }
  } catch {
    /* silencioso */
  }
}

app.post('/api/torneos', checkSuscripcionActiva, async (req, res) => {
  try {
    const {
      nombre,
      sede_id,
      nivel_torneo,
      tipo_torneo,
      categoria,
      fecha_inicio,
      fecha_fin,
      cantidad_equipos,
      costo_inscripcion,
      inscripcion_monto,
      inscripcion_moneda,
      premios_descripcion,
      puntos_total,
      cupos_maximos,
      horas_revelar_equipos,
      es_multisede,
      created_by,
      equipos_por_grupo,
      clasificados_por_grupo,
      mejores_terceros_clasificados,
      estado: estadoBody,
      fecha_apertura_inscripcion: fechaAperturaBody,
      tipo_competencia: tipoCompBody,
      genero_competencia: legacyGeneroCompBody,
      tipo_torneo_genero: tipoTorneoGeneroBody,
      categoria_edad: categoriaEdadBody,
      deporte: deporteBody,
      formato_equipo: formatoEquipoBody,
    } = req.body;

    const estadoNorm = normalizeTorneoEstadoForDb(estadoBody);
    const tipoCompRaw =
      tipoCompBody !== undefined
        ? tipoCompBody
        : legacyGeneroCompBody !== undefined
          ? legacyGeneroCompBody
          : tipoTorneoGeneroBody;
    const tipoComp = normalizeTorneoTipoCompetencia(tipoCompRaw) ?? 'masculino';
    const catEdad = normalizeTorneoCategoriaEdad(categoriaEdadBody) ?? 'open';
    const deporteNorm = normalizeTorneoDeporteForDb(deporteBody);
    const formatoEq = resolveTorneoFormatoEquipoForDb(deporteNorm, formatoEquipoBody);

    const row = {
      nombre,
      sede_id: sede_id || null,
      nivel_torneo,
      tipo_torneo,
      categoria: categoria != null && String(categoria).trim() ? String(categoria).trim() : 'Libre',
      tipo_competencia: tipoComp,
      tipo_torneo_genero: tipoComp,
      categoria_edad: catEdad,
      deporte: deporteNorm,
      formato_equipo: formatoEq,
      estado: estadoNorm || 'planificacion',
      fecha_inicio,
      fecha_fin,
      cantidad_equipos,
      es_multisede,
      created_by,
    };
    const montoInscripcionParsed = parseTorneoOptionalAmount(
      inscripcion_monto !== undefined ? inscripcion_monto : costo_inscripcion
    );
    if (montoInscripcionParsed.action === 'set' && montoInscripcionParsed.value != null) {
      row.inscripcion_monto = montoInscripcionParsed.value;
      row.inscripcion_moneda = normalizeTorneoInscripcionMoneda(inscripcion_moneda) || 'ARS';
      row.costo_inscripcion = montoInscripcionParsed.value;
    } else {
      row.inscripcion_monto = null;
      row.inscripcion_moneda = null;
      row.costo_inscripcion = 0;
    }
    row.premios_descripcion =
      premios_descripcion != null && String(premios_descripcion).trim()
        ? String(premios_descripcion).trim()
        : null;
    const puntosParsed = parseTorneoOptionalInteger(puntos_total);
    row.puntos_total = puntosParsed.action === 'set' ? puntosParsed.value : null;
    if (cupos_maximos !== undefined && cupos_maximos !== null && cupos_maximos !== '') {
      const cm = parseInt(String(cupos_maximos), 10);
      row.cupos_maximos = Number.isFinite(cm) && cm > 0 ? cm : null;
    } else {
      row.cupos_maximos = null;
    }
    if (horas_revelar_equipos !== undefined && horas_revelar_equipos !== null && horas_revelar_equipos !== '') {
      const hr = parseInt(String(horas_revelar_equipos), 10);
      row.horas_revelar_equipos = Number.isFinite(hr) && hr >= 0 ? hr : 48;
    } else {
      row.horas_revelar_equipos = 48;
    }
    if (tipo_torneo === 'grupos_knockout') {
      const ep = parseInt(String(equipos_por_grupo), 10);
      const cp = parseInt(String(clasificados_por_grupo), 10);
      const mt = parseInt(String(mejores_terceros_clasificados), 10);
      if (Number.isFinite(ep) && ep > 0) row.equipos_por_grupo = ep;
      if (Number.isFinite(cp) && cp >= 0) row.clasificados_por_grupo = cp;
      if (Number.isFinite(mt) && mt >= 0) row.mejores_terceros_clasificados = mt;
    }

    const fap = normalizeFechaAperturaInscripcionInput(fechaAperturaBody);
    if (fap.action === 'invalid') {
      return res.status(400).json({ error: 'fecha_apertura_inscripcion inválida' });
    }
    if (fap.action === 'set') {
      row.fecha_apertura_inscripcion = fap.value;
    }

    const { data, error } = await supabase
      .from('torneos')
      .insert([row])
      .select();

    if (error) throw error;
    const inserted = Array.isArray(data) ? data[0] : data;
    if (inserted?.id && String(inserted.estado || '').toLowerCase() === 'abierto') {
      scheduleNotifyListaEsperaInscripcionAbierta(inserted.id);
    }
    void notifyJugadoresPerfilSedeNuevoTorneoWhatsApp(inserted).catch((e) =>
      console.warn('⚠️ Nuevo torneo WhatsApp (async):', e?.message || e),
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/torneos', async (req, res) => {
  try {
    const scope = await adminListScopeFromRequest(req);
    const logLine = scope
      ? { rol: scope.rol, alcance: scope.alcance, email: scope.email, sedeId: scope.sedeId }
      : { rol: null, alcance: null, email: null, sedeId: null };
    console.log('GET /torneos:', logLine);

    let query = supabase.from('torneos').select('*');

    if (scope) {
      if (scope.superA || scope.alcance === 'global') {
        // sin filtro
      } else if (scope.rol === 'admin_club' || scope.rol === 'admin_nacional' || scope.rol === 'empleado') {
        const allowed = await sedesPermitidasPorScope(scope);
        const ids = (allowed.sedes || [])
          .map((s) => s?.id)
          .filter((id) => id != null);
        if (!ids.length) return res.json([]);
        query = query.in('sede_id', ids);
      } else {
        return res.json([]);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/torneos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('torneos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/torneos/confirmar-inscripcion — marca inscripción del equipo como confirmada (tras pago MP)
app.post('/api/torneos/confirmar-inscripcion', async (req, res) => {
  try {
    const { equipo_id, torneo_id } = req.body || {};
    const eid = parseInt(String(equipo_id), 10);
    const tid = parseInt(String(torneo_id), 10);
    if (!eid || !tid) {
      return res.status(400).json({ error: 'equipo_id y torneo_id son requeridos' });
    }

    const { data: eq, error: errEq } = await supabase
      .from('equipos')
      .select('id, torneo_id, nombre, jugadores, creador_id, creador_email, inscripcion_estado')
      .eq('id', eid)
      .maybeSingle();

    if (errEq) throw errEq;
    if (!eq) return res.status(404).json({ error: 'Equipo no encontrado' });
    if (Number(eq.torneo_id) !== tid) {
      return res.status(400).json({ error: 'El equipo no pertenece a ese torneo' });
    }

    if (String(eq.inscripcion_estado || '').toLowerCase() === 'confirmado') {
      return res.json({ ok: true, already: true });
    }

    const { data: torneoRow, error: errTorneo } = await supabase
      .from('torneos')
      .select('id, nombre, fecha_inicio')
      .eq('id', tid)
      .maybeSingle();
    if (errTorneo) throw errTorneo;
    if (!torneoRow) return res.status(404).json({ error: 'Torneo no encontrado' });
    if (torneoFechaInicioEsAnteriorAHoyArt(torneoRow.fecha_inicio)) {
      return res.status(400).json({ error: MSG_TORNEO_INSCRIPCION_FECHA_PASADA });
    }

    const { error: errUp } = await supabase
      .from('equipos')
      .update({ inscripcion_estado: 'confirmado' })
      .eq('id', eid);

    if (errUp) throw errUp;
    await sendInscripcionTorneoMakeEvent({ equipoId: eid, torneoId: tid });
    void crearNotificacionesEquipoTorneo(eq, {
      tipo: 'torneo_inscripcion_confirmada',
      titulo: 'Inscripción confirmada',
      mensaje: `Tu inscripción al torneo ${String(torneoRow.nombre || 'seleccionado').trim()} quedó confirmada.`,
      link: `/torneo/${tid}`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /api/torneos/confirmar-inscripcion:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** WhatsApp al capitán cuando el equipo completa cupo (inscripción pendiente de pago). */
app.post('/api/torneos/notificar-equipo-completo', async (req, res) => {
  try {
    const { equipo_id, torneo_id } = req.body || {};
    const eid = parseInt(String(equipo_id), 10);
    const tid = parseInt(String(torneo_id), 10);
    if (!eid || !tid) {
      return res.status(400).json({ error: 'equipo_id y torneo_id son requeridos' });
    }

    const { data: eq, error: errEq } = await supabase
      .from('equipos')
      .select('id, torneo_id, nombre, jugadores, cupo_maximo, cupo, creador_id, creador_email')
      .eq('id', eid)
      .maybeSingle();

    if (errEq) throw errEq;
    if (!eq || Number(eq.torneo_id) !== tid) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const cupo = Number(eq.cupo_maximo || eq.cupo || 2);
    const players = Array.isArray(eq.jugadores) ? eq.jugadores : [];
    if (players.length < cupo) {
      return res.status(400).json({ error: 'El equipo aún no está completo' });
    }

    const nombreEquipo = String(eq.nombre || 'tu equipo').trim();
    const body = `🏆 Tu equipo ${nombreEquipo} está completo. Confirma el cupo pagando la inscripción en padbolmatch.com`;

    let whatsappDest = '';
    const creadorUid = eq.creador_id != null && String(eq.creador_id).trim() !== '' ? String(eq.creador_id).trim() : '';
    if (creadorUid) {
      const { data: perfil } = await supabase
        .from('jugadores_perfil')
        .select('whatsapp')
        .eq('user_id', creadorUid)
        .maybeSingle();
      whatsappDest = perfil?.whatsapp != null ? String(perfil.whatsapp).trim() : '';
    }
    if (!whatsappDest && eq.creador_email) {
      whatsappDest = (await fetchJugadorWhatsappPorEmail(eq.creador_email)) || '';
    }
    if (!whatsappDest) {
      return res.json({ ok: true, skipped: true, reason: 'no_whatsapp_capitan' });
    }

    let permiteNotifTorneoPromo = false;
    if (creadorUid) {
      permiteNotifTorneoPromo = await jugadorAceptaNotificacionesTorneoPromoPorUserId(creadorUid);
    }
    if (!permiteNotifTorneoPromo && eq.creador_email) {
      permiteNotifTorneoPromo = await jugadorAceptaNotificacionesTorneoPromoPorEmail(eq.creador_email);
    }
    if (!permiteNotifTorneoPromo) {
      return res.json({ ok: true, skipped: true, reason: 'notificaciones_whatsapp_off' });
    }

    await sendTwilioWhatsAppBodyToRaw(whatsappDest, body);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /api/torneos/notificar-equipo-completo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const MIN_EQUIPOS_INSCRIPCION_CONFIRMADA_PARA_EN_CURSO = 2;

/**
 * Condiciones para pasar un torneo a `en_curso` vía PATCH/PUT (no aplica a generar-partidos / sorteo).
 * @returns {{ ok: boolean, equipos_confirmados_count: number, partidos_count: number, mensaje: string }}
 */
async function requisitosParaPasarTorneoAEnCurso(torneoId) {
  const tid = parseInt(String(torneoId), 10);
  if (!Number.isFinite(tid)) {
    return {
      ok: false,
      equipos_confirmados_count: 0,
      partidos_count: 0,
      mensaje: 'Identificador de torneo inválido.',
    };
  }

  const { data: equipos, error: eEq } = await supabase
    .from('equipos')
    .select('id, inscripcion_estado')
    .eq('torneo_id', tid);
  if (eEq) throw eEq;

  const equipos_confirmados_count = (equipos || []).filter(
    (eq) => String(eq.inscripcion_estado || '').toLowerCase() === 'confirmado',
  ).length;

  const { count, error: ePt } = await supabase
    .from('partidos')
    .select('id', { count: 'exact', head: true })
    .eq('torneo_id', tid);
  if (ePt) throw ePt;
  const partidos_count = typeof count === 'number' ? count : 0;

  const faltas = [];
  if (equipos_confirmados_count < MIN_EQUIPOS_INSCRIPCION_CONFIRMADA_PARA_EN_CURSO) {
    faltas.push(
      `Se requieren al menos ${MIN_EQUIPOS_INSCRIPCION_CONFIRMADA_PARA_EN_CURSO} equipos con inscripción confirmada (hay ${equipos_confirmados_count}).`,
    );
  }
  if (partidos_count < 1) {
    faltas.push(
      'No hay partidos generados. Realiza el sorteo de grupos o genera el fixture antes de iniciar el torneo.',
    );
  }

  const ok = faltas.length === 0;
  return {
    ok,
    equipos_confirmados_count,
    partidos_count,
    mensaje: ok ? '' : faltas.join(' '),
  };
}

/** Encola avisos WA a lista de espera; no bloquea el hilo del request. */
function scheduleNotifyListaEsperaInscripcionAbierta(torneoId) {
  setImmediate(() => {
    void notifyListaEsperaInscripcionAbiertaJob(torneoId);
  });
}

/**
 * Jugadores en lista_espera_torneos que aún no recibieron el aviso de apertura.
 * Mensaje alineado al copy de producto; marca fila tras envío exitoso (idempotencia).
 */
async function notifyListaEsperaInscripcionAbiertaJob(torneoId) {
  try {
    const tid = parseInt(String(torneoId), 10);
    if (!Number.isFinite(tid)) return;

    const { data: torneoRow, error: tErr } = await supabase
      .from('torneos')
      .select('id, nombre, sede_id')
      .eq('id', tid)
      .maybeSingle();
    if (tErr) {
      console.warn('notify lista espera: torneo', tErr.message);
      return;
    }
    if (!torneoRow) return;

    let nombreSede = 'tu sede';
    if (torneoRow.sede_id != null) {
      const { data: sedeRow } = await supabase
        .from('sedes')
        .select('nombre')
        .eq('id', torneoRow.sede_id)
        .maybeSingle();
      if (sedeRow?.nombre) nombreSede = String(sedeRow.nombre).trim();
    }

    const { data: rows, error } = await supabase
      .from('lista_espera_torneos')
      .select('id, email, nombre, whatsapp')
      .eq('torneo_id', tid)
      .is('inscripcion_abierta_notificado_at', null);
    if (error) {
      console.warn('lista_espera_torneos select:', error.message);
      return;
    }
    if (!rows?.length) return;

    const nombreTorneo = String(torneoRow.nombre || 'el torneo').trim();
    const body =
      `🏆 ¡La inscripción para ${nombreTorneo} en ${nombreSede} ya está abierta! ` +
      'Entra a padbolmatch.com para inscribirte con tu compañero. Cupos limitados.';

    for (const row of rows) {
      let dest = String(row?.whatsapp || '').trim();
      if (!dest && row?.email) {
        dest = (await fetchJugadorWhatsappPorEmail(row.email)) || '';
      }
      if (!dest) continue;
      try {
        await sendTwilioWhatsAppBodyToRaw(dest, body);
        const { error: upErr } = await supabase
          .from('lista_espera_torneos')
          .update({ inscripcion_abierta_notificado_at: new Date().toISOString() })
          .eq('id', row.id);
        if (upErr) console.warn('lista_espera notificado_at update:', row.id, upErr.message);
      } catch (e) {
        console.warn('WhatsApp lista espera fila', row?.id, e?.message || e);
      }
    }
  } catch (e) {
    console.warn('notifyListaEsperaInscripcionAbiertaJob:', e?.message || e);
  }
}

async function handleTorneoPatchOrPut(req, res) {
  try {
    const { id } = req.params;
    const {
      nombre,
      nivel_torneo,
      tipo_torneo,
      categoria,
      estado,
      fecha_inicio,
      fecha_fin,
      cupos_maximos,
      horas_revelar_equipos,
      costo_inscripcion,
      inscripcion_monto,
      inscripcion_moneda,
      premios_descripcion,
      puntos_total,
      fecha_apertura_inscripcion: fechaAperturaPatch,
      tipo_competencia: tipoCompetenciaPatch,
      genero_competencia: legacyGeneroCompPatch,
      tipo_torneo_genero: tipoTorneoGeneroPatch,
      categoria_edad: categoriaEdadPatch,
      deporte,
      formato_equipo: formatoEquipoPatch,
    } = req.body;

    const { data: prevRow, error: prevErr } = await supabase
      .from('torneos')
      .select('estado, nombre, deporte, formato_equipo')
      .eq('id', id)
      .maybeSingle();
    if (prevErr) throw prevErr;

    const patch = { updated_at: new Date() };
    if (nombre !== undefined) patch.nombre = nombre;
    if (nivel_torneo !== undefined) patch.nivel_torneo = nivel_torneo;
    if (tipo_torneo !== undefined) patch.tipo_torneo = tipo_torneo;
    if (categoria !== undefined) {
      patch.categoria =
        categoria != null && String(categoria).trim() ? String(categoria).trim() : 'Libre';
    }
    if (estado !== undefined) {
      const rawEst = String(estado ?? '').trim();
      const estNorm = normalizeTorneoEstadoForDb(estado);
      if (rawEst && !estNorm) {
        return res.status(400).json({ error: 'Estado de torneo inválido' });
      }
      if (estNorm) {
        const prevNorm = normalizeTorneoEstadoForDb(prevRow?.estado) || 'planificacion';
        if (estNorm !== prevNorm) {
          const user = await authUserFromBearer(req);
          if (!user?.email) {
            return res.status(401).json({ error: 'Autenticación requerida para cambiar el estado del torneo' });
          }
          const rowRole = await fetchUserRoleRow(user.email);
          const superA = isSuperAdminApi(user.email, rowRole?.role);
          if (!superA && !torneoTransicionEstadoPermitidaNonSuper(prevNorm, estNorm)) {
            return res.status(403).json({ error: 'Transición de estado no permitida' });
          }
          if (estNorm === 'en_curso' && prevNorm !== 'en_curso') {
            let reqIni;
            try {
              reqIni = await requisitosParaPasarTorneoAEnCurso(id);
            } catch (e) {
              console.error('[torneo] requisitos en_curso:', e?.message || e);
              return res.status(500).json({ error: e?.message || 'Error al validar requisitos del torneo' });
            }
            if (!reqIni.ok) {
              return res.status(400).json({
                error: reqIni.mensaje,
                iniciar_torneo: {
                  equipos_confirmados: reqIni.equipos_confirmados_count,
                  min_equipos_confirmados: MIN_EQUIPOS_INSCRIPCION_CONFIRMADA_PARA_EN_CURSO,
                  partidos_generados: reqIni.partidos_count,
                },
              });
            }
          }
          patch.estado = estNorm;
        }
      }
    }
    if (fecha_inicio !== undefined) patch.fecha_inicio = fecha_inicio;
    if (fecha_fin !== undefined) patch.fecha_fin = fecha_fin;
    if (cupos_maximos !== undefined) {
      if (cupos_maximos === null || cupos_maximos === '') {
        patch.cupos_maximos = null;
      } else {
        const cm = parseInt(String(cupos_maximos), 10);
        patch.cupos_maximos = Number.isFinite(cm) && cm > 0 ? cm : null;
      }
    }
    if (horas_revelar_equipos !== undefined && horas_revelar_equipos !== null && horas_revelar_equipos !== '') {
      const hr = parseInt(String(horas_revelar_equipos), 10);
      if (Number.isFinite(hr) && hr >= 0) patch.horas_revelar_equipos = hr;
    }
    if (inscripcion_monto !== undefined || costo_inscripcion !== undefined) {
      const montoParsed = parseTorneoOptionalAmount(
        inscripcion_monto !== undefined ? inscripcion_monto : costo_inscripcion
      );
      if (montoParsed.action === 'set') {
        patch.inscripcion_monto = montoParsed.value;
        patch.costo_inscripcion = montoParsed.value != null ? montoParsed.value : 0;
        patch.inscripcion_moneda =
          montoParsed.value != null
            ? normalizeTorneoInscripcionMoneda(inscripcion_moneda) || 'ARS'
            : null;
      }
    } else if (inscripcion_moneda !== undefined) {
      patch.inscripcion_moneda = normalizeTorneoInscripcionMoneda(inscripcion_moneda);
    }
    if (premios_descripcion !== undefined) {
      const premios = String(premios_descripcion || '').trim();
      patch.premios_descripcion = premios || null;
    }
    if (puntos_total !== undefined) {
      const puntosParsed = parseTorneoOptionalInteger(puntos_total);
      if (puntosParsed.action === 'set') patch.puntos_total = puntosParsed.value;
    }
    if (fechaAperturaPatch !== undefined) {
      const fap = normalizeFechaAperturaInscripcionInput(fechaAperturaPatch);
      if (fap.action === 'invalid') {
        return res.status(400).json({ error: 'fecha_apertura_inscripcion inválida' });
      }
      if (fap.action === 'set') {
        patch.fecha_apertura_inscripcion = fap.value;
      }
    }
    if (tipoCompetenciaPatch !== undefined || legacyGeneroCompPatch !== undefined || tipoTorneoGeneroPatch !== undefined) {
      const raw =
        tipoCompetenciaPatch !== undefined
          ? tipoCompetenciaPatch
          : legacyGeneroCompPatch !== undefined
            ? legacyGeneroCompPatch
            : tipoTorneoGeneroPatch;
      if (raw === null || raw === '') {
        patch.tipo_competencia = null;
        patch.tipo_torneo_genero = null;
      } else {
        const g = normalizeTorneoTipoCompetencia(raw);
        if (!g) {
          return res.status(400).json({ error: 'tipo_competencia inválido (masculino, femenino, mixto)' });
        }
        patch.tipo_competencia = g;
        patch.tipo_torneo_genero = g;
      }
    }
    if (categoriaEdadPatch !== undefined) {
      if (categoriaEdadPatch === null || categoriaEdadPatch === '') {
        patch.categoria_edad = null;
      } else {
        const ce = normalizeTorneoCategoriaEdad(categoriaEdadPatch);
        if (!ce) {
          return res.status(400).json({ error: 'categoria_edad inválida (sub_18, open, master_40, master_50)' });
        }
        patch.categoria_edad = ce;
      }
    }
    if (deporte !== undefined || formatoEquipoPatch !== undefined) {
      const dep = normalizeTorneoDeporteForDb(deporte !== undefined ? deporte : prevRow?.deporte);
      if (deporte !== undefined) patch.deporte = dep;
      const fmtSrc = formatoEquipoPatch !== undefined ? formatoEquipoPatch : prevRow?.formato_equipo;
      patch.formato_equipo = resolveTorneoFormatoEquipoForDb(dep, fmtSrc);
    }

    const { data, error } = await supabase.from('torneos').update(patch).eq('id', id).select();

    if (error) throw error;
    const row0 = Array.isArray(data) ? data[0] : null;
    const newEst = String(row0?.estado ?? '').toLowerCase();
    const oldNorm = normalizeTorneoEstadoForDb(prevRow?.estado) || 'planificacion';
    if (patch.estado !== undefined && newEst === 'abierto' && oldNorm === 'planificacion') {
      scheduleNotifyListaEsperaInscripcionAbierta(id);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.put('/api/torneos/:id', handleTorneoPatchOrPut);
app.patch('/api/torneos/:id', handleTorneoPatchOrPut);

/** ¿El usuario autenticado ya está en lista de espera del torneo? */
app.get('/api/torneos/:id/lista-espera/me', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { data, error } = await supabase
      .from('lista_espera_torneos')
      .select('id')
      .eq('torneo_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    res.json({ enrolled: Boolean(data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Anotarse en lista de espera (torneo en planificación / próximo). */
app.post('/api/torneos/:id/lista-espera', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const email = String(user.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const { data: torneoRow, error: tErr } = await supabase
      .from('torneos')
      .select('id, estado, nombre, fecha_inicio')
      .eq('id', id)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!torneoRow) return res.status(404).json({ error: 'Torneo no encontrado' });
    if (torneoFechaInicioEsAnteriorAHoyArt(torneoRow.fecha_inicio)) {
      return res.status(400).json({ error: MSG_TORNEO_INSCRIPCION_FECHA_PASADA });
    }
    const te = String(torneoRow.estado || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (te !== 'planificacion' && te !== 'proximo') {
      return res.status(400).json({ error: 'La lista de espera solo aplica antes de abrir inscripción' });
    }

    const bodyWa = req.body?.whatsapp != null ? String(req.body.whatsapp).trim() : '';

    let { data: perfil, error: pErr } = await supabase
      .from('jugadores_perfil')
      .select('nombre, whatsapp, user_id')
      .eq('email', email)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!perfil?.nombre && user.id) {
      const r2 = await supabase
        .from('jugadores_perfil')
        .select('nombre, whatsapp, user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!r2.error && r2.data) perfil = r2.data;
    }
    const nombre = perfil?.nombre != null ? String(perfil.nombre).trim() : '';
    const whatsappDb = perfil?.whatsapp != null ? String(perfil.whatsapp).trim() : '';
    const whatsapp = bodyWa || whatsappDb;

    const { data: exist } = await supabase
      .from('lista_espera_torneos')
      .select('id')
      .eq('torneo_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (exist) {
      return res.json({ ok: true, already: true });
    }

    const { error: insErr } = await supabase.from('lista_espera_torneos').insert({
      torneo_id: id,
      user_id: user.id,
      email,
      nombre: nombre || null,
      whatsapp: whatsapp || null,
    });
    if (insErr) {
      if (String(insErr.code) === '23505') {
        return res.json({ ok: true, already: true });
      }
      throw insErr;
    }
    res.json({ ok: true, already: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Busca dupla (por torneo) ─────────────────────────────────────────────

/** Listado público: jugadores anotados en busca dupla + datos de perfil. */
app.get('/api/torneos/:id/busca-dupla', async (req, res) => {
  try {
    const tid = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(tid)) return res.status(400).json({ error: 'ID inválido' });

    const { data: rows, error } = await supabase
      .from('busca_dupla_torneo')
      .select('user_id, created_at')
      .eq('torneo_id', tid)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const uids = [...new Set((rows || []).map((r) => String(r.user_id)).filter(buscaDuplaEsUuidValido))];
    let perfilByUser = {};
    if (uids.length) {
      const { data: perfiles, error: pErr } = await supabase
        .from('jugadores_perfil')
        .select('user_id, nombre, apellido, alias, foto_url, whatsapp, nivel, lateralidad')
        .in('user_id', uids);
      if (pErr) throw pErr;
      (perfiles || []).forEach((p) => {
        if (p?.user_id) perfilByUser[String(p.user_id)] = p;
      });
    }

    const list = (rows || []).map((r) => {
      const uid = String(r.user_id);
      const perfil = perfilByUser[uid] || null;
      const wa = perfil?.whatsapp != null ? String(perfil.whatsapp).trim() : '';
      return {
        user_id: uid,
        created_at: r.created_at,
        nombre: perfil ? nombreCompletoDesdePerfilBuscaDupla(perfil) : null,
        apellido: perfil?.apellido != null ? String(perfil.apellido).trim() : '',
        alias: perfil?.alias != null ? String(perfil.alias).trim() : '',
        foto_url: perfil?.foto_url != null ? String(perfil.foto_url).trim() : '',
        categoria: perfil?.nivel != null ? String(perfil.nivel).trim() : '',
        lateralidad: perfil?.lateralidad != null ? String(perfil.lateralidad).trim() : '',
        whatsapp: wa || null,
      };
    });

    res.json(list);
  } catch (err) {
    const msg = String(err?.message || err);
    if (/busca_dupla_torneo|Could not find|schema cache|PGRST205|42P01/i.test(msg)) {
      return res.status(503).json({
        error:
          'Falta la tabla busca_dupla_torneo. Ejecutá padbol-backend/sql/busca_dupla_torneo.sql en Supabase.',
        code: 'BUSCA_DUPLA_TABLE_MISSING',
      });
    }
    res.status(500).json({ error: msg });
  }
});

app.get('/api/torneos/:id/busca-dupla/me', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const tid = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(tid)) return res.status(400).json({ error: 'ID inválido' });

    const { data, error } = await supabase
      .from('busca_dupla_torneo')
      .select('user_id, created_at')
      .eq('torneo_id', tid)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    res.json({ enrolled: Boolean(data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/torneos/:id/busca-dupla', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const email = String(user.email || '').trim().toLowerCase();
    const tid = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(tid)) return res.status(400).json({ error: 'ID inválido' });

    const { data: torneoRow, error: tErr } = await supabase
      .from('torneos')
      .select('id, estado, fecha_inicio')
      .eq('id', tid)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!torneoRow) return res.status(404).json({ error: 'Torneo no encontrado' });
    if (!torneoBackendPermiteBuscaDupla(torneoRow.estado, torneoRow.fecha_inicio)) {
      return res.status(400).json({ error: 'Este torneo no admite buscar dupla en este momento' });
    }

    if (await usuarioEstaEnAlgunEquipoTorneo(tid, user.id, email)) {
      return res.status(400).json({ error: 'Ya tienes equipo en este torneo' });
    }

    const { error: insErr } = await supabase.from('busca_dupla_torneo').insert({
      torneo_id: tid,
      user_id: user.id,
    });
    if (insErr) {
      if (String(insErr.code) === '23505') {
        return res.json({ ok: true, already: true });
      }
      throw insErr;
    }
    res.json({ ok: true, already: false });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/busca_dupla_torneo|Could not find|schema cache|PGRST205|42P01/i.test(msg)) {
      return res.status(503).json({
        error:
          'Falta la tabla busca_dupla_torneo. Ejecutá padbol-backend/sql/busca_dupla_torneo.sql en Supabase.',
        code: 'BUSCA_DUPLA_TABLE_MISSING',
      });
    }
    res.status(500).json({ error: msg });
  }
});

app.delete('/api/torneos/:id/busca-dupla/me', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const tid = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(tid)) return res.status(400).json({ error: 'ID inválido' });

    const { error } = await supabase
      .from('busca_dupla_torneo')
      .delete()
      .eq('torneo_id', tid)
      .eq('user_id', user.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/torneos/:id/busca-dupla/invitaciones', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const tid = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(tid)) return res.status(400).json({ error: 'ID inválido' });
    const uid = String(user.id);

    const { data: rows, error } = await supabase
      .from('busca_dupla_invitacion')
      .select('id, torneo_id, from_user_id, to_user_id, estado, created_at')
      .eq('torneo_id', tid)
      .eq('estado', 'pendiente')
      .or(`from_user_id.eq.${uid},to_user_id.eq.${uid}`);
    if (error) throw error;

    const otros = new Set();
    (rows || []).forEach((r) => {
      if (String(r.from_user_id) === uid) otros.add(String(r.to_user_id));
      else otros.add(String(r.from_user_id));
    });
    const otroList = [...otros].filter(buscaDuplaEsUuidValido);
    let perfilByUser = {};
    if (otroList.length) {
      const { data: perfiles, error: pErr } = await supabase
        .from('jugadores_perfil')
        .select('user_id, nombre, apellido, alias, foto_url')
        .in('user_id', otroList);
      if (pErr) throw pErr;
      (perfiles || []).forEach((p) => {
        if (p?.user_id) perfilByUser[String(p.user_id)] = p;
      });
    }

    const enrich = (otroId) => {
      const p = perfilByUser[String(otroId)] || null;
      return {
        otro_user_id: String(otroId),
        otro_nombre: p ? nombreCompletoDesdePerfilBuscaDupla(p) : null,
        otro_alias: p?.alias != null ? String(p.alias).trim() : '',
        otro_foto_url: p?.foto_url != null ? String(p.foto_url).trim() : '',
      };
    };

    const recibidas = (rows || [])
      .filter((r) => String(r.to_user_id) === uid)
      .map((r) => ({
        id: r.id,
        from_user_id: String(r.from_user_id),
        created_at: r.created_at,
        ...enrich(r.from_user_id),
      }));
    const enviadas = (rows || [])
      .filter((r) => String(r.from_user_id) === uid)
      .map((r) => ({
        id: r.id,
        to_user_id: String(r.to_user_id),
        created_at: r.created_at,
        ...enrich(r.to_user_id),
      }));

    res.json({ recibidas, enviadas });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/busca_dupla_invitacion|Could not find|schema cache|PGRST205|42P01/i.test(msg)) {
      return res.status(503).json({
        error:
          'Falta la tabla busca_dupla_invitacion. Ejecutá padbol-backend/sql/busca_dupla_torneo.sql en Supabase.',
        code: 'BUSCA_DUPLA_TABLE_MISSING',
      });
    }
    res.status(500).json({ error: msg });
  }
});

app.post('/api/torneos/:id/busca-dupla/invitar', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const email = String(user.email || '').trim().toLowerCase();
    const tid = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(tid)) return res.status(400).json({ error: 'ID inválido' });
    const toRaw = req.body?.to_user_id ?? req.body?.user_id;
    const toUid = String(toRaw || '').trim();
    if (!buscaDuplaEsUuidValido(toUid)) return res.status(400).json({ error: 'to_user_id inválido' });
    if (toUid === String(user.id)) return res.status(400).json({ error: 'No puedes invitarte a ti mismo' });

    const { data: torneoRow, error: tErr } = await supabase
      .from('torneos')
      .select('id, estado, fecha_inicio')
      .eq('id', tid)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!torneoRow) return res.status(404).json({ error: 'Torneo no encontrado' });
    if (!torneoBackendPermiteBuscaDupla(torneoRow.estado, torneoRow.fecha_inicio)) {
      return res.status(400).json({ error: 'Este torneo no admite invitaciones de dupla ahora' });
    }

    if (await usuarioEstaEnAlgunEquipoTorneo(tid, user.id, email)) {
      return res.status(400).json({ error: 'Ya tienes equipo en este torneo' });
    }
    if (await usuarioEstaEnAlgunEquipoTorneo(tid, toUid, null)) {
      return res.status(400).json({ error: 'Ese jugador ya tiene equipo en este torneo' });
    }

    const { data: yoBusco } = await supabase
      .from('busca_dupla_torneo')
      .select('user_id')
      .eq('torneo_id', tid)
      .eq('user_id', user.id)
      .maybeSingle();
    const { data: elOtroBusca } = await supabase
      .from('busca_dupla_torneo')
      .select('user_id')
      .eq('torneo_id', tid)
      .eq('user_id', toUid)
      .maybeSingle();
    if (!yoBusco || !elOtroBusca) {
      return res.status(400).json({ error: 'Ambos tienen que estar en “busco dupla” para este torneo' });
    }

    const { data: exist } = await supabase
      .from('busca_dupla_invitacion')
      .select('id, estado')
      .eq('torneo_id', tid)
      .eq('from_user_id', user.id)
      .eq('to_user_id', toUid)
      .maybeSingle();
    if (exist && String(exist.estado) === 'pendiente') {
      return res.json({ ok: true, invitation_id: exist.id, existing: true });
    }

    const { data: inserted, error: insErr } = await supabase
      .from('busca_dupla_invitacion')
      .insert({
        torneo_id: tid,
        from_user_id: user.id,
        to_user_id: toUid,
        estado: 'pendiente',
      })
      .select('id')
      .maybeSingle();
    if (insErr) {
      if (String(insErr.code) === '23505') {
        const { data: ex2 } = await supabase
          .from('busca_dupla_invitacion')
          .select('id')
          .eq('torneo_id', tid)
          .eq('from_user_id', user.id)
          .eq('to_user_id', toUid)
          .maybeSingle();
        return res.json({ ok: true, invitation_id: ex2?.id, existing: true });
      }
      throw insErr;
    }
    try {
      const [{ data: tNom }, { data: perfilFrom }] = await Promise.all([
        supabase.from('torneos').select('nombre').eq('id', tid).maybeSingle(),
        supabase.from('jugadores_perfil').select('nombre, apellido, apodo').eq('user_id', user.id).maybeSingle(),
      ]);
      const nombreTorneo = String(tNom?.nombre || 'el torneo').trim();
      const nomInv =
        String(perfilFrom?.apodo || '').trim() ||
        [perfilFrom?.nombre, perfilFrom?.apellido].map((v) => String(v || '').trim()).filter(Boolean).join(' ') ||
        String(email || '').split('@')[0] ||
        'Un jugador';
      void crearNotificacionJugador({
        userId: toUid,
        tipo: 'invitacion_torneo_dupla',
        titulo: 'Invitación a formar equipo',
        mensaje: `${nomInv} te invitó a armar equipo en ${nombreTorneo}.`,
        link: `/torneo/${tid}/equipos`,
      });
    } catch {
      /* no bloquear invitación si falla la notificación in-app */
    }
    res.json({ ok: true, invitation_id: inserted?.id, existing: false });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/busca_dupla_invitacion|Could not find|schema cache|PGRST205|42P01/i.test(msg)) {
      return res.status(503).json({
        error:
          'Falta la tabla busca_dupla_invitacion. Ejecutá padbol-backend/sql/busca_dupla_torneo.sql en Supabase.',
        code: 'BUSCA_DUPLA_TABLE_MISSING',
      });
    }
    res.status(500).json({ error: msg });
  }
});

app.post('/api/torneos/:id/busca-dupla/invitaciones/:invId/aceptar', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const emailInv = String(user.email || '').trim().toLowerCase();
    const tid = parseInt(String(req.params.id), 10);
    const invId = parseInt(String(req.params.invId), 10);
    if (!Number.isFinite(tid) || !Number.isFinite(invId)) return res.status(400).json({ error: 'ID inválido' });

    const { data: inv, error: iErr } = await supabase
      .from('busca_dupla_invitacion')
      .select('id, torneo_id, from_user_id, to_user_id, estado')
      .eq('id', invId)
      .maybeSingle();
    if (iErr) throw iErr;
    if (!inv || Number(inv.torneo_id) !== tid) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (String(inv.estado) !== 'pendiente') return res.status(400).json({ error: 'La invitación ya no está pendiente' });
    if (String(inv.to_user_id) !== String(user.id)) {
      return res.status(403).json({ error: 'Solo el invitado puede aceptar' });
    }

    const fromUid = String(inv.from_user_id);
    const toUid = String(inv.to_user_id);

    const { data: torneoRow, error: tErr } = await supabase
      .from('torneos')
      .select('id, estado, fecha_inicio, nombre')
      .eq('id', tid)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!torneoRow) return res.status(404).json({ error: 'Torneo no encontrado' });
    if (!torneoBackendPermiteBuscaDupla(torneoRow.estado, torneoRow.fecha_inicio)) {
      return res.status(400).json({ error: 'Este torneo no admite formar dupla ahora' });
    }

    if (await usuarioEstaEnAlgunEquipoTorneo(tid, fromUid, null)) {
      return res.status(400).json({ error: 'Tu compañero ya tiene equipo en este torneo' });
    }
    if (await usuarioEstaEnAlgunEquipoTorneo(tid, toUid, emailInv)) {
      return res.status(400).json({ error: 'Ya tienes equipo en este torneo' });
    }

    const emailFrom = (await obtenerEmailAuthPorUserIdBuscaDupla(fromUid)) || '';
    const emailTo = emailInv || (await obtenerEmailAuthPorUserIdBuscaDupla(toUid)) || '';

    const perfilFrom = await fetchJugadoresPerfilParaBuscaDupla(fromUid, emailFrom);
    const perfilTo = await fetchJugadoresPerfilParaBuscaDupla(toUid, emailTo);

    const jCreador = buildJugadorJsonEquipoDupla(perfilFrom || {}, fromUid, emailFrom, 'creador');
    const jInvitado = buildJugadorJsonEquipoDupla(perfilTo || {}, toUid, emailTo, '');
    const jugadores = [jCreador, jInvitado];

    const alias1 = String(jCreador.alias || jCreador.nombre || '').trim() || 'Jugador';
    const alias2 = String(jInvitado.alias || jInvitado.nombre || '').trim() || 'Jugador';
    const nombreEquipo = `Dupla ${alias1} · ${alias2}`;

    const insertRow = {
      nombre: nombreEquipo,
      tipo_equipo: 'cerrado',
      torneo_id: tid,
      creador_id: fromUid,
      creador_email: emailFrom || null,
      jugadores,
      solicitudes: [],
      cupo_maximo: 2,
      equipo_abierto: false,
      puntos_totales: 0,
    };

    const { data: eqRows, error: eqErr } = await supabase.from('equipos').insert([insertRow]).select();
    if (eqErr) throw eqErr;
    const equipoCreado = Array.isArray(eqRows) ? eqRows[0] : eqRows;
    if (equipoCreado) await actualizarUltimoCompaneroDesdeEquipoRow(equipoCreado);

    await supabase.from('busca_dupla_torneo').delete().eq('torneo_id', tid).eq('user_id', fromUid);
    await supabase.from('busca_dupla_torneo').delete().eq('torneo_id', tid).eq('user_id', toUid);

    await cancelarInvitacionesPendientesBuscaDuplaTorneo(tid, [fromUid, toUid]);

    await supabase.from('busca_dupla_invitacion').update({ estado: 'aceptada' }).eq('id', invId);

    res.json({ ok: true, equipo: equipoCreado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/torneos/:id/busca-dupla/invitaciones/:invId/rechazar', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const tid = parseInt(String(req.params.id), 10);
    const invId = parseInt(String(req.params.invId), 10);
    if (!Number.isFinite(tid) || !Number.isFinite(invId)) return res.status(400).json({ error: 'ID inválido' });

    const { data: inv, error: iErr } = await supabase
      .from('busca_dupla_invitacion')
      .select('id, torneo_id, to_user_id, estado')
      .eq('id', invId)
      .maybeSingle();
    if (iErr) throw iErr;
    if (!inv || Number(inv.torneo_id) !== tid) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (String(inv.to_user_id) !== String(user.id)) {
      return res.status(403).json({ error: 'Solo el invitado puede rechazar' });
    }
    if (String(inv.estado) !== 'pendiente') return res.json({ ok: true });

    const { error: uErr } = await supabase
      .from('busca_dupla_invitacion')
      .update({ estado: 'rechazada' })
      .eq('id', invId);
    if (uErr) throw uErr;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Quita a los jugadores de busca_dupla_torneo cuando el equipo quedó completo (dupla formada por flujo clásico).
 */
app.post('/api/torneos/:id/busca-dupla/limpiar-si-dupla-formada', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const email = String(user.email || '').trim().toLowerCase();
    const tid = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(tid)) return res.status(400).json({ error: 'ID inválido' });
    const equipoId = parseInt(String(req.body?.equipo_id ?? ''), 10);
    if (!Number.isFinite(equipoId)) return res.status(400).json({ error: 'equipo_id requerido' });

    const { data: eq, error: eErr } = await supabase
      .from('equipos')
      .select('id, torneo_id, jugadores, cupo_maximo, creador_id')
      .eq('id', equipoId)
      .maybeSingle();
    if (eErr) throw eErr;
    if (!eq || Number(eq.torneo_id) !== tid) return res.status(404).json({ error: 'Equipo no encontrado' });

    const enEquipo = await usuarioEstaEnAlgunEquipoTorneo(tid, user.id, email);
    if (!enEquipo) return res.status(403).json({ error: 'No perteneces a este equipo' });

    const cupo = Number(eq.cupo_maximo || 2);
    const nReg = jugadoresRegistradosCountBuscaDupla(eq);
    if (nReg < cupo || cupo < 2) {
      return res.json({ ok: true, skipped: true, reason: 'equipo_incompleto' });
    }

    const uuids = userIdsRegistradosDesdeEquipoRowBuscaDupla(eq);
    for (const uid of uuids) {
      await supabase.from('busca_dupla_torneo').delete().eq('torneo_id', tid).eq('user_id', uid);
    }
    if (uuids.length) await cancelarInvitacionesPendientesBuscaDuplaTorneo(tid, uuids);

    res.json({ ok: true, removed_user_ids: uuids });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/torneos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('torneos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ mensaje: 'Torneo eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/torneos/:id/generar-partidos
// Reads all equipos for the torneo, generates matches based on tipo_torneo,
// saves them to partidos, and sets the torneo estado to 'en_curso'.
// Requires 'ronda' (int, nullable) and 'grupo' (text, nullable) columns on partidos table.
app.post('/api/torneos/:id/generar-partidos', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: torneo, error: errTorneo } = await supabase
      .from('torneos')
      .select('*')
      .eq('id', id)
      .single();
    if (errTorneo) throw errTorneo;

    const { data: equipos, error: errEquipos } = await supabase
      .from('equipos')
      .select('*')
      .eq('torneo_id', parseInt(id))
      .order('created_at', { ascending: true });
    if (errEquipos) throw errEquipos;

    if (!equipos || equipos.length < 2) {
      return res.status(400).json({ error: 'Se necesitan al menos 2 equipos para generar partidos' });
    }

    let partidosData;
    switch (torneo.tipo_torneo) {
      case 'round_robin':
        partidosData = generarRoundRobin(equipos, id, torneo.sede_id);
        break;
      case 'knockout':
        partidosData = generarKnockout(equipos, id, torneo.sede_id);
        break;
      case 'grupos_knockout':
        return res.status(400).json({
          error:
            'El formato Grupos + Knockout usa el sorteo manual: POST /api/torneos/:id/sorteo con { grupos: [[ids...], ...] }',
        });
      default:
        partidosData = generarRoundRobin(equipos, id, torneo.sede_id);
    }

    const { data: partidos, error: errPartidos } = await supabase
      .from('partidos')
      .insert(partidosData)
      .select();
    if (errPartidos) throw errPartidos;

    await supabase.from('torneos').update({ estado: 'en_curso' }).eq('id', id);

    console.log(`✅ ${partidos.length} partidos generados para torneo ${id} (${torneo.tipo_torneo})`);
    void notifyJugadoresInscriptosTorneoFixtureWhatsApp(parseInt(String(id), 10)).catch(() => {});
    res.json({ partidos, total: partidos.length, formato: torneo.tipo_torneo });
  } catch (err) {
    console.error('❌ Error generar-partidos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/torneos/:id/sorteo
 * Body: { grupos: [[equipo_id, ...], ...] } — partición de equipos; genera partidos de fase de grupos y pasa el torneo a en_curso.
 */
app.post('/api/torneos/:id/sorteo', async (req, res) => {
  try {
    const { id } = req.params;
    const tid = parseInt(String(id), 10);
    if (!Number.isFinite(tid)) return res.status(400).json({ error: 'id inválido' });

    const { data: torneo, error: tErr } = await supabase.from('torneos').select('*').eq('id', tid).maybeSingle();
    if (tErr) throw tErr;
    if (!torneo) return res.status(404).json({ error: 'Torneo no encontrado' });

    await assertUsuarioPuedeSortearTorneo(req, torneo);

    if (String(torneo.tipo_torneo || '') !== 'grupos_knockout') {
      return res.status(400).json({ error: 'Solo aplica a torneos formato Grupos + Knockout' });
    }

    const est = String(torneo.estado || '').toLowerCase();
    if (!['abierto', 'inscripcion_abierta', 'en_curso'].includes(est)) {
      return res.status(400).json({
        error: 'El sorteo solo está permitido con inscripción abierta o torneo en curso sin grupos generados',
      });
    }

    const { grupos: gruposBody } = req.body || {};
    if (!Array.isArray(gruposBody) || gruposBody.length < 2) {
      return res.status(400).json({ error: 'grupos debe ser un array de al menos 2 grupos' });
    }

    const flat = [];
    for (const g of gruposBody) {
      if (!Array.isArray(g) || g.length === 0) {
        return res.status(400).json({ error: 'Cada grupo debe ser un array no vacío de equipo_id' });
      }
      for (const idEq of g) {
        const n = parseInt(String(idEq), 10);
        if (!Number.isFinite(n)) return res.status(400).json({ error: 'equipo_id inválido' });
        flat.push(n);
      }
    }
    const uniq = new Set(flat);
    if (uniq.size !== flat.length) return res.status(400).json({ error: 'Hay equipos duplicados en la partición' });

    const { data: equiposRows, error: eErr } = await supabase.from('equipos').select('id').eq('torneo_id', tid);
    if (eErr) throw eErr;
    const allowed = new Set((equiposRows || []).map((r) => r.id));
    for (const n of flat) {
      if (!allowed.has(n)) return res.status(400).json({ error: `El equipo ${n} no pertenece al torneo` });
    }

    const { data: partidosPrev, error: pExErr } = await supabase
      .from('partidos')
      .select('id, grupo')
      .eq('torneo_id', tid);
    if (pExErr) throw pExErr;
    const yaHayGrupos = (partidosPrev || []).some((p) => p.grupo != null && String(p.grupo).trim() !== '');
    if (yaHayGrupos) {
      return res.status(409).json({ error: 'Ya existen partidos de fase de grupos. No se puede volver a sortear.' });
    }

    const partidosData = partidosDesdeGruposSorteo(gruposBody, tid, torneo.sede_id);
    const { data: inserted, error: insErr } = await supabase.from('partidos').insert(partidosData).select();
    if (insErr) throw insErr;

    const { data: torneoUpd, error: uErr } = await supabase
      .from('torneos')
      .update({ estado: 'en_curso', updated_at: new Date() })
      .eq('id', tid)
      .select()
      .single();
    if (uErr) throw uErr;

    void notifyJugadoresInscriptosTorneoFixtureWhatsApp(tid).catch(() => {});
    res.json({
      ok: true,
      partidos: inserted,
      torneo: torneoUpd,
      total_partidos: Array.isArray(inserted) ? inserted.length : 0,
    });
  } catch (err) {
    const st = err.status;
    if (st === 401 || st === 403) {
      return res.status(st).json({ error: err.message });
    }
    console.error('❌ POST /api/torneos/:id/sorteo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== RANKINGS =====

function torneoRowTipoCompetencia(t) {
  return String(t?.tipo_competencia || t?.tipo_torneo_genero || t?.genero_competencia || '')
    .trim()
    .toLowerCase();
}

function torneoPasaFiltroGeneroRankingApi(t, filtro) {
  if (!filtro) return true;
  const g = torneoRowTipoCompetencia(t);
  if (!g) return true;
  if (filtro === 'mixto') return g === 'mixto';
  if (filtro === 'masculino') return g === 'masculino' || g === 'mixto';
  if (filtro === 'femenino') return g === 'femenino' || g === 'mixto';
  return true;
}

// GET /api/rankings?scope=local|nacional|internacional&sede_id=X&categoria=Y&pais=&provincia=&ciudad=&tipo_competencia=&deporte=
// ?deporte= filtra torneos y filas de tabla_puntos (slug canónico: padbol, padel, tenis, pickleball, squash, futbol_5, futbol_7; alias futbol5/futbol7).
app.get('/api/rankings', async (req, res) => {
  const {
    scope = 'internacional',
    sede_id,
    categoria,
    pais,
    provincia,
    ciudad,
    tipo_competencia: tipoCompQ,
    genero_competencia: legacyTipoQ,
    deporte: deporteQ,
  } = req.query;

  const deporteFiltro = normalizeTorneoDeporteForDb(deporteQ);

  const genCompFilt = String(tipoCompQ || legacyTipoQ || '').trim().toLowerCase();
  const normPais = (s) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  try {
    // 1. Load finalizado torneos filtered by scope
    const SCOPE_NIVELES = {
      local:         ['club', 'club_oficial', 'club_no_oficial'],
      nacional:      ['nacional'],
      internacional: ['internacional', 'mundial'],
    };
    const nivelesPermitidos = SCOPE_NIVELES[scope] || SCOPE_NIVELES.internacional;

    let torneosQuery = supabase
      .from('torneos')
      .select('id, sede_id, nivel_torneo, nombre, tipo_competencia, tipo_torneo_genero, genero_competencia, categoria_edad, deporte')
      .eq('estado', 'finalizado')
      .in('nivel_torneo', nivelesPermitidos)
      .eq('deporte', deporteFiltro);

    if (scope === 'local') {
      const sidRaw = sede_id != null && String(sede_id).trim() !== '' ? parseInt(String(sede_id), 10) : NaN;
      if (Number.isFinite(sidRaw)) {
        torneosQuery = torneosQuery.eq('sede_id', sidRaw);
      } else {
        const pPais = pais && String(pais).trim();
        const pProv = provincia && String(provincia).trim();
        const pCiudad = ciudad && String(ciudad).trim();
        if (!pPais && !pProv && !pCiudad) {
          return res.json([]);
        }
        let sedesQ = supabase.from('sedes').select('id');
        if (pPais) sedesQ = sedesQ.ilike('pais', pPais);
        if (pProv) sedesQ = sedesQ.ilike('provincia', pProv);
        if (pCiudad) {
          const safeCiudad = String(pCiudad).replace(/[%_]/g, ' ');
          sedesQ = sedesQ.ilike('ciudad', `%${safeCiudad}%`);
        }
        const { data: sedeRows, error: errSedes } = await sedesQ;
        if (errSedes) throw errSedes;
        const ids = (sedeRows || []).map((s) => s.id).filter((id) => id != null);
        if (!ids.length) return res.json([]);
        torneosQuery = torneosQuery.in('sede_id', ids);
      }
    }

    const { data: torneosRaw, error: errT } = await torneosQuery;
    if (errT) throw errT;
    if (!torneosRaw?.length) return res.json([]);

    const torneos = torneosRaw.filter((t) => torneoPasaFiltroGeneroRankingApi(t, genCompFilt));
    if (!torneos.length) return res.json([]);

    const torneoIds = torneos.map((t) => t.id);

    const depByTorneoId = {};
    torneos.forEach((t) => {
      depByTorneoId[t.id] = normalizeTorneoDeporteForDb(t.deporte);
    });

    // 2. Load tabla_puntos for those torneos (filtro por deporte en query + filtro defensivo en memoria)
    const { data: puntosRaw, error: errP } = await supabase
      .from('tabla_puntos')
      .select('torneo_id, equipo_id, posicion, puntos, deporte')
      .in('torneo_id', torneoIds)
      .eq('deporte', deporteFiltro);
    if (errP) throw errP;
    const puntos = (puntosRaw || []).filter((p) => {
      const d = p.deporte != null && String(p.deporte).trim() !== '' ? normalizeTorneoDeporteForDb(p.deporte) : depByTorneoId[p.torneo_id];
      return d === deporteFiltro;
    });
    if (!puntos?.length) return res.json([]);

    // 3. Load equipos
    const equipoIds = [...new Set(puntos.map(p => p.equipo_id))];
    const { data: equipos, error: errE } = await supabase
      .from('equipos')
      .select('id, nombre, jugadores')
      .in('id', equipoIds);
    if (errE) throw errE;

    const equipoMap = {};
    (equipos || []).forEach(e => { equipoMap[e.id] = e; });

    // 4. Aggregate per player (keyed by email when available, else by name)
    const playerMap = {};

    puntos.forEach(p => {
      const equipo = equipoMap[p.equipo_id];
      if (!equipo) return;
      const jugadores = Array.isArray(equipo.jugadores) ? equipo.jugadores : [];

      if (jugadores.length === 0) {
        // Fallback: team-level entry when no individual player data
        const key = `equipo:${equipo.id}`;
        if (!playerMap[key]) {
          playerMap[key] = { nombre: equipo.nombre, email: null, pais: null, foto_url: null, nivel: null, sede_id: null, equipo_nombre: equipo.nombre, puntos_total: 0, torneos_count: 0 };
        }
        playerMap[key].puntos_total += p.puntos;
        playerMap[key].torneos_count += 1;
      } else {
        jugadores.forEach(j => {
          const key = j.email || j.nombre;
          if (!key) return;
          if (!playerMap[key]) {
            playerMap[key] = {
              nombre: j.nombre || key,
              apellido: j.apellido != null && String(j.apellido).trim() ? String(j.apellido).trim() : null,
              alias: j.alias != null && String(j.alias).trim() ? String(j.alias).trim() : null,
              email: j.email || null,
              pais: null,
              foto_url: null,
              nivel: null,
              sede_id: null,
              equipo_nombre: equipo.nombre,
              puntos_total: 0,
              torneos_count: 0,
            };
          }
          playerMap[key].puntos_total += p.puntos;
          playerMap[key].torneos_count += 1;
        });
      }
    });

    // 5. Enrich with jugadores_perfil where emails are known
    const emails = Object.values(playerMap).map(p => p.email).filter(Boolean);
    if (emails.length > 0) {
      const { data: perfiles } = await supabase
        .from('jugadores_perfil')
        .select('email, nombre, apellido, alias, pais, foto_url, sede_id, nivel')
        .in('email', emails);

      (perfiles || []).forEach(perfil => {
        const entry = playerMap[perfil.email];
        if (!entry) return;
        entry.foto_url = perfil.foto_url || null;
        entry.pais     = perfil.pais     || null;
        entry.nivel    = perfil.nivel    || null;
        entry.sede_id  = perfil.sede_id  || null;
        entry.nombre   = perfil.nombre   || entry.nombre;
        const ap = perfil.apellido != null && String(perfil.apellido).trim() ? String(perfil.apellido).trim() : '';
        if (ap) entry.apellido = ap;
        const al = perfil.alias != null && String(perfil.alias).trim() ? String(perfil.alias).trim() : '';
        if (al) entry.alias = al;
      });
    }

    // 6. Filter by categoria
    let result = Object.values(playerMap);
    if (categoria) result = result.filter(p => p.nivel === categoria);

    // 6b. Nacional: restringir por país del perfil del jugador
    if (scope === 'nacional' && pais && String(pais).trim()) {
      const needle = normPais(pais);
      result = result.filter((pl) => normPais(pl.pais) === needle);
    }

    // 7. Sort by puntos_total desc, then torneos_count desc
    result.sort((a, b) => b.puntos_total - a.puntos_total || b.torneos_count - a.torneos_count);

    res.json(result);
  } catch (err) {
    console.error('❌ Error GET /api/rankings:', err.message);
    // El cliente espera un array; vacío evita romper la UI de rankings.
    res.status(200).json([]);
  }
});

// ===== FINALIZAR TORNEO =====
// Required SQL migration:
// create table tabla_puntos (
//   id serial primary key,
//   torneo_id int references torneos(id) on delete cascade,
//   equipo_id int references equipos(id) on delete cascade,
//   posicion int not null,
//   puntos int not null,
//   created_at timestamp default now(),
//   unique(torneo_id, equipo_id)
// );

const BASE_PUNTOS = {
  club_no_oficial:  10,
  club_oficial:     30,
  nacional:        100,
  internacional:   300,
  mundial:        1000,
};

// Index 0 = 1st place, 1 = 2nd, ... 9 = 10th
const POSICION_MULT = [1.0, 0.6, 0.4, 0.25, 0.15, 0.10, 0.05, 0.05, 0.05, 0.05];

function calcularClasificacion(equipos, partidos) {
  const stats = {};
  equipos.forEach(eq => {
    stats[eq.id] = { jj: 0, g: 0, p: 0, pts: 0, sg: 0, sp: 0, gg: 0, gp: 0 };
  });

  partidos.forEach(partido => {
    if (partido.estado !== 'finalizado' || !partido.resultado) return;
    const res = typeof partido.resultado === 'string'
      ? JSON.parse(partido.resultado)
      : partido.resultado;
    const sets = [res.set1, res.set2, res.set3].filter(Boolean);

    let sgA = 0, sgB = 0, ggA = 0, ggB = 0;
    sets.forEach(set => {
      const [a, b] = set.split('-').map(Number);
      ggA += a; ggB += b;
      if (a > b) sgA++; else sgB++;
    });

    const eqA = stats[partido.equipo_a_id];
    const eqB = stats[partido.equipo_b_id];
    if (!eqA || !eqB) return;

    eqA.jj++; eqB.jj++;
    eqA.sg += sgA; eqA.sp += sgB; eqA.gg += ggA; eqA.gp += ggB;
    eqB.sg += sgB; eqB.sp += sgA; eqB.gg += ggB; eqB.gp += ggA;

    if (sgA > sgB) { eqA.g++; eqB.p++; eqA.pts += 3; }
    else           { eqB.g++; eqA.p++; eqB.pts += 3; }
  });

  return equipos
    .map(eq => ({ ...eq, ...stats[eq.id] }))
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const dA = a.sg - a.sp, dB = b.sg - b.sp;
      if (dB !== dA) return dB - dA;
      return (b.gg - b.gp) - (a.gg - a.gp);
    });
}

app.post('/api/torneos/:id/finalizar', async (req, res) => {
  try {
    const { id } = req.params;

    // Load torneo
    const { data: torneo, error: errTorneo } = await supabase
      .from('torneos').select('*').eq('id', id).single();
    if (errTorneo) throw errTorneo;

    // Load equipos & partidos
    const [{ data: equipos, error: errEq }, { data: partidos, error: errPart }] = await Promise.all([
      supabase.from('equipos').select('*').eq('torneo_id', parseInt(id)),
      supabase.from('partidos').select('*').eq('torneo_id', parseInt(id)),
    ]);
    if (errEq) throw errEq;
    if (errPart) throw errPart;

    // Validate all matches finished
    const pendientes = (partidos || []).filter(p => p.estado !== 'finalizado');
    if (pendientes.length > 0) {
      return res.status(400).json({
        error: `Hay ${pendientes.length} partido(s) sin finalizar. Completa todos los resultados antes de finalizar el torneo.`,
      });
    }

    // Calculate final standings
    const clasificacion = calcularClasificacion(equipos || [], partidos || []);

    // Assign ranking points
    const base = BASE_PUNTOS[torneo.nivel_torneo] ?? 10;
    const puntosData = clasificacion.map((eq, idx) => ({
      torneo_id: parseInt(id),
      equipo_id: eq.id,
      posicion: idx + 1,
      puntos: Math.round(base * (POSICION_MULT[idx] ?? 0.05)),
      deporte: normalizeTorneoDeporteForDb(torneo?.deporte),
    }));

    // Delete previous entries for this torneo (idempotent), then insert
    await supabase.from('tabla_puntos').delete().eq('torneo_id', parseInt(id));
    const { error: errPuntos } = await supabase.from('tabla_puntos').insert(puntosData);
    if (errPuntos) throw errPuntos;

    // Update equipos with their final puntos_ranking
    await Promise.all(
      puntosData.map(({ equipo_id, puntos }) =>
        supabase.from('equipos').update({ puntos_ranking: puntos }).eq('id', equipo_id)
      )
    );

    // Mark torneo as finalizado
    const { data: torneoFinal, error: errFinal } = await supabase
      .from('torneos')
      .update({ estado: 'finalizado', updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();
    if (errFinal) throw errFinal;

    await Promise.all(
      (clasificacion || []).map((eq, idx) =>
        crearNotificacionesEquipoTorneo(eq, {
          tipo: 'ranking_actualizado',
          titulo: 'Ranking actualizado',
          mensaje: `Se actualizó el ranking del torneo ${String(torneo.nombre || '').trim() || id}. Posición final: ${idx + 1}.`,
          link: `/torneo/${id}`,
        })
      )
    );

    console.log(`🏆 Torneo ${id} finalizado. ${puntosData.length} equipos clasificados.`);
    res.json({
      torneo: torneoFinal,
      clasificacion: puntosData,
    });
  } catch (err) {
    console.error('❌ Error finalizar torneo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== JUGADORES =====
app.post('/api/jugadores', async (req, res) => {
  try {
    const { user_id, nombre, email, documento, tipo_documento, nacionalidad, fecha_nacimiento, foto_url, pierna_habil, bio } = req.body;

    const { data, error } = await supabase
      .from('jugadores')
      .insert([{
        user_id,
        nombre,
        email,
        documento,
        tipo_documento,
        nacionalidad,
        fecha_nacimiento,
        foto_url,
        pierna_habil,
        bio,
        estado: 'activo',
      }])
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jugadores', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('jugadores')
      .select('*')
      .eq('estado', 'activo')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Búsqueda en `jugadores_perfil` por nombre, apellido o alias (ilike).
 * Query: ?q=texto (mín. 2) &torneo_id= opcional (badges disponibilidad) &exclude_user_id= opcional
 */
app.get('/api/jugadores/buscar', async (req, res) => {
  try {
    const qRaw = String(req.query.q || '').trim();
    if (qRaw.length < 2) {
      return res.status(400).json({ error: 'El parámetro q debe tener al menos 2 caracteres' });
    }
    const safe = qRaw.replace(/[%_\\]/g, '').slice(0, 80);
    if (safe.length < 2) {
      return res.status(400).json({ error: 'El parámetro q debe tener al menos 2 caracteres' });
    }
    const pattern = `%${safe}%`;
    const excludeUid = String(req.query.exclude_user_id || '').trim();
    const torneoIdRaw = req.query.torneo_id;
    const torneoId =
      torneoIdRaw != null && torneoIdRaw !== '' && String(torneoIdRaw).trim() !== ''
        ? parseInt(String(torneoIdRaw).trim(), 10)
        : NaN;
    const conTorneo = Number.isFinite(torneoId) && torneoId > 0;

    const sel = 'user_id, alias, foto_url, nombre, apellido, email';
    const lim = 12;
    const [rAlias, rNombre, rApellido] = await Promise.all([
      supabase.from('jugadores_perfil').select(sel).ilike('alias', pattern).limit(lim),
      supabase.from('jugadores_perfil').select(sel).ilike('nombre', pattern).limit(lim),
      supabase.from('jugadores_perfil').select(sel).ilike('apellido', pattern).limit(lim),
    ]);
    if (rAlias.error) throw rAlias.error;
    if (rNombre.error) throw rNombre.error;
    if (rApellido.error) throw rApellido.error;

    const byUserId = new Map();
    for (const row of [...(rAlias.data || []), ...(rNombre.data || []), ...(rApellido.data || [])]) {
      if (!row || typeof row !== 'object') continue;
      const uid = row.user_id != null ? String(row.user_id).trim() : '';
      if (!uid) continue;
      if (excludeUid && uid === excludeUid) continue;
      if (!byUserId.has(uid)) byUserId.set(uid, row);
    }
    let rows = Array.from(byUserId.values()).slice(0, lim);

    const parseJsonArray = (raw) => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        try {
          const x = JSON.parse(raw);
          return Array.isArray(x) ? x : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const jugadorEnEquipoTorneo = (perfilRow, equiposRows) => {
      const uid = perfilRow.user_id != null ? String(perfilRow.user_id).trim() : '';
      const email = String(perfilRow.email || '').trim().toLowerCase();
      const matchLista = (arr) => {
        for (const p of arr) {
          if (!p || typeof p !== 'object') continue;
          const pe = String(p.email || '').trim().toLowerCase();
          const pid = p.id != null && String(p.id).trim() !== '' ? String(p.id).trim() : '';
          if (email && pe && pe === email) return true;
          if (uid && pid && pid === uid) return true;
        }
        return false;
      };
      for (const eq of equiposRows || []) {
        if (matchLista(parseJsonArray(eq?.jugadores))) return true;
        if (matchLista(parseJsonArray(eq?.solicitudes))) return true;
      }
      return false;
    };

    if (conTorneo) {
      const { data: eqs, error: eEq } = await supabase
        .from('equipos')
        .select('id,jugadores,solicitudes')
        .eq('torneo_id', torneoId);
      if (eEq) console.warn('jugadores/buscar equipos:', eEq.message);
      const equiposList = Array.isArray(eqs) ? eqs : [];
      rows = rows.map((row) => {
        const enEq = jugadorEnEquipoTorneo(row, equiposList);
        const disponibilidad = enEq ? 'tiene_equipo' : 'buscando_companero';
        return { ...row, disponibilidad };
      });
    }

    res.json(rows);
  } catch (err) {
    console.error('GET /api/jugadores/buscar', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

function whatsappDigitsOnly(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  return s.replace(/\D/g, '');
}

async function fetchWhatsappDesdeReservasPorUserOEmail(userId, email) {
  if (userId) {
    const { data: rows } = await supabase
      .from('reservas')
      .select('whatsapp')
      .eq('user_id', userId)
      .not('whatsapp', 'is', null)
      .order('id', { ascending: false })
      .limit(1);
    const w = rows?.[0]?.whatsapp != null ? String(rows[0].whatsapp).trim() : '';
    if (w) return w;
  }
  const em = String(email || '').trim();
  if (em) {
    const { data: rows2 } = await supabase
      .from('reservas')
      .select('whatsapp')
      .ilike('email', em)
      .not('whatsapp', 'is', null)
      .order('id', { ascending: false })
      .limit(1);
    const w2 = rows2?.[0]?.whatsapp != null ? String(rows2[0].whatsapp).trim() : '';
    if (w2) return w2;
  }
  return '';
}

function normClubLabel(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Jugadores con busca_companero en la misma sede que el usuario (JWT).
 * WhatsApp: perfil primero; si falta, última reserva con número (user_id o email).
 */
app.get('/api/jugadores/disponibles-matchmaking', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) {
      return res.status(401).json({ error: 'Se requiere sesión' });
    }
    const viewerUid = String(user.id).trim();

    let me = null;
    const rMe = await supabase
      .from('jugadores_perfil')
      .select('user_id, sede_id, ciudad, email')
      .eq('user_id', viewerUid)
      .maybeSingle();
    if (!rMe.error) me = rMe.data;
    if (!me && user.email) {
      const r2 = await supabase
        .from('jugadores_perfil')
        .select('user_id, sede_id, ciudad, email')
        .ilike('email', String(user.email).trim())
        .maybeSingle();
      if (!r2.error) me = r2.data;
    }

    const sedeIdMe = me?.sede_id != null && me.sede_id !== '' ? Number(me.sede_id) : NaN;
    const ciudadMe = String(me?.ciudad || '').trim();

    if (!(Number.isFinite(sedeIdMe) && sedeIdMe > 0) && !ciudadMe) {
      return res.json({ jugadores: [], needsClub: true });
    }

    const { data: rawList, error: listErr } = await supabase
      .from('jugadores_perfil')
      .select('user_id, nombre, apellido, alias, foto_url, nivel, ciudad, sede_id, whatsapp, email')
      .eq('busca_companero', true)
      .limit(500);
    if (listErr) throw listErr;

    const viewerSedeIds = new Set();
    if (Number.isFinite(sedeIdMe) && sedeIdMe > 0) viewerSedeIds.add(sedeIdMe);
    if (ciudadMe) {
      const { data: sedeRows } = await supabase.from('sedes').select('id').ilike('nombre', ciudadMe);
      for (const r of sedeRows || []) {
        const id = r?.id != null ? Number(r.id) : NaN;
        if (Number.isFinite(id) && id > 0) viewerSedeIds.add(id);
      }
    }

    const ciudadMeNorm = normClubLabel(ciudadMe);

    const listIn = (rawList || []).filter((c) => {
      const uid = c?.user_id != null ? String(c.user_id).trim() : '';
      if (!uid || uid === viewerUid) return false;
      const sid = c?.sede_id != null && c.sede_id !== '' ? Number(c.sede_id) : NaN;
      if (viewerSedeIds.size > 0 && Number.isFinite(sid) && sid > 0 && viewerSedeIds.has(sid)) return true;
      if (ciudadMeNorm && normClubLabel(c?.ciudad) === ciudadMeNorm) return true;
      return false;
    });

    const out = [];
    for (const row of listIn) {
      const uid = row.user_id;
      let wa = row.whatsapp != null ? String(row.whatsapp).trim() : '';
      if (!wa) {
        wa = await fetchWhatsappDesdeReservasPorUserOEmail(uid, row.email);
      }
      const digits = whatsappDigitsOnly(wa);
      const nombreCompleto = [String(row.nombre || '').trim(), String(row.apellido || '').trim()]
        .filter(Boolean)
        .join(' ')
        .trim();
      const nombre =
        nombreCompleto ||
        String(row.alias || '').trim() ||
        'Jugador';
      out.push({
        user_id: uid,
        nombre,
        alias: row.alias != null && String(row.alias).trim() ? String(row.alias).trim() : null,
        foto_url: row.foto_url || null,
        categoria: row.nivel != null && String(row.nivel).trim() ? String(row.nivel).trim() : null,
        whatsapp_me_digits: digits.length >= 8 ? digits : null,
      });
    }

    res.json({ jugadores: out, needsClub: false });
  } catch (err) {
    console.error('GET /api/jugadores/disponibles-matchmaking', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.get('/api/jugadores/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('jugadores')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/jugadores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, documento, nacionalidad, fecha_nacimiento, foto_url, pierna_habil, bio } = req.body;

    const { data, error } = await supabase
      .from('jugadores')
      .update({
        nombre,
        email,
        documento,
        nacionalidad,
        fecha_nacimiento,
        foto_url,
        pierna_habil,
        bio,
        updated_at: new Date(),
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== JUGADORES TORNEO =====
app.post('/api/torneos/:torneo_id/jugadores', async (req, res) => {
  try {
    const { torneo_id } = req.params;
    const { nombre, email, user_id, numero_camiseta, es_capitan, pais } = req.body;

    const { data, error } = await supabase
      .from('jugadores_torneo')
      .insert([{
        torneo_id: parseInt(torneo_id),
        nombre,
        email,
        user_id,
        numero_camiseta,
        es_capitan,
        pais: pais || null,
      }])
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/torneos/:torneo_id/jugadores', async (req, res) => {
  try {
    const { torneo_id } = req.params;

    const { data, error } = await supabase
      .from('jugadores_torneo')
      .select('*')
      .eq('torneo_id', parseInt(torneo_id));

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/jugadores_torneo/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('jugadores_torneo')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ mensaje: 'Jugador removido del torneo' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== EQUIPOS =====
/**
 * Si `equipo.jugadores` tiene exactamente 2 entradas, resuelve `user_id` de cada una
 * y guarda en `jugadores_perfil.ultimo_companero_id` el UUID del compañero de pareja.
 */
async function actualizarUltimoCompaneroDesdeEquipoRow(equipoRow) {
  try {
    if (!equipoRow || typeof equipoRow !== 'object') return;
    const arr = Array.isArray(equipoRow.jugadores) ? equipoRow.jugadores : [];
    if (arr.length !== 2) return;

    const esUuid = (s) => {
      const x = String(s || '').trim();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
    };

    const resolveUserId = async (j) => {
      if (!j || typeof j !== 'object') return null;
      const idRaw = j.id != null && j.id !== '' ? String(j.id).trim() : '';
      if (idRaw && esUuid(idRaw)) return idRaw;
      const em = String(j.email || '').trim().toLowerCase();
      if (!em) return null;
      const { data } = await supabase.from('jugadores_perfil').select('user_id').ilike('email', em).maybeSingle();
      return data?.user_id ? String(data.user_id) : null;
    };

    const u1 = await resolveUserId(arr[0]);
    const u2 = await resolveUserId(arr[1]);
    if (!u1 || !u2 || u1 === u2) return;

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('jugadores_perfil').update({ ultimo_companero_id: u2 }).eq('user_id', u1),
      supabase.from('jugadores_perfil').update({ ultimo_companero_id: u1 }).eq('user_id', u2),
    ]);
    if (e1) console.warn('ultimo_companero_id (jugador 1):', e1.message);
    if (e2) console.warn('ultimo_companero_id (jugador 2):', e2.message);
  } catch (err) {
    console.warn('actualizarUltimoCompaneroDesdeEquipoRow:', err?.message || err);
  }
}

app.post('/api/torneos/:torneo_id/equipos', async (req, res) => {
  try {
    const { torneo_id } = req.params;
    const { nombre, sede_id, jugadores } = req.body;

    const tidNum = parseInt(String(torneo_id), 10);
    const { data: torneoRow, error: tErr } = await supabase
      .from('torneos')
      .select('id, fecha_inicio')
      .eq('id', tidNum)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!torneoRow) return res.status(404).json({ error: 'Torneo no encontrado' });
    if (torneoFechaInicioEsAnteriorAHoyArt(torneoRow.fecha_inicio)) {
      return res.status(400).json({ error: MSG_TORNEO_INSCRIPCION_FECHA_PASADA });
    }

    const { data, error } = await supabase
      .from('equipos')
      .insert([{
        torneo_id: parseInt(torneo_id),
        nombre,
        sede_id,
        jugadores: jugadores || [],
        puntos_totales: 0,
      }])
      .select();

    if (error) throw error;
    if (Array.isArray(data) && data[0]) {
      await actualizarUltimoCompaneroDesdeEquipoRow(data[0]);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Placeholder: si se implementa inscripción bajo esta ruta, ya pasa por verificación de suscripción (sede_id en body). */
app.post('/api/inscripciones', checkSuscripcionActiva, async (req, res) => {
  return res.status(404).json({
    error:
      'Ruta no disponible. Para inscribir un equipo en un torneo usa POST /api/torneos/:torneo_id/equipos. Si envías sede_id en el body, la suscripción de esa sede se valida igualmente.',
  });
});

app.get('/api/torneos/:torneo_id/equipos', async (req, res) => {
  try {
    const { torneo_id } = req.params;

    const [{ data: equipos, error: errE }, { data: grupoPartidos }] = await Promise.all([
      supabase.from('equipos').select('*').eq('torneo_id', parseInt(torneo_id)).order('puntos_totales', { ascending: false }),
      supabase.from('partidos').select('equipo_a_id, equipo_b_id, grupo').eq('torneo_id', parseInt(torneo_id)).not('grupo', 'is', null),
    ]);
    if (errE) throw errE;

    // Derive equipo → grupo from partidos (grupo is stored on partidos, not equipos)
    const grupoMap = {};
    (grupoPartidos || []).forEach(p => {
      if (p.grupo) {
        if (p.equipo_a_id) grupoMap[p.equipo_a_id] = p.grupo;
        if (p.equipo_b_id) grupoMap[p.equipo_b_id] = p.grupo;
      }
    });

    const result = (equipos || []).map((eq) => {
      const tipoEquipo =
        eq.tipo_equipo != null && String(eq.tipo_equipo).trim() !== ''
          ? eq.tipo_equipo
          : eq.tipo != null && String(eq.tipo).trim() !== ''
            ? eq.tipo
            : null;
      return { ...eq, grupo: grupoMap[eq.id] || null, tipo_equipo: tipoEquipo };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/equipos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, jugadores, puntos_totales } = req.body;

    const { data, error } = await supabase
      .from('equipos')
      .update({
        nombre,
        jugadores,
        puntos_totales,
        updated_at: new Date(),
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    if (Array.isArray(data) && data[0]) {
      await actualizarUltimoCompaneroDesdeEquipoRow(data[0]);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Acepta una solicitud pendiente o reenvía invitación: WhatsApp (Twilio) vía jugadores_perfil y actualiza el equipo si aplica.
 * Body: { email } — `jugadores_perfil` por email (whatsapp obligatorio para enviar).
 * Caso A: email en `equipos.solicitudes` → envía WA y pasa al jugador a `jugadores`.
 * Caso B: reenvío → mismo email en `jugadores` con estado pendiente (sin fila en solicitudes) → solo envía WA.
 */
app.post('/api/equipos/:id/invitar', async (req, res) => {
  try {
    const equipoId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(equipoId)) {
      return res.status(400).json({ error: 'id de equipo inválido' });
    }

    const emailIn = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!emailIn) {
      return res.status(400).json({ error: 'email es requerido' });
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return res.status(503).json({ error: 'Twilio no está configurado' });
    }

    const { data: eq, error: eErr } = await supabase.from('equipos').select('*').eq('id', equipoId).maybeSingle();
    if (eErr) throw eErr;
    if (!eq) return res.status(404).json({ error: 'Equipo no encontrado' });

    const solicitudes = Array.isArray(eq.solicitudes) ? eq.solicitudes : [];
    const solicitudIdx = solicitudes.findIndex(
      (r) => String(r?.email || '').trim().toLowerCase() === emailIn,
    );
    const players = Array.isArray(eq.jugadores) ? eq.jugadores : [];
    const jugPendIdx = players.findIndex((pl) => {
      const em = String(pl?.email || '').trim().toLowerCase();
      const est = String(pl?.estado || '').trim().toLowerCase();
      return em === emailIn && est === 'pendiente';
    });

    const esReenvioJugadorEnLista = solicitudIdx === -1 && jugPendIdx !== -1;
    if (solicitudIdx === -1 && jugPendIdx === -1) {
      return res.status(400).json({
        error: 'No hay solicitud pendiente ni jugador en el equipo con ese email y estado pendiente',
      });
    }

    if (!esReenvioJugadorEnLista) {
      const cupo = Number(eq.cupo_maximo || eq.cupo || 2);
      if (players.length >= cupo) {
        return res.status(400).json({ error: 'Equipo completo' });
      }
    }

    const { data: perfil, error: pErr } = await supabase
      .from('jugadores_perfil')
      .select('id, email, nombre, apodo, whatsapp')
      .ilike('email', emailIn)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!perfil) {
      return res.status(404).json({ error: 'No hay ficha en jugadores_perfil para ese email' });
    }
    if (!perfil.whatsapp || !String(perfil.whatsapp).trim()) {
      return res.status(400).json({ error: 'El jugador no tiene WhatsApp en su perfil' });
    }

    const { data: torneoRow, error: tErr } = await supabase
      .from('torneos')
      .select('id, nombre')
      .eq('id', eq.torneo_id)
      .maybeSingle();
    if (tErr) throw tErr;
    const nombreTorneo = torneoRow?.nombre || `Torneo ${eq.torneo_id}`;
    const torneoId = torneoRow?.id ?? eq.torneo_id;

    const nombreHola = nombreWhatsappJugadorDesdePerfil(perfil, '');

    await sendWhatsAppTorneoEquipoInvitacion(perfil.whatsapp, {
      nombreDestinatario: nombreHola,
      nombreTorneo,
      torneoId,
      equipoId,
    });

    if (esReenvioJugadorEnLista) {
      const { data: fresh, error: fErr } = await supabase
        .from('equipos')
        .select('*')
        .eq('id', equipoId)
        .maybeSingle();
      if (fErr) throw fErr;
      return res.json({ ok: true, equipo: fresh ?? null });
    }

    const solicitud = solicitudes[solicitudIdx];
    const solicitudConfirmada = {
      ...solicitud,
      estado: String(solicitud.email || '').trim() ? 'confirmado' : 'pendiente',
    };
    const nuevosJugadores = [...players, solicitudConfirmada];
    const nuevasSolicitudes = solicitudes.filter((_, i) => i !== solicitudIdx);

    const { data: updated, error: uErr } = await supabase
      .from('equipos')
      .update({
        jugadores: nuevosJugadores,
        solicitudes: nuevasSolicitudes,
        updated_at: new Date(),
      })
      .eq('id', equipoId)
      .select();

    if (uErr) throw uErr;

    const eqOut = updated?.[0] ?? null;
    if (eqOut) {
      await actualizarUltimoCompaneroDesdeEquipoRow(eqOut);
    }
    res.json({ ok: true, equipo: eqOut });
  } catch (err) {
    console.error('❌ POST /api/equipos/:id/invitar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/equipos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('equipos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ mensaje: 'Equipo eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PARTIDOS =====
app.post('/api/partidos', async (req, res) => {
  try {
    const { torneo_id, equipo_a_id, equipo_b_id, fecha_hora, cancha_id, sede_id } = req.body;

    const { data, error } = await supabase
      .from('partidos')
      .insert([{
        torneo_id,
        equipo_a_id,
        equipo_b_id,
        fecha_hora,
        cancha_id,
        sede_id,
        estado: 'pendiente',
      }])
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/torneos/:torneo_id/partidos', async (req, res) => {
  try {
    const { torneo_id } = req.params;

    const { data, error } = await supabase
      .from('partidos')
      .select(`
        *,
        equipo_a:equipos!equipo_a_id(nombre),
        equipo_b:equipos!equipo_b_id(nombre)
      `)
      .eq('torneo_id', parseInt(torneo_id))
      .order('fecha_hora', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/partidos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('partidos')
      .select(`
        *,
        equipo_a:equipos!equipo_a_id(nombre),
        equipo_b:equipos!equipo_b_id(nombre),
        games(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}); 

app.put('/api/partidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, resultado } = req.body;

    // Obtener el partido
    const { data: partido, error: errPartido } = await supabase
      .from('partidos')
      .select('*')
      .eq('id', id)
      .single();

    if (errPartido) throw errPartido;

    // Parsear resultado
    const res_obj = JSON.parse(resultado);
    const set1 = res_obj.set1.split('-').map(Number);
    const set2 = res_obj.set2.split('-').map(Number);
    const set3 = res_obj.set3.split('-').map(Number);

    // Contar sets ganados
    let setsA = 0, setsB = 0;
    if (set1[0] > set1[1]) setsA++; else setsB++;
    if (set2[0] > set2[1]) setsA++; else setsB++;
    if (set3[0] > set3[1]) setsA++; else setsB++;

    const gamesA = set1[0] + set2[0] + set3[0];
    const gamesB = set1[1] + set2[1] + set3[1];

    // Actualizar partido
    const { error: errUpdate } = await supabase
      .from('partidos')
      .update({
        estado,
        resultado,
        updated_at: new Date(),
      })
      .eq('id', id);

    if (errUpdate) throw errUpdate;

    // Actualizar equipos
    const { data: equipoA } = await supabase
      .from('equipos')
      .select('*')
      .eq('id', partido.equipo_a_id)
      .single();

    const { data: equipoB } = await supabase
      .from('equipos')
      .select('*')
      .eq('id', partido.equipo_b_id)
      .single();

    if (equipoA) {
      await supabase
        .from('equipos')
        .update({
          sets_ganados: (equipoA.sets_ganados || 0) + setsA,
          sets_perdidos: (equipoA.sets_perdidos || 0) + setsB,
          games_ganados: (equipoA.games_ganados || 0) + gamesA,
          games_perdidos: (equipoA.games_perdidos || 0) + gamesB,
          puntos_totales: (equipoA.puntos_totales || 0) + (setsA > setsB ? 3 : 0),
          partidos_jugados: (equipoA.partidos_jugados || 0) + 1,
        })
        .eq('id', partido.equipo_a_id);
    }

    if (equipoB) {
      await supabase
        .from('equipos')
        .update({
          sets_ganados: (equipoB.sets_ganados || 0) + setsB,
          sets_perdidos: (equipoB.sets_perdidos || 0) + setsA,
          games_ganados: (equipoB.games_ganados || 0) + gamesB,
          games_perdidos: (equipoB.games_perdidos || 0) + gamesA,
          puntos_totales: (equipoB.puntos_totales || 0) + (setsB > setsA ? 3 : 0),
          partidos_jugados: (equipoB.partidos_jugados || 0) + 1,
        })
        .eq('id', partido.equipo_b_id);
    }

    const { data: updatedPartido } = await supabase
      .from('partidos')
      .select('*')
      .eq('id', id)
      .single();

    if (String(estado || '').trim().toLowerCase() === 'finalizado') {
      const { data: torneoNotif } = await supabase
        .from('torneos')
        .select('id, nombre')
        .eq('id', partido.torneo_id)
        .maybeSingle();
      const nombreTorneo = String(torneoNotif?.nombre || 'tu torneo').trim();
      const mensaje = `Se cargó el resultado de un partido en ${nombreTorneo}.`;
      if (equipoA) {
        void crearNotificacionesEquipoTorneo(equipoA, {
          tipo: 'resultado_partido',
          titulo: 'Resultado cargado',
          mensaje,
          link: `/torneo/${partido.torneo_id}`,
        });
      }
      if (equipoB) {
        void crearNotificacionesEquipoTorneo(equipoB, {
          tipo: 'resultado_partido',
          titulo: 'Resultado cargado',
          mensaje,
          link: `/torneo/${partido.torneo_id}`,
        });
      }
    }

    res.json(updatedPartido);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GAMES =====
app.post('/api/partidos/:partido_id/games', async (req, res) => {
  try {
    const { partido_id } = req.params;
    const { numero_game, equipo_a_score, equipo_b_score } = req.body;

    const { data, error } = await supabase
      .from('games')
      .insert([{
        partido_id: parseInt(partido_id),
        numero_game,
        equipo_a_score,
        equipo_b_score,
        estado: 'finalizado',
      }])
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/partidos/:partido_id/games', async (req, res) => {
  try {
    const { partido_id } = req.params;

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('partido_id', parseInt(partido_id))
      .order('numero_game', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/games/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { equipo_a_score, equipo_b_score, estado } = req.body;

    const { data, error } = await supabase
      .from('games')
      .update({
        equipo_a_score,
        equipo_b_score,
        estado,
        updated_at: new Date(),
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CONFIG PUNTOS =====
// Required SQL migration:
// create table config_puntos (
//   id serial primary key,
//   clave text unique not null,
//   valor jsonb not null,
//   updated_at timestamp default now()
// );
// insert into config_puntos (clave, valor) values
//   ('niveles', '{"club_no_oficial":10,"club_oficial":30,"nacional":100,"internacional":300,"mundial":1000}'),
//   ('posiciones', '{"1":100,"2":60,"3":40,"4":25,"5":15,"6":10,"7":5,"8":5,"9":5,"10":5}');

const CONFIG_DEFAULTS = {
  niveles:      { club_no_oficial: 10, club_oficial: 30, nacional: 100, internacional: 300, mundial: 1000 },
  posiciones:   { 1: 100, 2: 60, 3: 40, 4: 25, 5: 15, 6: 10, 7: 5, 8: 5, 9: 5, 10: 5 },
  tipos_custom: [],
};

app.get('/api/config/puntos', async (req, res) => {
  try {
    const { data, error } = await supabase.from('config_puntos').select('clave, valor');
    if (error) throw error;
    if (!data?.length) return res.json(CONFIG_DEFAULTS);
    const result = { ...CONFIG_DEFAULTS };
    data.forEach(row => { result[row.clave] = row.valor; });
    res.json(result);
  } catch (err) {
    console.error('❌ Error GET /api/config/puntos:', err.message);
    res.json(CONFIG_DEFAULTS); // always return usable defaults
  }
});

app.put('/api/config/puntos', async (req, res) => {
  try {
    const { niveles, posiciones, tipos_custom } = req.body;
    const rows = [];
    if (niveles)                    rows.push({ clave: 'niveles',      valor: niveles,      updated_at: new Date() });
    if (posiciones)                 rows.push({ clave: 'posiciones',   valor: posiciones,   updated_at: new Date() });
    if (tipos_custom !== undefined) rows.push({ clave: 'tipos_custom', valor: tipos_custom, updated_at: new Date() });
    if (!rows.length) return res.status(400).json({ error: 'No data provided' });

    const { error } = await supabase
      .from('config_puntos')
      .upsert(rows, { onConflict: 'clave' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error PUT /api/config/puntos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cancelar-reserva — Cancellation with optional credit
app.post('/api/cancelar-reserva', async (req, res) => {
  try {
    const { reservaId, email } = req.body;
    if (!reservaId || !email) {
      return res.status(400).json({ error: 'Faltan campos: reservaId, email' });
    }

    // Fetch the reservation and verify ownership
    const { data: reserva, error: fetchErr } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', reservaId)
      .eq('email', email)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada o no pertenece a este usuario' });
    if (reserva.estado === 'cancelada') return res.status(409).json({ error: 'La reserva ya está cancelada' });

    const { data: sedeTzRow } = await supabase
      .from('sedes')
      .select('timezone, ciudad, pais')
      .eq('nombre', reserva.sede)
      .maybeSingle();
    const tzCancel = normalizeSedeTimezone(
      sedeTzRow?.timezone || inferTimezoneFromCiudadPais(sedeTzRow?.ciudad, sedeTzRow?.pais),
    );
    const startMs = reservaWallStartUtcMs(String(reserva.fecha || '').trim(), String(reserva.hora || '').trim(), tzCancel);
    const horasHasta =
      startMs != null && Number.isFinite(startMs) ? (startMs - Date.now()) / (1000 * 60 * 60) : -Infinity;
    const eligibleForCredit = horasHasta > 24;

    // Mark as cancelled
    const { error: updateErr } = await supabase
      .from('reservas')
      .update({ estado: 'cancelada' })
      .eq('id', reservaId);
    if (updateErr) throw updateErr;

    const emJug = String(email || '').trim().toLowerCase();
    await insertReservaHistorialEstado(supabase, {
      reserva_id: reservaId,
      estado_anterior: String(reserva.estado || '').trim() || null,
      estado_nuevo: 'cancelada',
      changed_by: emJug ? `jugador:${emJug}` : 'jugador',
    });

    // Credit if eligible
    let credito = null;
    if (eligibleForCredit && reserva.precio > 0) {
      // Look up sede_id by name
      const { data: sedeRow } = await supabase
        .from('sedes')
        .select('id')
        .eq('nombre', reserva.sede)
        .maybeSingle();

      const venceAt = new Date();
      venceAt.setDate(venceAt.getDate() + 30);

      const { data: creditData, error: creditErr } = await supabase
        .from('creditos')
        .insert([{
          email,
          monto: reserva.precio,
          sede_id: sedeRow?.id || null,
          vence_at: venceAt.toISOString(),
          usado: false,
        }])
        .select()
        .maybeSingle();

      if (!creditErr) credito = creditData;
      else console.error('❌ Error al insertar crédito:', creditErr.message);
    }

    // WhatsApp notification (fire-and-forget)
    if (reserva.whatsapp) {
      const digits = String(reserva.whatsapp).replace(/\D/g, '');
      const to     = `whatsapp:+${digits}`;
      const creditLine = credito !== null
        ? `\n💳 Se acreditaron $${Number(credito.monto).toLocaleString('es-AR')} en tu cuenta (válido 30 días).`
        : '\n⏱ La cancelación fue realizada con menos de 24hs de anticipación — no genera crédito.';

      const body =
`❌ *Reserva cancelada*

📅 ${reserva.fecha} ⏰ ${reserva.hora}
🏟️ ${reserva.sede} — Cancha ${reserva.cancha}
${creditLine}

Si necesitás ayuda, escribinos por WhatsApp.

*PADBOL MATCH*`;

      twilioClient.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body })
        .catch(err => console.warn('⚠️ WhatsApp cancelación no enviado:', err.message));
    }

    console.log(`✓ Reserva ${reservaId} cancelada — crédito: ${credito ? credito.id : 'no'}`);
    res.json({ success: true, eligibleForCredit: credito !== null, credito });
  } catch (err) {
    console.error('❌ Error POST /api/cancelar-reserva:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/creditos/:email — active (unused, non-expired) credit balance
app.get('/api/creditos/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const now   = new Date().toISOString();

    const { data, error } = await supabase
      .from('creditos')
      .select('id, monto, sede_id, created_at, vence_at')
      .eq('email', email)
      .eq('usado', false)
      .gt('vence_at', now)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const total = (data || []).reduce((sum, c) => sum + Number(c.monto), 0);
    console.log(`✓ GET creditos ${email} — total: ${total} (${(data || []).length} registros)`);
    res.json({ total, creditos: data || [] });
  } catch (err) {
    console.error('❌ Error GET /api/creditos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function equipoIncluyeUsuario(equipo, user) {
  const em = String(user?.email || '').trim().toLowerCase();
  const uid = String(user?.id || '').trim();
  if (!em && !uid) return false;
  const creadorEmail = String(equipo?.creador_email || '').trim().toLowerCase();
  if (em && creadorEmail && creadorEmail === em) return true;
  const jugadores = Array.isArray(equipo?.jugadores) ? equipo.jugadores : [];
  return jugadores.some((p) => {
    const pe = String(p?.email || '').trim().toLowerCase();
    const puid = String(p?.user_id || p?.id || '').trim();
    if (em && pe && pe === em) return true;
    if (uid && puid && puid === uid) return true;
    return false;
  });
}

// GET /api/jugador/mis-pagos — historial de pagos (reservas + torneos)
app.get('/api/jugador/mis-pagos', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.email) return res.status(401).json({ error: 'No autorizado' });
    const emailNorm = String(user.email || '').trim().toLowerCase();
    const uid = String(user.id || '').trim();

    let reservasData = [];
    if (uid) {
      const { data, error } = await supabase
        .from('reservas')
        .select('id, fecha, hora, sede, precio, moneda, estado, user_id')
        .eq('user_id', uid)
        .neq('estado', 'cancelada')
        .order('fecha', { ascending: false })
        .limit(400);
      if (error) throw error;
      reservasData = Array.isArray(data) ? data : [];
    } else {
      const { data, error } = await supabase
        .from('reservas')
        .select('id, fecha, hora, sede, precio, moneda, estado, email')
        .ilike('email', emailNorm)
        .neq('estado', 'cancelada')
        .order('fecha', { ascending: false })
        .limit(400);
      if (error) throw error;
      reservasData = Array.isArray(data) ? data : [];
    }

    const { data: equiposRows, error: eqErr } = await supabase
      .from('equipos')
      .select('id, torneo_id, nombre, jugadores, creador_email, inscripcion_estado, created_at, updated_at')
      .eq('inscripcion_estado', 'confirmado')
      .order('updated_at', { ascending: false })
      .limit(1500);
    if (eqErr) throw eqErr;
    const equiposMios = (Array.isArray(equiposRows) ? equiposRows : []).filter((eq) =>
      equipoIncluyeUsuario(eq, user)
    );

    const tids = [...new Set(equiposMios.map((e) => e.torneo_id).filter(Boolean))];
    const torneosById = {};
    const sedeById = {};
    if (tids.length) {
      const { data: torRows, error: tErr } = await supabase
        .from('torneos')
        .select('id, nombre, fecha_inicio, estado, sede_id, precio_inscripcion, monto_inscripcion, moneda')
        .in('id', tids);
      if (tErr) throw tErr;
      (torRows || []).forEach((t) => {
        torneosById[t.id] = t;
      });
      const sedeIds = [...new Set((torRows || []).map((t) => t?.sede_id).filter(Boolean))];
      if (sedeIds.length) {
        const { data: sRows } = await supabase.from('sedes').select('id, nombre').in('id', sedeIds);
        (sRows || []).forEach((s) => {
          sedeById[s.id] = s.nombre;
        });
      }
    }

    const pagosReservas = reservasData.map((r) => ({
      tipo: 'reserva',
      id: r.id,
      fecha: String(r?.fecha || '').slice(0, 10),
      hora: String(r?.hora || '').trim(),
      sede: String(r?.sede || '').trim() || null,
      monto: Number(r?.precio) || 0,
      moneda: String(r?.moneda || 'ARS').trim().toUpperCase(),
      estado: String(r?.estado || '').trim() || 'confirmada',
    }));

    const pagosTorneos = equiposMios.map((eq) => {
      const t = torneosById[eq.torneo_id] || {};
      const montoRaw = t.monto_inscripcion != null && t.monto_inscripcion !== '' ? t.monto_inscripcion : t.precio_inscripcion;
      return {
        tipo: 'torneo',
        id: eq.id,
        torneo_id: eq.torneo_id,
        torneo_nombre: String(t?.nombre || eq?.nombre || '').trim() || `Torneo #${eq.torneo_id}`,
        fecha: String(t?.fecha_inicio || eq?.updated_at || eq?.created_at || '').slice(0, 10),
        sede: t?.sede_id ? sedeById[t.sede_id] || null : null,
        monto: Number(montoRaw) || 0,
        moneda: String(t?.moneda || 'ARS').trim().toUpperCase(),
        estado: String(t?.estado || 'confirmado').trim(),
      };
    });

    const pagos = [...pagosReservas, ...pagosTorneos].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    const totalPorMoneda = { ARS: 0, USD: 0, EUR: 0 };
    pagos.forEach((p) => {
      const mon = ['ARS', 'USD', 'EUR'].includes(String(p.moneda || '').toUpperCase())
        ? String(p.moneda || '').toUpperCase()
        : 'ARS';
      totalPorMoneda[mon] = (totalPorMoneda[mon] || 0) + (Number(p.monto) || 0);
    });

    res.json({
      pagos,
      reservas: pagosReservas,
      torneos: pagosTorneos,
      total_por_moneda: totalPorMoneda,
      total_transacciones: pagos.length,
    });
  } catch (err) {
    console.error('❌ GET /api/jugador/mis-pagos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Perfil público: estadísticas de rendimiento (alias) ───────────────────────

function normalizeEmailStrStats(raw) {
  if (raw == null || raw === '') return '';
  return String(raw).replace(/\s/g, '').trim().toLowerCase();
}

function nombreCompletoPerfilStatsLower(perfil) {
  if (!perfil || typeof perfil !== 'object') return '';
  const n = String(perfil.nombre || '').trim().toLowerCase();
  const a = String(perfil.apellido || '').trim().toLowerCase();
  return `${n}${n && a ? ' ' : ''}${a}`.trim();
}

function normalizeJugadorEquipoStats(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    id: p.id != null && p.id !== '' ? String(p.id) : null,
    email: normalizeEmailStrStats(p.email),
    alias: String(p.alias || '').trim().toLowerCase(),
    nombre: String(p.nombre || '').trim().toLowerCase(),
  };
}

function jugadorEnEquipoStats(jugadoresArr, perfil) {
  if (!Array.isArray(jugadoresArr) || !perfil) return false;
  const uid = String(perfil.user_id || '').trim();
  const em = normalizeEmailStrStats(perfil.email);
  const rawEm = String(perfil.email || '').trim().toLowerCase();
  const al = String(perfil.alias || '').trim().toLowerCase();
  const nomFull = nombreCompletoPerfilStatsLower(perfil) || String(perfil.nombre || '').trim().toLowerCase();

  for (const raw of jugadoresArr) {
    const p = normalizeJugadorEquipoStats(raw);
    if (!p) continue;
    const pid = raw?.id != null && String(raw.id).trim() !== '' ? String(raw.id).trim() : '';
    if (uid && pid && pid === uid) return true;
    const emailJugadorLower = String(raw?.email || '').trim().toLowerCase();
    if (rawEm && emailJugadorLower && emailJugadorLower === rawEm) return true;
    if (em && p.email && p.email === em) return true;
    if (rawEm && p.email && p.email === rawEm) return true;
    if (al && p.alias && p.alias === al) return true;
    if (nomFull && p.nombre && p.nombre === nomFull) return true;
  }
  return false;
}

function esUuidAuthProbableJugadorSlug(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

async function fetchJugadoresPerfilByAliasSlug(aliasDecoded) {
  const a = String(aliasDecoded || '').trim();
  if (!a) return null;
  const { data: rows, error } = await supabase.from('jugadores_perfil').select('*').ilike('alias', a).limit(8);
  if (error) throw error;
  const list = Array.isArray(rows) ? rows : [];
  const aLower = a.toLowerCase();
  const byAlias =
    list.find((r) => String(r.alias || '').trim().toLowerCase() === aLower) || (list.length === 1 ? list[0] : null);
  if (byAlias) return byAlias;
  if (esUuidAuthProbableJugadorSlug(a)) {
    const { data: byUid, error: uErr } = await supabase.from('jugadores_perfil').select('*').eq('user_id', a).maybeSingle();
    if (uErr) throw uErr;
    return byUid || null;
  }
  return null;
}

function partidoEquipoGanadorId(partido) {
  if (!partido || String(partido.estado || '').toLowerCase() !== 'finalizado' || !partido.resultado) return null;
  let res;
  try {
    res = typeof partido.resultado === 'string' ? JSON.parse(partido.resultado) : partido.resultado;
  } catch {
    return null;
  }
  const sets = [res?.set1, res?.set2, res?.set3].filter(Boolean);
  if (!sets.length) return null;
  let sgA = 0;
  let sgB = 0;
  for (const set of sets) {
    const parts = String(set).split('-').map((x) => Number(String(x).trim()));
    const a = parts[0];
    const b = parts[1];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a > b) sgA++;
    else sgB++;
  }
  if (sgA === sgB) return null;
  return sgA > sgB ? partido.equipo_a_id : partido.equipo_b_id;
}

function formatDeporteEstadisticaSlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (!s) return null;
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function tsPartidoOrdenEstadisticas(p, torneo) {
  const u = p?.updated_at ? Date.parse(p.updated_at) : NaN;
  if (Number.isFinite(u)) return u;
  const fin = torneo?.fecha_fin ? Date.parse(`${String(torneo.fecha_fin).trim()}T12:00:00`) : NaN;
  const ini = torneo?.fecha_inicio ? Date.parse(`${String(torneo.fecha_inicio).trim()}T12:00:00`) : NaN;
  const t0 = Number.isFinite(fin) ? fin : Number.isFinite(ini) ? ini : 0;
  const ronda = Number(p?.ronda) || 0;
  const id = Number(p?.id) || 0;
  const tid = Number(p?.torneo_id) || 0;
  return t0 + tid * 1e9 + ronda * 1e6 + id;
}

function rachaVictoriasDesdeUltimosPartidos(resultadosOrdenAsc) {
  if (!resultadosOrdenAsc.length) return 0;
  if (!resultadosOrdenAsc[resultadosOrdenAsc.length - 1].win) return 0;
  let n = 0;
  for (let i = resultadosOrdenAsc.length - 1; i >= 0; i--) {
    if (resultadosOrdenAsc[i].win) n += 1;
    else break;
  }
  return n;
}

function mejorResultadoLabelDesdePosicion(bestPos) {
  if (!Number.isFinite(bestPos) || bestPos === Infinity) return null;
  if (bestPos <= 1) return 'Campeón';
  if (bestPos === 2) return 'Finalista';
  if (bestPos <= 4) return 'Semifinalista';
  return null;
}

async function deportePrincipalPorSedeIdsStats(supabaseClient, sedeIds) {
  const ids = [...new Set((sedeIds || []).filter((x) => x != null))].map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return new Map();
  const { data, error } = await supabaseClient
    .from('canchas_por_deporte')
    .select('sede_id, deporte, cantidad, activo')
    .in('sede_id', ids);
  if (error) {
    console.warn('deportePrincipalPorSedeIdsStats:', error.message || error);
    return new Map();
  }
  const best = new Map();
  for (const row of data || []) {
    if (row && row.activo === false) continue;
    const sid = row.sede_id;
    const c = Number(row.cantidad) || 0;
    const dep = String(row.deporte || '').trim().toLowerCase();
    if (!dep) continue;
    const prev = best.get(sid);
    if (!prev || c > prev.cantidad) best.set(sid, { deporte: dep, cantidad: c });
  }
  return best;
}

async function sedeMasFrecuentadaDesdeReservasStats(supabaseClient, perfil) {
  const userIdStats = String(perfil.user_id || '').trim();
  if (!userIdStats) return null;
  const { data: resvRows, error: rvErr } = await supabaseClient.from('reservas').select('sede, estado').eq('user_id', userIdStats);
  if (rvErr) {
    console.warn('sedeMasFrecuentadaDesdeReservasStats:', rvErr.message || rvErr);
    return null;
  }
  const m = new Map();
  for (const r of resvRows || []) {
    const es = String(r.estado || '').toLowerCase();
    if (es === 'cancelada') continue;
    const nome = String(r.sede || '').trim();
    if (!nome) continue;
    m.set(nome, (m.get(nome) || 0) + 1);
  }
  if (!m.size) return null;
  let bestName = null;
  let bestC = 0;
  for (const [nome, c] of m) {
    if (c > bestC) {
      bestC = c;
      bestName = nome;
    }
  }
  return bestName ? { nombre: bestName, reservas_en_sede: bestC } : null;
}

async function computeEstadisticasJugadorPublico(perfil) {
  const sede_mas_frecuentada_reservas = await sedeMasFrecuentadaDesdeReservasStats(supabase, perfil);

  const { data: equiposRows, error: eqErr } = await supabase.from('equipos').select('id, torneo_id, jugadores');
  if (eqErr) throw eqErr;

  const misEquipos = (equiposRows || []).filter((eq) => jugadorEnEquipoStats(eq.jugadores, perfil));
  const misTorneoIds = [...new Set(misEquipos.map((e) => e.torneo_id).filter((x) => x != null))];
  if (!misTorneoIds.length) {
    return {
      torneos_jugados: 0,
      torneos_ganados: 0,
      partidos_jugados: 0,
      partidos_ganados: 0,
      win_rate_pct: 0,
      puntos_ranking_total: 0,
      puntos_ranking_por_deporte: {},
      sede_habitual: null,
      racha_victorias_consecutivas: 0,
      mejor_resultado: null,
      deporte_mas_jugado: null,
      sede_mas_frecuentada_reservas,
    };
  }

  const { data: torneosRows, error: tErr } = await supabase
    .from('torneos')
    .select('id, estado, sede_id, fecha_inicio, fecha_fin, deporte')
    .in('id', misTorneoIds);
  if (tErr) throw tErr;

  const torneoById = {};
  (torneosRows || []).forEach((t) => {
    torneoById[t.id] = t;
  });

  const finalTorneoIds = new Set(
    (torneosRows || [])
      .filter((t) => String(t.estado || '').toLowerCase() === 'finalizado')
      .map((t) => t.id),
  );

  const equiposFinalizados = misEquipos.filter((eq) => finalTorneoIds.has(eq.torneo_id));
  const torneosJugadosSet = new Set(equiposFinalizados.map((e) => e.torneo_id));
  const torneos_jugados = torneosJugadosSet.size;

  const equipoIdPorTorneo = new Map();
  for (const eq of equiposFinalizados) {
    equipoIdPorTorneo.set(Number(eq.torneo_id), eq.id);
  }

  const misEquipoIdsFinal = [...new Set(equiposFinalizados.map((e) => e.id))];
  const fArr = [...finalTorneoIds];

  let puntos_ranking_total = 0;
  let torneos_ganados = 0;
  let mejor_posicion_torneo = Infinity;
  const puntos_ranking_por_deporte = {};
  let deporte_mas_jugado = null;

  const deporteTorneoFreq = new Map();
  for (const tid of torneosJugadosSet) {
    const t = torneoById[tid];
    const d = normalizeTorneoDeporteForDb(t?.deporte);
    deporteTorneoFreq.set(d, (deporteTorneoFreq.get(d) || 0) + 1);
  }
  if (deporteTorneoFreq.size > 0) {
    let bestDep = null;
    let bestN = 0;
    for (const [d, n] of deporteTorneoFreq) {
      if (n > bestN || (n === bestN && String(d) < String(bestDep || '\uffff'))) {
        bestN = n;
        bestDep = d;
      }
    }
    deporte_mas_jugado = formatDeporteEstadisticaSlug(bestDep);
  }

  if (fArr.length && misEquipoIdsFinal.length) {
    const { data: tpRows, error: tpErr } = await supabase
      .from('tabla_puntos')
      .select('torneo_id, equipo_id, posicion, puntos, deporte')
      .in('torneo_id', fArr)
      .in('equipo_id', misEquipoIdsFinal);
    if (tpErr) throw tpErr;
    const depForTorneo = (tid) => normalizeTorneoDeporteForDb(torneoById[tid]?.deporte);
    const ganadosSet = new Set();
    for (const row of tpRows || []) {
      const tid = row.torneo_id;
      const eid = row.equipo_id;
      if (equipoIdPorTorneo.get(Number(tid)) !== eid) continue;
      const pts = Number(row.puntos) || 0;
      const dep = row.deporte != null && String(row.deporte).trim() !== '' ? normalizeTorneoDeporteForDb(row.deporte) : depForTorneo(tid);
      puntos_ranking_por_deporte[dep] = (puntos_ranking_por_deporte[dep] || 0) + pts;
      if (Number(row.posicion) === 1) ganadosSet.add(tid);
      const posN = Number(row.posicion);
      if (Number.isFinite(posN) && posN >= 1) mejor_posicion_torneo = Math.min(mejor_posicion_torneo, posN);
    }
    torneos_ganados = ganadosSet.size;

    let primaryDep = null;
    let bestNc = 0;
    for (const [d, n] of deporteTorneoFreq) {
      if (n > bestNc || (n === bestNc && String(d) < String(primaryDep || '\uffff'))) {
        bestNc = n;
        primaryDep = d;
      }
    }
    if (primaryDep && puntos_ranking_por_deporte[primaryDep] != null) {
      puntos_ranking_total = puntos_ranking_por_deporte[primaryDep];
    } else {
      puntos_ranking_total = Object.values(puntos_ranking_por_deporte).reduce((a, b) => a + b, 0);
    }
  }

  let partidos_jugados = 0;
  let partidos_ganados = 0;
  const partidosParaRacha = [];
  if (fArr.length) {
    const { data: partidosRows, error: pErr } = await supabase
      .from('partidos')
      .select('id, torneo_id, estado, resultado, equipo_a_id, equipo_b_id, ronda, grupo, updated_at')
      .in('torneo_id', fArr)
      .eq('estado', 'finalizado');
    if (pErr) throw pErr;
    for (const p of partidosRows || []) {
      const myEq = equipoIdPorTorneo.get(Number(p.torneo_id));
      if (!myEq) continue;
      if (p.equipo_a_id !== myEq && p.equipo_b_id !== myEq) continue;
      partidos_jugados++;
      const winId = partidoEquipoGanadorId(p);
      const win = winId != null && winId === myEq;
      if (win) partidos_ganados++;
      const tmeta = torneoById[p.torneo_id];
      partidosParaRacha.push({ p, torneo: tmeta, win });
    }
    partidosParaRacha.sort((a, b) => tsPartidoOrdenEstadisticas(a.p, a.torneo) - tsPartidoOrdenEstadisticas(b.p, b.torneo));
  }

  const racha_victorias_consecutivas = rachaVictoriasDesdeUltimosPartidos(partidosParaRacha.map((x) => ({ win: x.win })));
  const mejor_resultado = mejorResultadoLabelDesdePosicion(mejor_posicion_torneo);

  const win_rate_pct =
    partidos_jugados > 0 ? Math.round((partidos_ganados / partidos_jugados) * 1000) / 10 : 0;

  const sedeCount = new Map();
  for (const tid of torneosJugadosSet) {
    const t = torneoById[tid];
    const sid = t?.sede_id;
    if (sid == null) continue;
    sedeCount.set(sid, (sedeCount.get(sid) || 0) + 1);
  }
  let sede_habitual = null;
  if (sedeCount.size > 0) {
    let bestSid = null;
    let bestN = 0;
    for (const [sid, n] of sedeCount) {
      if (n > bestN) {
        bestN = n;
        bestSid = sid;
      }
    }
    if (bestSid != null) {
      const { data: sedeRow } = await supabase.from('sedes').select('id, nombre').eq('id', bestSid).maybeSingle();
      if (sedeRow?.nombre) {
        sede_habitual = { sede_id: bestSid, nombre: String(sedeRow.nombre).trim(), torneos_en_sede: bestN };
      }
    }
  }

  return {
    torneos_jugados,
    torneos_ganados,
    partidos_jugados,
    partidos_ganados,
    win_rate_pct,
    puntos_ranking_total,
    puntos_ranking_por_deporte,
    sede_habitual,
    racha_victorias_consecutivas,
    mejor_resultado,
    deporte_mas_jugado,
    sede_mas_frecuentada_reservas,
  };
}

/** GET /api/jugador/:alias/estadisticas — stats públicas (torneos finalizados). Debe ir después de rutas fijas como /api/jugador/mis-pagos. */
app.get('/api/jugador/:alias/estadisticas', async (req, res) => {
  try {
    let raw = String(req.params.alias || '').trim();
    if (!raw) return res.status(400).json({ error: 'Alias requerido' });
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* keep */
    }
    const perfil = await fetchJugadoresPerfilByAliasSlug(raw);
    if (!perfil) return res.status(404).json({ error: 'Jugador no encontrado' });
    const stats = await computeEstadisticasJugadorPublico(perfil);
    res.json(stats);
  } catch (err) {
    console.error('❌ GET /api/jugador/:alias/estadisticas:', err?.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

function stripeMetadataPayload(payloadObj) {
  const raw = JSON.stringify(payloadObj);
  if (raw.length <= 500) return { payload_json: raw };
  const e = new Error(
    'Los datos de la operación superan el límite permitido. Acorta nombre u otros textos e intenta de nuevo.'
  );
  e.status = 400;
  throw e;
}

/**
 * Stripe Connect: un solo PaymentIntent por monto_base + 3 %.
 * `application_fee_amount` + `transfer_data.destination` envían la base al club y el fee queda en la plataforma.
 */
app.post('/api/stripe/crear-payment-intent', async (req, res) => {
  try {
    const st = getStripeOrThrow();
    const authUser = await authUserFromBearer(req);
    if (!authUser?.email) return res.status(401).json({ error: 'No autorizado' });

    const b = req.body || {};
    const sede_id = parseInt(String(b.sede_id), 10);
    const monto_base = parseInt(String(b.monto_base), 10);
    const moneda = String(b.moneda || '').trim().toLowerCase();
    const tipo = String(b.tipo || '').trim().toLowerCase();
    const descripcion = String(b.descripcion || '').trim();
    const payload = b.payload;

    if (!Number.isFinite(sede_id) || sede_id <= 0) {
      return res.status(400).json({ error: 'sede_id inválido' });
    }
    if (!Number.isFinite(monto_base) || monto_base <= 0) {
      return res.status(400).json({ error: 'monto_base inválido' });
    }
    if (!moneda || !/^[a-z]{3}$/.test(moneda)) {
      return res.status(400).json({ error: 'moneda inválida (código ISO de 3 letras, ej. ars, usd)' });
    }
    if (!['reserva', 'torneo'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser reserva o torneo' });
    }
    if (!descripcion) return res.status(400).json({ error: 'descripcion es requerida' });
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'payload es requerido (datos de la reserva o inscripción)' });
    }

    const emailUser = String(authUser.email).trim().toLowerCase();
    const sedeCfg = await sedePaymentConfigBySedeId(sede_id);
    if (!sedeCfg) return res.status(404).json({ error: 'Sede no encontrada' });
    if (normalizeMetodoPago(sedeCfg.metodo_pago) !== 'stripe') {
      return res.status(400).json({ error: 'Esta sede no tiene configurado el método de pago Stripe' });
    }
    const destination = String(sedeCfg.stripe_account_id || '').trim();
    if (!destination.startsWith('acct_')) {
      return res.status(400).json({ error: 'La sede no tiene una cuenta Stripe Connect vinculada (onboarding incompleto)' });
    }

    let payloadNorm;
    if (tipo === 'reserva') {
      const em = String(payload.email || '').trim().toLowerCase();
      if (em !== emailUser) {
        return res.status(403).json({ error: 'El email de la reserva debe coincidir con tu sesión' });
      }
      if (!payload.sede || !payload.fecha || !payload.hora || payload.cancha == null || !payload.nombre || !payload.whatsapp) {
        return res.status(400).json({ error: 'payload de reserva incompleto' });
      }
      payloadNorm = {
        v: 1,
        t: 'reserva',
        sede: String(payload.sede).trim(),
        fecha: String(payload.fecha).trim(),
        hora: String(payload.hora).trim(),
        cancha: parseInt(String(payload.cancha), 10),
        nombre: String(payload.nombre).trim(),
        email: em,
        whatsapp: String(payload.whatsapp).trim(),
        nivel: String(payload.nivel || 'Principiante').trim(),
        precio: Number(payload.precio),
        duracion: parseInt(String(payload.duracion), 10) || 90,
      };
      if (payloadNorm.sede !== String(sedeCfg.nombre || '').trim()) {
        return res.status(400).json({ error: 'La sede del payload no coincide con sede_id' });
      }
      try {
        await assertCanchaPermitidaParaReservaPorNombreSede(payloadNorm.sede, payloadNorm.cancha);
      } catch (e) {
        const st = e.status || 400;
        return res.status(st).json({ error: e.message || String(e) });
      }
    } else {
      const eid = parseInt(String(payload.equipo_id), 10);
      const tid = parseInt(String(payload.torneo_id), 10);
      const em = String(payload.email || '').trim().toLowerCase();
      if (!eid || !tid || !em) {
        return res.status(400).json({ error: 'payload de torneo incompleto (equipo_id, torneo_id, email)' });
      }
      if (em !== emailUser) {
        return res.status(403).json({ error: 'El email debe coincidir con tu sesión' });
      }
      payloadNorm = { v: 1, t: 'torneo', equipo_id: eid, torneo_id: tid, email: em };
    }

    const metaPayload = stripeMetadataPayload(payloadNorm);
    const cargo_servicio = Math.round(monto_base * 0.03);
    const total = monto_base + cargo_servicio;
    if (!Number.isFinite(cargo_servicio) || cargo_servicio < 0 || total <= 0) {
      return res.status(400).json({ error: 'Monto total inválido' });
    }

    const pi = await st.paymentIntents.create({
      amount: total,
      currency: moneda,
      description: descripcion.slice(0, 500),
      automatic_payment_methods: { enabled: true },
      application_fee_amount: cargo_servicio,
      transfer_data: { destination },
      metadata: {
        sede_id: String(sede_id),
        tipo,
        monto_base: String(monto_base),
        cargo_servicio: String(cargo_servicio),
        ...metaPayload,
      },
    });

    res.json({
      client_secret: pi.client_secret,
      payment_intent_id: pi.id,
      amount_total: total,
      monto_base,
      cargo_servicio,
      moneda,
    });
  } catch (err) {
    console.error('❌ POST /api/stripe/crear-payment-intent:', err?.message || err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || String(err) });
  }
});

app.post('/api/stripe/confirmar-pago', async (req, res) => {
  try {
    const st = getStripeOrThrow();
    const authUser = await authUserFromBearer(req);
    if (!authUser?.email) return res.status(401).json({ error: 'No autorizado' });
    const emailUser = String(authUser.email).trim().toLowerCase();

    const payment_intent_id = String((req.body || {}).payment_intent_id || '').trim();
    if (!payment_intent_id.startsWith('pi_')) {
      return res.status(400).json({ error: 'payment_intent_id inválido' });
    }

    const pi = await st.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== 'succeeded') {
      return res.status(400).json({ error: 'El pago no está confirmado', status: pi.status });
    }

    const md = pi.metadata || {};
    const monto_base = parseInt(String(md.monto_base || ''), 10);
    const cargo = parseInt(String(md.cargo_servicio || ''), 10);
    const expectedTotal = monto_base + cargo;
    if (!Number.isFinite(monto_base) || !Number.isFinite(cargo) || pi.amount !== expectedTotal) {
      console.error('Stripe confirmar-pago: monto inconsistente', { piAmount: pi.amount, expectedTotal, md });
      return res.status(400).json({ error: 'Datos de pago inconsistentes' });
    }

    let payload;
    try {
      payload = JSON.parse(String(md.payload_json || 'null'));
    } catch {
      return res.status(400).json({ error: 'Metadata de pago inválida' });
    }
    if (!payload || payload.v !== 1) {
      return res.status(400).json({ error: 'Versión de payload no soportada' });
    }

    if (payload.t === 'reserva') {
      if (String(payload.email || '').trim().toLowerCase() !== emailUser) {
        return res.status(403).json({ error: 'No autorizado a confirmar esta reserva' });
      }
      const sede = String(payload.sede || '').trim();
      const fecha = String(payload.fecha || '').trim();
      const hora = String(payload.hora || '').trim();
      const cancha = parseInt(String(payload.cancha), 10);

      try {
        await assertCanchaPermitidaParaReservaPorNombreSede(sede, cancha);
        await assertReservaHorarioNoPasadoParaSede(sede, fecha, hora);
      } catch (e) {
        const st = e.status || 400;
        return res.status(st).json({ error: e.message || String(e) });
      }

      let duracionMin = parseInt(String(payload.duracion), 10);
      if (!Number.isFinite(duracionMin) || duracionMin <= 0) {
        const { data: sedeDur } = await supabase
          .from('sedes')
          .select('duracion_reserva_minutos')
          .eq('nombre', sede)
          .maybeSingle();
        duracionMin = parseInt(sedeDur?.duracion_reserva_minutos, 10) || 90;
      }
      await assertReservaSinSolapeBackend({ sede, fecha, hora, cancha, duracionMin });

      const ins = {
        sede,
        fecha,
        hora,
        cancha,
        nombre: String(payload.nombre || '').trim(),
        email: String(payload.email || '').trim().toLowerCase(),
        telefono: String(payload.whatsapp || '').trim(),
        whatsapp: String(payload.whatsapp || '').trim(),
        nivel: String(payload.nivel || 'Principiante').trim(),
        precio: parseInt(String(payload.precio), 10),
        estado: 'confirmada',
        duracion: duracionMin,
        duracion_minutos: duracionMin,
        ...(authUser.id ? { user_id: authUser.id } : {}),
      };

      const { data, error } = await supabase.from('reservas').insert([ins]).select();
      if (error) throw error;
      const createdReserva = Array.isArray(data) ? data[0] : null;
      if (createdReserva?.id != null) {
        await insertReservaHistorialEstado(supabase, {
          reserva_id: createdReserva.id,
          estado_anterior: null,
          estado_nuevo: 'confirmada',
          changed_by: 'sistema',
        });
      }
      void sendMakeEvent('pago_exitoso', {
        nombre: ins.nombre || null,
        email: ins.email || null,
        sede: ins.sede || null,
        monto: createdReserva?.precio ?? ins.precio ?? null,
        metodo_pago: 'stripe',
        reserva_id: createdReserva?.id ?? null,
      });
      sendReservaConfirmadaWhatsAppTwilio({
        email: ins.email,
        nombreFallback: ins.nombre,
        fecha,
        hora,
        duracionMinutos: duracionMin,
        nombreSede: sede,
      }).catch((errW) => console.warn('⚠️ WhatsApp confirmación reserva:', errW.message));
      void crearNotificacionReservaConfirmada({
        userId: authUser.id,
        email: ins.email,
        sede,
        fecha,
        hora,
      });
      return res.json({ ok: true, tipo: 'reserva', reservation: data?.[0] || null });
    }

    if (payload.t === 'torneo') {
      if (String(payload.email || '').trim().toLowerCase() !== emailUser) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      const eid = parseInt(String(payload.equipo_id), 10);
      const tid = parseInt(String(payload.torneo_id), 10);

      const { data: eq, error: errEq } = await supabase
        .from('equipos')
        .select('id, torneo_id, nombre, jugadores, creador_id, creador_email, inscripcion_estado')
        .eq('id', eid)
        .maybeSingle();
      if (errEq) throw errEq;
      if (!eq) return res.status(404).json({ error: 'Equipo no encontrado' });
      if (Number(eq.torneo_id) !== tid) {
        return res.status(400).json({ error: 'El equipo no pertenece a ese torneo' });
      }
      if (String(eq.inscripcion_estado || '').toLowerCase() === 'confirmado') {
        return res.json({ ok: true, already: true, tipo: 'torneo' });
      }

      const { data: torneoRow, error: errTorneo } = await supabase
        .from('torneos')
        .select('id, nombre, fecha_inicio')
        .eq('id', tid)
        .maybeSingle();
      if (errTorneo) throw errTorneo;
      if (!torneoRow) return res.status(404).json({ error: 'Torneo no encontrado' });
      if (torneoFechaInicioEsAnteriorAHoyArt(torneoRow.fecha_inicio)) {
        return res.status(400).json({ error: MSG_TORNEO_INSCRIPCION_FECHA_PASADA });
      }

      const { error: errUp } = await supabase.from('equipos').update({ inscripcion_estado: 'confirmado' }).eq('id', eid);
      if (errUp) throw errUp;
      await sendInscripcionTorneoMakeEvent({ equipoId: eid, torneoId: tid, emailHint: emailUser });
      void crearNotificacionesEquipoTorneo(eq, {
        tipo: 'torneo_inscripcion_confirmada',
        titulo: 'Inscripción confirmada',
        mensaje: `Tu inscripción al torneo ${String(torneoRow.nombre || 'seleccionado').trim()} quedó confirmada.`,
        link: `/torneo/${tid}`,
      });
      return res.json({ ok: true, tipo: 'torneo' });
    }

    return res.status(400).json({ error: 'Tipo de operación desconocido' });
  } catch (err) {
    console.error('❌ POST /api/stripe/confirmar-pago:', err?.message || err);
    res.status(err.status || 500).json({ error: err.message || String(err) });
  }
});

app.get('/api/stripe/onboarding/:sede_id', async (req, res) => {
  try {
    const st = getStripeOrThrow();
    const sid = parseInt(String(req.params.sede_id), 10);
    if (!Number.isFinite(sid) || sid <= 0) {
      return res.status(400).json({ error: 'sede_id inválido' });
    }
    await assertUsuarioPuedeAdministrarSede(req, sid);

    const { data: sedeRow, error } = await supabase
      .from('sedes')
      .select('id, nombre, stripe_account_id')
      .eq('id', sid)
      .maybeSingle();
    if (error) throw error;
    if (!sedeRow) return res.status(404).json({ error: 'Sede no encontrada' });

    let accountId = String(sedeRow.stripe_account_id || '').trim();
    if (!accountId) {
      const acc = await st.accounts.create({
        type: 'standard',
        metadata: { sede_id: String(sid), sede_nombre: String(sedeRow.nombre || '').slice(0, 50) },
      });
      accountId = acc.id;
      const { error: upErr } = await supabase.from('sedes').update({ stripe_account_id: accountId }).eq('id', sid);
      if (upErr) throw upErr;
    }

    const base = FRONTEND_URL.replace(/\/$/, '');
    const returnUrl = `${base}/admin?tab=mi_sede`;
    const link = await st.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    res.json({ url: link.url, stripe_account_id: accountId });
  } catch (err) {
    console.error('❌ GET /api/stripe/onboarding/:sede_id:', err?.message || err);
    res.status(err.status || 500).json({ error: err.message || String(err) });
  }
});

/** Super admin: inicia suscripción mensual Padbol Match (Stripe Billing) y devuelve client_secret del primer pago. */
app.post('/api/stripe/suscripcion/crear', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const st = getStripeOrThrow();
    const priceId = getStripeSubscriptionPriceIdOrThrow();
    const sid = parseInt(String((req.body || {}).sede_id), 10);
    if (!Number.isFinite(sid) || sid <= 0) {
      return res.status(400).json({ error: 'sede_id inválido' });
    }

    const { data: sedeRow, error: sErr } = await supabase
      .from('sedes')
      .select('id, nombre, email_contacto, stripe_customer_id, stripe_subscription_id')
      .eq('id', sid)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!sedeRow) return res.status(404).json({ error: 'Sede no encontrada' });

    let adminEmail = await fetchAdminClubEmailForSede(sid);
    if (!adminEmail) {
      adminEmail = String(sedeRow.email_contacto || '').trim().toLowerCase();
    }
    if (!adminEmail || !adminEmail.includes('@')) {
      return res.status(400).json({
        error:
          'No hay email de admin_club ni email_contacto válido. Asigna un admin al club o completa el contacto de la sede.',
      });
    }

    const existingSub = String(sedeRow.stripe_subscription_id || '').trim();
    if (existingSub.startsWith('sub_')) {
      const sub = await st.subscriptions.retrieve(existingSub, {
        expand: ['latest_invoice.payment_intent'],
      });
      if (sub.status === 'active' || sub.status === 'trialing') {
        return res.status(400).json({
          error: 'La sede ya tiene una suscripción en curso',
          subscription_status: sub.status,
        });
      }
      if (sub.status === 'incomplete' || sub.status === 'past_due' || sub.status === 'unpaid') {
        const inv = sub.latest_invoice;
        const piRaw = inv && typeof inv === 'object' ? inv.payment_intent : null;
        const pi =
          typeof piRaw === 'string' ? await st.paymentIntents.retrieve(piRaw) : piRaw;
        if (pi?.client_secret) {
          return res.json({
            client_secret: pi.client_secret,
            subscription_id: sub.id,
            customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          });
        }
      }
    }

    let customerId = String(sedeRow.stripe_customer_id || '').trim();
    if (!customerId.startsWith('cus_')) {
      const cust = await st.customers.create({
        email: adminEmail,
        metadata: { sede_id: String(sid) },
      });
      customerId = cust.id;
      const { error: cuErr } = await supabase.from('sedes').update({ stripe_customer_id: customerId }).eq('id', sid);
      if (cuErr) throw cuErr;
    }

    const subscription = await st.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: { sede_id: String(sid) },
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    const inv = subscription.latest_invoice;
    const pi = inv && typeof inv === 'object' ? inv.payment_intent : null;
    const paymentIntent = typeof pi === 'string' ? await st.paymentIntents.retrieve(pi) : pi;
    const clientSecret = paymentIntent?.client_secret || null;

    const { error: upErr } = await supabase
      .from('sedes')
      .update({
        stripe_subscription_id: subscription.id,
        suscripcion_estado: 'pendiente_pago',
      })
      .eq('id', sid);
    if (upErr) throw upErr;

    res.json({
      client_secret: clientSecret,
      subscription_id: subscription.id,
      customer_id: customerId,
    });
  } catch (err) {
    console.error('❌ POST /api/stripe/suscripcion/crear:', err?.message || err);
    res.status(err.status || 500).json({ error: err.message || String(err) });
  }
});

async function handleStripeBillingWebhook(req, res) {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET no configurado');
    return res.status(500).send('webhook no configurado');
  }
  const sig = req.headers['stripe-signature'];
  const buf = req.rawBody;
  if (!Buffer.isBuffer(buf)) {
    return res.status(400).send('raw body requerido');
  }
  let event;
  try {
    event = getStripeOrThrow().webhooks.constructEvent(buf, sig, secret);
  } catch (err) {
    console.error('❌ Webhook Stripe firma:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const inv = event.data.object;
        const subId = inv.subscription ? String(inv.subscription) : null;
        const customerId = inv.customer ? String(inv.customer) : null;
        const sedeId = await resolveSedeIdFromStripeContext({ subscriptionId: subId, customerId });
        if (!sedeId) {
          console.warn('⚠️ invoice.payment_succeeded: sede no encontrada', { subId, customerId });
          break;
        }
        const st = getStripeOrThrow();
        let periodEndIso = null;
        if (subId) {
          const sub = await st.subscriptions.retrieve(subId);
          if (sub.current_period_end) {
            periodEndIso = new Date(sub.current_period_end * 1000).toISOString();
          }
        }
        const { error } = await supabase
          .from('sedes')
          .update({
            suscripcion_estado: 'activa',
            suscripcion_proximo_cobro: periodEndIso,
            ...(subId ? { stripe_subscription_id: subId } : {}),
          })
          .eq('id', sedeId);
        if (error) throw error;
        const monto = Number(inv.amount_paid ?? inv.amount_due ?? 0) / 100;
        const { data: sedePago } = await supabase
          .from('sedes')
          .select('nombre, email_contacto')
          .eq('id', sedeId)
          .maybeSingle();
        void sendMakeEvent('pago_exitoso', {
          nombre: String(sedePago?.nombre || '').trim() || null,
          email: String(sedePago?.email_contacto || '').trim().toLowerCase() || null,
          sede: String(sedePago?.nombre || '').trim() || null,
          monto: Number.isFinite(monto) ? monto : null,
          metodo_pago: 'stripe',
          reserva_id: null,
        });
        console.log(`✓ Webhook invoice.payment_succeeded → suscripción activa sede ${sedeId}`);
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object;
        const subId = inv.subscription ? String(inv.subscription) : null;
        const customerId = inv.customer ? String(inv.customer) : null;
        const sedeId = await resolveSedeIdFromStripeContext({ subscriptionId: subId, customerId });
        if (!sedeId) {
          console.warn('⚠️ invoice.payment_failed: sede no encontrada');
          break;
        }
        const { data: sedeNombreRow } = await supabase.from('sedes').select('nombre').eq('id', sedeId).maybeSingle();
        const { error } = await supabase.from('sedes').update({ suscripcion_estado: 'vencida' }).eq('id', sedeId);
        if (error) throw error;
        await sendSuscripcionPagoFallidoWhatsApp({
          sedeNombre: sedeNombreRow?.nombre,
          sedeId,
        });
        console.log(`✓ Webhook invoice.payment_failed → vencida sede ${sedeId}`);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const subId = sub.id;
        const customerId = sub.customer ? String(sub.customer) : null;
        const sedeId = await resolveSedeIdFromStripeContext({ subscriptionId: subId, customerId });
        if (!sedeId) break;
        const { error } = await supabase
          .from('sedes')
          .update({
            suscripcion_estado: 'cancelada',
            suscripcion_proximo_cobro: null,
            stripe_subscription_id: null,
            licencia_activa: false,
          })
          .eq('id', sedeId);
        if (error) throw error;
        console.log(`✓ Webhook customer.subscription.deleted → sede ${sedeId} inactiva (licencia off)`);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('❌ Webhook Stripe handler:', e?.message || e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
  res.json({ received: true });
}

app.post('/api/stripe/webhook', async (req, res) => {
  await handleStripeBillingWebhook(req, res);
});

// ─── Mercado Pago: webhooks producción (firma, idempotencia, auditoría) ─────

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runWithRetries(fn, { retries = 3, delayMs = 60_000 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.warn(`⚠️ MP webhook reintento ${i + 1}/${retries}:`, e?.message || e);
      if (i < retries - 1) await sleepMs(delayMs);
    }
  }
  throw lastErr;
}

async function insertWebhookLog({ source, event_type, payload, mp_payment_id = null }) {
  try {
    const row = {
      source,
      event_type: event_type != null ? String(event_type) : null,
      payload: payload && typeof payload === 'object' ? payload : { raw: String(payload) },
      procesado: false,
      ...(mp_payment_id ? { mp_payment_id: String(mp_payment_id) } : {}),
    };
    const { data, error } = await supabase.from('webhook_logs').insert(row).select('id').single();
    if (error) throw error;
    return data?.id || null;
  } catch (e) {
    console.error('❌ webhook_logs insert:', e?.message || e);
    return null;
  }
}

async function markWebhookLogDone(logId, extra = {}) {
  if (!logId) return;
  try {
    const patch = { procesado: true, ...extra };
    await supabase.from('webhook_logs').update(patch).eq('id', logId);
  } catch (e) {
    console.warn('webhook_logs update:', e?.message || e);
  }
}

function verifyMercadoPagoWebhookSignature(req) {
  const secret = String(process.env.MERCADOPAGO_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ MERCADOPAGO_WEBHOOK_SECRET requerido en producción para validar webhooks MP');
      return false;
    }
    console.warn('⚠️ Webhook MP: sin MERCADOPAGO_WEBHOOK_SECRET — firma omitida (solo desarrollo)');
    return true;
  }
  const xSig = req.headers['x-signature'] || req.headers['X-Signature'];
  const xRid = req.headers['x-request-id'] || req.headers['X-Request-Id'];
  if (!xSig || !xRid) return false;
  const dataIdRaw =
    req.query?.['data.id'] ??
    (String(req.query?.topic || '').toLowerCase() === 'payment' && req.query?.id ? req.query.id : null) ??
    req.body?.data?.id ??
    '';
  const dataID = String(dataIdRaw);
  let ts;
  let v1;
  for (const part of String(xSig).split(',')) {
    const [k, ...rest] = part.split('=');
    const key = String(k || '').trim();
    const val = rest.join('=').trim();
    if (key === 'ts') ts = val;
    else if (key === 'v1') v1 = val;
  }
  if (!ts || !v1) return false;
  let manifest = '';
  if (dataID) manifest += `id:${dataID};`;
  manifest += `request-id:${xRid};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(manifest);
  const sha = hmac.digest('hex');
  try {
    const a = Buffer.from(sha, 'hex');
    const b = Buffer.from(String(v1).trim(), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function extractMercadoPagoPaymentId(req) {
  const q = req.query || {};
  if (String(q.topic || '').toLowerCase() === 'payment' && q.id) {
    return String(q.id).trim();
  }
  const b = req.body || {};
  if (String(b.type || '').toLowerCase() === 'payment' && b.data?.id != null) {
    return String(b.data.id).trim();
  }
  if (String(b.action || '').startsWith('payment.') && b.data?.id != null) {
    return String(b.data.id).trim();
  }
  return null;
}

async function fetchMercadoPagoPaymentById(paymentId) {
  const id = String(paymentId || '').trim();
  if (!id) throw new Error('payment id vacío');
  const tokens = [];
  const main = String(process.env.MP_ACCESS_TOKEN || '').trim();
  if (main) tokens.push(main);
  try {
    const { data: sedes } = await supabase
      .from('sedes')
      .select('mp_access_token')
      .not('mp_access_token', 'is', null);
    for (const s of sedes || []) {
      const t = String(s.mp_access_token || '').trim();
      if (t && !tokens.includes(t)) tokens.push(t);
    }
  } catch {
    /* noop */
  }
  if (!tokens.length) throw new Error('Ningún MP_ACCESS_TOKEN configurado');
  let lastErr;
  for (const token of tokens) {
    try {
      const client = new MercadoPagoConfig({ accessToken: token });
      const api = new Payment(client);
      const data = await api.get({ id });
      if (data && data.id != null) return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('No se pudo obtener el pago en Mercado Pago');
}

async function mpPaymentApprovedAlreadyProcessed(paymentId) {
  const pid = String(paymentId || '').trim();
  if (!pid) return false;
  const { data, error } = await supabase
    .from('webhook_logs')
    .select('id')
    .eq('source', 'mercadopago')
    .eq('procesado', true)
    .eq('mp_payment_id', pid)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

function parseMercadoPagoExternalReference(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep */
  }
  try {
    const o = JSON.parse(s);
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

async function crearReservaConfirmadaDesdePayloadMp(payload) {
  const { sede, fecha, hora, cancha, nombre, email, whatsapp, nivel, precio, duracion, user_id } = payload;
  if (!sede || !fecha || !hora || cancha == null || !nombre || !email || !whatsapp) {
    throw new Error('Payload de reserva incompleto');
  }
  await assertCanchaPermitidaParaReservaPorNombreSede(sede, cancha);
  await assertReservaHorarioNoPasadoParaSede(sede, fecha, hora);
  let duracionMin = duracion != null && duracion !== '' ? parseInt(duracion, 10) : null;
  if (!Number.isFinite(duracionMin) || duracionMin <= 0) {
    const { data: sedeDur } = await supabase
      .from('sedes')
      .select('duracion_reserva_minutos')
      .eq('nombre', sede)
      .maybeSingle();
    duracionMin = parseInt(sedeDur?.duracion_reserva_minutos, 10) || 90;
  }
  try {
    await assertReservaSinSolapeBackend({ sede, fecha, hora, cancha, duracionMin });
  } catch (e) {
    if (e.status === 409) {
      const { data: existente } = await supabase
        .from('reservas')
        .select('*')
        .eq('sede', sede)
        .eq('fecha', fecha)
        .eq('cancha', parseInt(String(cancha), 10))
        .eq('hora', hora)
        .limit(1)
        .maybeSingle();
      return { ok: true, duplicate: true, data: existente ? [existente] : [] };
    }
    throw e;
  }
  const { data, error } = await supabase
    .from('reservas')
    .insert([
      {
        sede,
        fecha,
        hora,
        cancha: parseInt(String(cancha), 10),
        nombre,
        email: String(email).trim().toLowerCase(),
        telefono: whatsapp,
        whatsapp,
        nivel: nivel || 'Principiante',
        precio: parseInt(String(precio), 10),
        estado: 'confirmada',
        duracion: duracionMin,
        duracion_minutos: duracionMin,
        ...(user_id ? { user_id } : {}),
      },
    ])
    .select();
  if (error) throw error;
  const createdReserva = Array.isArray(data) ? data[0] : null;
  if (createdReserva?.id != null) {
    await insertReservaHistorialEstado(supabase, {
      reserva_id: createdReserva.id,
      estado_anterior: null,
      estado_nuevo: 'confirmada',
      changed_by: 'sistema',
    });
  }
  void sendMakeEvent('pago_exitoso', {
    nombre: String(nombre || '').trim() || null,
    email: String(email || '').trim().toLowerCase() || null,
    sede: String(sede || '').trim() || null,
    monto: createdReserva?.precio ?? (precio != null ? parseInt(String(precio), 10) : null),
    metodo_pago: 'mercadopago',
    reserva_id: createdReserva?.id ?? null,
  });
  sendReservaConfirmadaWhatsAppTwilio({
    email: String(email).trim().toLowerCase(),
    nombreFallback: nombre,
    fecha,
    hora,
    duracionMinutos: duracionMin,
    nombreSede: sede,
  }).catch((err) => console.warn('⚠️ WhatsApp confirmación reserva (webhook MP):', err.message));
  void crearNotificacionReservaConfirmada({
    userId: user_id,
    email: String(email).trim().toLowerCase(),
    sede,
    fecha,
    hora,
  });
  return { ok: true, data };
}

function normalizeDeportePartido(raw) {
  const s = String(raw || '').trim().toLowerCase();
  const compact = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '_');
  if (compact === 'padel' || compact === 'paddle') return 'padel';
  if (compact === 'pickleball') return 'pickleball';
  if (compact === 'futbol5' || compact === 'futbol_5') return 'futbol_5';
  if (compact === 'futbol7' || compact === 'futbol_7') return 'futbol_7';
  return 'padbol';
}

function jugadoresRequeridosPartido(deporte, rawCantidad) {
  const d = normalizeDeportePartido(deporte);
  const n = parseInt(String(rawCantidad || ''), 10);
  if (d === 'futbol_5') return 10;
  if (d === 'futbol_7') return 14;
  if (d === 'pickleball') return n === 2 ? 2 : 4;
  return 4;
}

function buildJugadorConfirmadoPartido(payload) {
  return {
    user_id: payload.capitan_user_id || payload.user_id || null,
    email: String(payload.email || payload.capitan_email || '').trim().toLowerCase(),
    nombre: String(payload.nombre || payload.capitan_nombre || '').trim() || 'Capitán',
    foto_url: String(payload.capitan_foto_url || '').trim() || null,
    rol: 'capitan',
  };
}

async function publicarPartidoAbiertoDesdePayload(payload, reservaRow = null) {
  const shareToken = String(payload.share_token || '').trim() || crypto.randomBytes(12).toString('hex');
  const { data: existente, error: exErr } = await supabase
    .from('partidos_abiertos')
    .select('*')
    .eq('share_token', shareToken)
    .maybeSingle();
  if (exErr) throw exErr;
  if (existente?.id) return { ok: true, partido: existente, already: true };

  const deporte = normalizeDeportePartido(payload.deporte);
  const jugadoresRequeridos = jugadoresRequeridosPartido(deporte, payload.jugadores_requeridos);
  const confirmadosRaw = parseInt(String(payload.jugadores_confirmados_count || '1'), 10);
  const confirmadosCount = Math.max(1, Math.min(jugadoresRequeridos, Number.isFinite(confirmadosRaw) ? confirmadosRaw : 1));
  const capitan = buildJugadorConfirmadoPartido(payload);
  const jugadoresConfirmados = [
    capitan,
    ...Array.from({ length: Math.max(0, confirmadosCount - 1) }, (_, idx) => ({
      nombre: `Jugador ${idx + 2}`,
      invitado: true,
    })),
  ];
  const sedeId = parseInt(String(payload.sede_id || payload.sedeId || ''), 10);
  const row = {
    reserva_id: reservaRow?.id ?? null,
    sede_id: Number.isFinite(sedeId) && sedeId > 0 ? sedeId : null,
    sede_nombre: String(payload.sede || payload.sede_nombre || '').trim(),
    cancha: parseInt(String(payload.cancha), 10),
    deporte,
    fecha: String(payload.fecha || '').trim().slice(0, 10),
    hora: String(payload.hora || '').trim().split(' - ')[0],
    duracion_minutos: parseInt(String(payload.duracion || payload.duracion_minutos || '90'), 10) || 90,
    nivel: String(payload.nivel || 'Principiante').trim(),
    jugadores_requeridos: jugadoresRequeridos,
    jugadores_confirmados: jugadoresConfirmados,
    capitan_user_id: payload.capitan_user_id || payload.user_id || null,
    capitan_email: capitan.email,
    capitan_nombre: capitan.nombre,
    capitan_foto_url: capitan.foto_url,
    estado: confirmadosCount >= jugadoresRequeridos ? 'completo' : 'abierto',
    share_token: shareToken,
  };
  if (!row.sede_nombre || !row.fecha || !row.hora || !row.cancha || !row.capitan_email) {
    const e = new Error('Payload de partido abierto incompleto');
    e.status = 400;
    throw e;
  }
  const { data, error } = await supabase.from('partidos_abiertos').insert([row]).select('*').single();
  if (error) throw error;
  return { ok: true, partido: data };
}

async function crearReservaYPartidoAbiertoDesdePayload(payload) {
  const reservaRes = await crearReservaConfirmadaDesdePayloadMp(payload);
  const reservaRow = Array.isArray(reservaRes?.data) ? reservaRes.data[0] : null;
  return publicarPartidoAbiertoDesdePayload(payload, reservaRow);
}

app.get('/api/partidos-abiertos', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('partidos_abiertos')
      .select('*')
      .in('estado', ['abierto', 'completo'])
      .gte('fecha', today)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })
      .limit(60);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('❌ GET /api/partidos-abiertos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/partidos-abiertos/confirmar-pago', async (req, res) => {
  try {
    const authUser = await authUserFromBearer(req);
    if (!authUser?.email) return res.status(401).json({ error: 'No autorizado' });
    const payload = req.body || {};
    const emailPayload = String(payload.email || payload.capitan_email || '').trim().toLowerCase();
    const emailUser = String(authUser.email || '').trim().toLowerCase();
    if (!emailPayload || emailPayload !== emailUser) {
      return res.status(403).json({ error: 'El email del partido debe coincidir con tu sesión' });
    }
    const out = await crearReservaYPartidoAbiertoDesdePayload({
      ...payload,
      user_id: authUser.id || payload.user_id || null,
      capitan_user_id: authUser.id || payload.capitan_user_id || null,
    });
    res.json(out);
  } catch (err) {
    console.error('❌ POST /api/partidos-abiertos/confirmar-pago:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/partidos-abiertos/:id/solicitudes', async (req, res) => {
  try {
    const authUser = await authUserFromBearer(req);
    if (!authUser?.email) return res.status(401).json({ error: 'No autorizado' });
    const partidoId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(partidoId) || partidoId <= 0) return res.status(400).json({ error: 'partido_id inválido' });
    const { data: partido, error: pErr } = await supabase
      .from('partidos_abiertos')
      .select('*')
      .eq('id', partidoId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
    if (String(partido.estado || '').toLowerCase() !== 'abierto') {
      return res.status(400).json({ error: 'Este partido no está abierto a solicitudes' });
    }
    const emailJugador = String(authUser.email || '').trim().toLowerCase();
    const capitanEmail = String(partido.capitan_email || '').trim().toLowerCase();
    if (emailJugador === capitanEmail) return res.status(400).json({ error: 'Ya eres el capitán de este partido' });

    const { data: perfil } = await supabase
      .from('jugadores_perfil')
      .select('nombre, apellido, apodo, foto_url, avatar_url, whatsapp')
      .eq('user_id', authUser.id)
      .maybeSingle();
    const nombreJugador =
      String(perfil?.apodo || '').trim() ||
      [perfil?.nombre, perfil?.apellido].map((v) => String(v || '').trim()).filter(Boolean).join(' ') ||
      String(authUser.user_metadata?.full_name || '').trim() ||
      emailJugador;
    const fotoJugador = String(perfil?.foto_url || perfil?.avatar_url || authUser.user_metadata?.avatar_url || '').trim() || null;
    const mensaje = String((req.body || {}).mensaje || '').trim().slice(0, 300);
    const { data: solicitud, error: sErr } = await supabase
      .from('partidos_abiertos_solicitudes')
      .insert([{
        partido_id: partidoId,
        jugador_user_id: authUser.id || null,
        jugador_email: emailJugador,
        jugador_nombre: nombreJugador,
        jugador_foto_url: fotoJugador,
        mensaje: mensaje || null,
        estado: 'pendiente',
      }])
      .select('*')
      .single();
    if (sErr) {
      if (String(sErr.message || '').toLowerCase().includes('duplicate')) {
        return res.status(409).json({ error: 'Ya enviaste una solicitud para este partido' });
      }
      throw sErr;
    }

    const body =
      `Nuevo pedido para tu partido en Padbol Match\n\n` +
      `${nombreJugador} quiere jugar ${String(partido.deporte || '').toUpperCase()} en ${partido.sede_nombre} ` +
      `el ${formatFechaReservaConfirmacion(String(partido.fecha || '').slice(0, 10))} a las ${horaLegibleUnPuntoReserva(partido.hora)}.\n\n` +
      `Entra a la app para aceptar o rechazar.`;
    await enviarTwilioWhatsappJugadorPorEmailPerfilReserva({
      email: capitanEmail,
      body,
      warnSinWhatsapp: 'Solicitud partido abierto',
    });
    void crearNotificacionJugador({
      userId: partido.capitan_user_id,
      email: capitanEmail,
      tipo: 'partido_solicitud',
      titulo: 'Quieren unirse a tu partido',
      mensaje: `${nombreJugador} pidió sumarse a tu partido en ${partido.sede_nombre}.`,
      link: '/partidos-abiertos',
    });
    res.json({ ok: true, solicitud });
  } catch (err) {
    console.error('❌ POST /api/partidos-abiertos/:id/solicitudes:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/partidos-abiertos/mis-solicitudes', async (req, res) => {
  try {
    const authUser = await authUserFromBearer(req);
    if (!authUser?.email) return res.status(401).json({ error: 'No autorizado' });
    const email = String(authUser.email || '').trim().toLowerCase();
    const { data: partidos, error: pErr } = await supabase
      .from('partidos_abiertos')
      .select('id,sede_nombre,deporte,fecha,hora,jugadores_requeridos,jugadores_confirmados,capitan_email,estado')
      .eq('capitan_email', email)
      .in('estado', ['abierto', 'completo'])
      .order('fecha', { ascending: true });
    if (pErr) throw pErr;
    const ids = (partidos || []).map((p) => p.id).filter(Boolean);
    if (!ids.length) return res.json([]);
    const { data: solicitudes, error: sErr } = await supabase
      .from('partidos_abiertos_solicitudes')
      .select('*')
      .in('partido_id', ids)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true });
    if (sErr) throw sErr;
    const partidoMap = new Map((partidos || []).map((p) => [Number(p.id), p]));
    res.json((solicitudes || []).map((s) => ({ ...s, partido: partidoMap.get(Number(s.partido_id)) || null })));
  } catch (err) {
    console.error('❌ GET /api/partidos-abiertos/mis-solicitudes:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.patch('/api/partidos-abiertos/solicitudes/:id', async (req, res) => {
  try {
    const authUser = await authUserFromBearer(req);
    if (!authUser?.email) return res.status(401).json({ error: 'No autorizado' });
    const solicitudId = parseInt(String(req.params.id), 10);
    const estado = String((req.body || {}).estado || '').trim().toLowerCase();
    if (!['aceptada', 'rechazada'].includes(estado)) {
      return res.status(400).json({ error: 'estado debe ser aceptada o rechazada' });
    }
    const { data: solicitud, error: sErr } = await supabase
      .from('partidos_abiertos_solicitudes')
      .select('*')
      .eq('id', solicitudId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const { data: partido, error: pErr } = await supabase
      .from('partidos_abiertos')
      .select('*')
      .eq('id', solicitud.partido_id)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!partido) return res.status(404).json({ error: 'Partido no encontrado' });
    const emailUser = String(authUser.email || '').trim().toLowerCase();
    if (String(partido.capitan_email || '').trim().toLowerCase() !== emailUser) {
      return res.status(403).json({ error: 'Solo el capitán puede gestionar esta solicitud' });
    }

    const { data: updatedSolicitud, error: upSolErr } = await supabase
      .from('partidos_abiertos_solicitudes')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', solicitudId)
      .select('*')
      .single();
    if (upSolErr) throw upSolErr;

    let updatedPartido = partido;
    if (estado === 'aceptada') {
      const jugadores = Array.isArray(partido.jugadores_confirmados) ? partido.jugadores_confirmados : [];
      const emailJugador = String(solicitud.jugador_email || '').trim().toLowerCase();
      const existe = jugadores.some((j) => String(j?.email || '').trim().toLowerCase() === emailJugador);
      const requeridos = parseInt(String(partido.jugadores_requeridos || '4'), 10) || 4;
      const nextJugadores = existe
        ? jugadores
        : [
            ...jugadores,
            {
              user_id: solicitud.jugador_user_id || null,
              email: emailJugador,
              nombre: solicitud.jugador_nombre || emailJugador,
              foto_url: solicitud.jugador_foto_url || null,
              rol: 'jugador',
            },
          ].slice(0, requeridos);
      const nextEstado = nextJugadores.length >= requeridos ? 'completo' : 'abierto';
      const { data: pUp, error: upPartidoErr } = await supabase
        .from('partidos_abiertos')
        .update({ jugadores_confirmados: nextJugadores, estado: nextEstado, updated_at: new Date().toISOString() })
        .eq('id', partido.id)
        .select('*')
        .single();
      if (upPartidoErr) throw upPartidoErr;
      updatedPartido = pUp;
    }
    void crearNotificacionJugador({
      userId: solicitud.jugador_user_id,
      email: solicitud.jugador_email,
      tipo: estado === 'aceptada' ? 'partido_solicitud_aceptada' : 'partido_solicitud_rechazada',
      titulo: estado === 'aceptada' ? 'Te aceptaron en el partido' : 'Solicitud rechazada',
      mensaje:
        estado === 'aceptada'
          ? `Ya estás confirmado para jugar en ${partido.sede_nombre}.`
          : `El capitán rechazó tu solicitud para el partido en ${partido.sede_nombre}.`,
      link: '/partidos-abiertos',
    });
    res.json({ ok: true, solicitud: updatedSolicitud, partido: updatedPartido });
  } catch (err) {
    console.error('❌ PATCH /api/partidos-abiertos/solicitudes/:id:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

async function sendInscripcionTorneoMakeEvent({ equipoId, torneoId, emailHint = '' }) {
  const eid = parseInt(String(equipoId), 10);
  const tid = parseInt(String(torneoId), 10);
  if (!eid || !tid) return;
  try {
    const [{ data: eq }, { data: torneo }] = await Promise.all([
      supabase
        .from('equipos')
        .select('id, nombre, creador_email')
        .eq('id', eid)
        .maybeSingle(),
      supabase
        .from('torneos')
        .select('id, nombre, fecha_inicio, sede_id')
        .eq('id', tid)
        .maybeSingle(),
    ]);
    if (!eq || !torneo) return;
    let sedeNombre = null;
    if (torneo.sede_id != null) {
      const { data: sede } = await supabase.from('sedes').select('nombre').eq('id', torneo.sede_id).maybeSingle();
      sedeNombre = String(sede?.nombre || '').trim() || null;
    }
    void sendMakeEvent('inscripcion_torneo', {
      nombre: String(eq.nombre || '').trim() || null,
      email: String(emailHint || eq.creador_email || '').trim().toLowerCase() || null,
      torneo: String(torneo.nombre || '').trim() || null,
      sede: sedeNombre,
      fecha_torneo: torneo.fecha_inicio || null,
    });
  } catch {
    /* ignore Make sideflow data fetch errors */
  }
}

async function confirmarTorneoInscripcionDesdePayloadMp(payload) {
  const eid = parseInt(String(payload.equipo_id), 10);
  const tid = parseInt(String(payload.torneo_id), 10);
  if (!eid || !tid) throw new Error('Payload torneo_inscripcion incompleto');
  const { data: eq, error: errEq } = await supabase
    .from('equipos')
    .select('id, torneo_id, inscripcion_estado')
    .eq('id', eid)
    .maybeSingle();
  if (errEq) throw errEq;
  if (!eq) throw new Error('Equipo no encontrado');
  if (Number(eq.torneo_id) !== tid) throw new Error('El equipo no pertenece a ese torneo');
  if (String(eq.inscripcion_estado || '').toLowerCase() === 'confirmado') {
    return { ok: true, already: true };
  }
  const { data: torneoRow, error: errTorneo } = await supabase
    .from('torneos')
    .select('fecha_inicio')
    .eq('id', tid)
    .maybeSingle();
  if (errTorneo) throw errTorneo;
  if (!torneoRow) throw new Error('Torneo no encontrado');
  if (torneoFechaInicioEsAnteriorAHoyArt(torneoRow.fecha_inicio)) {
    throw new Error(MSG_TORNEO_INSCRIPCION_FECHA_PASADA);
  }
  const { error: errUp } = await supabase.from('equipos').update({ inscripcion_estado: 'confirmado' }).eq('id', eid);
  if (errUp) throw errUp;
  await sendInscripcionTorneoMakeEvent({ equipoId: eid, torneoId: tid, emailHint: payload?.email });
  return { ok: true };
}

async function liberarSlotReservaPendienteMp(payload) {
  if (!payload || String(payload.tipo || '').toLowerCase() === 'torneo_inscripcion') return;
  const sede = String(payload.sede || '').trim();
  const fecha = String(payload.fecha || '').trim();
  const hora = String(payload.hora || '').trim();
  const cancha = parseInt(String(payload.cancha), 10);
  if (!sede || !fecha || !hora || !Number.isFinite(cancha)) return;
  const { error } = await supabase
    .from('reservas')
    .delete()
    .eq('sede', sede)
    .eq('fecha', fecha)
    .eq('hora', hora)
    .eq('cancha', cancha)
    .in('estado', ['pendiente_pago_mercadopago', 'pendiente_mercadopago']);
  if (error) console.warn('⚠️ liberar slot MP:', error.message);
}

async function procesarPagoMercadoPagoWebhook(logId, paymentId) {
  const payment = await fetchMercadoPagoPaymentById(paymentId);
  const pid = String(payment?.id ?? paymentId);
  const status = String(payment?.status || '').toLowerCase();
  await supabase.from('webhook_logs').update({ mp_payment_id: pid }).eq('id', logId);

  if (status === 'approved') {
    if (await mpPaymentApprovedAlreadyProcessed(pid)) {
      await markWebhookLogDone(logId, { mp_payment_id: pid });
      console.log(`✓ MP webhook: pago ${pid} ya procesado (idempotencia)`);
      return;
    }
    const ext = parseMercadoPagoExternalReference(payment.external_reference);
    if (!ext) {
      throw new Error('external_reference vacío o inválido');
    }
    const tipo = String(ext.tipo || '').toLowerCase();
    if (tipo === 'torneo_inscripcion') {
      await confirmarTorneoInscripcionDesdePayloadMp(ext);
    } else if (tipo === 'partido_abierto') {
      await crearReservaYPartidoAbiertoDesdePayload(ext);
    } else {
      await crearReservaConfirmadaDesdePayloadMp(ext);
    }
    await markWebhookLogDone(logId, { mp_payment_id: pid });
    console.log(`✓ MP webhook: pago ${pid} approved → confirmado`);
    return;
  }

  if (['pending', 'in_process', 'authorized'].includes(status)) {
    await markWebhookLogDone(logId, { mp_payment_id: pid });
    console.log(`ℹ️ MP webhook: pago ${pid} estado ${status} — sin confirmar`);
    return;
  }

  if (['rejected', 'cancelled'].includes(status)) {
    const ext = parseMercadoPagoExternalReference(payment.external_reference);
    if (ext) await liberarSlotReservaPendienteMp(ext);
    await markWebhookLogDone(logId, { mp_payment_id: pid });
    console.log(`✓ MP webhook: pago ${pid} ${status} — slot pendiente liberado si existía`);
    return;
  }

  await markWebhookLogDone(logId, { mp_payment_id: pid });
  console.log(`ℹ️ MP webhook: pago ${pid} estado ${status || '—'} — sin acción`);
}

/** Healthcheck / validación URL en panel MP */
app.get('/api/pagos/webhook', (req, res) => {
  res.status(200).send('ok');
});

app.post('/api/pagos/webhook', async (req, res) => {
  const eventType = req.body?.action || req.body?.type || req.query?.topic || 'unknown';
  const logPayload = {
    body: req.body,
    query: req.query,
    headers: {
      'x-signature': req.headers['x-signature'] ? '[set]' : null,
      'x-request-id': req.headers['x-request-id'] || null,
    },
  };
  const logId = await insertWebhookLog({
    source: 'mercadopago',
    event_type: String(eventType),
    payload: logPayload,
  });

  if (!verifyMercadoPagoWebhookSignature(req)) {
    console.warn('❌ Webhook MP: firma inválida o faltante');
    return res.status(401).send('Invalid signature');
  }

  const paymentId = extractMercadoPagoPaymentId(req);
  if (!paymentId) {
    await markWebhookLogDone(logId);
    return res.status(200).json({ received: true, ignored: 'no payment id' });
  }

  res.status(200).json({ received: true });

  setImmediate(() => {
    void (async () => {
      try {
        await runWithRetries(() => procesarPagoMercadoPagoWebhook(logId, paymentId), {
          retries: 3,
          delayMs: 60_000,
        });
      } catch (e) {
        console.error('❌ MP webhook: falló tras reintentos:', e?.message || e);
      }
    })();
  });
});

// POST /api/crear-preferencia — Mercado Pago Checkout Pro
app.post('/api/crear-preferencia', async (req, res) => {
  try {
    const b = req.body || {};
    const {
      titulo,
      precio,
      monto,
      moneda,
      sedeNombre,
      reservaData: reservaDataIn,
      sedeId,
      tipo,
      equipo_id,
      torneo_id,
      email,
    } = b;
    const unitPrice = Number(monto != null && monto !== '' ? monto : precio);
    if (!titulo || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ error: 'Faltan campos requeridos: titulo, precio o monto' });
    }

    let reservaData = reservaDataIn;
    const tipoEff = String(reservaDataIn?.tipo || tipo || '').toLowerCase();
    let torneoSedeIdForCfg = null;
    if (tipoEff === 'torneo_inscripcion') {
      const eid = parseInt(String(equipo_id ?? reservaDataIn?.equipo_id), 10);
      const tid = parseInt(String(torneo_id ?? reservaDataIn?.torneo_id), 10);
      if (!eid || !tid) {
        return res.status(400).json({ error: 'torneo_inscripcion requiere equipo_id y torneo_id' });
      }
      const { data: torneoRow, error: tErr } = await supabase
        .from('torneos')
        .select('fecha_inicio, sede_id')
        .eq('id', tid)
        .maybeSingle();
      if (tErr) throw tErr;
      if (!torneoRow) return res.status(400).json({ error: 'Torneo no encontrado' });
      if (torneoFechaInicioEsAnteriorAHoyArt(torneoRow.fecha_inicio)) {
        return res.status(400).json({ error: MSG_TORNEO_INSCRIPCION_FECHA_PASADA });
      }
      if (torneoRow.sede_id != null && Number.isFinite(Number(torneoRow.sede_id))) {
        torneoSedeIdForCfg = Number(torneoRow.sede_id);
      }
      const em = String(email || reservaDataIn?.email || '').trim().toLowerCase();
      reservaData = {
        tipo: 'torneo_inscripcion',
        equipo_id: eid,
        torneo_id: tid,
        email: em,
      };
    }

    const sidNum = Number(sedeId);
    const effectiveSedeId =
      Number.isFinite(sidNum) && sidNum > 0 ? sidNum : torneoSedeIdForCfg != null ? torneoSedeIdForCfg : null;
    let sedeCfg = effectiveSedeId ? await sedePaymentConfigBySedeId(effectiveSedeId) : null;
    if (!sedeCfg && reservaData && typeof reservaData === 'object' && reservaData.sede) {
      sedeCfg = await sedePaymentConfigByNombre(String(reservaData.sede).trim());
    }
    const metodoPago = normalizeMetodoPago(sedeCfg?.metodo_pago || 'mercadopago');
    const instruccionesManual = String(sedeCfg?.pago_manual_instrucciones || '').trim();

    if (metodoPago === 'manual' || metodoPago === 'efectivo') {
      const esEfectivo = metodoPago === 'efectivo';
      const estadoPresencial = esEfectivo ? 'pendiente_pago_efectivo' : 'pendiente_pago_manual';
      if (tipoEff === 'torneo_inscripcion') {
        return res.json({
          manual_payment: !esEfectivo,
          efectivo_payment: esEfectivo,
          instructions: esEfectivo
            ? 'Esta sede acepta pago presencial. Presenta tu inscripción al llegar al club.'
            : instruccionesManual || 'Coordina el pago manual con la sede para confirmar la inscripción.',
          status: estadoPresencial,
          tipo: 'torneo_inscripcion',
        });
      }
      const r = reservaData && typeof reservaData === 'object' ? reservaData : null;
      if (!r) {
        return res.status(400).json({
          error: esEfectivo ? 'Para pago en efectivo se requiere reservaData' : 'Para pago manual se requiere reservaData',
        });
      }
      const payloadReserva = {
        sede: r.sede,
        fecha: r.fecha,
        hora: r.hora,
        cancha: r.cancha,
        nombre: r.nombre,
        email: r.email,
        whatsapp: r.whatsapp,
        nivel: r.nivel || 'Principiante',
        precio: Number(r.precio) || unitPrice,
        estado: estadoPresencial,
        duracion: r.duracion,
      };
      try {
        await assertCanchaPermitidaParaReservaPorNombreSede(
          String(payloadReserva.sede || '').trim(),
          payloadReserva.cancha
        );
        await assertReservaHorarioNoPasadoParaSede(
          String(payloadReserva.sede || '').trim(),
          String(payloadReserva.fecha || '').trim(),
          String(payloadReserva.hora || '').trim()
        );
        let duracionMinManual = parseInt(String(payloadReserva.duracion), 10);
        if (!Number.isFinite(duracionMinManual) || duracionMinManual <= 0) duracionMinManual = 90;
        payloadReserva.duracion = duracionMinManual;
        payloadReserva.duracion_minutos = duracionMinManual;
        await assertReservaSinSolapeBackend({
          sede: String(payloadReserva.sede || '').trim(),
          fecha: String(payloadReserva.fecha || '').trim(),
          hora: String(payloadReserva.hora || '').trim(),
          cancha: payloadReserva.cancha,
          duracionMin: duracionMinManual,
        });
      } catch (e) {
        const st = e.status || 400;
        return res.status(st).json({ error: e.message || String(e) });
      }
      const { data: reservaCreada, error: resErr } = await supabase.from('reservas').insert([payloadReserva]).select().single();
      if (resErr) throw resErr;
      let partidoCreado = null;
      if (String(r.tipo || '').trim().toLowerCase() === 'partido_abierto') {
        const pub = await publicarPartidoAbiertoDesdePayload(r, reservaCreada);
        partidoCreado = pub.partido || null;
      }
      if (reservaCreada?.id != null) {
        await insertReservaHistorialEstado(supabase, {
          reserva_id: reservaCreada.id,
          estado_anterior: null,
          estado_nuevo: String(payloadReserva.estado || '').trim() || estadoPresencial,
          changed_by: 'sistema',
        });
      }
      return res.json({
        manual_payment: !esEfectivo,
        efectivo_payment: esEfectivo,
        instructions: esEfectivo
          ? null
          : instruccionesManual || 'Transfiere o abona en sede y comparte el comprobante por WhatsApp.',
        reservation: reservaCreada,
        partido: partidoCreado,
      });
    }

    if (metodoPago === 'stripe') {
      const stripeAccountId = String(sedeCfg?.stripe_account_id || '').trim() || null;
      return res.json({
        stripe_checkout_pending: true,
        provider: 'stripe',
        stripe_account_id: stripeAccountId,
        message:
          'Stripe Connect está en implementación. Mientras tanto usa Mercado Pago, pago manual o efectivo en sede según la sede.',
      });
    }

    const mpTokSede = String(sedeCfg?.mp_access_token || '').trim();
    if (!mpTokSede) {
      return res.status(400).json({
        error:
          'Esta sede no tiene configurado Mercado Pago. En Admin → Mi sede → Configuración de pagos, ingresa el Access Token de la cuenta del club.',
      });
    }
    const client = new MercadoPagoConfig({ accessToken: mpTokSede });

    // Embed full reservation data as JSON in external_reference so
    // PagoExitoso can create the reservation after payment is approved.
    const externalReference = reservaData ? JSON.stringify(reservaData) : '';

    if (reservaData && typeof reservaData === 'object' && tipoEff !== 'torneo_inscripcion') {
      const rdSede = reservaData.sede;
      const rdCancha = reservaData.cancha;
      if (rdSede && rdCancha != null) {
        try {
          await assertCanchaPermitidaParaReservaPorNombreSede(String(rdSede).trim(), rdCancha);
        } catch (e) {
          const st = e.status || 400;
          return res.status(st).json({ error: e.message || String(e) });
        }
      }
    }

    const preference = new Preference(client);
    const response = await preference.create({
      body: {
        items: [{
          title: titulo,
          unit_price: unitPrice,
          quantity: 1,
          currency_id: moneda || 'ARS',
        }],
        back_urls: {
          success: `${FRONTEND_URL}/pago-exitoso`,
          failure: `${FRONTEND_URL}/pago-fallido`,
          pending: `${FRONTEND_URL}/pago-fallido`,
        },
        auto_return: 'approved',
        external_reference: externalReference,
        statement_descriptor: sedeNombre || 'Padbol Match',
      },
    });

    console.log(`✓ MP preferencia creada: ${response.id} | success→ ${FRONTEND_URL}/pago-exitoso | sede: ${sedeNombre || '—'}`);
    res.json({ init_point: response.init_point, preference_id: response.id });
  } catch (err) {
    console.error('❌ Error POST /api/crear-preferencia:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: sedes pendientes / alta sede (usa auth arriba) ───────────────────

async function sendTwilioWhatsAppBodyToRaw(toRaw, body) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('⚠️ Twilio no configurado — no se envía WhatsApp');
    return;
  }
  const raw = String(toRaw || '').trim();
  if (!raw) return;
  const to = raw.toLowerCase().startsWith('whatsapp:') ? raw : normalizePhoneToE164ForTwilioWhatsApp(raw);
  if (!to) {
    console.warn('⚠️ WhatsApp: destino no normalizable:', toRaw);
    return;
  }
  await twilioClient.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body: String(body || '').trim() });
  console.log(`✓ WhatsApp enviado → ${to}`);
}

async function fetchJugadorWhatsappPorEmail(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return null;
  const { data } = await supabase.from('jugadores_perfil').select('whatsapp').eq('email', em).maybeSingle();
  const w = data?.whatsapp != null ? String(data.whatsapp).trim() : '';
  return w || null;
}

async function sendSolicitudLicenciaConfirmacionEmail({ toEmail, clubNombre, responsableNombre }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || 'Padbol Match <no-reply@padbolmatch.com>').trim();
  const to = String(toEmail || '').trim().toLowerCase();
  if (!apiKey || !to) return;
  const bodyHtml = `
    <p>Hola ${String(responsableNombre || '').trim() || 'club'},</p>
    <p>Recibimos tu solicitud para sumar <strong>${String(clubNombre || '').trim() || 'tu club'}</strong> a Padbol Match.</p>
    <p>Nuestro equipo la revisará y te contactará por email o WhatsApp.</p>
    <p>¡Gracias por tu interés!</p>
    <p><strong>PADBOL Match</strong></p>
  `;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Recibimos tu solicitud para unirte a Padbol Match',
        html: bodyHtml,
      }),
    });
  } catch (e) {
    console.warn('⚠️ Email confirmación solicitud licencia:', e?.message || e);
  }
}

/** Opt-in `jugadores_perfil.notificaciones_whatsapp`: novedades/promos de torneo (no invitaciones transaccionales). */
async function jugadorAceptaNotificacionesTorneoPromoPorEmail(emailNorm) {
  const em = String(emailNorm || '').trim().toLowerCase();
  if (!em) return false;
  const { data } = await supabase
    .from('jugadores_perfil')
    .select('notificaciones_whatsapp')
    .eq('email', em)
    .maybeSingle();
  return data?.notificaciones_whatsapp === true;
}

async function jugadorAceptaNotificacionesTorneoPromoPorUserId(uid) {
  const id = String(uid || '').trim();
  if (!id) return false;
  const { data } = await supabase
    .from('jugadores_perfil')
    .select('notificaciones_whatsapp')
    .eq('user_id', id)
    .maybeSingle();
  return data?.notificaciones_whatsapp === true;
}

async function upsertUserRoleAdminClub({ email, nombre, pais, sede_id }) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return new Error('Email licenciatario vacío');
  const payload = {
    email: em,
    role: 'admin_club',
    alcance: 'sede',
    nombre: nombre || null,
    pais: pais || null,
    ciudad: null,
    provincia: null,
    sede_id,
    torneos_oficiales_habilitados: false,
  };
  const { data: ex } = await supabase.from('user_roles').select('email').eq('email', em).maybeSingle();
  if (ex?.email) {
    const { error } = await supabase
      .from('user_roles')
      .update({
        role: 'admin_club',
        alcance: 'sede',
        nombre: payload.nombre,
        pais: payload.pais,
        ciudad: null,
        provincia: null,
        sede_id: payload.sede_id,
        torneos_oficiales_habilitados: false,
      })
      .eq('email', em);
    return error || null;
  }
  const { error } = await supabase.from('user_roles').insert(payload);
  return error || null;
}

/** Invitación geo: admin_nacional con alcance pais | provincia | ciudad (sin crear sede). */
function invitacionAdminEsFlujoGeo(inv) {
  const role = String(inv?.invited_role || 'admin_club').trim().toLowerCase();
  const alc = String(inv?.invited_alcance || '').trim().toLowerCase();
  return role === 'admin_nacional' && ['pais', 'provincia', 'ciudad'].includes(alc);
}

async function upsertUserRoleFromInvitacionGeo({ email, nombre, inv }) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return new Error('Email vacío');
  const alcance = String(inv.invited_alcance || '').trim().toLowerCase();
  const pais = String(inv.pais || '').trim() || null;
  const provinciaInv = String(inv.provincia || '').trim() || null;
  const ciudadInv = String(inv.ciudad || '').trim() || null;

  let row;
  if (alcance === 'pais') {
    if (!pais) return new Error('País obligatorio en la invitación');
    row = {
      email: em,
      role: 'admin_nacional',
      alcance: 'pais',
      nombre: nombre || null,
      sede_id: null,
      ciudad: null,
      provincia: null,
      pais,
      torneos_oficiales_habilitados: true,
    };
  } else if (alcance === 'provincia') {
    if (!provinciaInv) return new Error('Provincia obligatoria en la invitación');
    row = {
      email: em,
      role: 'admin_nacional',
      alcance: 'provincia',
      nombre: nombre || null,
      sede_id: null,
      ciudad: null,
      provincia: provinciaInv,
      pais: pais || null,
      torneos_oficiales_habilitados: true,
    };
  } else if (alcance === 'ciudad') {
    if (!ciudadInv) return new Error('Ciudad obligatoria en la invitación');
    row = {
      email: em,
      role: 'admin_nacional',
      alcance: 'ciudad',
      nombre: nombre || null,
      sede_id: null,
      ciudad: ciudadInv,
      provincia: provinciaInv || null,
      pais: pais || null,
      torneos_oficiales_habilitados: true,
    };
  } else {
    return new Error('Tipo de invitación geográfica no válido');
  }

  const { data: ex } = await supabase.from('user_roles').select('email').eq('email', em).maybeSingle();
  if (ex?.email) {
    const { error } = await supabase.from('user_roles').update(row).eq('email', em);
    return error || null;
  }
  const { error } = await supabase.from('user_roles').insert(row);
  return error || null;
}

function randomTemporaryPassword() {
  return `Padbol#${Math.random().toString(36).slice(2, 8)}${Date.now().toString().slice(-4)}`;
}

function licenciaRoleAssignment(payload, sedeId) {
  const tipo = String(payload?.tipo_licencia || 'club_afiliado').trim().toLowerCase();
  if (tipo === 'master_ciudad') {
    return {
      role: 'admin_nacional',
      alcance: 'ciudad',
      sede_id: null,
      ciudad: String(payload?.ciudad_representa || payload?.ciudad || '').trim() || null,
      provincia: null,
      pais: null,
    };
  }
  if (tipo === 'master_provincia') {
    return {
      role: 'admin_nacional',
      alcance: 'provincia',
      sede_id: null,
      ciudad: null,
      provincia: String(payload?.provincia_representa || payload?.provincia || '').trim() || null,
      pais: null,
    };
  }
  if (tipo === 'master_pais') {
    return {
      role: 'admin_nacional',
      alcance: 'pais',
      sede_id: null,
      ciudad: null,
      provincia: null,
      pais: String(payload?.pais_representa || payload?.licenciatario_pais || payload?.pais || '').trim() || null,
    };
  }
  return {
    role: 'admin_club',
    alcance: 'sede',
    sede_id: sedeId,
    ciudad: null,
    provincia: null,
    pais: String(payload?.licenciatario_pais || payload?.pais || '').trim() || null,
  };
}

async function upsertUserRoleLicenciaAsignada({ email, nombre, payload, sedeId }) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return new Error('Email licenciatario vacío');
  const a = licenciaRoleAssignment(payload, sedeId);
  if (a.alcance === 'ciudad' && !a.ciudad) return new Error('Falta ciudad_representa para alcance ciudad');
  if (a.alcance === 'provincia' && !a.provincia) return new Error('Falta provincia_representa para alcance provincia');
  if (a.alcance === 'pais' && !a.pais) return new Error('Falta pais_representa para alcance pais');

  const row = {
    email: em,
    role: a.role,
    alcance: a.alcance,
    nombre: String(nombre || '').trim() || null,
    sede_id: a.sede_id ?? null,
    ciudad: a.ciudad ?? null,
    provincia: a.provincia ?? null,
    pais: a.pais ?? null,
    torneos_oficiales_habilitados: a.role === 'admin_nacional',
  };
  const { data: ex } = await supabase.from('user_roles').select('email').eq('email', em).maybeSingle();
  if (ex?.email) {
    const { error } = await supabase.from('user_roles').update(row).eq('email', em);
    return error || null;
  }
  const { error } = await supabase.from('user_roles').insert(row);
  return error || null;
}

async function ensureLicenciatarioAuthUserAndWelcomeEmail(email, opts = {}) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return { created: false, tempPassword: null };
  const tempPassword = randomTemporaryPassword();
  let created = false;
  const cr = await supabase.auth.admin.createUser({
    email: em,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { temp_password: true },
  });
  if (cr.error) {
    const msg = String(cr.error?.message || '').toLowerCase();
    if (!msg.includes('already') && !msg.includes('exists') && String(cr.error?.status || '') !== '422') {
      throw cr.error;
    }
  } else {
    created = true;
  }
  if (created) {
    void sendMakeEvent('jugador_registrado', {
      email: em,
      nombre: String(opts?.nombre || '').trim() || null,
      pais: String(opts?.pais || '').trim() || null,
      ciudad: String(opts?.ciudad || '').trim() || null,
    });
  }
  await supabase.auth.resetPasswordForEmail(em, {
    redirectTo: `${FRONTEND_URL}/login`,
  });
  return { created, tempPassword };
}

async function assertSuperAdminReq(req) {
  const user = await authUserFromBearer(req);
  if (!user?.email) {
    const e = new Error('No autorizado');
    e.status = 401;
    throw e;
  }
  const rowRole = await fetchUserRoleRow(user.email);
  const role = rowRole?.role || null;
  if (!isSuperAdminApi(user.email, role)) {
    const e = new Error('Solo super admin');
    e.status = 403;
    throw e;
  }
  return { user, roleRow: rowRole };
}

/** Top países por cantidad de sedes (todas las filas `sedes`). */
function topPaisesPorCantidadSedes(sedesRows, limit = 5) {
  const map = {};
  for (const s of sedesRows || []) {
    const p = String(s?.pais || '').trim() || 'Sin país';
    map[p] = (map[p] || 0) + 1;
  }
  return Object.entries(map)
    .map(([pais, cantidad]) => ({ pais, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.pais.localeCompare(b.pais, 'es'))
    .slice(0, limit);
}

/** Deporte con más filas en `torneos` (empate → orden léxico del deporte). */
function deporteMasPopularDesdeTorneos(torneosRows) {
  const map = {};
  for (const t of torneosRows || []) {
    const raw = String(t?.deporte || '').trim().toLowerCase();
    const key = raw || '(sin deporte)';
    map[key] = (map[key] || 0) + 1;
  }
  const sorted = Object.entries(map).sort(
    (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'es')
  );
  const [deporteKey, n] = sorted[0] || [null, 0];
  if (!deporteKey || n === 0) {
    return { deporte: null, torneos_creados: 0, label: '—' };
  }
  if (deporteKey === '(sin deporte)') {
    return { deporte: null, torneos_creados: n, label: 'Sin deporte' };
  }
  const norm = normalizeTorneoDeporteForDb(deporteKey);
  const label = etiquetaDeporteCorta(norm);
  return { deporte: norm, torneos_creados: n, label };
}

/**
 * GET /api/admin/analytics-globales — super_admin: métricas agregadas (Supabase).
 */
app.get('/api/admin/analytics-globales', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const now = new Date();
    const monthStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const monthStartIso = monthStartUtc.toISOString();
    const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      jugTotal,
      jugMes,
      sedesRowsRes,
      tornFin,
      resMes,
      tornDep,
    ] = await Promise.all([
      supabase.from('jugadores_perfil').select('*', { count: 'exact', head: true }),
      supabase.from('jugadores_perfil').select('*', { count: 'exact', head: true }).gte('created_at', monthStartIso),
      supabase.from('sedes').select('pais, licencia_activa, numero_licencia').limit(10000),
      supabase.from('torneos').select('*', { count: 'exact', head: true }).eq('estado', 'finalizado'),
      supabase.from('reservas').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgoIso),
      supabase.from('torneos').select('deporte').limit(50000),
    ]);

    if (jugTotal.error) throw jugTotal.error;
    if (jugMes.error) throw jugMes.error;
    if (sedesRowsRes.error) throw sedesRowsRes.error;
    if (tornFin.error) throw tornFin.error;
    if (resMes.error) throw resMes.error;
    if (tornDep.error) throw tornDep.error;

    const sedesRows = sedesRowsRes.data || [];
    const sedesActivasTotal = sedesRows.filter(
      (s) => s.licencia_activa === true && String(s.numero_licencia || '').trim() !== ''
    ).length;

    res.json({
      jugadores_registrados_total: jugTotal.count ?? 0,
      jugadores_nuevos_este_mes: jugMes.count ?? 0,
      sedes_activas_total: sedesActivasTotal,
      sedes_por_pais_top5: topPaisesPorCantidadSedes(sedesRows, 5),
      torneos_finalizados_total: tornFin.count ?? 0,
      reservas_ultimo_mes_total: resMes.count ?? 0,
      deporte_mas_popular: deporteMasPopularDesdeTorneos(tornDep.data || []),
      meta: {
        jugadores_nuevos_periodo: 'mes_calendario_utc',
        reservas_periodo: 'ultimos_30_dias',
      },
    });
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
    console.error('❌ GET /api/admin/analytics-globales:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/sedes-alcance — admin autenticado: metadatos de alcance y sedes habilitadas. */
app.get('/api/admin/sedes-alcance', async (req, res) => {
  try {
    const scope = await adminListScopeFromRequest(req);
    if (!scope) return res.status(401).json({ error: 'No autorizado' });
    const allowed = await sedesPermitidasPorScope(scope);
    res.json({
      rol: scope.rol,
      alcance: scope.alcance,
      pais: scope.pais || null,
      provincia: scope.provincia || null,
      ciudad: scope.ciudad || null,
      sede_id: scope.sedeId ?? null,
      sedes: allowed.sedes || [],
    });
  } catch (err) {
    console.error('❌ GET /api/admin/sedes-alcance:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /api/admin/roles — super_admin: lista admins + alcance + asignación geográfica. */
app.get('/api/admin/roles', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const { data: rolesRows, error: rErr } = await supabase
      .from('user_roles')
      .select('email, nombre, role, alcance, sede_id, ciudad, provincia, pais')
      .in('role', ['admin_club', 'admin_nacional', 'super_admin', 'empleado'])
      .order('email', { ascending: true });
    if (rErr) throw rErr;
    const sedeIds = [...new Set((rolesRows || []).map((r) => r.sede_id).filter((id) => id != null))];
    let sedesMap = {};
    if (sedeIds.length) {
      const { data: sedes, error: sErr } = await supabase.from('sedes').select('id, nombre').in('id', sedeIds);
      if (sErr) throw sErr;
      for (const s of sedes || []) sedesMap[s.id] = s;
    }
    const rows = (rolesRows || []).map((r) => ({
      ...r,
      alcance: resolveAlcanceFromRoleRow(r),
      sede_nombre: r.sede_id != null ? String(sedesMap[r.sede_id]?.nombre || '').trim() || null : null,
    }));
    res.json(rows);
  } catch (err) {
    console.error('❌ GET /api/admin/roles:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/admin/roles — super_admin: asigna/actualiza rol + alcance. */
app.post('/api/admin/roles', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    const role = String(b.role || '').trim().toLowerCase();
    const alcance = String(b.alcance || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email obligatorio' });
    if (!['admin_club', 'admin_nacional', 'empleado'].includes(role)) return res.status(400).json({ error: 'Rol inválido' });
    if (!['sede', 'ciudad', 'provincia', 'pais'].includes(alcance)) {
      return res.status(400).json({ error: 'Alcance inválido' });
    }
    if (role === 'empleado' && alcance !== 'sede') {
      return res.status(400).json({ error: 'El rol empleado debe tener alcance sede' });
    }
    const sedeId = b.sede_id != null && String(b.sede_id).trim() !== '' ? Number(b.sede_id) : null;
    const ciudad = String(b.ciudad || '').trim() || null;
    const provincia = String(b.provincia || '').trim() || null;
    const pais = String(b.pais || '').trim() || null;
    if (alcance === 'sede' && !Number.isFinite(sedeId)) {
      return res.status(400).json({ error: 'sede_id es obligatorio para alcance sede' });
    }
    if (alcance === 'ciudad' && !ciudad) return res.status(400).json({ error: 'Ciudad obligatoria' });
    if (alcance === 'provincia' && !provincia) return res.status(400).json({ error: 'Provincia obligatoria' });
    if (alcance === 'pais' && !pais) return res.status(400).json({ error: 'País obligatorio' });

    const payload = {
      email,
      role,
      alcance,
      nombre: String(b.nombre || '').trim() || null,
      sede_id: alcance === 'sede' ? sedeId : null,
      ciudad: alcance === 'ciudad' ? ciudad : null,
      provincia: alcance === 'provincia' ? provincia : null,
      pais: alcance === 'pais' ? pais : null,
      torneos_oficiales_habilitados: role === 'admin_nacional',
    };
    const { data: existing } = await supabase.from('user_roles').select('email').eq('email', email).maybeSingle();
    let r;
    if (existing?.email) {
      r = await supabase.from('user_roles').update(payload).eq('email', email).select('*').single();
    } else {
      r = await supabase.from('user_roles').insert(payload).select('*').single();
    }
    if (r.error) throw r.error;
    res.json(r.data);
  } catch (err) {
    console.error('❌ POST /api/admin/roles:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** DELETE /api/admin/roles/:email — super_admin: revoca rol admin. */
app.delete('/api/admin/roles/:email', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const email = String(req.params.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email inválido' });
    const { error } = await supabase.from('user_roles').delete().eq('email', email);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ DELETE /api/admin/roles/:email:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── Invitaciones admin club (super_admin → email con link público) ─────────

const INVITACION_ADMIN_HORAS_VALIDEZ = 48;

function generarTokenInvitacionAdmin() {
  return crypto.randomBytes(32).toString('hex');
}

async function sendInvitacionAdminClubEmail({ toEmail, inviteUrl, nombreClub, paisLabel }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || 'Padbol Match <no-reply@padbolmatch.com>').trim();
  const to = String(toEmail || '').trim().toLowerCase();
  if (!apiKey || !to) {
    console.warn('⚠️ Invitación admin club: sin RESEND_API_KEY o email vacío — no se envía mail');
    return false;
  }
  const club = String(nombreClub || '').trim();
  const pais = String(paisLabel || '').trim();
  const bodyHtml = `
    <p>Hola,</p>
    <p>Te invitaron a ser <strong>administrador de club</strong> en Padbol Match.</p>
    ${club ? `<p><strong>Club sugerido:</strong> ${club}</p>` : ''}
    ${pais ? `<p><strong>País:</strong> ${pais}</p>` : ''}
    <p>Completa el alta de tu sede en el siguiente enlace (válido ${INVITACION_ADMIN_HORAS_VALIDEZ} horas):</p>
    <p><a href="${inviteUrl}" style="font-weight:700;color:#4f46e5;">Completar alta de sede</a></p>
    <p>Si el botón no funciona, copia y pega esta URL en el navegador:<br/><span style="word-break:break-all;font-size:13px;">${inviteUrl}</span></p>
    <p><strong>PADBOL Match</strong></p>
  `;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Invitación para administrar tu club en Padbol Match',
        html: bodyHtml,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.warn('⚠️ Resend invitación admin:', r.status, t);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('⚠️ Email invitación admin club:', e?.message || e);
    return false;
  }
}

async function sendInvitacionAdminGeoEmail({ toEmail, inviteUrl, paisLabel, invitedAlcance, provincia, ciudad }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || 'Padbol Match <no-reply@padbolmatch.com>').trim();
  const to = String(toEmail || '').trim().toLowerCase();
  if (!apiKey || !to) {
    console.warn('⚠️ Invitación admin geo: sin RESEND_API_KEY o email vacío — no se envía mail');
    return false;
  }
  const alc = String(invitedAlcance || '').trim().toLowerCase();
  const pais = String(paisLabel || '').trim();
  const prov = String(provincia || '').trim();
  const ciu = String(ciudad || '').trim();
  let rolTxt = 'administrador nacional';
  let scopeHtml = '';
  if (alc === 'pais') {
    rolTxt = 'administrador nacional';
    scopeHtml = pais ? `<p><strong>País:</strong> ${pais}</p>` : '';
  } else if (alc === 'provincia') {
    rolTxt = 'administrador de ciudad / región';
    scopeHtml = `<p><strong>País:</strong> ${pais || '—'}</p><p><strong>Provincia o estado:</strong> ${prov || '—'}</p>`;
  } else if (alc === 'ciudad') {
    rolTxt = 'administrador de ciudad / región';
    scopeHtml = `<p><strong>País:</strong> ${pais || '—'}</p>${prov ? `<p><strong>Provincia o estado:</strong> ${prov}</p>` : ''}${
      ciu ? `<p><strong>Ciudad:</strong> ${ciu}</p>` : ''
    }`;
  }
  const bodyHtml = `
    <p>Hola,</p>
    <p>Te invitaron a ser <strong>${rolTxt}</strong> en Padbol Match.</p>
    ${scopeHtml}
    <p>Acepta la invitación en el siguiente enlace (válido ${INVITACION_ADMIN_HORAS_VALIDEZ} horas). No crea una sede: solo activa tu acceso con el alcance indicado.</p>
    <p><a href="${inviteUrl}" style="font-weight:700;color:#4f46e5;">Aceptar invitación</a></p>
    <p>Si el botón no funciona, copia y pega esta URL en el navegador:<br/><span style="word-break:break-all;font-size:13px;">${inviteUrl}</span></p>
    <p><strong>PADBOL Match</strong></p>
  `;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Invitación como administrador en Padbol Match',
        html: bodyHtml,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.warn('⚠️ Resend invitación admin geo:', r.status, t);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('⚠️ Email invitación admin geo:', e?.message || e);
    return false;
  }
}

function invitacionAdminUrl(token) {
  const base = String(FRONTEND_URL || '').replace(/\/$/, '');
  return `${base}/invitar-admin-club/${encodeURIComponent(token)}`;
}

async function insertDeportesSedeSinAuth(sedeId, deportesArr) {
  const arr = Array.isArray(deportesArr) ? deportesArr : null;
  if (!arr || arr.length === 0) {
    const e = new Error('deportes debe ser un array no vacío');
    e.status = 400;
    throw e;
  }
  const rows = [];
  for (const raw of arr) {
    const dep = String(raw?.deporte || '').trim().toLowerCase();
    const n = parseInt(String(raw?.cantidad ?? ''), 10);
    if (!DEPORTES_SEDE_VALID.has(dep)) {
      const e = new Error(`Deporte no permitido: ${dep || '(vacío)'}`);
      e.status = 400;
      throw e;
    }
    if (!Number.isFinite(n) || n < 0) {
      const e = new Error(`Cantidad inválida para ${dep}`);
      e.status = 400;
      throw e;
    }
    if (n === 0) continue;
    rows.push({ sede_id: sedeId, deporte: dep, cantidad: n, activo: true });
  }
  if (!rows.length) {
    const e = new Error('Al menos un deporte con cantidad mayor a 0');
    e.status = 400;
    throw e;
  }
  const { error: delErr } = await supabase.from('canchas_por_deporte').delete().eq('sede_id', sedeId);
  if (delErr) throw delErr;
  const { data: ins, error: insErr } = await supabase.from('canchas_por_deporte').insert(rows).select('*');
  if (insErr) throw insErr;
  return ins || [];
}

/** GET /api/admin/invitaciones-admin — super_admin: invitaciones (filtro ?estado=pendiente). */
app.get('/api/admin/invitaciones-admin', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const est = String(req.query?.estado || '').trim().toLowerCase();
    let q = supabase
      .from('invitaciones_admin')
      .select(
        'id, email, pais, nombre_club, estado, created_at, expires_at, sede_id, invited_role, invited_alcance, provincia, ciudad',
      )
      .order('created_at', { ascending: false })
      .limit(300);
    if (est && ['pendiente', 'completada', 'expirada', 'cancelada'].includes(est)) {
      q = q.eq('estado', est);
    }
    const { data, error } = await q;
    if (error) throw error;
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('❌ GET /api/admin/invitaciones-admin:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/admin/invitaciones-admin — super_admin: crea invitación y envía email. */
app.post('/api/admin/invitaciones-admin', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const b = req.body || {};
    const email = String(b.email || '').trim().toLowerCase();
    const pais = String(b.pais || '').trim();
    if (!email) return res.status(400).json({ error: 'Email obligatorio' });
    if (!pais) return res.status(400).json({ error: 'País obligatorio' });
    const tipoInv = String(b.tipo_invitacion || b.tipo || 'club').trim().toLowerCase();

    let invitedRole = 'admin_club';
    let invitedAlcance = null;
    let nombreClub = String(b.nombre_club || '').trim() || null;
    let provinciaIns = null;
    let ciudadIns = null;

    if (tipoInv === 'nacional') {
      invitedRole = 'admin_nacional';
      invitedAlcance = 'pais';
      nombreClub = null;
    } else if (tipoInv === 'ciudad_region') {
      invitedRole = 'admin_nacional';
      const prov = String(b.provincia || b.estado || '').trim();
      const ciu = String(b.ciudad || '').trim();
      if (!prov) return res.status(400).json({ error: 'Provincia / estado obligatorio' });
      provinciaIns = prov;
      ciudadIns = ciu || null;
      invitedAlcance = ciu ? 'ciudad' : 'provincia';
      nombreClub = null;
    } else if (tipoInv !== 'club') {
      return res.status(400).json({ error: 'tipo_invitacion inválido (club, nacional, ciudad_region)' });
    }

    await supabase
      .from('invitaciones_admin')
      .update({ estado: 'cancelada' })
      .eq('email', email)
      .eq('estado', 'pendiente');

    const token = generarTokenInvitacionAdmin();
    const expiresAt = new Date(Date.now() + INVITACION_ADMIN_HORAS_VALIDEZ * 3600 * 1000).toISOString();
    const { data: row, error: insErr } = await supabase
      .from('invitaciones_admin')
      .insert({
        email,
        token,
        pais,
        nombre_club: nombreClub,
        estado: 'pendiente',
        expires_at: expiresAt,
        invited_role: invitedRole,
        invited_alcance: invitedAlcance,
        provincia: provinciaIns,
        ciudad: ciudadIns,
      })
      .select(
        'id, email, pais, nombre_club, estado, created_at, expires_at, sede_id, invited_role, invited_alcance, provincia, ciudad',
      )
      .single();
    if (insErr) throw insErr;

    const url = invitacionAdminUrl(token);
    const mailed = invitacionAdminEsFlujoGeo(row)
      ? await sendInvitacionAdminGeoEmail({
          toEmail: email,
          inviteUrl: url,
          paisLabel: pais,
          invitedAlcance: row.invited_alcance,
          provincia: row.provincia,
          ciudad: row.ciudad,
        })
      : await sendInvitacionAdminClubEmail({
          toEmail: email,
          inviteUrl: url,
          nombreClub,
          paisLabel: pais,
        });
    res.status(201).json({ ...row, email_sent: mailed });
  } catch (err) {
    console.error('❌ POST /api/admin/invitaciones-admin:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/admin/invitaciones-admin/:id/reenviar — super_admin: reenvía email (renueva token si expiró). */
app.post('/api/admin/invitaciones-admin/:id/reenviar', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const { data: row, error: fErr } = await supabase.from('invitaciones_admin').select('*').eq('id', id).maybeSingle();
    if (fErr) throw fErr;
    if (!row?.id) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (row.estado !== 'pendiente') {
      return res.status(400).json({ error: 'Solo se puede reenviar invitaciones pendientes' });
    }
    const now = Date.now();
    const expMs = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    let token = row.token;
    let expiresAt = row.expires_at;
    if (!Number.isFinite(expMs) || expMs <= now) {
      token = generarTokenInvitacionAdmin();
      expiresAt = new Date(Date.now() + INVITACION_ADMIN_HORAS_VALIDEZ * 3600 * 1000).toISOString();
      const { error: uErr } = await supabase
        .from('invitaciones_admin')
        .update({ token, expires_at: expiresAt })
        .eq('id', id)
        .eq('estado', 'pendiente');
      if (uErr) throw uErr;
    }
    const url = invitacionAdminUrl(token);
    const mailed = invitacionAdminEsFlujoGeo(row)
      ? await sendInvitacionAdminGeoEmail({
          toEmail: row.email,
          inviteUrl: url,
          paisLabel: row.pais,
          invitedAlcance: row.invited_alcance,
          provincia: row.provincia,
          ciudad: row.ciudad,
        })
      : await sendInvitacionAdminClubEmail({
          toEmail: row.email,
          inviteUrl: url,
          nombreClub: row.nombre_club,
          paisLabel: row.pais,
        });
    res.json({ ok: true, email_sent: mailed, expires_at: expiresAt });
  } catch (err) {
    console.error('❌ POST /api/admin/invitaciones-admin/:id/reenviar:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /api/invitacion/:token — público: valida token y devuelve datos para el formulario. */
app.get('/api/invitacion/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token || token.length < 16) return res.status(404).json({ error: 'Invitación no encontrada' });
    const { data: row, error } = await supabase.from('invitaciones_admin').select('*').eq('token', token).maybeSingle();
    if (error) throw error;
    if (!row?.id) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (row.estado !== 'pendiente') {
      return res.status(410).json({ error: 'Esta invitación ya no está activa', estado: row.estado });
    }
    const expMs = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    if (Number.isFinite(expMs) && expMs <= Date.now()) {
      await supabase.from('invitaciones_admin').update({ estado: 'expirada' }).eq('id', row.id).eq('estado', 'pendiente');
      return res.status(410).json({ error: 'Invitación expirada' });
    }
    res.json({
      valid: true,
      flow: invitacionAdminEsFlujoGeo(row) ? 'geo' : 'club',
      email: row.email,
      pais: row.pais,
      nombre_club: row.nombre_club || '',
      expires_at: row.expires_at,
      invited_role: row.invited_role || 'admin_club',
      invited_alcance: row.invited_alcance || null,
      provincia: row.provincia || '',
      ciudad: row.ciudad || '',
    });
  } catch (err) {
    console.error('❌ GET /api/invitacion/:token:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/invitacion/:token/completar — público: crea sede, deportes, rol admin_club, cierra invitación. */
app.post('/api/invitacion/:token/completar', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token || token.length < 16) return res.status(404).json({ error: 'Invitación no encontrada' });
    const { data: inv, error: iErr } = await supabase.from('invitaciones_admin').select('*').eq('token', token).maybeSingle();
    if (iErr) throw iErr;
    if (!inv?.id) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (inv.estado !== 'pendiente') {
      return res.status(410).json({ error: 'Esta invitación ya no está activa', estado: inv.estado });
    }
    const expMs = inv.expires_at ? new Date(inv.expires_at).getTime() : 0;
    if (Number.isFinite(expMs) && expMs <= Date.now()) {
      await supabase.from('invitaciones_admin').update({ estado: 'expirada' }).eq('id', inv.id).eq('estado', 'pendiente');
      return res.status(410).json({ error: 'Invitación expirada' });
    }

    const b = req.body || {};
    const emailInv = String(inv.email || '').trim().toLowerCase();
    const emailContacto = String(b.email_contacto || '').trim().toLowerCase();
    if (!emailContacto || emailContacto !== emailInv) {
      return res.status(400).json({ error: 'El email de contacto debe coincidir con el de la invitación' });
    }

    if (invitacionAdminEsFlujoGeo(inv)) {
      const nombreAdmin = String(b.nombre_admin || '').trim() || null;
      const urErr = await upsertUserRoleFromInvitacionGeo({
        email: emailInv,
        nombre: nombreAdmin,
        inv,
      });
      if (urErr) {
        const e = new Error(urErr.message || String(urErr));
        e.status = 400;
        throw e;
      }
      const { error: upInvGeoErr } = await supabase
        .from('invitaciones_admin')
        .update({ estado: 'completada', sede_id: null })
        .eq('id', inv.id)
        .eq('estado', 'pendiente');
      if (upInvGeoErr) {
        console.error('⚠️ Invitación geo no actualizada:', upInvGeoErr.message);
      }
      try {
        await ensureLicenciatarioAuthUserAndWelcomeEmail(emailInv, {
          nombre: nombreAdmin,
          pais: String(inv.pais || '').trim() || null,
          ciudad: String(inv.ciudad || '').trim() || null,
        });
      } catch (authErr) {
        console.warn('⚠️ Alta rol geo por invitación: provisión auth:', authErr?.message || authErr);
      }
      return res.status(201).json({ ok: true, flow: 'geo' });
    }

    const nombre = String(b.nombre || '').trim();
    const ciudad = String(b.ciudad || '').trim();
    const pais = String(b.pais || '').trim();
    if (!nombre) return res.status(400).json({ error: 'Nombre de la sede obligatorio' });
    if (!ciudad) return res.status(400).json({ error: 'Ciudad obligatoria' });
    if (!pais) return res.status(400).json({ error: 'País obligatorio' });

    const latitudBody = b.latitud != null && String(b.latitud).trim() !== '' ? Number(b.latitud) : null;
    const longitudBody = b.longitud != null && String(b.longitud).trim() !== '' ? Number(b.longitud) : null;
    const mapsParsed = parseLatLngFromMapsUrl(b.google_maps_url || b.maps_url || b.googleMapsUrl || '');
    const latitud = Number.isFinite(latitudBody) ? latitudBody : mapsParsed.latitud;
    const longitud = Number.isFinite(longitudBody) ? longitudBody : mapsParsed.longitud;
    const precioTurno = b.precio_turno != null && b.precio_turno !== '' ? Number(b.precio_turno) : null;
    const cantidadCanchasTotal =
      b.cantidad_canchas != null && String(b.cantidad_canchas).trim() !== ''
        ? parseInt(String(b.cantidad_canchas), 10)
        : null;
    const skipAutogenCanchas = Boolean(b.skip_autogen_canchas);
    const telefonoBody = String(b.telefono || b.whatsapp || '').trim();
    if (!telefonoBody) return res.status(400).json({ error: 'Teléfono / WhatsApp obligatorio' });

    const timezoneInv = normalizeSedeTimezone(
      b.timezone != null && String(b.timezone).trim()
        ? String(b.timezone).trim()
        : inferTimezoneFromCiudadPais(ciudad, pais),
    );

    const payload = {
      nombre,
      pais,
      provincia: String(b.provincia || b.estado || '').trim() || null,
      ciudad,
      timezone: timezoneInv,
      direccion: String(b.direccion || '').trim() || null,
      email_contacto: emailContacto,
      telefono: telefonoBody,
      horario_apertura: String(b.horario_apertura || '').trim() || null,
      horario_cierre: String(b.horario_cierre || '').trim() || null,
      precio_turno: Number.isFinite(precioTurno) ? precioTurno : null,
      moneda: String(b.moneda || 'ARS').trim().toUpperCase() || 'ARS',
      metodo_pago: normalizeMetodoPago(b.metodo_pago || 'mercadopago'),
      stripe_account_id: String(b.stripe_account_id || '').trim() || null,
      mp_access_token: String(b.mp_access_token || '').trim() || null,
      pago_manual_instrucciones: String(b.pago_manual_instrucciones || '').trim() || null,
      latitud: Number.isFinite(latitud) ? latitud : null,
      longitud: Number.isFinite(longitud) ? longitud : null,
      google_maps_url: String(b.google_maps_url || b.maps_url || '').trim() || null,
    };
    if (Number.isFinite(cantidadCanchasTotal) && cantidadCanchasTotal >= 0) {
      payload.cantidad_canchas = cantidadCanchasTotal;
    }

    const { data: created, error: sedeErr } = await supabase.from('sedes').insert(payload).select('*').single();
    if (sedeErr) throw sedeErr;
    const sedeId = created.id;

    try {
      const deportesArr = Array.isArray(b.deportes) ? b.deportes : [];
      await insertDeportesSedeSinAuth(sedeId, deportesArr);
    } catch (depErr) {
      await supabase.from('sedes').delete().eq('id', sedeId);
      throw depErr;
    }

    const nombreAdmin = String(b.nombre_admin || '').trim() || null;
    const urErr = await upsertUserRoleAdminClub({
      email: emailInv,
      nombre: nombreAdmin,
      pais,
      sede_id: sedeId,
    });
    if (urErr) {
      await supabase.from('canchas_por_deporte').delete().eq('sede_id', sedeId);
      await supabase.from('sedes').delete().eq('id', sedeId);
      throw new Error(urErr.message || String(urErr));
    }

    const { error: upInvErr } = await supabase
      .from('invitaciones_admin')
      .update({ estado: 'completada', sede_id: sedeId })
      .eq('id', inv.id)
      .eq('estado', 'pendiente');
    if (upInvErr) {
      console.error('⚠️ Invitación no actualizada tras crear sede:', upInvErr.message);
    }

    try {
      await ensureLicenciatarioAuthUserAndWelcomeEmail(emailInv, {
        nombre: nombreAdmin,
        pais,
        ciudad,
      });
    } catch (authErr) {
      console.warn('⚠️ Alta sede por invitación: provisión auth:', authErr?.message || authErr);
    }

    void sendMakeEvent('sede_creada', {
      nombre_sede: String(created?.nombre || nombre || '').trim() || null,
      pais: String(created?.pais || pais || '').trim() || null,
      ciudad: String(created?.ciudad || ciudad || '').trim() || null,
      email_contacto: emailContacto,
      deportes: Array.isArray(b.deportes) ? b.deportes : null,
      origen: 'invitacion_admin_club',
    });

    res.status(201).json({ ok: true, sede: created, sede_id: sedeId });
  } catch (err) {
    const st = err.status || 500;
    if (st >= 400 && st < 500) return res.status(st).json({ error: err.message || String(err) });
    console.error('❌ POST /api/invitacion/:token/completar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function mapPendingRowToSedeInsert(row) {
  const ciudadP = row.ciudad || null;
  const paisP = row.pais || null;
  const tz = normalizeSedeTimezone(
    row.timezone != null && String(row.timezone).trim()
      ? String(row.timezone).trim()
      : inferTimezoneFromCiudadPais(ciudadP, paisP),
  );
  return {
    nombre: String(row.nombre || '').trim(),
    direccion: row.direccion || null,
    ciudad: ciudadP,
    provincia: row.provincia || null,
    pais: paisP,
    timezone: tz,
    latitud: row.latitud != null ? Number(row.latitud) : null,
    longitud: row.longitud != null ? Number(row.longitud) : null,
    horario_apertura: row.horario_apertura || null,
    horario_cierre: row.horario_cierre || null,
    precio_turno: row.precio_base != null && row.precio_base !== '' ? Number(row.precio_base) : null,
    moneda: row.moneda || 'ARS',
    metodo_pago: normalizeMetodoPago(row.metodo_pago || 'mercadopago'),
    stripe_account_id: row.stripe_account_id || null,
    mp_access_token: row.mp_access_token || null,
    pago_manual_instrucciones: row.pago_manual_instrucciones || null,
    telefono: row.whatsapp || null,
    email_contacto: row.email_contacto || null,
    numero_licencia: row.numero_licencia || null,
    fecha_licencia: row.fecha_contrato || null,
    licencia_activa: true,
    franjas_horarias: [],
    fotos_destacadas: [],
  };
}

/** POST /api/admin/sedes-pendientes — solo admin_nacional: inserta fila pendiente + aviso a super admin. */
app.post('/api/admin/sedes-pendientes', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.email) return res.status(401).json({ error: 'No autorizado' });
    const rowRole = await fetchUserRoleRow(user.email);
    const role = rowRole?.role || null;
    if (isSuperAdminApi(user.email, role)) {
      return res.status(403).json({ error: 'Usa “Crear sede” desde el formulario de super admin' });
    }
    if (role !== 'admin_nacional') {
      return res.status(403).json({ error: 'Solo admin nacional puede enviar solicitudes pendientes' });
    }
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'Nombre del club obligatorio' });
    const licEmail = String(b.licenciatario_email || '').trim().toLowerCase();
    if (!licEmail) return res.status(400).json({ error: 'Email del licenciatario obligatorio' });

    const insert = {
      created_by: String(user.email).trim().toLowerCase(),
      estado: 'pendiente',
      nombre,
      direccion: b.direccion || null,
      ciudad: b.ciudad || null,
      provincia: b.provincia || null,
      pais: b.pais || null,
      latitud: b.latitud != null && b.latitud !== '' ? Number(b.latitud) : null,
      longitud: b.longitud != null && b.longitud !== '' ? Number(b.longitud) : null,
      horario_apertura: b.horario_apertura || null,
      horario_cierre: b.horario_cierre || null,
      precio_base: b.precio_base != null && b.precio_base !== '' ? Number(b.precio_base) : null,
      moneda: b.moneda || 'ARS',
      whatsapp: b.whatsapp || null,
      email_contacto: b.email_contacto || null,
      metodo_pago: normalizeMetodoPago(b.metodo_pago || 'mercadopago'),
      stripe_account_id: String(b.stripe_account_id || '').trim() || null,
      mp_access_token: String(b.mp_access_token || '').trim() || null,
      pago_manual_instrucciones: String(b.pago_manual_instrucciones || '').trim() || null,
      numero_licencia: b.numero_licencia || null,
      fecha_contrato: b.fecha_inicio_contrato || b.fecha_contrato || null,
      tipo_licencia: ['club_afiliado', 'padbol_point', 'master_ciudad', 'master_provincia', 'master_pais'].includes(String(b.tipo_licencia || '').trim())
        ? String(b.tipo_licencia).trim()
        : 'club_afiliado',
      ciudad_representa: b.ciudad_representa || null,
      provincia_representa: b.provincia_representa || null,
      pais_representa: b.pais_representa || null,
      licenciatario_nombre: b.licenciatario_nombre || null,
      licenciatario_email: licEmail,
      licenciatario_telefono: b.licenciatario_telefono || null,
      licenciatario_pais: b.licenciatario_pais || null,
    };

    let { data: ins, error } = await supabase.from('sedes_pendientes').insert(insert).select('id').single();
    if (error && /ciudad_representa|provincia_representa|pais_representa/i.test(String(error.message || ''))) {
      const legacyInsert = { ...insert };
      delete legacyInsert.ciudad_representa;
      delete legacyInsert.provincia_representa;
      delete legacyInsert.pais_representa;
      const retry = await supabase.from('sedes_pendientes').insert(legacyInsert).select('id').single();
      ins = retry.data;
      error = retry.error;
    }
    if (error) throw error;

    const toSuper = resolveSuperAdminNotifyWhatsAppTo();
    if (toSuper) {
      const msg =
        `🏟 Nueva sede pendiente de aprobación\n` +
        `Club: ${nombre}\n` +
        `País: ${insert.pais || '—'}\n` +
        `Licenciatario: ${insert.licenciatario_nombre || '—'} (${licEmail})\n` +
        `Enviado por: ${insert.created_by}\n` +
        `Revisar en: padbolmatch.com/admin`;
      await sendTwilioWhatsAppBodyToRaw(toSuper, msg);
    }

    res.json({ ok: true, id: ins?.id });
  } catch (err) {
    console.error('❌ POST /api/admin/sedes-pendientes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/sedes-directa — super_admin: inserta sede + user_roles según tipo de licencia. */
app.post('/api/admin/sedes-directa', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.email) return res.status(401).json({ error: 'No autorizado' });
    const rowRole = await fetchUserRoleRow(user.email);
    const role = rowRole?.role || null;
    if (!isSuperAdminApi(user.email, role)) {
      return res.status(403).json({ error: 'Solo super admin puede crear sede directa' });
    }
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim();
    if (!nombre) return res.status(400).json({ error: 'Nombre del club obligatorio' });
    const licEmail = String(b.licenciatario_email || '').trim().toLowerCase();
    if (!licEmail) return res.status(400).json({ error: 'Email del licenciatario obligatorio' });

    const sedePayload = {
      nombre,
      direccion: b.direccion || null,
      ciudad: b.ciudad || null,
      provincia: b.provincia || null,
      pais: b.pais || null,
      timezone: normalizeSedeTimezone(
        b.timezone != null && String(b.timezone).trim()
          ? String(b.timezone).trim()
          : inferTimezoneFromCiudadPais(b.ciudad, b.pais),
      ),
      latitud: b.latitud != null && b.latitud !== '' ? Number(b.latitud) : null,
      longitud: b.longitud != null && b.longitud !== '' ? Number(b.longitud) : null,
      horario_apertura: b.horario_apertura || null,
      horario_cierre: b.horario_cierre || null,
      precio_turno: b.precio_base != null && b.precio_base !== '' ? Number(b.precio_base) : null,
      moneda: b.moneda || 'ARS',
      metodo_pago: normalizeMetodoPago(b.metodo_pago || 'mercadopago'),
      stripe_account_id: String(b.stripe_account_id || '').trim() || null,
      mp_access_token: String(b.mp_access_token || '').trim() || null,
      pago_manual_instrucciones: String(b.pago_manual_instrucciones || '').trim() || null,
      telefono: b.whatsapp || null,
      email_contacto: b.email_contacto || null,
      numero_licencia: b.numero_licencia || null,
      fecha_licencia: b.fecha_inicio_contrato || b.fecha_contrato || null,
      licencia_activa: true,
      franjas_horarias: [],
      fotos_destacadas: [],
    };

    const { data: sedeRow, error: sedeErr } = await supabase.from('sedes').insert(sedePayload).select('id').single();
    if (sedeErr) throw sedeErr;
    const sedeId = sedeRow.id;

    const urErr = await upsertUserRoleLicenciaAsignada({
      email: licEmail,
      nombre: String(b.licenciatario_nombre || '').trim() || null,
      payload: b,
      sedeId,
    });
    if (urErr) {
      await supabase.from('sedes').delete().eq('id', sedeId);
      throw urErr;
    }

    const authProvision = await ensureLicenciatarioAuthUserAndWelcomeEmail(licEmail, {
      nombre: String(b.licenciatario_nombre || '').trim() || null,
      pais: String(b.pais || '').trim() || null,
      ciudad: String(b.ciudad || '').trim() || null,
    });

    const waLic = b.licenciatario_telefono || b.whatsapp;
    if (waLic) {
      const msg =
        `🎉 Bienvenido a PADBOL Match. Tu sede "${nombre}" está activa.\n` +
        `Ingresa al panel: padbolmatch.com/admin\n` +
        `${authProvision?.created ? 'Revisa tu email para configurar acceso y cambiar la contraseña temporal.' : 'Si ya tenías cuenta, revisa tu email para restablecer contraseña.'}`;
      await sendTwilioWhatsAppBodyToRaw(waLic, msg);
    }

    res.json({ ok: true, sede_id: sedeId, auth_user_created: Boolean(authProvision?.created) });
  } catch (err) {
    console.error('❌ POST /api/admin/sedes-directa:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function normalizeDeportesCanchasSolicitudLicencia(raw) {
  if (raw == null || typeof raw !== 'object') return null;
  const allowed = DEPORTES_SEDE_VALID;
  const depIn = Array.isArray(raw.deportes) ? raw.deportes : [];
  const deportes = [...new Set(depIn.map((x) => String(x || '').trim().toLowerCase()).filter((x) => allowed.has(x)))];
  const canIn = raw.canchas && typeof raw.canchas === 'object' ? raw.canchas : {};
  const canchas = {};
  for (const k of allowed) {
    if (!Object.prototype.hasOwnProperty.call(canIn, k)) continue;
    const v = canIn[k];
    if (v == null || v === '') continue;
    const n = parseInt(String(v), 10);
    if (Number.isFinite(n) && n >= 0) canchas[k] = n;
  }
  if (!deportes.length && !Object.keys(canchas).length) return null;
  return { deportes, canchas: Object.keys(canchas).length ? canchas : {} };
}

function formatoDeportesCanchasWhatsApp(dc) {
  if (!dc || typeof dc !== 'object') return '—';
  const depLabel = (k) => etiquetaDeporteCorta(k);
  const deportes = Array.isArray(dc.deportes) ? dc.deportes : [];
  const canchas = dc.canchas && typeof dc.canchas === 'object' ? dc.canchas : {};
  const depPart = deportes.map(depLabel).join(', ') || '—';
  const canParts = Object.entries(canchas)
    .filter(([, n]) => n != null && String(n).trim() !== '')
    .map(([k, n]) => `${depLabel(k)}: ${n}`);
  return canParts.length ? `${depPart} · Canchas: ${canParts.join('; ')}` : depPart;
}

function normalizeTipoInstalacionSolicitud(v) {
  const x = String(v || '').trim().toLowerCase();
  if (x === 'indoor' || x === 'outdoor' || x === 'mixto') return x;
  return null;
}

function labelTipoInstalacionWa(key) {
  const m = { indoor: 'Indoor', outdoor: 'Outdoor', mixto: 'Mixto' };
  return m[key] || key || '—';
}

function normalizeResponsableCargoSolicitud(v) {
  const x = String(v || '').trim().toLowerCase();
  if (x === 'propietario' || x === 'manager' || x === 'otro') return x;
  return null;
}

function labelResponsableCargoWa(key) {
  const m = { propietario: 'Propietario', manager: 'Manager', otro: 'Otro' };
  return m[key] || key || '—';
}

function labelTipoInteresSolicitudWa(v) {
  const s = String(v || '').trim();
  if (!s || s === 'pendiente_definicion') return 'Pendiente definición';
  return s;
}

function buildWhatsAppSolicitudLicenciaCompleta(payload, deportesCanchas) {
  const orDash = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : '—');
  const fiscalDir =
    payload.fiscal_misma_que_club === true
      ? 'Igual que la dirección del club'
      : orDash(payload.direccion_fiscal);
  const lines = [
    `🏟️ Nueva solicitud — ${labelTipoInteresSolicitudWa(payload.tipo_interes)}`,
    '',
    '▸ DATOS DEL CLUB',
    `Nombre: ${orDash(payload.nombre_club || payload.club_nombre)}`,
    `Dirección: ${orDash(payload.club_direccion)}`,
    `Ciudad: ${orDash(payload.ciudad)}`,
    `Provincia / Estado: ${orDash(payload.provincia_estado)}`,
    `País: ${orDash(payload.pais)}`,
    `Tel. club: ${orDash(payload.club_telefono)}`,
    `Email club: ${orDash(payload.club_email)}`,
    `Web: ${orDash(payload.club_web)}`,
    `Instalación: ${labelTipoInstalacionWa(payload.tipo_instalacion)}`,
    `Horario: ${orDash(payload.horario_apertura)} – ${orDash(payload.horario_cierre)}`,
    `Deportes / canchas: ${formatoDeportesCanchasWhatsApp(deportesCanchas)}`,
    `Canchas (total calculado): ${payload.cantidad_canchas ?? '—'}`,
    '',
    '▸ RESPONSABLE',
    `Nombre: ${orDash(payload.responsable_nombre)}`,
    `Cargo: ${labelResponsableCargoWa(payload.responsable_cargo)}`,
    `Email: ${orDash(payload.email)}`,
    `WhatsApp: ${orDash(payload.whatsapp)}`,
    '',
    '▸ DATOS LEGALES / FISCALES',
    `Nombre legal: ${orDash(payload.nombre_legal)}`,
    `Número fiscal: ${orDash(payload.numero_fiscal)}`,
    `Dirección fiscal: ${fiscalDir}`,
    `País fiscal: ${orDash(payload.pais_fiscal)}`,
    '',
    '▸ NOTAS',
    orDash(payload.mensaje),
  ];
  return lines.join('\n');
}

/** POST /api/solicitudes-licencia — público: registro de interés para sumar club. */
app.post('/api/solicitudes-licencia', async (req, res) => {
  try {
    const b = req.body || {};
    const club_nombre = String(b.club_nombre || b.nombre_club || '').trim();
    const club_direccion = String(b.club_direccion || '').trim();
    const pais = String(b.pais || '').trim();
    const ciudad = String(b.ciudad || '').trim();
    const provincia_estado = String(b.provincia_estado || '').trim() || null;
    const club_telefono = String(b.club_telefono || '').trim() || null;
    const club_email = String(b.club_email || '').trim().toLowerCase() || null;
    const club_web = String(b.club_web || '').trim() || null;
    const tipo_instalacion = normalizeTipoInstalacionSolicitud(b.tipo_instalacion) || null;
    const horario_apertura = String(b.horario_apertura || '').trim() || null;
    const horario_cierre = String(b.horario_cierre || '').trim() || null;
    const responsable_nombre = String(b.responsable_nombre || '').trim();
    const responsable_cargo = normalizeResponsableCargoSolicitud(b.responsable_cargo);
    const email = String(b.email || '').trim().toLowerCase();
    const whatsapp = String(b.whatsapp || '').trim();
    const nombre_legal = String(b.nombre_legal || '').trim() || null;
    const numero_fiscal = String(b.numero_fiscal || '').trim() || null;
    const fiscal_misma_que_club = Boolean(b.fiscal_misma_que_club);
    const direccion_fiscal = fiscal_misma_que_club ? null : String(b.direccion_fiscal || '').trim() || null;
    const pais_fiscal = String(b.pais_fiscal || '').trim() || null;

    if (
      !club_nombre ||
      !club_direccion ||
      !pais ||
      !ciudad ||
      !provincia_estado ||
      !club_telefono ||
      !club_email ||
      !responsable_nombre ||
      !responsable_cargo ||
      !email ||
      !whatsapp
    ) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const deportesCanchas = normalizeDeportesCanchasSolicitudLicencia(b.deportes_canchas);
    if (!deportesCanchas || !Array.isArray(deportesCanchas.deportes) || deportesCanchas.deportes.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos un deporte disponible' });
    }

    const cantidadCanchasTotal = (() => {
      if (deportesCanchas?.canchas && Object.keys(deportesCanchas.canchas).length) {
        const s = Object.values(deportesCanchas.canchas).reduce((a, n) => a + (Number(n) || 0), 0);
        return s > 0 ? s : null;
      }
      if (b.cantidad_canchas != null && b.cantidad_canchas !== '') {
        const n = parseInt(String(b.cantidad_canchas), 10);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    })();

    const tipo_interes = 'pendiente_definicion';

    const payload = {
      nombre_club: club_nombre,
      club_direccion,
      pais,
      ciudad,
      provincia_estado,
      club_telefono,
      club_email,
      club_web,
      tipo_instalacion,
      horario_apertura,
      horario_cierre,
      responsable_nombre,
      responsable_cargo,
      email,
      whatsapp,
      nombre_legal,
      numero_fiscal,
      direccion_fiscal,
      fiscal_misma_que_club: fiscal_misma_que_club === true,
      pais_fiscal,
      cantidad_canchas: cantidadCanchasTotal,
      tipo_interes,
      mensaje: String(b.mensaje || '').trim() || null,
      estado: 'pendiente',
      deportes_canchas: deportesCanchas,
    };
    const { data, error } = await supabase.from('solicitudes_licencia').insert(payload).select('*').single();
    if (error) throw error;

    const toSuper = resolveSuperAdminNotifyWhatsAppTo();
    if (toSuper) {
      const msg = buildWhatsAppSolicitudLicenciaCompleta(payload, deportesCanchas);
      await sendTwilioWhatsAppBodyToRaw(toSuper, msg);
    }
    await sendSolicitudLicenciaConfirmacionEmail({
      toEmail: email,
      clubNombre: club_nombre,
      responsableNombre: responsable_nombre,
    });

    res.status(201).json({ ok: true, id: data?.id });
  } catch (err) {
    console.error('❌ POST /api/solicitudes-licencia:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/solicitudes-licencia — super_admin lista (por estado). */
app.get('/api/admin/solicitudes-licencia', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const estado = String(req.query.estado || 'pendiente').trim().toLowerCase();
    let q = supabase.from('solicitudes_licencia').select('*').order('created_at', { ascending: false });
    if (estado && estado !== 'todas' && estado !== 'todos') q = q.eq('estado', estado);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('❌ GET /api/admin/solicitudes-licencia:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/admin/solicitudes-licencia/:id/rechazar — super_admin */
app.post('/api/admin/solicitudes-licencia/:id/rechazar', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    const motivo = String(req.body?.motivo || '').trim() || null;
    const { error } = await supabase
      .from('solicitudes_licencia')
      .update({ estado: 'rechazada', motivo_rechazo: motivo })
      .eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST /api/admin/solicitudes-licencia/:id/rechazar:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

const TIPO_INTERES_ASIGNABLE_SOLICITUD = new Set([
  'Club Afiliado',
  'Padbol Point Franquicia',
  'Master Nacional',
]);

/** POST /api/admin/solicitudes-licencia/:id/tipo-interes — super_admin: asigna tipo antes de crear sede. */
app.post('/api/admin/solicitudes-licencia/:id/tipo-interes', async (req, res) => {
  try {
    await assertSuperAdminReq(req);
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    const raw = String(req.body?.tipo_interes || '').trim();
    if (!TIPO_INTERES_ASIGNABLE_SOLICITUD.has(raw)) {
      return res.status(400).json({ error: 'tipo_interes inválido' });
    }
    const { data, error } = await supabase
      .from('solicitudes_licencia')
      .update({ tipo_interes: raw })
      .eq('id', id)
      .eq('estado', 'pendiente')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Solicitud no encontrada o ya no pendiente' });
    res.json(data);
  } catch (err) {
    console.error('❌ POST /api/admin/solicitudes-licencia/:id/tipo-interes:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** GET /api/admin/sedes-pendientes — super_admin lista. */
app.get('/api/admin/sedes-pendientes', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.email) return res.status(401).json({ error: 'No autorizado' });
    const rowRole = await fetchUserRoleRow(user.email);
    const role = rowRole?.role || null;
    if (!isSuperAdminApi(user.email, role)) {
      return res.status(403).json({ error: 'Solo super admin' });
    }
    const estado = String(req.query.estado || 'pendiente').trim().toLowerCase();
    let q = supabase.from('sedes_pendientes').select('*').order('created_at', { ascending: false });
    if (estado && estado !== 'todas' && estado !== 'todos') q = q.eq('estado', estado);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('❌ GET /api/admin/sedes-pendientes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/sedes-pendientes/:id/aprobar */
app.post('/api/admin/sedes-pendientes/:id/aprobar', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.email) return res.status(401).json({ error: 'No autorizado' });
    const rowRole = await fetchUserRoleRow(user.email);
    const role = rowRole?.role || null;
    if (!isSuperAdminApi(user.email, role)) {
      return res.status(403).json({ error: 'Solo super admin' });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Id inválido' });

    const { data: pend, error: pe } = await supabase.from('sedes_pendientes').select('*').eq('id', id).maybeSingle();
    if (pe) throw pe;
    if (!pend) return res.status(404).json({ error: 'No encontrada' });
    if (pend.estado !== 'pendiente') return res.status(400).json({ error: 'La solicitud ya no está pendiente' });

    const sedePayload = mapPendingRowToSedeInsert(pend);
    const { data: sedeRow, error: sedeErr } = await supabase.from('sedes').insert(sedePayload).select('id').single();
    if (sedeErr) throw sedeErr;
    const sedeId = sedeRow.id;

    const licEmail = String(pend.licenciatario_email || '').trim().toLowerCase();
    if (!licEmail) {
      await supabase.from('sedes').delete().eq('id', sedeId);
      return res.status(400).json({ error: 'Solicitud sin email de licenciatario' });
    }
    const urErr = await upsertUserRoleLicenciaAsignada({
      email: licEmail,
      nombre: pend.licenciatario_nombre || null,
      payload: pend,
      sedeId,
    });
    if (urErr) {
      await supabase.from('sedes').delete().eq('id', sedeId);
      throw urErr;
    }

    await ensureLicenciatarioAuthUserAndWelcomeEmail(licEmail, {
      nombre: String(pend.licenciatario_nombre || '').trim() || null,
      pais: String(pend.pais || '').trim() || null,
      ciudad: String(pend.ciudad || '').trim() || null,
    });

    await supabase.from('sedes_pendientes').update({ estado: 'aprobada' }).eq('id', id);

    const nombre = String(pend.nombre || '').trim();
    const waNacional = await fetchJugadorWhatsappPorEmail(pend.created_by);
    if (waNacional) {
      await sendTwilioWhatsAppBodyToRaw(
        waNacional,
        `✅ Sede ${nombre} aprobada en PADBOL Match.`
      );
    }
    const waLic = pend.licenciatario_telefono || pend.whatsapp;
    if (waLic) {
      await sendTwilioWhatsAppBodyToRaw(
        waLic,
        `🎉 Bienvenido a PADBOL Match. Tu sede "${nombre}" está activa.\nIngresa al panel: padbolmatch.com/admin`
      );
    }

    res.json({ ok: true, sede_id: sedeId });
  } catch (err) {
    console.error('❌ POST aprobar sede pendiente:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/sedes-pendientes/:id/rechazar body: { motivo } */
app.post('/api/admin/sedes-pendientes/:id/rechazar', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.email) return res.status(401).json({ error: 'No autorizado' });
    const rowRole = await fetchUserRoleRow(user.email);
    const role = rowRole?.role || null;
    if (!isSuperAdminApi(user.email, role)) {
      return res.status(403).json({ error: 'Solo super admin' });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Id inválido' });
    const motivo = String(req.body?.motivo || '').trim();
    if (!motivo) return res.status(400).json({ error: 'Motivo obligatorio' });

    const { data: pend, error: pe } = await supabase.from('sedes_pendientes').select('*').eq('id', id).maybeSingle();
    if (pe) throw pe;
    if (!pend) return res.status(404).json({ error: 'No encontrada' });
    if (pend.estado !== 'pendiente') return res.status(400).json({ error: 'La solicitud ya no está pendiente' });

    await supabase
      .from('sedes_pendientes')
      .update({ estado: 'rechazada', motivo_rechazo: motivo })
      .eq('id', id);

    const waNacional = await fetchJugadorWhatsappPorEmail(pend.created_by);
    if (waNacional) {
      const nombre = String(pend.nombre || '').trim();
      await sendTwilioWhatsAppBodyToRaw(
        waNacional,
        `❌ Sede "${nombre}" rechazada.\nMotivo: ${motivo}`
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ POST rechazar sede pendiente:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Cron: recordatorio ~2 horas antes de la reserva (por zona de cada sede) ─
cron.schedule('*/5 * * * *', async () => {
  try {
    const { data: reservas, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('estado', 'confirmada')
      .eq('recordatorio_enviado', false)
      .limit(800);

    if (error) {
      console.error('❌ Cron recordatorio - error Supabase:', error.message);
      return;
    }
    if (!reservas?.length) return;

    const sedesNombres = [...new Set(reservas.map((r) => String(r.sede || '').trim()).filter(Boolean))];
    const tzByNombre = {};
    if (sedesNombres.length) {
      const { data: sedesRows, error: se } = await supabase
        .from('sedes')
        .select('nombre, timezone, ciudad, pais, direccion')
        .in('nombre', sedesNombres);
      if (se) {
        console.error('❌ Cron recordatorio - sedes:', se.message);
        return;
      }
      for (const s of sedesRows || []) {
        const nm = String(s.nombre || '').trim();
        if (!nm) continue;
        tzByNombre[nm] = {
          tz: normalizeSedeTimezone(s.timezone || inferTimezoneFromCiudadPais(s.ciudad, s.pais)),
          direccion: s.direccion || null,
        };
      }
    }

    let enviados = 0;
    for (const r of reservas) {
      try {
        const sedeNom = String(r.sede || '').trim();
        const meta = tzByNombre[sedeNom] || { tz: TZ_SEDE_DEFAULT, direccion: null };
        const z = meta.tz;
        const startMs = reservaWallStartUtcMs(String(r.fecha || '').trim(), String(r.hora || '').trim(), z);
        if (startMs == null || !Number.isFinite(startMs)) continue;

        const minsUntil = (startMs - Date.now()) / (1000 * 60);
        if (minsUntil < 115 || minsUntil > 125) continue;

        const body =
`🎾 *¡Te esperamos en ${r.sede}!*

Tu reserva es en 2 horas:
⏰ ${r.hora}hs${meta.direccion ? `\n📍 ${meta.direccion}` : ''}

Recordá llegar 10 minutos antes.
💬 Ante cualquier consulta escribinos por WhatsApp.

*PADBOL MATCH*`;

        const digits = String(r.whatsapp).replace(/\D/g, '');
        const to = `whatsapp:+${digits}`;
        await twilioClient.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body });
        enviados += 1;
        console.log(`✓ Recordatorio enviado a ${to} (reserva ${r.id})`);

        await crearNotificacionJugador({
          userId: r.user_id,
          email: r.email,
          tipo: 'recordatorio_reserva',
          titulo: 'Tu reserva empieza en 2 horas',
          mensaje: `Te esperamos en ${r.sede} a las ${horaLegibleUnPuntoReserva(r.hora)}.`,
          link: '/mi-perfil?tab=reservas',
        });

        await supabase.from('reservas').update({ recordatorio_enviado: true }).eq('id', r.id);
      } catch (err) {
        console.warn(`⚠️ Recordatorio reserva ${r.id} fallido:`, err.message);
      }
    }
    if (enviados) console.log(`⏰ Cron recordatorio: ${enviados} enviado(s) en este ciclo`);
  } catch (err) {
    console.error('❌ Cron recordatorio - error inesperado:', err.message);
  }
}, { timezone: 'America/Argentina/Buenos_Aires' });

/** Inicio del torneo: fecha_inicio (YYYY-MM-DD) a las 00:00 ART. */
function parseTorneoFechaInicioArt(fechaInicioStr) {
  const ymd = torneoFechaInicioYmdFromStr(fechaInicioStr);
  if (!ymd) return null;
  const [y, mo, da] = ymd.split('-');
  const t = new Date(`${y}-${mo}-${da}T00:00:00-03:00`);
  return Number.isNaN(t.getTime()) ? null : t;
}

/** Cada hora: pasar a finalizado torneos con fecha de juego ya pasada (calendario ART). */
async function marcarTorneosFinalizadosPorFechaInicioPasada() {
  const hoy = ymdTodayInTorneoTz();
  if (!hoy) return;

  const { data: torneos, error } = await supabase
    .from('torneos')
    .select('id, nombre, fecha_inicio, estado')
    .in('estado', ['proximo', 'inscripcion_abierta', 'en_curso']);

  if (error) throw error;

  for (const t of torneos || []) {
    const inicio = torneoFechaInicioYmdFromStr(t.fecha_inicio);
    if (!inicio || inicio >= hoy) continue;

    const { error: eUp } = await supabase.from('torneos').update({ estado: 'finalizado' }).eq('id', t.id);
    if (eUp) {
      console.warn(`⚠️ Torneo ${t.id}: no se pudo marcar finalizado:`, eUp.message);
    } else {
      console.log(
        `📅 Torneo ${t.id} "${String(t.nombre || '').slice(0, 40)}" → finalizado (fecha_inicio pasada, era «${t.estado}»)`,
      );
    }
  }
}

/** Cierre de inscripción 24h antes del inicio: pasa torneo a en_curso y elimina equipos no confirmados. */
async function cierreInscripcionTorneos24hAntesInicio() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));

  const { data: torneos, error } = await supabase
    .from('torneos')
    .select('id, nombre, fecha_inicio, estado')
    .in('estado', ['abierto', 'inscripcion_abierta']);

  if (error) throw error;
  if (!torneos?.length) return;

  for (const t of torneos) {
    const inicio = parseTorneoFechaInicioArt(t.fecha_inicio);
    if (!inicio) continue;
    const limiteCierreInscripcion = new Date(inicio.getTime() - 24 * 60 * 60 * 1000);
    if (now.getTime() < limiteCierreInscripcion.getTime()) continue;

    let reqIni;
    try {
      reqIni = await requisitosParaPasarTorneoAEnCurso(t.id);
    } catch (e) {
      console.warn(`⚠️ Torneo ${t.id}: validación inicio automático:`, e?.message || e);
      continue;
    }
    if (!reqIni.ok) {
      console.warn(
        `⚠️ Torneo ${t.id} "${String(t.nombre || '').slice(0, 40)}": no se aplicó cierre automático a en_curso — ${reqIni.mensaje}`,
      );
      continue;
    }

    console.log(`📅 Cierre inscripción (24h antes del inicio): torneo ${t.id} "${String(t.nombre || '').slice(0, 40)}" → en_curso`);

    const { error: eUp } = await supabase.from('torneos').update({ estado: 'en_curso' }).eq('id', t.id);
    if (eUp) {
      console.warn(`⚠️ Torneo ${t.id}: no se pudo actualizar estado:`, eUp.message);
      continue;
    }

    const { data: equipos, error: eE } = await supabase
      .from('equipos')
      .select('id, inscripcion_estado')
      .eq('torneo_id', t.id);

    if (eE) {
      console.warn(`⚠️ Torneo ${t.id}: listar equipos:`, eE.message);
      continue;
    }

    for (const eq of equipos || []) {
      if (String(eq.inscripcion_estado || '').toLowerCase() === 'confirmado') continue;
      const { error: eDel } = await supabase.from('equipos').delete().eq('id', eq.id);
      if (eDel) console.warn(`⚠️ Equipo ${eq.id}: no se pudo eliminar:`, eDel.message);
      else console.log(`  ✓ Equipo ${eq.id} eliminado (inscripción no confirmada)`);
    }
  }
}

/** Inscripción automática: `fecha_apertura_inscripcion` alcanzada → estado abierto. */
async function aplicarFechaAperturaInscripcionTorneos() {
  const nowIso = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from('torneos')
    .update({ estado: 'abierto', updated_at: new Date() })
    .not('fecha_apertura_inscripcion', 'is', null)
    .lte('fecha_apertura_inscripcion', nowIso)
    .in('estado', ['planificacion', 'proximo'])
    .select('id, nombre');

  if (error) throw error;
  for (const row of updated || []) {
    scheduleNotifyListaEsperaInscripcionAbierta(row.id);
  }
  if (updated?.length) {
    console.log(`📅 Apertura automática inscripción: ${updated.length} torneo(s)`);
  }
}

// ─── Chat IA: disponibilidad real (misma lógica base que ReservaForm) ───────
const CHAT_IA_SLOT_STEP_MIN = 30;
const CHAT_IA_MAX_CANCHAS_UI = 2;

function chatIaFoldText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function chatIaHoraDesdeMinutosReserva(totalMin) {
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Primeras canchas activas como en ReservaForm (máx. 2); si no hay catálogo, 1..min(cantidad,2). */
function chatIaSlotsReservaDesdeSede(sedeRow) {
  const active = sedeRow?.canchas_activas;
  if (Array.isArray(active) && active.length > 0) {
    const sorted = [...active].sort((a, b) => Number(a.numero) - Number(b.numero));
    return sorted.slice(0, CHAT_IA_MAX_CANCHAS_UI).map((x) => Number(x.numero));
  }
  const total = Math.max(1, Number(sedeRow?.cantidad_canchas) || 2);
  const n = Math.min(total, CHAT_IA_MAX_CANCHAS_UI);
  return Array.from({ length: n }, (_, i) => i + 1);
}


/**
 * Slots con al menos una cancha ofertada libre (misma grilla que ReservaForm: paso 30 min, duración fija).
 * @param {string|null|undefined} deporteCanon - resultado de normalizeChatIaDeporteToolInput; vacío = sin filtro por deporte.
 */
async function computeChatIaSlotsReales(supabaseClient, sedeRow, fechaYmd, duracionMin, deporteCanon = null) {
  const nombreSede = String(sedeRow?.nombre || '').trim();
  if (!nombreSede || !/^\d{4}-\d{2}-\d{2}$/.test(String(fechaYmd || '').slice(0, 10))) {
    return { slots: [], error: 'Parámetros inválidos' };
  }
  const fecha = String(fechaYmd).trim().slice(0, 10);
  const duracion = [60, 90, 120].includes(Number(duracionMin)) ? Number(duracionMin) : 90;

  const { data: reservadas, error } = await supabaseClient
    .from('reservas')
    .select('*')
    .eq('sede', nombreSede)
    .eq('fecha', fecha);
  if (error) return { slots: [], error: error.message };

  const lista = Array.isArray(reservadas) ? reservadas : [];
  let horaApertura = 10;
  let horaCierre = 23;
  try {
    if (sedeRow.horario_apertura) {
      const a = parseInt(String(sedeRow.horario_apertura).split(':')[0], 10);
      if (Number.isFinite(a)) horaApertura = a;
    }
  } catch {
    /* keep default */
  }
  try {
    if (sedeRow.horario_cierre) {
      const c = parseInt(String(sedeRow.horario_cierre).split(':')[0], 10);
      if (Number.isFinite(c)) horaCierre = c;
    }
  } catch {
    /* keep default */
  }

  let numsSlots = chatIaSlotsReservaDesdeSede(sedeRow);
  if (deporteCanon) {
    const r = await chatIaResolveNumerosCanchaParaDeporte(supabaseClient, sedeRow, deporteCanon);
    if (r.error) return { slots: [], error: r.error };
    if (!Array.isArray(r.numeros) || r.numeros.length === 0) {
      return { slots: [], error: null };
    }
    numsSlots = r.numeros;
  }

  const tz = normalizeSedeTimezone(sedeRow?.timezone || inferTimezoneFromCiudadPais(sedeRow?.ciudad, sedeRow?.pais));
  const hoySede = ymdTodayInSedeTimezone(tz);
  const filtrarPasadosHoy = Boolean(hoySede && fecha === hoySede);
  const aperturaMin = horaApertura * 60;
  const cierreMin = horaCierre * 60;

  const canchasMeta = Array.isArray(sedeRow?.canchas_activas) ? sedeRow.canchas_activas : [];
  const slots = [];
  for (let startMin = aperturaMin; startMin + duracion <= cierreMin; startMin += CHAT_IA_SLOT_STEP_MIN) {
    const endMin = startMin + duracion;
    if (endMin > cierreMin) break;
    const horaInicio = chatIaHoraDesdeMinutosReserva(startMin);
    const horaFin = chatIaHoraDesdeMinutosReserva(endMin);

    const ocupadasNums = lista
      .filter(
        (r) =>
          reservaEstadoBloqueaSlotBackend(r) &&
          numsSlots.includes(parseInt(String(r.cancha), 10)) &&
          reservasSolapanBackend(startMin, duracion, r),
      )
      .map((r) => parseInt(String(r.cancha), 10));
    const ocupSet = new Set(ocupadasNums);
    const libres = numsSlots.length - ocupSet.size;

    if (libres > 0) {
      if (filtrarPasadosHoy) {
        const slotMs = reservaWallStartUtcMs(fecha, horaInicio, tz);
        if (slotMs != null && Number.isFinite(slotMs) && slotMs <= Date.now()) continue;
      }
      const libresNums = numsSlots.filter((n) => !ocupSet.has(n));
      const detalleCanchas = libresNums.map((num) => {
        const ca = canchasMeta.find((x) => Number(x.numero) === Number(num));
        const nom = String(ca?.nombre || '').trim() || `Cancha ${num}`;
        return { numero: num, nombre: nom };
      });
      const nombresTxt = detalleCanchas.map((d) => d.nombre).join(' · ');
      slots.push({
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        horario: `${horaInicio} - ${horaFin}`,
        canchas_libres: libres,
        canchas_ofertadas: numsSlots.length,
        canchas_detalle: detalleCanchas,
        canchas_nombres: nombresTxt,
      });
    }
  }
  return { slots, error: null };
}

async function chatIaFetchSedeFullForTool(supabaseClient, sedeId) {
  const sid = parseInt(String(sedeId), 10);
  if (!Number.isFinite(sid) || sid <= 0) return null;
  // No incluir canchas_activas aquí: no es columna de `sedes` (se arma en sedeResponseConCanchasActivas vía tabla canchas).
  const { data: sede, error } = await supabaseClient
    .from('sedes')
    .select(
      'id,nombre,horario_apertura,horario_cierre,duracion_reserva_minutos,cantidad_canchas,timezone,ciudad,pais',
    )
    .eq('id', sid)
    .maybeSingle();
  if (error) {
    console.error('[chat-ia] chatIaFetchSedeFullForTool sedes', { sede_id: sid, error: error.message || String(error) });
    return null;
  }
  if (!sede) return null;
  let canchasRows = [];
  try {
    canchasRows = await fetchCanchasRowsForSede(sid);
  } catch (e) {
    console.error('[chat-ia] chatIaFetchSedeFullForTool canchas', { sede_id: sid, error: e?.message || String(e) });
    canchasRows = [];
  }
  return sedeResponseConCanchasActivas(sede, canchasRows);
}

/** Misma lógica agregada que GET /api/rankings; devuelve hasta 10 filas. */
async function chatIaRankingsForTool(supabaseClient, { nivel, deporte, categoria, pais, sede_id }) {
  const scope = ['local', 'nacional', 'internacional'].includes(String(nivel || '').trim())
    ? String(nivel).trim()
    : 'internacional';
  const genCompFilt = '';
  const normPais = (s) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const SCOPE_NIVELES = {
    local: ['club', 'club_oficial', 'club_no_oficial'],
    nacional: ['nacional'],
    internacional: ['internacional', 'mundial'],
  };
  const nivelesPermitidos = SCOPE_NIVELES[scope] || SCOPE_NIVELES.internacional;
  const deporteFiltro = normalizeTorneoDeporteForDb(deporte || 'padbol');

  let torneosQuery = supabaseClient
    .from('torneos')
    .select('id, sede_id, nivel_torneo, nombre, tipo_competencia, tipo_torneo_genero, genero_competencia, categoria_edad, deporte')
    .eq('estado', 'finalizado')
    .in('nivel_torneo', nivelesPermitidos)
    .eq('deporte', deporteFiltro);

  if (scope === 'local') {
    const sidRaw = sede_id != null && String(sede_id).trim() !== '' ? parseInt(String(sede_id), 10) : NaN;
    if (Number.isFinite(sidRaw)) {
      torneosQuery = torneosQuery.eq('sede_id', sidRaw);
    } else {
      const pPais = pais && String(pais).trim();
      if (!pPais) {
        return {
          ok: false,
          error:
            'Ranking local: pasá sede_id (id numérico de la sede) o pais para acotar sedes; si no, usá nivel internacional o nacional.',
        };
      }
      let sedesQ = supabaseClient.from('sedes').select('id').ilike('pais', pPais);
      const { data: sedeRows, error: errSedes } = await sedesQ;
      if (errSedes) return { ok: false, error: errSedes.message };
      const ids = (sedeRows || []).map((s) => s.id).filter((id) => id != null);
      if (!ids.length) return { ok: true, ranking: [] };
      torneosQuery = torneosQuery.in('sede_id', ids);
    }
  }

  const { data: torneosRaw, error: errT } = await torneosQuery;
  if (errT) return { ok: false, error: errT.message };
  if (!torneosRaw?.length) return { ok: true, ranking: [] };

  const torneos = torneosRaw.filter((t) => torneoPasaFiltroGeneroRankingApi(t, genCompFilt));
  if (!torneos.length) return { ok: true, ranking: [] };

  const torneoIds = torneos.map((t) => t.id);
  const depByTorneoId = {};
  torneos.forEach((t) => {
    depByTorneoId[t.id] = normalizeTorneoDeporteForDb(t.deporte);
  });

  const { data: puntosRaw, error: errP } = await supabaseClient
    .from('tabla_puntos')
    .select('torneo_id, equipo_id, posicion, puntos, deporte')
    .in('torneo_id', torneoIds);
  if (errP) return { ok: false, error: errP.message };
  const puntos = (puntosRaw || []).filter((p) => {
    const d = p.deporte != null && String(p.deporte).trim() !== '' ? normalizeTorneoDeporteForDb(p.deporte) : depByTorneoId[p.torneo_id];
    return d === deporteFiltro;
  });
  if (!puntos?.length) return { ok: true, ranking: [] };

  const equipoIds = [...new Set(puntos.map((p) => p.equipo_id))];
  const { data: equipos, error: errE } = await supabaseClient.from('equipos').select('id, nombre, jugadores').in('id', equipoIds);
  if (errE) return { ok: false, error: errE.message };

  const equipoMap = {};
  (equipos || []).forEach((e) => {
    equipoMap[e.id] = e;
  });

  const playerMap = {};
  puntos.forEach((p) => {
    const equipo = equipoMap[p.equipo_id];
    if (!equipo) return;
    const jugadores = Array.isArray(equipo.jugadores) ? equipo.jugadores : [];
    if (jugadores.length === 0) {
      const key = `equipo:${equipo.id}`;
      if (!playerMap[key]) {
        playerMap[key] = {
          nombre: equipo.nombre,
          email: null,
          pais: null,
          puntos_total: 0,
          torneos_count: 0,
        };
      }
      playerMap[key].puntos_total += p.puntos;
      playerMap[key].torneos_count += 1;
    } else {
      jugadores.forEach((j) => {
        const key = j.email || j.nombre;
        if (!key) return;
        if (!playerMap[key]) {
          playerMap[key] = {
            nombre: j.nombre || key,
            email: j.email || null,
            pais: null,
            puntos_total: 0,
            torneos_count: 0,
          };
        }
        playerMap[key].puntos_total += p.puntos;
        playerMap[key].torneos_count += 1;
      });
    }
  });

  const emails = Object.values(playerMap)
    .map((pl) => pl.email)
    .filter(Boolean);
  if (emails.length > 0) {
    const { data: perfiles } = await supabaseClient
      .from('jugadores_perfil')
      .select('email, nombre, apellido, alias, pais, sede_id, nivel')
      .in('email', emails);
    (perfiles || []).forEach((perfil) => {
      const entry = playerMap[perfil.email];
      if (!entry) return;
      entry.pais = perfil.pais || null;
      entry.nombre = perfil.nombre || entry.nombre;
      entry.nivel = perfil.nivel || null;
    });
  }

  let result = Object.values(playerMap);
  if (categoria && String(categoria).trim()) {
    result = result.filter((pl) => pl.nivel === String(categoria).trim());
  }
  if (scope === 'nacional' && pais && String(pais).trim()) {
    const needle = normPais(pais);
    result = result.filter((pl) => normPais(pl.pais) === needle);
  }

  result.sort((a, b) => b.puntos_total - a.puntos_total || b.torneos_count - a.torneos_count);
  return { ok: true, ranking: result.slice(0, 10) };
}

function chatIaAnthropicToolsDefinition() {
  return [
    {
      name: 'consultar_disponibilidad',
      description:
        'Returns real free court time slots for one club (sede_id) on a calendar date YYYY-MM-DD and duration 60, 90 or 120 minutes. Same rules as the public booking form. Pass deporte ONLY when the user explicitly names a sport in their message (e.g. football, padel, tennis). For generic requests like "today\'s hours" / "ver horarios hoy" (no sport named), omit deporte so all courts count. If sede_id is unknown, call listar_sedes or buscar_sedes_por_deporte.',
      input_schema: {
        type: 'object',
        properties: {
          sede_id: { type: 'number', description: 'Numeric club id from listar_sedes or context' },
          fecha: { type: 'string', description: 'Date YYYY-MM-DD, or relative words resolved server-side (mañana/hoy)' },
          duracion_minutos: { type: 'number', enum: [60, 90, 120], description: 'Optional; default 90' },
          deporte: {
            type: 'string',
            description:
              'ONLY if the user explicitly names a sport (fútbol, pádel, tenis, padbol, pickleball, squash, etc.). Omit for generic availability ("ver horarios hoy", "horarios hoy", "turnos libres" without a sport). Values: padbol, padel, tenis, pickleball, squash, futbol (or futbol_5 / futbol_7).',
          },
        },
        required: ['sede_id', 'fecha'],
      },
    },
    {
      name: 'listar_sedes',
      description: 'Lista sedes públicas con id, nombre, ciudad, país, timezone y horarios. Filtra opcionalmente por país.',
      input_schema: {
        type: 'object',
        properties: {
          pais: { type: 'string', description: 'Filtro opcional, coincide con sedes.pais (ilike)' },
        },
      },
    },
    {
      name: 'buscar_sedes_por_deporte',
      description:
        'Find clubs that declare the given sport in canchas_por_deporte (with court counts). Use for questions like which clubs near me offer football or padel. Combine with optional ciudad or pais filters (ilike on sedes).',
      input_schema: {
        type: 'object',
        properties: {
          deporte: {
            type: 'string',
            description: 'Required: padbol, padel, futbol, tenis, pickleball, squash, futbol_5, futbol_7',
          },
          ciudad: { type: 'string', description: 'Optional: filters sedes.ciudad (ilike)' },
          pais: { type: 'string', description: 'Optional: filters sedes.pais (ilike)' },
        },
        required: ['deporte'],
      },
    },
    {
      name: 'listar_torneos',
      description: 'Torneos próximos (no finalizados) con fechas y datos básicos.',
      input_schema: {
        type: 'object',
        properties: {
          sede_id: { type: 'number', description: 'Opcional: solo torneos de esta sede' },
          dias_proximos: { type: 'number', description: 'Ventana desde hoy (ART) hacia adelante, default 30' },
        },
      },
    },
    {
      name: 'consultar_ranking',
      description: 'Top jugadores/equipos por puntos de torneos finalizados (tabla_puntos).',
      input_schema: {
        type: 'object',
        properties: {
          nivel: {
            type: 'string',
            enum: ['local', 'nacional', 'internacional'],
            description: 'Alcance del torneo',
          },
          deporte: { type: 'string', description: 'Ej. padbol, padel' },
          categoria: { type: 'string', description: 'Opcional: filtra por nivel del jugador en perfil' },
          pais: { type: 'string', description: 'Para nacional: país del jugador; para local sin sede_id: filtra sedes' },
          sede_id: { type: 'number', description: 'Para nivel local: recomendado' },
        },
        required: ['nivel', 'deporte'],
      },
    },
  ];
}

/** Anthropic a veces entrega `input` como string JSON; normalizar a objeto plano. */
function chatIaParseToolInput(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return {};
    try {
      const o = JSON.parse(t);
      return o != null && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return {};
}

/** Anthropic Messages API: `tool_result.content` debe ser string o bloques; siempre string JSON aquí. */
function chatIaToolResultContentString(payload) {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? String(v) : v));
  } catch (e) {
    return JSON.stringify({ ok: false, error: 'tool_result_serialización', detail: e?.message || String(e) });
  }
}

function chatIaNormalizeFechaYmdReserva(raw) {
  const s0 = String(raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s0)) return s0;
  const s = s0.slice(0, 40);
  const d = DateTime.fromISO(s, { zone: 'utc' });
  if (d.isValid) return d.toFormat('yyyy-LL-dd');
  const d2 = DateTime.fromFormat(s, 'd/M/yyyy', { zone: 'utc' });
  if (d2.isValid) return d2.toFormat('yyyy-LL-dd');
  const d3 = DateTime.fromFormat(s, 'd-M-yyyy', { zone: 'utc' });
  if (d3.isValid) return d3.toFormat('yyyy-LL-dd');
  return '';
}

/** Resuelve "mañana"/"hoy" usando el calendario ART del contexto (misma zona que fecha_referencia). */
function chatIaResolveDisponibilidadFecha(raw, ctx) {
  const direct = chatIaNormalizeFechaYmdReserva(raw);
  if (direct) return direct;
  const rawStr = String(raw ?? '').trim();
  if (!rawStr) return '';
  const fold = chatIaFoldText(rawStr)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!fold) return '';
  const ref = String(ctx?.fecha_referencia || '').trim();
  const man = String(ctx?.fecha_mañana_art || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ref)) return '';
  const hasPasadoManana =
    /\bpasado manana\b/.test(fold) ||
    /\bday after tomorrow\b/.test(fold) ||
    /\bdepois de amanha\b/.test(fold);
  const hasManana =
    !hasPasadoManana &&
    (/\bmanana\b/.test(fold) ||
      /\b tomorrow\b/.test(` ${fold} `) ||
      /\btomorrow\b/.test(fold) ||
      /\bamanha\b/.test(fold) ||
      /\bproximo dia\b/.test(fold));
  if (hasManana) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(man)) return man;
    return DateTime.fromISO(ref, { zone: TZ_TORNEO_CALENDARIO }).plus({ days: 1 }).toFormat('yyyy-LL-dd');
  }
  if (hasPasadoManana) {
    return DateTime.fromISO(ref, { zone: TZ_TORNEO_CALENDARIO }).plus({ days: 2 }).toFormat('yyyy-LL-dd');
  }
  if (/\bhoy\b/.test(fold) || /\btoday\b/.test(fold) || /\bhoje\b/.test(fold)) return ref;
  return '';
}

function chatIaLogConsultarDisponibilidad(payload) {
  try {
    console.error('[chat-ia] consultar_disponibilidad', JSON.stringify(payload));
  } catch (e) {
    console.error('[chat-ia] consultar_disponibilidad (log falló)', e?.message || e);
  }
}

async function chatIaExecuteTool(supabaseClient, toolName, toolInput, ctx, ultimoMensajeUsuario) {
  const input = chatIaParseToolInput(toolInput);
  const ultimoUser = ultimoMensajeUsuario != null ? String(ultimoMensajeUsuario).trim() : '';
  try {
    if (toolName === 'consultar_disponibilidad') {
      const sedeId = Number.parseInt(String(input.sede_id ?? '').trim(), 10);
      const fecha = chatIaResolveDisponibilidadFecha(input.fecha, ctx);
      let dur = Number.parseInt(String(input.duracion_minutos ?? '').trim(), 10);
      if (![60, 90, 120].includes(dur)) dur = 90;
      let depCanon = normalizeChatIaDeporteToolInput(input.deporte);
      if (ultimoUser && chatIaShouldOmitDeporteDisponibilidadParaUltimoUsuario(ultimoUser)) {
        if (depCanon) {
          chatIaLogConsultarDisponibilidad({
            step: 'deporte_omitido_frase_generica_hoy',
            ultimo_usuario_fold: chatIaFoldUsuarioDisponibilidadPhrase(ultimoUser),
            deporte_modelo_descartado: depCanon,
          });
        }
        depCanon = '';
      }
      chatIaLogConsultarDisponibilidad({
        step: 'entrada',
        toolInput_type: typeof toolInput,
        keys: Object.keys(input),
        raw_sede_id: input.sede_id,
        raw_fecha: input.fecha,
        raw_duracion_minutos: input.duracion_minutos,
        raw_deporte: input.deporte,
        parsed_sede_id: sedeId,
        parsed_fecha: fecha,
        parsed_duracion_minutos: dur,
        deporte_canon: depCanon || null,
      });
      if (!Number.isFinite(sedeId) || sedeId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        const errOut = { ok: false, error: 'Parámetros inválidos: sede_id numérico y fecha válida (YYYY-MM-DD o mañana/hoy según contexto)' };
        chatIaLogConsultarDisponibilidad({ step: 'params_invalid', ...errOut, sedeId, fecha, dur });
        return errOut;
      }
      const sedeFull = await chatIaFetchSedeFullForTool(supabaseClient, sedeId);
      if (!sedeFull) {
        const errOut = { ok: false, error: 'Sede no encontrada' };
        chatIaLogConsultarDisponibilidad({ step: 'sede_fetch_null', sedeId, ...errOut });
        return errOut;
      }
      chatIaLogConsultarDisponibilidad({
        step: 'antes_compute_slots',
        sedeId,
        sede_nombre: String(sedeFull.nombre || '').trim(),
        fecha,
        duracion_minutos: dur,
        timezone: sedeFull.timezone,
        cantidad_canchas: sedeFull.cantidad_canchas,
        canchas_activas_count: Array.isArray(sedeFull.canchas_activas) ? sedeFull.canchas_activas.length : 0,
      });
      const { slots, error } = await computeChatIaSlotsReales(supabaseClient, sedeFull, fecha, dur, depCanon || null);
      if (error) {
        const errOut = { ok: false, error };
        chatIaLogConsultarDisponibilidad({ step: 'compute_slots_error', sedeId, fecha, dur, ...errOut });
        return errOut;
      }
      const okOut = {
        ok: true,
        sede_id: sedeId,
        sede_nombre: String(sedeFull.nombre || '').trim(),
        fecha,
        duracion_minutos: dur,
        deporte_filtro: depCanon || null,
        slots: slots.map((s) => ({
          hora_inicio: s.hora_inicio,
          hora_fin: s.hora_fin,
          canchas_libres: s.canchas_libres,
          canchas_nombres: s.canchas_nombres || null,
          canchas_detalle: Array.isArray(s.canchas_detalle) ? s.canchas_detalle.slice(0, 8) : [],
        })),
      };
      chatIaLogConsultarDisponibilidad({ step: 'ok', sedeId, fecha, dur, deporte: depCanon || null, slots_count: slots.length });
      return okOut;
    }
    if (toolName === 'buscar_sedes_por_deporte') {
      const depCanon = normalizeChatIaDeporteToolInput(input.deporte);
      if (!depCanon) {
        return {
          ok: false,
          error: 'Parámetro deporte requerido (padbol, padel, futbol, tenis, pickleball, squash, futbol_5, futbol_7)',
        };
      }
      const keys = chatIaDeporteDbKeysForFilter(depCanon);
      if (!keys.length) return { ok: false, error: 'Deporte no reconocido' };
      const { data: cpd, error } = await supabaseClient
        .from('canchas_por_deporte')
        .select('sede_id, deporte, cantidad, activo')
        .in('deporte', keys)
        .gt('cantidad', 0);
      if (error) return { ok: false, error: error.message };
      const sidMap = new Map();
      for (const row of cpd || []) {
        if (row?.activo === false) continue;
        const sid = Number(row.sede_id);
        if (!Number.isFinite(sid) || sid <= 0) continue;
        const c = Number(row.cantidad) || 0;
        if (c <= 0) continue;
        sidMap.set(sid, (sidMap.get(sid) || 0) + c);
      }
      const ids = [...sidMap.keys()];
      if (!ids.length) return { ok: true, deporte_filtro: depCanon, sedes: [] };
      let sq = supabaseClient.from('sedes').select('id,nombre,ciudad,pais').in('id', ids).order('nombre', { ascending: true }).limit(80);
      const ciudadF = String(input.ciudad || '').trim();
      const paisF = String(input.pais || '').trim();
      if (paisF) sq = sq.ilike('pais', `%${paisF}%`);
      if (ciudadF) sq = sq.ilike('ciudad', `%${ciudadF}%`);
      const { data: sedesData, error: sErr } = await sq;
      if (sErr) return { ok: false, error: sErr.message };
      const sedes = (sedesData || []).map((s) => ({
        id: s.id,
        nombre: s.nombre,
        ciudad: s.ciudad,
        pais: s.pais,
        canchas_declaradas_para_deporte: sidMap.get(Number(s.id)) || 0,
      }));
      return { ok: true, deporte_filtro: depCanon, sedes };
    }
    if (toolName === 'listar_sedes') {
      const paisF = String(input.pais || '').trim();
      let q = supabaseClient
        .from('sedes')
        .select('id,nombre,ciudad,pais,timezone,horario_apertura,horario_cierre,precio_turno,moneda')
        .order('nombre', { ascending: true })
        .limit(60);
      if (paisF) q = q.ilike('pais', paisF);
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message };
      const rows = Array.isArray(data) ? data : [];
      return {
        ok: true,
        sedes: rows.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          ciudad: s.ciudad,
          pais: s.pais,
          timezone: normalizeSedeTimezone(s.timezone || inferTimezoneFromCiudadPais(s.ciudad, s.pais)),
          horario: [s.horario_apertura, s.horario_cierre].filter(Boolean).join('–') || null,
          precio_turno: s.precio_turno,
          moneda: s.moneda || 'ARS',
        })),
      };
    }
    if (toolName === 'listar_torneos') {
      const dias = Number.isFinite(Number(input.dias_proximos)) ? Math.min(90, Math.max(1, Number(input.dias_proximos))) : 30;
      const todayYmd = ymdTodayInTorneoTz();
      const hasta = DateTime.fromISO(todayYmd, { zone: TZ_TORNEO_CALENDARIO })
        .plus({ days: dias })
        .toFormat('yyyy-LL-dd');
      let tq = supabaseClient
        .from('torneos')
        .select(
          'id,nombre,fecha_inicio,estado,sede_id,categoria_edad,deporte,precio_inscripcion,monto_inscripcion,moneda,cupos_maximos',
        )
        .gte('fecha_inicio', todayYmd)
        .lte('fecha_inicio', hasta)
        .order('fecha_inicio', { ascending: true })
        .limit(40);
      const sid = input.sede_id != null ? parseInt(String(input.sede_id), 10) : NaN;
      if (Number.isFinite(sid) && sid > 0) tq = tq.eq('sede_id', sid);
      const { data, error } = await tq;
      if (error) return { ok: false, error: error.message };
      const list = (Array.isArray(data) ? data : []).filter((t) => chatIaTorneoEstadoInteresPublico(t?.estado));
      return {
        ok: true,
        torneos: list.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          fecha_inicio: t.fecha_inicio,
          estado: t.estado,
          sede_id: t.sede_id,
          categoria: t.categoria_edad || null,
          deporte: t.deporte || null,
          precio_inscripcion: t.monto_inscripcion != null && t.monto_inscripcion !== '' ? t.monto_inscripcion : t.precio_inscripcion,
          moneda: t.moneda || null,
          cupos: t.cupos_maximos ?? null,
        })),
      };
    }
    if (toolName === 'consultar_ranking') {
      const paisDefault = String(ctx?.usuario_logueado?.perfil?.pais || '').trim();
      const sidH = ctx?.usuario_logueado?.sede_habitual?.sede_id;
      const sedeIdTool = input.sede_id != null ? parseInt(String(input.sede_id), 10) : NaN;
      const sedeRanking =
        Number.isFinite(sedeIdTool) && sedeIdTool > 0 ? sedeIdTool : input.nivel === 'local' && sidH != null ? Number(sidH) : null;
      return chatIaRankingsForTool(supabaseClient, {
        nivel: input.nivel,
        deporte: input.deporte,
        categoria: input.categoria,
        pais: String(input.pais || '').trim() || (input.nivel === 'nacional' ? paisDefault : ''),
        sede_id: sedeRanking,
      });
    }
    return { ok: false, error: `Tool desconocida: ${toolName}` };
  } catch (e) {
    if (toolName === 'consultar_disponibilidad') {
      chatIaLogConsultarDisponibilidad({
        step: 'exception',
        error: e?.message || String(e),
        stack: typeof e?.stack === 'string' ? e.stack.slice(0, 800) : undefined,
      });
    }
    return { ok: false, error: e?.message || String(e) };
  }
}

function chatIaSedeNombreDesdeCtx(ctx, sedeId) {
  const sid = Number(sedeId);
  if (!Number.isFinite(sid) || sid <= 0) return '';
  const list = Array.isArray(ctx?.sedes) ? ctx.sedes : [];
  const row = list.find((s) => Number(s.id) === sid);
  return row ? String(row.nombre || '').trim() : '';
}

/** Último sede_id mencionado en un marcador RESERVA del historial (asistente). */
function chatIaSedeIdDesdeHistorialReserva(historial) {
  const rows = Array.isArray(historial) ? historial : [];
  let lastId = null;
  for (const h of rows) {
    if (h?.role !== 'assistant') continue;
    const t = String(h.content || '');
    const re = /<<<RESERVA:sede_id=(\d+)/gi;
    let m;
    while ((m = re.exec(t)) !== null) {
      const id = parseInt(m[1], 10);
      if (Number.isFinite(id) && id > 0) lastId = id;
    }
  }
  return lastId;
}

async function chatIaRunClaudeWithTools({ apiKey, model, system, messages, tools, supabaseClient, ctx, ultimoMensajeUsuario }) {
  const msgs = [...messages];
  const toolDefs = tools || chatIaAnthropicToolsDefinition();
  let sedeContextoUltima = null;
  let ultimaConsultaDisponibilidad = null;
  for (let round = 0; round < 8; round += 1) {
    console.error('[chat-ia] Anthropic request', JSON.stringify({ round, model, msg_count: msgs.length }));
    const anthroRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        system,
        tools: toolDefs,
        messages: msgs,
      }),
    });
    const rawJson = await anthroRes.json().catch(() => ({}));
    if (!anthroRes.ok) {
      console.error(
        '[chat-ia] Anthropic HTTP error',
        JSON.stringify({
          round,
          status: anthroRes.status,
          err: rawJson?.error || rawJson,
        }),
      );
      const lastUser = msgs.length ? msgs[msgs.length - 1] : null;
      const lastContent = lastUser?.content;
      const toolDbg =
        round > 0 && Array.isArray(lastContent)
          ? lastContent
              .filter((b) => b && b.type === 'tool_result')
              .map((b) => ({
                tool_use_id: b.tool_use_id,
                content_type: typeof b.content,
                content_len: typeof b.content === 'string' ? b.content.length : null,
              }))
          : null;
      if (toolDbg?.length) {
        console.error('[chat-ia] Anthropic error con tool_result previo', JSON.stringify({ status: anthroRes.status, toolDbg }));
      }
      return {
        ok: false,
        status: anthroRes.status,
        error: rawJson?.error?.message || rawJson?.message || 'Anthropic error',
        raw: rawJson,
      };
    }
    const content = Array.isArray(rawJson.content) ? rawJson.content : [];
    console.error(
      '[chat-ia] Anthropic response ok',
      JSON.stringify({
        round,
        status: anthroRes.status,
        stop_reason: rawJson.stop_reason,
        block_types: content.map((b) => b?.type).filter(Boolean),
        usage: rawJson.usage || null,
      }),
    );
    msgs.push({ role: 'assistant', content });
    const stop = rawJson.stop_reason;
    if (stop !== 'tool_use') {
      const text = content
        .filter((b) => b && b.type === 'text' && b.text)
        .map((b) => b.text)
        .join('\n')
        .trim();
      return {
        ok: true,
        text,
        stop_reason: stop,
        raw: rawJson,
        sede_contexto: sedeContextoUltima,
        disponibilidad: ultimaConsultaDisponibilidad,
      };
    }
    const toolUses = content.filter((b) => b && b.type === 'tool_use' && b.name && b.id);
    if (!toolUses.length) {
      return { ok: false, error: 'tool_use sin bloques', raw: rawJson };
    }
    const toolResults = [];
    for (const tu of toolUses) {
      const rawToolIn = tu.input != null ? tu.input : tu.arguments;
      const parsedIn = chatIaParseToolInput(rawToolIn);
      if (tu.name === 'consultar_disponibilidad') {
        console.error(
          '[chat-ia] tool_use Claude',
          JSON.stringify({
            tool_use_id: tu.id,
            name: tu.name,
            raw_input_type: typeof rawToolIn,
            parsed_keys: Object.keys(parsedIn),
            parsed_sede_id: parsedIn.sede_id,
            parsed_fecha: parsedIn.fecha,
            parsed_duracion_minutos: parsedIn.duracion_minutos,
            parsed_deporte: parsedIn.deporte,
          }),
        );
      }
      const out = await chatIaExecuteTool(supabaseClient, tu.name, parsedIn, ctx, ultimoMensajeUsuario);
      if (tu.name === 'consultar_disponibilidad' && out?.ok && out.sede_id) {
        const id = Number(out.sede_id);
        const nombre =
          String(out.sede_nombre || '').trim() || chatIaSedeNombreDesdeCtx(ctx, id) || `Sede ${id}`;
        sedeContextoUltima = { id, nombre };
        ultimaConsultaDisponibilidad = {
          sede_id: id,
          sede_nombre: String(out.sede_nombre || nombre).trim(),
          fecha: out.fecha || null,
          duracion_minutos: out.duracion_minutos ?? null,
          deporte_filtro: out.deporte_filtro != null && String(out.deporte_filtro).trim() ? String(out.deporte_filtro).trim() : null,
          slots: Array.isArray(out.slots) ? out.slots.slice(0, 24) : [],
        };
      } else if (tu.name === 'listar_torneos') {
        const sid = parsedIn.sede_id != null ? parseInt(String(parsedIn.sede_id).trim(), 10) : NaN;
        if (Number.isFinite(sid) && sid > 0) {
          const nombre = chatIaSedeNombreDesdeCtx(ctx, sid) || `Sede ${sid}`;
          sedeContextoUltima = { id: sid, nombre };
        }
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: chatIaToolResultContentString(out),
      });
    }
    console.error(
      '[chat-ia] tool_results enviados',
      JSON.stringify(
        toolResults.map((tr) => ({
          tool_use_id: tr.tool_use_id,
          content_len: typeof tr.content === 'string' ? tr.content.length : 0,
          ok_flag:
            typeof tr.content === 'string' && tr.content.includes('"ok":true')
              ? true
              : typeof tr.content === 'string' && tr.content.includes('"ok":false')
                ? false
                : null,
        })),
      ),
    );
    msgs.push({ role: 'user', content: toolResults });
  }
  return { ok: false, error: 'Demasiadas rondas de tools' };
}

// ─── IA Chat (Anthropic Claude) ─────────────────────────────────────────────
const CHAT_IA_MODEL = process.env.CHAT_IA_MODEL?.trim() || 'claude-sonnet-4-5-20250929';
const CHAT_IA_RATE_WINDOW_MS = 60 * 60 * 1000;
const CHAT_IA_RATE_MAX = 20;
const CHAT_IA_MAX_USER_MSG = 6;
const chatIaRateBuckets = new Map();

function chatIaRateKey(req, user) {
  if (user?.id) return `u:${user.id}`;
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = xf || req.ip || String(req.socket?.remoteAddress || '').trim() || 'unknown';
  return `ip:${ip}`;
}

function chatIaConsumeRateSlot(key) {
  const now = Date.now();
  const cut = now - CHAT_IA_RATE_WINDOW_MS;
  let arr = chatIaRateBuckets.get(key);
  if (!Array.isArray(arr)) arr = [];
  arr = arr.filter((t) => t > cut);
  if (arr.length >= CHAT_IA_RATE_MAX) return false;
  arr.push(now);
  chatIaRateBuckets.set(key, arr);
  return true;
}

function normalizeChatIaLocale(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .slice(0, 24);
  if (!s) return 'es';
  if (s.startsWith('es')) return 'es';
  if (s.startsWith('pt')) return 'pt';
  if (s.startsWith('en')) return 'en';
  if (s.startsWith('fr')) return 'fr';
  if (s.startsWith('de')) return 'de';
  if (s.startsWith('it')) return 'it';
  return 'es';
}

/** es|en|pt según el texto del usuario en el turno (no navigator). Heurística alineada con el frontend. */
function chatIaInferWritingLocaleFromConversation(mensaje, historial) {
  const parts = [];
  if (Array.isArray(historial)) {
    for (const row of historial) {
      if (row && row.role === 'user' && String(row.content || '').trim()) parts.push(String(row.content).trim());
    }
  }
  if (String(mensaje || '').trim()) parts.push(String(mensaje).trim());
  const text = parts.join('\n');
  if (!text.trim()) return 'es';

  const fold = chatIaFoldText(text).toLowerCase();
  const pad = ` ${fold.replace(/\s+/g, ' ')} `;

  let pt = 0;
  let es = 0;
  let en = 0;

  if (/[ãõ]|\b(nao|nao)\b/i.test(text) || /não/i.test(text)) pt += 4;
  if (/ñ|¿|¡/.test(text)) es += 4;
  if (/\b(nao|nao|voce|voces|torneio|obrigado|obrigada|quadras|disponivel|tambem|amanha)\b/.test(pad)) pt += 3;
  if (/\b(manana|hoy|cuando|donde|cancha|turno|disponibilidad|quiero|gracias|sedes?|horarios)\b/.test(pad)) es += 3;
  if (/\b(tomorrow|today|when|where|booking|available|slot|courts|tournament|thanks|please|what\s+time|how\s+do)\b/.test(pad)) en += 3;
  if (/\b(voce|voces)\b/.test(pad)) pt += 2;
  if (/\b(the|and|with|for)\b/.test(pad)) en += 1;
  if (/\b(el|la|los|las|una|por|para)\b/.test(pad)) es += 1;

  if (pt > es && pt > en) return 'pt';
  if (en > es && en > pt) return 'en';
  return 'es';
}

function chatIaLuxonLocaleForUi(lang) {
  const l = normalizeChatIaLocale(lang);
  if (l === 'pt') return 'pt-BR';
  if (l === 'en') return 'en';
  if (l === 'fr') return 'fr';
  if (l === 'de') return 'de';
  if (l === 'it') return 'it';
  return 'es';
}

function chatIaClaudeLanguageName(lang) {
  const l = normalizeChatIaLocale(lang);
  const m = { es: 'Spanish', en: 'English', pt: 'Portuguese', fr: 'French', de: 'German', it: 'Italian' };
  return m[l] || 'Spanish';
}

function chatIaTelefonoToWaMeDigits(telefono) {
  const digits = String(telefono || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('0') ? `54${digits.slice(1)}` : digits;
}

function chatIaGuiaAppUsoSerializable() {
  return {
    reservar:
      'Reservas: Hub o /reservar → sede (o ?sedeId=) → fecha → horario en grilla → cancha → datos y pago según la sede.',
    torneos:
      'Torneos: listado por sede o hub → ficha del torneo → crear equipo / inscribirse según estado; fixture y resultados cuando corresponda.',
    ranking: 'Ranking: perfiles de jugador y tablas de puntos por torneo finalizado.',
    partidos: 'Partidos e invitaciones: desde el hub y notificaciones de la app.',
  };
}

function stripChatIaWhatsAppMarkers(rawText) {
  const raw = String(rawText || '');
  const re = /<<<WHATSAPP(?:\:sede_id=(\d+))?>>>/gi;
  let lastSedeId = null;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m[1]) lastSedeId = parseInt(m[1], 10);
  }
  const text = raw.replace(re, '').trim();
  return {
    text,
    whatsapp_sede_id: Number.isFinite(lastSedeId) && lastSedeId > 0 ? lastSedeId : null,
  };
}

/** Usuario pide explícitamente WhatsApp o hablar con el club (no usar para "no entendí la sede"). */
function chatIaUserExplicitClubWhatsappIntent(text) {
  const t = chatIaFoldText(text);
  if (!t.trim()) return false;
  const wantsW = /\b(whatsapp|wsp|whats\s*app|wasap)\b/.test(t);
  const wantsHuman = /\b(hablar|habla|contact(ar|o)?|comunic(ar|o)?|que\s+me\s+atend|atenci[oó]n|persona|humano|operador|due[nñ]o|encargad)\b/.test(
    t,
  );
  const clubish = /\b(club|sede|local)\b/.test(t);
  if (wantsW && (clubish || wantsHuman)) return true;
  if (/\b(numero|n[uú]mero|telefono|tel[eé]fono|celular)\b.*\b(club|sede)\b/.test(t)) return true;
  if (/\b(club|sede)\b.*\b(whatsapp|wsp)\b/.test(t)) return true;
  return false;
}

/** El servidor solo muestra escalada WhatsApp si el mensaje del usuario lo autoriza (pedido explícito). */
function chatIaUserAllowsWhatsappEscalada(text) {
  if (chatIaUserExplicitClubWhatsappIntent(text)) return true;
  const t = chatIaFoldText(text);
  if (/\b(pasame|dame|mandame|quiero)\s+(el\s+)?(whatsapp|wsp|telefono|tel[eé]fono)\s+(del\s+)?(club|sede)\b/.test(t)) return true;
  if (/\b(hablar|contact(ar|o)?|comunic(ar|o)?)\s+con\s+(el\s+)?(club|la\s+sede|administraci|encargad)\b/.test(t)) return true;
  return false;
}

async function chatIaResolveWhatsappEscalation(supabaseClient, markerSedeId, ctx) {
  const trySede = async (sid) => {
    const id = parseInt(String(sid), 10);
    if (!Number.isFinite(id) || id <= 0) return null;
    const { data, error } = await supabaseClient.from('sedes').select('id,nombre,telefono').eq('id', id).maybeSingle();
    if (error || !data) return null;
    const digits = chatIaTelefonoToWaMeDigits(data.telefono);
    if (!digits) return null;
    const sn = String(data.nombre || '').trim();
    const textQ = encodeURIComponent(`Hola${sn ? ` ${sn}` : ''}, escribo desde Padbol Match y necesito ayuda.`);
    return { href: `https://wa.me/${digits}?text=${textQ}`, sede_id: id, sede_nombre: sn };
  };
  if (markerSedeId != null) {
    const r = await trySede(markerSedeId);
    if (r) return r;
  }
  const def = ctx?.usuario_logueado?.escalada_whatsapp_default;
  if (def?.href) return def;
  const h = ctx?.usuario_logueado?.sede_habitual;
  if (h?.sede_id != null) {
    const r2 = await trySede(h.sede_id);
    if (r2) return r2;
  }
  const sedesRows = ctx?._sedes_rows_chat_ia;
  if (Array.isArray(sedesRows)) {
    for (const s of sedesRows) {
      const r3 = await trySede(s.id);
      if (r3) return r3;
    }
  }
  return null;
}

function chatIaReservaEstadoCuentaPatron(estadoRaw) {
  return !String(estadoRaw || '').toLowerCase().includes('cancel');
}

function chatIaPatronReservasParaIa(reservasRows, idiomaUi, zone) {
  const rows = (Array.isArray(reservasRows) ? reservasRows : []).filter((r) => chatIaReservaEstadoCuentaPatron(r?.estado));
  if (!rows.length) return null;
  const dow = new Map();
  const horaH = new Map();
  const sedeC = new Map();
  const z = zone || TZ_TORNEO_CALENDARIO;
  for (const r of rows) {
    const fe = String(r?.fecha || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fe)) continue;
    const dt = DateTime.fromISO(fe, { zone: z }).startOf('day');
    if (!dt.isValid) continue;
    const w = dt.weekday;
    dow.set(w, (dow.get(w) || 0) + 1);
    const ho = String(r?.hora || '').trim();
    if (ho) {
      const hh = ho.split(/\s*-\s*/)[0]?.trim() || ho;
      if (hh) horaH.set(hh, (horaH.get(hh) || 0) + 1);
    }
    const se = String(r?.sede || '').trim();
    if (se) sedeC.set(se, (sedeC.get(se) || 0) + 1);
  }
  const loc = chatIaLuxonLocaleForUi(idiomaUi);
  let bestW = null;
  let bestWc = 0;
  for (const [w, c] of dow) {
    if (c > bestWc) {
      bestWc = c;
      bestW = w;
    }
  }
  let bestH = null;
  let bestHc = 0;
  for (const [h, c] of horaH) {
    if (c > bestHc) {
      bestHc = c;
      bestH = h;
    }
  }
  let bestS = null;
  let bestSc = 0;
  for (const [s, c] of sedeC) {
    if (c > bestSc) {
      bestSc = c;
      bestS = s;
    }
  }
  const refMon = DateTime.fromISO('2026-01-05', { zone: z });
  const weekdayName =
    bestW != null && refMon.isValid
      ? refMon.set({ weekday: bestW }).setLocale(loc).toFormat('cccc')
      : null;
  return {
    weekday_luxon: bestW,
    weekday_label: weekdayName,
    hora_tipica: bestH,
    sede_favorita_nombre: bestS,
    muestras: rows.length,
  };
}

async function chatIaEquiposInscripcionPorTorneoIds(supabaseClient, torneoIds) {
  const ids = [...new Set((torneoIds || []).map((x) => parseInt(String(x), 10)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!ids.length) return [];
  const { data, error } = await supabaseClient
    .from('equipos')
    .select('torneo_id, jugadores, creador_email, creador_id')
    .in('torneo_id', ids);
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

function chatIaJugadorInscriptoEnEquipo(eq, perfilLite, authUser) {
  if (!eq) return false;
  const em = String(perfilLite?.email || '').trim().toLowerCase();
  const ce = String(eq.creador_email || '').trim().toLowerCase();
  if (em && ce && em === ce) return true;
  const uid = String(authUser?.id || perfilLite?.user_id || '').trim();
  const cid = String(eq.creador_id || '').trim();
  if (uid && cid && uid === cid) return true;
  return jugadorEnEquipoStats(eq.jugadores, perfilLite);
}

function chatIaJugadorInscriptoTorneo(equiposRows, torneoId, perfilLite, authUser) {
  const tid = Number(torneoId);
  return (equiposRows || []).some(
    (eq) => Number(eq.torneo_id) === tid && chatIaJugadorInscriptoEnEquipo(eq, perfilLite, authUser),
  );
}

function chatIaTorneoEstadoInteresPublico(est) {
  const e = String(est || '').toLowerCase();
  return e !== 'finalizado' && e !== 'cancelado';
}

async function buildChatIAContextPayload(supabaseClient, authUser, localeUiRaw) {
  const idioma_ui = normalizeChatIaLocale(localeUiRaw);

  const sedesQ = await supabaseClient
    .from('sedes')
    .select('id,nombre,ciudad,pais,timezone,precio_turno,moneda,horario_apertura,horario_cierre,franjas_horarias,telefono')
    .order('nombre', { ascending: true })
    .limit(45);
  const sedesRows = sedesQ.error ? [] : sedesQ.data || [];
  const sedesCompact = sedesRows.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    ciudad: s.ciudad,
    pais: s.pais,
    timezone: s.timezone,
    precio_turno: s.precio_turno,
    moneda: s.moneda || 'ARS',
    horario: [s.horario_apertura, s.horario_cierre].filter(Boolean).join('–') || null,
    franjas: s.franjas_horarias != null ? JSON.stringify(s.franjas_horarias).slice(0, 500) : null,
  }));

  const todayYmd = ymdTodayInTorneoTz();
  const fecha_mañana_art =
    todayYmd && /^\d{4}-\d{2}-\d{2}$/.test(todayYmd)
      ? DateTime.fromISO(todayYmd, { zone: TZ_TORNEO_CALENDARIO }).plus({ days: 1 }).toFormat('yyyy-LL-dd')
      : null;
  const limiteYmd = DateTime.fromISO(todayYmd, { zone: TZ_TORNEO_CALENDARIO })
    .plus({ days: 7 })
    .toFormat('yyyy-LL-dd');

  const torneosQ = await supabaseClient
    .from('torneos')
    .select('id,nombre,fecha_inicio,estado,sede_id')
    .gte('fecha_inicio', todayYmd)
    .order('fecha_inicio', { ascending: true })
    .limit(24);
  const torneosRows = torneosQ.error ? [] : torneosQ.data || [];
  const torneos_proximos = torneosRows.filter((t) => chatIaTorneoEstadoInteresPublico(t?.estado));

  let usuarioBloque = null;
  if (authUser?.email) {
    const em = String(authUser.email || '').trim().toLowerCase();
    const uid = String(authUser.id || '').trim();
    const perfilQ = await supabaseClient
      .from('jugadores_perfil')
      .select('nombre,nombre_saludo,email,ciudad,pais,whatsapp,sede_id,user_id,alias,apodo,apellido')
      .eq('email', em)
      .maybeSingle();
    const perfil = perfilQ.data || null;
    const reservasQ = await supabaseClient
      .from('reservas')
      .select('sede,fecha,hora,estado,cancha,precio')
      .eq('email', em)
      .order('id', { ascending: false })
      .limit(12);
    const reservasLista = reservasQ.error ? [] : reservasQ.data || [];
    const reservas_ultimas_3 = reservasLista.slice(0, 3);
    const patron_sugerencias_ia = chatIaPatronReservasParaIa(reservasLista, idioma_ui, TZ_TORNEO_CALENDARIO);

    const perfilLite = {
      ...perfil,
      user_id: perfil?.user_id || uid || null,
      email: em,
    };

    let habitualSid = perfil?.sede_id != null && Number.isFinite(Number(perfil.sede_id)) ? Number(perfil.sede_id) : null;
    if (!habitualSid && reservasLista.length) {
      const sedeC = new Map();
      for (const r of reservasLista) {
        if (!chatIaReservaEstadoCuentaPatron(r?.estado)) continue;
        const n = String(r.sede || '').trim();
        if (!n) continue;
        sedeC.set(n, (sedeC.get(n) || 0) + 1);
      }
      let bn = null;
      let bc = 0;
      for (const [n, c] of sedeC) {
        if (c > bc) {
          bc = c;
          bn = n;
        }
      }
      if (bn) habitualSid = sedesRows.find((s) => String(s.nombre).trim() === bn)?.id ?? null;
    }

    let sede_habitual = null;
    if (habitualSid != null) {
      const row = sedesRows.find((s) => Number(s.id) === Number(habitualSid));
      if (row) {
        sede_habitual = {
          sede_id: habitualSid,
          nombre: String(row.nombre || '').trim(),
        };
      }
    }

    const torCand = torneos_proximos.filter(
      (t) =>
        habitualSid != null &&
        Number(t.sede_id) === Number(habitualSid) &&
        String(t.fecha_inicio || '').slice(0, 10) <= limiteYmd,
    );
    const tids = [...new Set(torCand.map((t) => t.id).filter((x) => x != null))];
    const equiposIns = await chatIaEquiposInscripcionPorTorneoIds(supabaseClient, tids);
    const torneos_sede_habitual_7d = torCand.slice(0, 6).map((t) => ({
      id: t.id,
      nombre: t.nombre,
      fecha_inicio: t.fecha_inicio,
      estado: t.estado,
      sede_id: t.sede_id,
      inscripto: chatIaJugadorInscriptoTorneo(equiposIns, t.id, perfilLite, authUser),
    }));

    let escalada_whatsapp_default = null;
    if (habitualSid != null) {
      const rowH = sedesRows.find((s) => Number(s.id) === Number(habitualSid));
      const digitDef = chatIaTelefonoToWaMeDigits(rowH?.telefono);
      if (digitDef) {
        const sedeN = sede_habitual?.nombre || String(rowH?.nombre || '').trim();
        const textQ = encodeURIComponent(`Hola${sedeN ? ` ${sedeN}` : ''}, escribo desde Padbol Match y necesito ayuda.`);
        escalada_whatsapp_default = {
          href: `https://wa.me/${digitDef}?text=${textQ}`,
          sede_id: habitualSid,
          sede_nombre: sedeN,
        };
      }
    }

    let ultima_reserva_sede = null;
    const rUlt = reservasLista[0];
    if (rUlt && String(rUlt.sede || '').trim()) {
      const rowMatch = sedesRows.find((s) => String(s.nombre || '').trim() === String(rUlt.sede).trim());
      if (rowMatch) {
        ultima_reserva_sede = {
          sede_id: rowMatch.id,
          nombre: String(rowMatch.nombre || '').trim(),
        };
      }
    }

    usuarioBloque = {
      email: em,
      user_id: uid,
      perfil,
      reservas_ultimas_3,
      patron_sugerencias_ia,
      sede_habitual,
      ultima_reserva_sede,
      torneos_sede_habitual_7d,
      escalada_whatsapp_default,
    };
  }

  return {
    idioma_ui,
    claude_language: chatIaClaudeLanguageName(idioma_ui),
    fecha_referencia: todayYmd,
    fecha_mañana_art,
    sedes_hora_local: sedesRows.map((s) => {
      const tz = normalizeSedeTimezone(s.timezone || inferTimezoneFromCiudadPais(s.ciudad, s.pais));
      const now = DateTime.now().setZone(tz);
      return {
        sede_id: s.id,
        nombre: String(s.nombre || '').trim(),
        timezone: tz,
        fecha_hora_local: now.toFormat('yyyy-LL-dd HH:mm'),
        ymd_hoy: now.toFormat('yyyy-LL-dd'),
      };
    }),
    sedes: sedesCompact,
    torneos_proximos,
    guia_app: chatIaGuiaAppUsoSerializable(),
    usuario_logueado: usuarioBloque,
    _sedes_rows_chat_ia: sedesRows,
  };
}

function buildChatIaBootstrapPayload(ctx) {
  const l = ctx?.idioma_ui || 'es';
  const u = ctx?.usuario_logueado;
  const nombre = String(u?.perfil?.nombre_saludo || u?.perfil?.nombre || u?.perfil?.apodo || '').trim();

  const lines = {
    es: {
      titulo: nombre ? `Hola ${nombre}, ¿en qué te ayudo?` : 'Hola, ¿en qué te ayudo?',
      patron: (() => {
        const p = u?.patron_sugerencias_ia;
        if (!p?.weekday_label || !p?.sede_favorita_nombre) return null;
        const h = p.hora_tipica ? ` a las ${p.hora_tipica}` : '';
        return `Sueles reservar los ${p.weekday_label}${h}\nen ${p.sede_favorita_nombre}. ¿Busco algo parecido esta semana?`;
      })(),
    },
    en: {
      titulo: nombre ? `Hi ${nombre}, how can I help?` : 'Hi, how can I help?',
      patron: (() => {
        const p = u?.patron_sugerencias_ia;
        if (!p?.weekday_label || !p?.sede_favorita_nombre) return null;
        const h = p.hora_tipica ? ` around ${p.hora_tipica}` : '';
        return `You often book on ${p.weekday_label}${h} at ${p.sede_favorita_nombre}. Want me to look for something similar this week?`;
      })(),
    },
    pt: {
      titulo: nombre ? `Olá ${nombre}, em que posso ajudar?` : 'Olá, em que posso ajudar?',
      patron: (() => {
        const p = u?.patron_sugerencias_ia;
        if (!p?.weekday_label || !p?.sede_favorita_nombre) return null;
        const h = p.hora_tipica ? ` às ${p.hora_tipica}` : '';
        return `Você costuma reservar nas ${p.weekday_label}${h} em ${p.sede_favorita_nombre}. Quer que eu busque algo parecido nesta semana?`;
      })(),
    },
  };
  const pack = lines[l] || lines.en;
  const extras = [pack.patron].filter(Boolean);
  const sedeHab = u?.sede_habitual?.sede_id;
  const sede_habitual_id =
    sedeHab != null && String(sedeHab).trim() !== '' && Number.isFinite(Number(sedeHab)) && Number(sedeHab) > 0
      ? Number(sedeHab)
      : null;
  const sede_habitual_nombre = u?.sede_habitual?.nombre ? String(u.sede_habitual.nombre).trim() : null;
  return {
    idioma: l,
    saludo_titulo: pack.titulo,
    saludo_lineas: extras,
    sede_habitual_id,
    sede_habitual_nombre,
    whatsapp_club: u?.escalada_whatsapp_default || null,
  };
}

function buildChatIaSystemPrompt(ctxForModel) {
  const uiLang = ctxForModel.idioma_ui || 'es';
  const payload = {
    idioma_ui: ctxForModel.idioma_ui,
    claude_language: ctxForModel.claude_language,
    fecha_referencia_art: ctxForModel.fecha_referencia,
    fecha_mañana_art: ctxForModel.fecha_mañana_art,
    sedes_hora_local: ctxForModel.sedes_hora_local,
    disponibilidad_sede_implicita: ctxForModel.disponibilidad_sede_implicita || {
      sede_id: null,
      sede_nombre: null,
      fuente: 'ninguna',
      ymd_hoy_local: null,
    },
    sedes_resumen: (ctxForModel.sedes || []).map((s) => ({
      id: s.id,
      nombre: s.nombre,
      ciudad: s.ciudad,
      pais: s.pais,
      timezone: s.timezone,
    })),
    usuario_logueado: ctxForModel.usuario_logueado,
    guia_app: ctxForModel.guia_app,
  };
  return `You are the Padbol Match assistant for padbol/padel bookings, tournaments and rankings.

LANGUAGE (critical):
- Always respond in the same language the user writes in (mirror their Spanish, English, or Portuguese, or whichever language they consistently use in this thread). Match their tone when reasonable.
- Do not choose the reply language from the device or browser. The code ${uiLang} in the Context JSON is only for structured hints (e.g. calendar labels), not for picking your answer language—follow the actual user messages.
- If the latest message is very short or ambiguous, use the same language as the clearest earlier user message in this chat.

STYLE:
- Maximum 3 short lines. No long paragraphs or bullet lists.
- Act without asking for confirmation when tools already returned data: state slots, names, dates and prices directly.
- Use tools for real data: never invent availability, rankings or tournaments.
- When you write in Spanish (es), avoid voseo: use "puedes", "quieres", "tienes", "haces", not "podés", "querés", "tenés", "hacés".

Out of scope: if the question is unrelated to padbol/padel bookings, tournaments or rankings on Padbol Match, reply with exactly one short sentence in the SAME language as the user's message, stating only that limitation.

Context JSON (use sedes_hora_local for "today" per club timezone; fecha_referencia_art and fecha_mañana_art are yyyy-LL-dd in America/Argentina/Buenos_Aires for "hoy" / "mañana"):
${JSON.stringify(payload)}

Tools: call consultar_disponibilidad with sede_id + fecha + optional duracion_minutos (default 90). Pass deporte ONLY when the user explicitly names a sport in their message (padbol, padel, tenis, pickleball, squash, futbol / football). Do NOT pass deporte for generic "today\'s slots" / "ver horarios hoy" / "horarios" requests with no sport—omit deporte so all courts are included.

Sede for availability (read disponibilidad_sede_implicita in Context JSON):
- If fuente is pagina_actual or habitual and sede_id is set: when the user asks for today\'s hours or generic availability without naming a club, use that sede_id with fecha = ymd_hoy_local from the same object (or matching sedes_hora_local). Do not ask which club first.
- If fuente is ninguna (sede_id null): do NOT call consultar_disponibilidad until the user names a city or club (or picks from sedes_resumen). Ask one short line which city/club they want—in Spanish use tú: "¿En qué ciudad o club quieres jugar?" (mirror EN/PT if the user writes in those languages).

Use buscar_sedes_por_deporte with deporte and optional ciudad/pais when they ask which clubs offer a sport. Use listar_sedes to resolve sede_id from a name or match sedes_resumen. Use listar_torneos / consultar_ranking as needed.

Availability (critical):
- When the user asks for free slots, horarios, turnos or disponibilidad, you MUST call consultar_disponibilidad (after listar_sedes or buscar_sedes_por_deporte if needed) and answer ONLY with the tool result—except when disponibilidad_sede_implicita.fuente is ninguna and they have not specified a club yet: then ask which city/club first (no tool). Include deporte in the tool call only if the user clearly names a sport (e.g. "quiero jugar fútbol", "hay pádel"); if they only ask for today\'s times or generic availability, omit deporte. For "mañana"/"tomorrow" pass that word as fecha or use fecha_mañana_art from the Context JSON. List several concrete start times (hora_inicio) from the slots array in plain language within the 3-line limit (you may group as a short comma list).
- Never invent times. If slots is empty, say there are no openings that day for that duration and suggest another date or duration—do not send the user to WhatsApp.
- Never output <<<WHATSAPP>>> for availability, booking help, or missing data. WhatsApp is ONLY when the user clearly asks to message or call the club by phone/WhatsApp.

Booking: when the user chooses a slot, end with exactly one line:
<<<RESERVA:sede_id=NUMBER|fecha=YYYY-MM-DD|hora=HH:MM>>>
or without hora:
<<<RESERVA:sede_id=NUMBER|fecha=YYYY-MM-DD>>>
If sede_id or time is uncertain, omit that line.

WhatsApp: do NOT output <<<WHATSAPP>>> unless the user clearly asks to contact the club by WhatsApp/phone.`;
}

function stripChatIaReserveMarker(rawText) {
  const text = String(rawText || '').trim();
  const re =
    /<<<RESERVA:sede_id=(\d+)(?:\|fecha=([0-9]{4}-[0-9]{2}-[0-9]{2}))?(?:\|hora=([0-9]{2}:[0-9]{2}))?>>>/i;
  const m = text.match(re);
  if (!m) return { text, reserve: null };
  const sedeId = parseInt(m[1], 10);
  const fecha = m[2] ? String(m[2]).trim() : '';
  const hora = m[3] ? String(m[3]).trim() : '';
  const stripped = text.replace(re, '').trim();
  let href = `/reservar?sedeId=${sedeId}`;
  if (fecha) href += `&fecha=${encodeURIComponent(fecha)}`;
  if (hora) href += `&hora=${encodeURIComponent(hora)}`;
  return {
    text: stripped,
    reserve: Number.isFinite(sedeId) && sedeId > 0 ? { sede_id: sedeId, href, fecha: fecha || null, hora: hora || null } : null,
  };
}

app.get('/api/chat-ia/bootstrap', async (req, res) => {
  try {
    const user = await authUserFromBearer(req);
    const locale = normalizeChatIaLocale(req.query?.locale);
    const ctx = await buildChatIAContextPayload(supabase, user, locale);
    res.json(buildChatIaBootstrapPayload(ctx));
  } catch (err) {
    console.error('❌ GET /api/chat-ia/bootstrap:', err?.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/chat-ia', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'Chat IA no configurado en el servidor.' });
    }
    const user = await authUserFromBearer(req);
    const b = req.body || {};
    const mensaje = String(b.mensaje || '').trim();
    const historialRaw = Array.isArray(b.historial) ? b.historial : [];
    const clientCal = String(b.client_calendario_art || '').trim().slice(0, 10);
    if (clientCal && /^\d{4}-\d{2}-\d{2}$/.test(clientCal)) {
      console.error('[chat-ia] POST client_calendario_art (referencia navegador ART)', clientCal);
    }
    if (!mensaje) return res.status(400).json({ error: 'mensaje requerido' });

    const historial = historialRaw
      .filter(
        (x) =>
          x &&
          typeof x === 'object' &&
          (x.role === 'user' || x.role === 'assistant') &&
          String(x.content || '').trim()
      )
      .map((x) => ({ role: x.role, content: String(x.content).trim() }))
      .slice(-20);

    const priorUser = historial.filter((h) => h.role === 'user').length;
    if (priorUser >= CHAT_IA_MAX_USER_MSG) {
      const localeEarly = chatIaInferWritingLocaleFromConversation(mensaje, historial);
      const ctxEarly = await buildChatIAContextPayload(supabase, user, localeEarly);
      const rid = chatIaSedeIdDesdeHistorialReserva(historial);
      let sede_contexto = null;
      if (rid != null) {
        const nombre = chatIaSedeNombreDesdeCtx(ctxEarly, rid) || `Sede ${rid}`;
        sede_contexto = { id: rid, nombre };
      } else {
        const h = ctxEarly?.usuario_logueado?.sede_habitual;
        if (h?.sede_id != null && Number.isFinite(Number(h.sede_id)) && Number(h.sede_id) > 0) {
          const sid = Number(h.sede_id);
          const nombre = String(h.nombre || '').trim() || chatIaSedeNombreDesdeCtx(ctxEarly, sid) || `Sede ${sid}`;
          sede_contexto = { id: sid, nombre };
        }
      }
      return res.status(400).json({
        error: 'Llegaste al límite de esta sesión.',
        limit_reached: true,
        sede_contexto,
      });
    }

    const key = chatIaRateKey(req, user);
    if (!chatIaConsumeRateSlot(key)) {
      return res.status(429).json({ error: 'Demasiadas consultas. Intenta de nuevo en una hora.' });
    }

    const locale = chatIaInferWritingLocaleFromConversation(mensaje, historial);
    const ctxBase = await buildChatIAContextPayload(supabase, user, locale);
    console.error(
      '[chat-ia] POST inicio',
      JSON.stringify({
        usuario: user?.id || 'anon',
        historial_turnos: historial.length,
        mensaje_preview: mensaje.slice(0, 140),
        locale,
        fecha_referencia_art: ctxBase.fecha_referencia,
        fecha_mañana_art: ctxBase.fecha_mañana_art,
      }),
    );
    const clientSedeRaw = b.client_pagina_sede_id ?? b.pagina_sede_id;
    const disponibilidadSedeImplicita = chatIaResolveDisponibilidadSedeImplicita(ctxBase, clientSedeRaw);
    const ctxForModel = { ...ctxBase, disponibilidad_sede_implicita: disponibilidadSedeImplicita };
    delete ctxForModel._sedes_rows_chat_ia;

    const genericHoyChip = chatIaShouldOmitDeporteDisponibilidadParaUltimoUsuario(mensaje);
    if (genericHoyChip) {
      if (disponibilidadSedeImplicita.sede_id != null) {
        const sid = Number(disponibilidadSedeImplicita.sede_id);
        const fechaRaw = disponibilidadSedeImplicita.ymd_hoy_local || ctxBase.fecha_referencia;
        const fecha = String(fechaRaw || '').trim().slice(0, 10);
        if (Number.isFinite(sid) && sid > 0 && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
          try {
            const sedeFull = await chatIaFetchSedeFullForTool(supabase, sid);
            if (sedeFull) {
              const { slots, error } = await computeChatIaSlotsReales(supabase, sedeFull, fecha, 90, null);
              if (!error) {
                const sedeNombre =
                  String(sedeFull.nombre || disponibilidadSedeImplicita.sede_nombre || '').trim() || `Sede ${sid}`;
                const respuesta = chatIaFormatHorariosHoyRespuestaLineas(locale, sedeNombre, slots);
                const disponibilidad = {
                  sede_id: sid,
                  sede_nombre: sedeNombre,
                  fecha,
                  duracion_minutos: 90,
                  deporte_filtro: null,
                  slots: (slots || []).slice(0, 24).map((s) => ({
                    hora_inicio: s.hora_inicio,
                    hora_fin: s.hora_fin,
                    canchas_libres: s.canchas_libres,
                    canchas_nombres: s.canchas_nombres || null,
                    canchas_detalle: Array.isArray(s.canchas_detalle) ? s.canchas_detalle.slice(0, 8) : [],
                  })),
                };
                const sede_contexto = { id: sid, nombre: sedeNombre };
                console.error(
                  '[chat-ia] POST ver_horarios_hoy fast_path',
                  JSON.stringify({
                    sid,
                    fecha,
                    fuente: disponibilidadSedeImplicita.fuente,
                    nslots: slots?.length ?? 0,
                  }),
                );
                return res.json({
                  respuesta,
                  reserve: null,
                  whatsapp_escalada: null,
                  user_messages_used: priorUser + 1,
                  user_messages_max: CHAT_IA_MAX_USER_MSG,
                  sede_contexto,
                  disponibilidad: disponibilidad.slots.length ? disponibilidad : null,
                });
              }
            }
          } catch (e) {
            console.error('[chat-ia] fast_path ver_horarios_hoy', e?.message || e);
          }
        }
      } else {
        const q = chatIaPreguntaLugarSinSedeResuelta(locale);
        console.error('[chat-ia] POST ver_horarios_hoy sin_sede', JSON.stringify({ locale }));
        return res.json({
          respuesta: q,
          reserve: null,
          whatsapp_escalada: null,
          user_messages_used: priorUser + 1,
          user_messages_max: CHAT_IA_MAX_USER_MSG,
          sede_contexto: null,
          disponibilidad: null,
        });
      }
    }

    const systemText = buildChatIaSystemPrompt(ctxForModel);

    const msgs = [...historial.map((h) => ({ role: h.role, content: h.content })), { role: 'user', content: mensaje }];

    const run = await chatIaRunClaudeWithTools({
      apiKey: ANTHROPIC_API_KEY,
      model: CHAT_IA_MODEL,
      system: systemText,
      messages: msgs,
      tools: chatIaAnthropicToolsDefinition(),
      supabaseClient: supabase,
      ctx: ctxForModel,
      ultimoMensajeUsuario: mensaje,
    });
    if (!run.ok) {
      console.error('❌ Anthropic chat-ia:', run.status || '', run.error || run.raw);
      return res.status(502).json({
        error: run.error || 'No se pudo obtener respuesta del asistente.',
      });
    }
    console.error(
      '[chat-ia] POST respuesta modelo',
      JSON.stringify({
        stop_reason: run.stop_reason,
        disponibilidad_slots: run.disponibilidad?.slots?.length ?? 0,
        disponibilidad_sede_id: run.disponibilidad?.sede_id ?? null,
        disponibilidad_fecha: run.disponibilidad?.fecha ?? null,
      }),
    );
    const txt = String(run.text || '');
    let { text: respuesta, reserve } = stripChatIaReserveMarker(txt);
    const waSt = stripChatIaWhatsAppMarkers(respuesta);
    respuesta = waSt.text;
    let whatsapp_escalada = null;
    if (chatIaUserAllowsWhatsappEscalada(mensaje)) {
      whatsapp_escalada = await chatIaResolveWhatsappEscalation(supabase, waSt.whatsapp_sede_id, ctxBase);
    }

    let sede_contexto = run.sede_contexto || null;
    if (reserve?.sede_id) {
      const rid = parseInt(String(reserve.sede_id), 10);
      if (Number.isFinite(rid) && rid > 0) {
        const nombre =
          chatIaSedeNombreDesdeCtx(ctxBase, rid) ||
          (sede_contexto && Number(sede_contexto.id) === rid ? String(sede_contexto.nombre || '').trim() : '') ||
          `Sede ${rid}`;
        sede_contexto = { id: rid, nombre: nombre || `Sede ${rid}` };
      }
    }

    return res.json({
      respuesta,
      reserve: reserve && reserve.sede_id ? reserve : null,
      whatsapp_escalada: whatsapp_escalada && whatsapp_escalada.href ? whatsapp_escalada : null,
      user_messages_used: priorUser + 1,
      user_messages_max: CHAT_IA_MAX_USER_MSG,
      sede_contexto,
      disponibilidad: run.disponibilidad || null,
    });
  } catch (err) {
    console.error('❌ POST /api/chat-ia:', err?.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

cron.schedule('*/10 * * * *', async () => {
  try {
    await aplicarFechaAperturaInscripcionTorneos();
  } catch (err) {
    console.error('❌ Cron fecha apertura inscripción torneos:', err.message);
  }
}, { timezone: 'America/Argentina/Buenos_Aires' });

cron.schedule(
  '0 * * * *',
  async () => {
    try {
      await marcarTorneosFinalizadosPorFechaInicioPasada();
    } catch (err) {
      console.error('❌ Cron marcar torneos finalizados por fecha_inicio:', err.message);
    }
    try {
      await cierreInscripcionTorneos24hAntesInicio();
    } catch (err) {
      console.error('❌ Cron cierre inscripción torneos (24h antes):', err.message);
    }
  },
  { timezone: TZ_TORNEO_CALENDARIO },
);

/** 09:00 ART: mora de suscripción (sedes con proximo_cobro vencido, excl. pago manual). */
cron.schedule(
  '0 9 * * *',
  async () => {
    try {
      await checkMorasSedes({
        supabase,
        sendWhatsApp: (to, body) => sendTwilioWhatsAppBodyToRaw(to, body),
      });
    } catch (err) {
      console.error('❌ Cron checkMorasSedes:', err.message);
    }
  },
  { timezone: 'America/Argentina/Buenos_Aires' },
);

(async () => {
  try {
    await ensureStripeSubscriptionPriceId();
  } catch (e) {
    console.error('❌ Inicialización precio suscripción Stripe:', e?.message || e);
  }
  app.listen(PORT, () => {
    console.log(`🚀 Padbol Match API running on port ${PORT}`);
    console.log(`📊 Supabase: ${SUPABASE_URL}`);
    console.log(`💬 Twilio WhatsApp: whatsapp:+14155238886`);
    const subPrice = String(process.env.STRIPE_SUBSCRIPTION_PRICE_ID || '').trim();
    if (subPrice.startsWith('price_')) {
      console.log(`💳 Stripe Billing: STRIPE_SUBSCRIPTION_PRICE_ID=${subPrice}`);
    }
  });
})();