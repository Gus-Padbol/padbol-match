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

function ymdTodayInTorneoTz() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_TORNEO_CALENDARIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const mo = parts.find((p) => p.type === 'month')?.value;
  const da = parts.find((p) => p.type === 'day')?.value;
  if (!y || !mo || !da) return null;
  return `${y}-${mo}-${da}`;
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
  const q1 = await supabase.from('jugadores_perfil').select('nombre, apellido, alias').eq('user_id', uid).maybeSingle();
  if (!q1.error) perfil = q1.data;
  if (!perfil?.nombre && email) {
    const q2 = await supabase.from('jugadores_perfil').select('nombre, apellido, alias').eq('email', email).maybeSingle();
    if (!q2.error) perfil = q2.data;
  }
  const n = nombreAutorResenaDesdePerfil(perfil);
  return n && String(n).trim() ? String(n).trim() : 'Jugador';
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

/** Alineado con el front (user_role_data): quita bandera emoji al comparar país. */
function normalizeAdminPaisLabel(raw) {
  if (raw == null || raw === '') return '';
  return String(raw).replace(/^[\p{Emoji_Presentation}\s]*/u, '').trim();
}

function normalizeMetodoPago(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'stripe') return 'stripe';
  if (v === 'manual') return 'manual';
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
    const e = new Error('No tenés permiso para esta sede');
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
    .select('id, sede_id, nombre, estado, descripcion, orden')
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

// Mercado Pago
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn('⚠️  MP_ACCESS_TOKEN no está configurado — los pagos fallarán en producción');
}
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || '',
});

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
      console.log(`✓ Creado ${stub} — copiá STRIPE_SUBSCRIPTION_PRICE_ID al entorno de producción`);
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
      'Precio de suscripción no disponible. Configurá STRIPE_SUBSCRIPTION_PRICE_ID o reiniciá el servidor tras crear el Product/Price.'
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
    `Revisá Stripe y el panel de sedes.`;
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
  return `Hola ${nombre}, te invito a jugar el torneo "${torneoNombre}". Confirmá tu lugar en el equipo: ${link}`;
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
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('⚠️ Confirmación reserva: Twilio no configurado — no se envía WhatsApp');
    return;
  }
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

  const rawWa = perfil?.whatsapp;
  if (!rawWa || !String(rawWa).trim()) {
    console.warn(
      `⚠️ Confirmación reserva: sin WhatsApp en jugadores_perfil para el email ${emailNorm} — no se envía mensaje`,
    );
    return;
  }

  const nombre = nombreWhatsappJugadorDesdePerfil(perfil, nombreFallback);
  const { horaInicio, horaFin } = horaInicioYFinParaMensaje(hora, duracionMinutos);
  const fechaTxt = formatFechaReservaConfirmacion(fecha);
  const sedeTxt = String(nombreSede || '').trim() || 'la sede';
  const body = `¡Hola ${nombre}! ✅ Tu reserva está confirmada. Te esperamos el ${fechaTxt} en horario ${horaInicio} - ${horaFin} en ${sedeTxt}. ⚽ ¡Nos vemos en la cancha!`;

  const to = normalizePhoneToE164ForTwilioWhatsApp(rawWa);
  if (!to) {
    console.warn('⚠️ Confirmación reserva: WhatsApp en perfil no normalizable a E.164:', rawWa);
    return;
  }

  await twilioClient.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body });
  console.log(`✓ WhatsApp confirmación de reserva enviado a ${to}`);
}

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
    const payload = {
      nombre,
      pais,
      provincia: String(b.provincia || b.estado || '').trim() || null,
      ciudad,
      direccion: String(b.direccion || '').trim() || null,
      email_contacto: String(b.email_contacto || '').trim() || null,
      telefono: String(b.telefono || b.whatsapp || '').trim() || null,
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

    const { data: created, error } = await supabase.from('sedes').insert(payload).select('*').single();
    if (error) throw error;

    if (Number.isFinite(canchasActivas) && canchasActivas > 0) {
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

    res.status(201).json(created);
  } catch (err) {
    console.error('❌ POST /api/sedes:', err.message);
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
    res.json(out);
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
    await assertUsuarioPuedeAdministrarSede(req, id);

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
      .select('user_id, foto_url, nombre, apellido, alias')
      .in('user_id', uids);
    if (error) console.warn('enrichSedeResenasConPerfil jugadores_perfil:', error.message);
    (perfiles || []).forEach((p) => {
      if (p?.user_id) map[p.user_id] = p;
    });
  }
  return rows.map((r) => {
    const p = map[r.user_id];
    const nombreGuardado = String(r.nombre ?? '').trim();
    return {
      id: r.id,
      estrellas: r.estrellas,
      comentario: r.comentario,
      created_at: r.created_at,
      autor: {
        nombre: nombreGuardado || nombreAutorResenaDesdePerfil(p),
        foto_url: p?.foto_url ? String(p.foto_url).trim() || null : null,
      },
    };
  });
}

/**
 * GET reseñas de una sede: promedio, total, página (orden por más recientes).
 * Query: limit (default 5, max 100), offset (default 0).
 * Con Bearer: incluye `ya_reseño` si el usuario ya publicó en esta sede.
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
    const user = await authUserFromBearer(req);
    if (user?.id) {
      const { data: mine } = await supabase
        .from(PUBLIC_RESENAS_TABLE)
        .select('id')
        .eq('sede_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      ya_reseño = Boolean(mine);
    }

    res.json({ promedio, total, resenas, ya_reseño });
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
      return res.status(401).json({ error: 'Iniciá sesión para dejar una reseña' });
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

// POST reserva
app.post('/api/reservas', async (req, res) => {
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

    // Verificar double-booking
    const { data: existentes, error: errCheck } = await supabase
      .from('reservas')
      .select('*')
      .eq('sede', sede)
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancha', cancha);

    if (errCheck) throw errCheck;

    if (existentes && existentes.length > 0) {
      return res.status(409).json({ error: 'Este horario ya está reservado' });
    }

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
      } else if (scope.rol === 'admin_club' || scope.rol === 'admin_nacional') {
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
    res.json(data || []);
  } catch (err) {
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
    if (duracion !== undefined) updates.duracion = duracion !== null ? parseInt(duracion) : null;
    if (estado   !== undefined) updates.estado   = estado;

    const { data, error } = await supabase
      .from('reservas')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
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

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE reserva
app.delete('/api/reservas/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('reservas')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ mensaje: 'Reserva eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// ===== TORNEOS =====
app.post('/api/torneos', async (req, res) => {
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
      cupos_maximos,
      horas_revelar_equipos,
      es_multisede,
      created_by,
      equipos_por_grupo,
      clasificados_por_grupo,
      mejores_terceros_clasificados,
      estado: estadoBody,
      fecha_apertura_inscripcion: fechaAperturaBody,
    } = req.body;

    const estadoNorm = normalizeTorneoEstadoForDb(estadoBody);

    const row = {
      nombre,
      sede_id: sede_id || null,
      nivel_torneo,
      tipo_torneo,
      categoria: categoria != null && String(categoria).trim() ? String(categoria).trim() : 'Libre',
      estado: estadoNorm || 'planificacion',
      fecha_inicio,
      fecha_fin,
      cantidad_equipos,
      es_multisede,
      created_by,
    };
    if (costo_inscripcion !== undefined && costo_inscripcion !== null && costo_inscripcion !== '') {
      const c = Number(String(costo_inscripcion).replace(',', '.'));
      row.costo_inscripcion = Number.isFinite(c) && c >= 0 ? c : 0;
    } else {
      row.costo_inscripcion = 0;
    }
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
      } else if (scope.rol === 'admin_club' || scope.rol === 'admin_nacional') {
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
      .select('id, torneo_id, inscripcion_estado')
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
      .select('fecha_inicio')
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
    const body = `🏆 Tu equipo ${nombreEquipo} está completo. Confirmá el cupo pagando la inscripción en padbolmatch.com`;

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
      'No hay partidos generados. Realizá el sorteo de grupos o generá el fixture antes de iniciar el torneo.',
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
      'Entrá a padbolmatch.com para inscribirte con tu compañero. Cupos limitados.';

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
      fecha_apertura_inscripcion: fechaAperturaPatch,
    } = req.body;

    const { data: prevRow, error: prevErr } = await supabase
      .from('torneos')
      .select('estado, nombre')
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
    if (costo_inscripcion !== undefined && costo_inscripcion !== null && costo_inscripcion !== '') {
      const c = Number(String(costo_inscripcion).replace(',', '.'));
      if (Number.isFinite(c) && c >= 0) patch.costo_inscripcion = c;
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
// GET /api/rankings?scope=local|nacional|internacional&sede_id=X&categoria=Y&pais=&provincia=&ciudad=
app.get('/api/rankings', async (req, res) => {
  const {
    scope = 'internacional',
    sede_id,
    categoria,
    pais,
    provincia,
    ciudad,
  } = req.query;

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
      .select('id, sede_id, nivel_torneo, nombre')
      .eq('estado', 'finalizado')
      .in('nivel_torneo', nivelesPermitidos);

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

    const { data: torneos, error: errT } = await torneosQuery;
    if (errT) throw errT;
    if (!torneos?.length) return res.json([]);

    const torneoIds = torneos.map(t => t.id);

    // 2. Load tabla_puntos for those torneos
    const { data: puntos, error: errP } = await supabase
      .from('tabla_puntos')
      .select('torneo_id, equipo_id, posicion, puntos')
      .in('torneo_id', torneoIds);
    if (errP) throw errP;
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

    // Check if reservation is more than 24h away (Argentina UTC-3)
    const reservaDt = new Date(`${reserva.fecha}T${reserva.hora}:00-03:00`);
    const nowAR     = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const horasHasta = (reservaDt - nowAR) / (1000 * 60 * 60);
    const eligibleForCredit = horasHasta > 24;

    // Mark as cancelled
    const { error: updateErr } = await supabase
      .from('reservas')
      .update({ estado: 'cancelada' })
      .eq('id', reservaId);
    if (updateErr) throw updateErr;

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

    console.log(`✓ Reserva ${reservaId} cancelada — crédito: ${credito ? credito.id : 'no'}`);;
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

async function fetchJugadoresPerfilByAliasSlug(aliasDecoded) {
  const a = String(aliasDecoded || '').trim();
  if (!a) return null;
  const { data: rows, error } = await supabase.from('jugadores_perfil').select('*').ilike('alias', a).limit(8);
  if (error) throw error;
  const list = Array.isArray(rows) ? rows : [];
  const aLower = a.toLowerCase();
  return (
    list.find((r) => String(r.alias || '').trim().toLowerCase() === aLower) || (list.length === 1 ? list[0] : null)
  );
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

async function computeEstadisticasJugadorPublico(perfil) {
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
      sede_habitual: null,
    };
  }

  const { data: torneosRows, error: tErr } = await supabase
    .from('torneos')
    .select('id, estado, sede_id')
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
  if (fArr.length && misEquipoIdsFinal.length) {
    const { data: tpRows, error: tpErr } = await supabase
      .from('tabla_puntos')
      .select('torneo_id, equipo_id, posicion, puntos')
      .in('torneo_id', fArr)
      .in('equipo_id', misEquipoIdsFinal);
    if (tpErr) throw tpErr;
    const ganadosSet = new Set();
    for (const row of tpRows || []) {
      const tid = row.torneo_id;
      const eid = row.equipo_id;
      if (equipoIdPorTorneo.get(Number(tid)) !== eid) continue;
      const pts = Number(row.puntos) || 0;
      puntos_ranking_total += pts;
      if (Number(row.posicion) === 1) ganadosSet.add(tid);
    }
    torneos_ganados = ganadosSet.size;
  }

  let partidos_jugados = 0;
  let partidos_ganados = 0;
  if (fArr.length) {
    const { data: partidosRows, error: pErr } = await supabase
      .from('partidos')
      .select('id, torneo_id, estado, resultado, equipo_a_id, equipo_b_id')
      .in('torneo_id', fArr)
      .eq('estado', 'finalizado');
    if (pErr) throw pErr;
    for (const p of partidosRows || []) {
      const myEq = equipoIdPorTorneo.get(Number(p.torneo_id));
      if (!myEq) continue;
      if (p.equipo_a_id !== myEq && p.equipo_b_id !== myEq) continue;
      partidos_jugados++;
      const winId = partidoEquipoGanadorId(p);
      if (winId != null && winId === myEq) partidos_ganados++;
    }
  }

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
    sede_habitual,
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
    'Los datos de la operación superan el límite permitido. Acortá nombre u otros textos e intentá de nuevo.'
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
      } catch (e) {
        const st = e.status || 400;
        return res.status(st).json({ error: e.message || String(e) });
      }

      const { data: existentes, error: errCheck } = await supabase
        .from('reservas')
        .select('id')
        .eq('sede', sede)
        .eq('fecha', fecha)
        .eq('hora', hora)
        .eq('cancha', cancha);
      if (errCheck) throw errCheck;
      if ((existentes || []).length > 0) {
        return res.status(409).json({ error: 'Este horario ya está reservado' });
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
        ...(authUser.id ? { user_id: authUser.id } : {}),
      };

      const { data, error } = await supabase.from('reservas').insert([ins]).select();
      if (error) throw error;
      sendReservaConfirmadaWhatsAppTwilio({
        email: ins.email,
        nombreFallback: ins.nombre,
        fecha,
        hora,
        duracionMinutos: duracionMin,
        nombreSede: sede,
      }).catch((errW) => console.warn('⚠️ WhatsApp confirmación reserva:', errW.message));
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
        .select('id, torneo_id, inscripcion_estado')
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
        .select('fecha_inicio')
        .eq('id', tid)
        .maybeSingle();
      if (errTorneo) throw errTorneo;
      if (!torneoRow) return res.status(404).json({ error: 'Torneo no encontrado' });
      if (torneoFechaInicioEsAnteriorAHoyArt(torneoRow.fecha_inicio)) {
        return res.status(400).json({ error: MSG_TORNEO_INSCRIPCION_FECHA_PASADA });
      }

      const { error: errUp } = await supabase.from('equipos').update({ inscripcion_estado: 'confirmado' }).eq('id', eid);
      if (errUp) throw errUp;
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
          'No hay email de admin_club ni email_contacto válido. Asigná un admin al club o completá el contacto de la sede.',
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
  const { sede, fecha, hora, cancha, nombre, email, whatsapp, nivel, precio, duracion } = payload;
  if (!sede || !fecha || !hora || cancha == null || !nombre || !email || !whatsapp) {
    throw new Error('Payload de reserva incompleto');
  }
  await assertCanchaPermitidaParaReservaPorNombreSede(sede, cancha);
  const { data: existentes, error: errCheck } = await supabase
    .from('reservas')
    .select('id')
    .eq('sede', sede)
    .eq('fecha', fecha)
    .eq('hora', hora)
    .eq('cancha', parseInt(String(cancha), 10));
  if (errCheck) throw errCheck;
  if (existentes && existentes.length > 0) {
    return { ok: true, duplicate: true };
  }
  let duracionMin = duracion != null && duracion !== '' ? parseInt(duracion, 10) : null;
  if (!Number.isFinite(duracionMin) || duracionMin <= 0) {
    const { data: sedeDur } = await supabase
      .from('sedes')
      .select('duracion_reserva_minutos')
      .eq('nombre', sede)
      .maybeSingle();
    duracionMin = parseInt(sedeDur?.duracion_reserva_minutos, 10) || 90;
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
      },
    ])
    .select();
  if (error) throw error;
  sendReservaConfirmadaWhatsAppTwilio({
    email: String(email).trim().toLowerCase(),
    nombreFallback: nombre,
    fecha,
    hora,
    duracionMinutos: duracionMin,
    nombreSede: sede,
  }).catch((err) => console.warn('⚠️ WhatsApp confirmación reserva (webhook MP):', err.message));
  return { ok: true, data };
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
    if (tipoEff === 'torneo_inscripcion') {
      const eid = parseInt(String(equipo_id ?? reservaDataIn?.equipo_id), 10);
      const tid = parseInt(String(torneo_id ?? reservaDataIn?.torneo_id), 10);
      if (!eid || !tid) {
        return res.status(400).json({ error: 'torneo_inscripcion requiere equipo_id y torneo_id' });
      }
      const { data: torneoRow, error: tErr } = await supabase
        .from('torneos')
        .select('fecha_inicio')
        .eq('id', tid)
        .maybeSingle();
      if (tErr) throw tErr;
      if (!torneoRow) return res.status(400).json({ error: 'Torneo no encontrado' });
      if (torneoFechaInicioEsAnteriorAHoyArt(torneoRow.fecha_inicio)) {
        return res.status(400).json({ error: MSG_TORNEO_INSCRIPCION_FECHA_PASADA });
      }
      const em = String(email || reservaDataIn?.email || '').trim().toLowerCase();
      reservaData = {
        tipo: 'torneo_inscripcion',
        equipo_id: eid,
        torneo_id: tid,
        email: em,
      };
    }

    const sedeCfg = sedeId ? await sedePaymentConfigBySedeId(sedeId) : null;
    const metodoPago = normalizeMetodoPago(sedeCfg?.metodo_pago || 'mercadopago');
    const instruccionesManual = String(sedeCfg?.pago_manual_instrucciones || '').trim();

    if (metodoPago === 'manual') {
      if (tipoEff === 'torneo_inscripcion') {
        return res.json({
          manual_payment: true,
          instructions: instruccionesManual || 'Coordiná el pago manual con la sede para confirmar la inscripción.',
          status: 'pendiente_pago_manual',
          tipo: 'torneo_inscripcion',
        });
      }
      const r = reservaData && typeof reservaData === 'object' ? reservaData : null;
      if (!r) {
        return res.status(400).json({ error: 'Para pago manual se requiere reservaData' });
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
        estado: 'pendiente_pago_manual',
        duracion: r.duracion,
      };
      const { data: taken, error: chkErr } = await supabase
        .from('reservas')
        .select('id')
        .eq('sede', payloadReserva.sede)
        .eq('fecha', payloadReserva.fecha)
        .eq('hora', payloadReserva.hora)
        .eq('cancha', parseInt(String(payloadReserva.cancha), 10));
      if (chkErr) throw chkErr;
      if ((taken || []).length > 0) {
        return res.status(409).json({ error: 'Este horario ya está reservado' });
      }
      try {
        await assertCanchaPermitidaParaReservaPorNombreSede(
          String(payloadReserva.sede || '').trim(),
          payloadReserva.cancha
        );
      } catch (e) {
        const st = e.status || 400;
        return res.status(st).json({ error: e.message || String(e) });
      }
      const { data: reservaCreada, error: resErr } = await supabase.from('reservas').insert([payloadReserva]).select().single();
      if (resErr) throw resErr;
      return res.json({
        manual_payment: true,
        instructions: instruccionesManual || 'Transferí/aboná en sede y compartí comprobante por WhatsApp.',
        reservation: reservaCreada,
      });
    }

    if (metodoPago === 'stripe') {
      const stripeAccountId =
        String(sedeCfg?.stripe_account_id || '').trim() ||
        String(process.env.STRIPE_ACCOUNT_ID || '').trim() ||
        null;
      return res.json({
        stripe_checkout_pending: true,
        provider: 'stripe',
        stripe_account_id: stripeAccountId,
        message:
          'Stripe Connect está en implementación. Mientras tanto usá Mercado Pago o pago manual en esta sede.',
      });
    }

    // Use sede-specific MP token if configured, otherwise fall back to env var
    let client = mpClient;
    if (sedeCfg?.mp_access_token) {
      client = new MercadoPagoConfig({ accessToken: sedeCfg.mp_access_token });
    }

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

async function ensureLicenciatarioAuthUserAndWelcomeEmail(email) {
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
      .in('role', ['admin_club', 'admin_nacional', 'super_admin'])
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
    if (!['admin_club', 'admin_nacional'].includes(role)) return res.status(400).json({ error: 'Rol inválido' });
    if (!['sede', 'ciudad', 'provincia', 'pais'].includes(alcance)) {
      return res.status(400).json({ error: 'Alcance inválido' });
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

function mapPendingRowToSedeInsert(row) {
  return {
    nombre: String(row.nombre || '').trim(),
    direccion: row.direccion || null,
    ciudad: row.ciudad || null,
    provincia: row.provincia || null,
    pais: row.pais || null,
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
      return res.status(403).json({ error: 'Usá “Crear sede” desde el formulario de super admin' });
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

    const authProvision = await ensureLicenciatarioAuthUserAndWelcomeEmail(licEmail);

    const waLic = b.licenciatario_telefono || b.whatsapp;
    if (waLic) {
      const msg =
        `🎉 Bienvenido a PADBOL Match. Tu sede "${nombre}" está activa.\n` +
        `Ingresá al panel: padbolmatch.com/admin\n` +
        `${authProvision?.created ? 'Revisá tu email para configurar acceso y cambiar la contraseña temporal.' : 'Si ya tenías cuenta, revisá tu email para restablecer contraseña.'}`;
      await sendTwilioWhatsAppBodyToRaw(waLic, msg);
    }

    res.json({ ok: true, sede_id: sedeId, auth_user_created: Boolean(authProvision?.created) });
  } catch (err) {
    console.error('❌ POST /api/admin/sedes-directa:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/solicitudes-licencia — público: registro de interés para sumar club. */
app.post('/api/solicitudes-licencia', async (req, res) => {
  try {
    const b = req.body || {};
    const club_nombre = String(b.club_nombre || '').trim();
    const pais = String(b.pais || '').trim();
    const ciudad = String(b.ciudad || '').trim();
    const responsable_nombre = String(b.responsable_nombre || '').trim();
    const email = String(b.email || '').trim().toLowerCase();
    const whatsapp = String(b.whatsapp || '').trim();
    if (!club_nombre || !pais || !ciudad || !responsable_nombre || !email || !whatsapp) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const payload = {
      club_nombre,
      pais,
      ciudad,
      responsable_nombre,
      email,
      whatsapp,
      cantidad_canchas: b.cantidad_canchas != null && b.cantidad_canchas !== '' ? parseInt(String(b.cantidad_canchas), 10) : null,
      tipo_interes: String(b.tipo_interes || '').trim() || null,
      mensaje: String(b.mensaje || '').trim() || null,
      estado: 'pendiente',
    };
    const { data, error } = await supabase.from('solicitudes_licencia').insert(payload).select('*').single();
    if (error) throw error;

    const toSuper = resolveSuperAdminNotifyWhatsAppTo();
    if (toSuper) {
      const msg =
        `🏟️ Nueva solicitud de licencia\n` +
        `Club: ${club_nombre}\n` +
        `País/Ciudad: ${pais} · ${ciudad}\n` +
        `Responsable: ${responsable_nombre}\n` +
        `Email: ${email}\n` +
        `WhatsApp: ${whatsapp}\n` +
        `Interés: ${payload.tipo_interes || '—'}\n` +
        `Canchas: ${payload.cantidad_canchas ?? '—'}`;
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
    const estado = String(req.query.estado || 'pendiente').trim() || 'pendiente';
    const { data, error } = await supabase
      .from('sedes_pendientes')
      .select('*')
      .eq('estado', estado)
      .order('created_at', { ascending: false });
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

    await ensureLicenciatarioAuthUserAndWelcomeEmail(licEmail);

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
        `🎉 Bienvenido a PADBOL Match. Tu sede "${nombre}" está activa.\nIngresá al panel: padbolmatch.com/admin`
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

// ─── Cron: WhatsApp reminder 1 hour before reservation ──────────────────────
cron.schedule('*/5 * * * *', async () => {
  try {
    // Current time in Argentina (UTC-3)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));

    // Target: exactly 1 hour from now
    const target = new Date(now.getTime() + 60 * 60 * 1000);
    const targetFecha = target.toISOString().slice(0, 10); // YYYY-MM-DD
    const targetHora  = target.toTimeString().slice(0, 5);  // HH:MM

    const { data: reservas, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('fecha', targetFecha)
      .eq('hora', targetHora)
      .eq('estado', 'confirmada')
      .eq('recordatorio_enviado', false);

    if (error) {
      console.error('❌ Cron recordatorio - error Supabase:', error.message);
      return;
    }

    if (!reservas || reservas.length === 0) return;

    console.log(`⏰ Cron: ${reservas.length} recordatorio(s) para ${targetFecha} ${targetHora}`);

    for (const r of reservas) {
      try {
        // Fetch sede address
        const { data: sedeRow } = await supabase
          .from('sedes')
          .select('direccion')
          .eq('nombre', r.sede)
          .maybeSingle();

        const body =
`🎾 *¡Te esperamos en ${r.sede}!*

Tu reserva es en 1 hora:
⏰ ${r.hora}hs${sedeRow?.direccion ? `\n📍 ${sedeRow.direccion}` : ''}

Recordá llegar 10 minutos antes.
💬 Ante cualquier consulta escribinos por WhatsApp.

*PADBOL MATCH*`;

        const digits = String(r.whatsapp).replace(/\D/g, '');
        const to     = `whatsapp:+${digits}`;
        await twilioClient.messages.create({ from: TWILIO_WHATSAPP_FROM, to, body });
        console.log(`✓ Recordatorio enviado a ${to} (reserva ${r.id})`);

        // Mark as sent
        await supabase
          .from('reservas')
          .update({ recordatorio_enviado: true })
          .eq('id', r.id);

      } catch (err) {
        console.warn(`⚠️ Recordatorio reserva ${r.id} fallido:`, err.message);
      }
    }
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