import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import cron from 'node-cron';

dotenv.config();

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
app.use(express.json());

// Supabase (desde .env)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Reseñas de sede en Postgres/PostgREST: siempre ASCII `sede_resenas` (n sin tilde).
 * No usar `sede_reseñas` u otros identificadores con ñ para evitar problemas de encoding.
 */
const SEDE_RESENAS_TABLE = 'sede_resenas';

function isSedeResenasTableConfigError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (!msg.includes('sede_resenas')) return false;
  const code = String(err?.code || '');
  return (
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    code === '42P01' ||
    code === 'PGRST205'
  );
}

function respondSedeResenasUnavailable(res, err) {
  console.error('❌ Tabla reseñas sede no disponible:', err?.message || err);
  return res.status(503).json({
    error:
      'Las reseñas no están disponibles: falta la tabla public.sede_resenas en Supabase. Ejecutá el SQL padbol-backend/sql/create_sede_resenas.sql (nombre con n ASCII, sin tilde).',
    code: 'SEDE_RESENAS_TABLE_MISSING',
  });
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
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, sede_id, nombre, pais')
    .eq('email', em)
    .maybeSingle();
  if (error) return null;
  return data;
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
  const sedeIdRaw = row?.sede_id;
  const sedeId = sedeIdRaw != null && sedeIdRaw !== '' ? Number(sedeIdRaw) : null;
  return {
    email,
    rol,
    sedeId: Number.isFinite(sedeId) ? sedeId : null,
    pais: row?.pais || null,
    superA: isSuperAdminApi(email, rol),
    row,
    authUserId: user.id ?? null,
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

  if (rol === 'admin_club' && row?.sede_id != null && tsede != null && Number(row.sede_id) === tsede) {
    return;
  }

  if (rol === 'admin_nacional' && row?.pais && tsede != null) {
    const { data: sede } = await supabase.from('sedes').select('pais').eq('id', tsede).maybeSingle();
    if (sede && paisAdminCoincideSedeSorteo(row.pais, sede.pais)) return;
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
    res.json(sede);
  } catch (err) {
    console.error('❌ Error GET /api/sedes/:id:', err.message);
    res.status(500).json({ error: err.message });
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
    return {
      id: r.id,
      estrellas: r.estrellas,
      comentario: r.comentario,
      created_at: r.created_at,
      autor: {
        nombre: nombreAutorResenaDesdePerfil(p),
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

    const { data: allStars, error: e1 } = await supabase.from(SEDE_RESENAS_TABLE).select('estrellas').eq('sede_id', id);
    if (e1) throw e1;
    const total = allStars?.length ?? 0;
    const promedio =
      total > 0
        ? Math.round((allStars.reduce((s, r) => s + Number(r.estrellas), 0) / total) * 10) / 10
        : null;

    const { data: pageRows, error: e2 } = await supabase
      .from(SEDE_RESENAS_TABLE)
      .select('id, estrellas, comentario, user_id, created_at')
      .eq('sede_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (e2) throw e2;

    const resenas = await enrichSedeResenasConPerfil(pageRows || []);

    let ya_reseño = false;
    const user = await authUserFromBearer(req);
    if (user?.id) {
      const { data: mine } = await supabase
        .from(SEDE_RESENAS_TABLE)
        .select('id')
        .eq('sede_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      ya_reseño = Boolean(mine);
    }

    res.json({ promedio, total, resenas, ya_reseño });
  } catch (err) {
    if (isSedeResenasTableConfigError(err)) return respondSedeResenasUnavailable(res, err);
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
      .from(SEDE_RESENAS_TABLE)
      .select('id')
      .eq('sede_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (dup) {
      return res.status(409).json({ error: 'Ya dejaste una reseña en esta sede' });
    }

    const { data: inserted, error: insErr } = await supabase
      .from(SEDE_RESENAS_TABLE)
      .insert([{ sede_id: id, user_id: user.id, estrellas, comentario }])
      .select('id, estrellas, comentario, user_id, created_at')
      .single();
    if (insErr) throw insErr;

    const [enriched] = await enrichSedeResenasConPerfil(inserted ? [inserted] : []);
    res.status(201).json(enriched || null);
  } catch (err) {
    if (isSedeResenasTableConfigError(err)) return respondSedeResenasUnavailable(res, err);
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
    console.error('❌ Error POST reserva:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET reservas — con Bearer: super_admin / emails legacy → todas; admin_club → sede; admin_nacional → sedes del país
app.get('/api/reservas', async (req, res) => {
  try {
    const scope = await adminListScopeFromRequest(req);
    const logLine = scope
      ? { rol: scope.rol, email: scope.email, sedeId: scope.sedeId }
      : { rol: null, email: null, sedeId: null };
    console.log('GET /reservas:', logLine);

    let query = supabase.from('reservas').select('*');

    if (scope) {
      if (scope.superA) {
        // sin filtro
      } else if (scope.rol === 'admin_club' && scope.sedeId != null) {
        const { data: sedeRow, error: se } = await supabase
          .from('sedes')
          .select('nombre')
          .eq('id', scope.sedeId)
          .maybeSingle();
        if (se) throw se;
        const nombre = String(sedeRow?.nombre || '').trim();
        if (!nombre) {
          return res.json([]);
        }
        query = query.eq('sede', nombre);
      } else if (scope.rol === 'admin_nacional' && scope.pais) {
        const paisAdmin = normalizeAdminPaisLabel(scope.pais);
        const { data: sedesAll, error: e2 } = await supabase.from('sedes').select('nombre, pais');
        if (e2) throw e2;
        const nombres = [
          ...new Set(
            (sedesAll || [])
              .filter((s) => s.pais && String(s.pais).includes(paisAdmin))
              .map((s) => String(s.nombre || '').trim())
              .filter(Boolean)
          ),
        ];
        if (nombres.length === 0) {
          return res.json([]);
        }
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
      void notifyListaEsperaInscripcionAbierta(inserted.id, inserted.nombre || row.nombre);
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
      ? { rol: scope.rol, email: scope.email, sedeId: scope.sedeId }
      : { rol: null, email: null, sedeId: null };
    console.log('GET /torneos:', logLine);

    let query = supabase.from('torneos').select('*');

    if (scope) {
      if (scope.superA) {
        // sin filtro
      } else if (scope.rol === 'admin_club' && scope.sedeId != null) {
        query = query.eq('sede_id', scope.sedeId);
      } else if (scope.rol === 'admin_nacional' && scope.pais) {
        const paisAdmin = normalizeAdminPaisLabel(scope.pais);
        const { data: sedesAll, error: e2 } = await supabase.from('sedes').select('id, pais');
        if (e2) throw e2;
        const ids = (sedesAll || [])
          .filter((s) => s.pais && String(s.pais).includes(paisAdmin))
          .map((s) => s.id)
          .filter((id) => id != null);
        if (ids.length === 0) {
          return res.json([]);
        }
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

async function notifyListaEsperaInscripcionAbierta(torneoId, nombreTorneo) {
  try {
    const { data: rows, error } = await supabase
      .from('lista_espera_torneos')
      .select('id, email, nombre, whatsapp')
      .eq('torneo_id', torneoId);
    if (error) {
      console.warn('lista_espera_torneos select:', error.message);
      return;
    }
    const tname = String(nombreTorneo || 'el torneo').trim();
    const baseUrl = String(TORNEO_EQUIPOS_INVITE_BASE_URL || FRONTEND_URL || '').replace(/\/$/, '');
    const link = `${baseUrl}/torneo/${torneoId}/equipos`;
    const body = `🏆 ¡Abrió la inscripción para «${tname}»! Tu lugar está esperando. Inscribite antes de que se agoten los cupos: ${link}`;
    for (const row of rows || []) {
      const emailRow = String(row?.email || '').trim().toLowerCase();
      if (emailRow) {
        const permite = await jugadorAceptaNotificacionesTorneoPromoPorEmail(emailRow);
        if (!permite) continue;
      } else {
        continue;
      }
      let dest = String(row?.whatsapp || '').trim();
      if (!dest && row?.email) {
        dest = (await fetchJugadorWhatsappPorEmail(row.email)) || '';
      }
      if (!dest) continue;
      try {
        await sendTwilioWhatsAppBodyToRaw(dest, body);
      } catch (e) {
        console.warn('WhatsApp lista espera fila', row?.id, e?.message || e);
      }
    }
  } catch (e) {
    console.warn('notifyListaEsperaInscripcionAbierta:', e?.message || e);
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
    const oldEst = String(prevRow?.estado ?? '').toLowerCase();
    if (
      patch.estado !== undefined &&
      newEst === 'abierto' &&
      (oldEst === 'planificacion' || oldEst === 'proximo')
    ) {
      void notifyListaEsperaInscripcionAbierta(id, row0?.nombre || prevRow?.nombre);
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
      .select('id, estado, nombre')
      .eq('id', id)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!torneoRow) return res.status(404).json({ error: 'Torneo no encontrado' });
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
      const em = String(email || reservaDataIn?.email || '').trim().toLowerCase();
      reservaData = {
        tipo: 'torneo_inscripcion',
        equipo_id: eid,
        torneo_id: tid,
        email: em,
      };
    }

    // Use sede-specific MP token if configured, otherwise fall back to env var
    let client = mpClient;
    if (sedeId) {
      const { data: sedeRow } = await supabase
        .from('sedes')
        .select('mp_access_token')
        .eq('id', sedeId)
        .maybeSingle();
      if (sedeRow?.mp_access_token) {
        client = new MercadoPagoConfig({ accessToken: sedeRow.mp_access_token });
      }
    }

    // Embed full reservation data as JSON in external_reference so
    // PagoExitoso can create the reservation after payment is approved.
    const externalReference = reservaData ? JSON.stringify(reservaData) : '';

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
    nombre: nombre || null,
    pais: pais || null,
    sede_id,
    torneos_oficiales_habilitados: false,
  };
  const { data: ex } = await supabase.from('user_roles').select('email').eq('email', em).maybeSingle();
  if (ex?.email) {
    const { error } = await supabase
      .from('user_roles')
      .update({
        role: 'admin_club',
        nombre: payload.nombre,
        pais: payload.pais,
        sede_id: payload.sede_id,
        torneos_oficiales_habilitados: false,
      })
      .eq('email', em);
    return error || null;
  }
  const { error } = await supabase.from('user_roles').insert(payload);
  return error || null;
}

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
      numero_licencia: b.numero_licencia || null,
      fecha_contrato: b.fecha_contrato || null,
      tipo_licencia: b.tipo_licencia === 'padbol_point' ? 'padbol_point' : 'club_afiliado',
      licenciatario_nombre: b.licenciatario_nombre || null,
      licenciatario_email: licEmail,
      licenciatario_telefono: b.licenciatario_telefono || null,
      licenciatario_pais: b.licenciatario_pais || null,
    };

    const { data: ins, error } = await supabase.from('sedes_pendientes').insert(insert).select('id').single();
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

/** POST /api/admin/sedes-directa — super_admin: inserta sede activa + user_roles admin_club. */
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
      telefono: b.whatsapp || null,
      email_contacto: b.email_contacto || null,
      numero_licencia: b.numero_licencia || null,
      fecha_licencia: b.fecha_contrato || null,
      licencia_activa: true,
      franjas_horarias: [],
      fotos_destacadas: [],
    };

    const { data: sedeRow, error: sedeErr } = await supabase.from('sedes').insert(sedePayload).select('id').single();
    if (sedeErr) throw sedeErr;
    const sedeId = sedeRow.id;

    const urErr = await upsertUserRoleAdminClub({
      email: licEmail,
      nombre: String(b.licenciatario_nombre || '').trim() || null,
      pais: b.licenciatario_pais || b.pais || null,
      sede_id: sedeId,
    });
    if (urErr) {
      await supabase.from('sedes').delete().eq('id', sedeId);
      throw urErr;
    }

    const waLic = b.licenciatario_telefono || b.whatsapp;
    if (waLic) {
      const msg =
        `🎉 Bienvenido a PADBOL Match. Tu sede "${nombre}" está activa.\n` +
        `Ingresá al panel: padbolmatch.com/admin`;
      await sendTwilioWhatsAppBodyToRaw(waLic, msg);
    }

    res.json({ ok: true, sede_id: sedeId });
  } catch (err) {
    console.error('❌ POST /api/admin/sedes-directa:', err.message);
    res.status(500).json({ error: err.message });
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
    const urErr = await upsertUserRoleAdminClub({
      email: licEmail,
      nombre: pend.licenciatario_nombre || null,
      pais: pend.licenciatario_pais || pend.pais || null,
      sede_id: sedeId,
    });
    if (urErr) {
      await supabase.from('sedes').delete().eq('id', sedeId);
      throw urErr;
    }

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
  const d = String(fechaInicioStr || '').trim();
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const t = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00-03:00`);
  return Number.isNaN(t.getTime()) ? null : t;
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
    void notifyListaEsperaInscripcionAbierta(row.id, row.nombre);
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

cron.schedule('0 * * * *', async () => {
  try {
    await cierreInscripcionTorneos24hAntesInicio();
  } catch (err) {
    console.error('❌ Cron cierre inscripción torneos (24h antes):', err.message);
  }
}, { timezone: 'America/Argentina/Buenos_Aires' });

app.listen(PORT, () => {
  console.log(`🚀 Padbol Match API running on port ${PORT}`);
  console.log(`📊 Supabase: ${SUPABASE_URL}`);
  console.log(`💬 Twilio WhatsApp: whatsapp:+14155238886`);
});