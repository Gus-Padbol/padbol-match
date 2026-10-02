import express from 'express';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { registerWhatsappCrmRoutes } from '../lib/whatsappCrm.js';

const projectRef = 'vxikhdulhuvghfqeutnp';
const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim();
const databaseUrl = String(process.env.DATABASE_URL || '').trim();

if (!supabaseUrl.includes(projectRef) || !databaseUrl.includes(projectRef)) {
  throw new Error('El backend CRM QA sólo puede conectarse al proyecto Supabase QA autorizado.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const pgPool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

async function authUserFromBearer(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  const { data, error } = await supabase.auth.getUser(match[1].trim());
  return error ? null : data?.user || null;
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  const origin = String(req.headers.origin || '');
  const allowed = origin === 'http://localhost:3000' || origin.endsWith('.vercel.app');
  if (origin && allowed) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get('/health', (_req, res) => res.json({
  ok: true,
  environment: 'qa',
  projectRef,
  crmDispatchAllowed: false,
}));

async function handleGetMiRol(req, res) {
  const user = await authUserFromBearer(req);
  if (!user?.email) return res.status(401).json({ error: 'No autorizado' });

  let query = await supabase
    .from('user_roles')
    .select('role, sede_id, nombre, pais, email, torneos_oficiales_habilitados')
    .eq('user_id', user.id)
    .maybeSingle();
  if (query.error && /column/i.test(String(query.error.message || ''))) {
    query = await supabase
      .from('user_roles')
      .select('role, sede_id, nombre, pais, email')
      .eq('user_id', user.id)
      .maybeSingle();
  }
  if (query.error) return res.status(500).json({ error: 'No se pudo resolver el rol.' });

  const row = query.data || {};
  const role = String(row.role || '').trim().toLowerCase() || null;
  const sedeId = row.sede_id == null ? null : Number(row.sede_id);
  return res.json({
    email: String(row.email || user.email).trim().toLowerCase(),
    rol: role,
    role,
    sede_id: Number.isFinite(sedeId) ? sedeId : null,
    sedeId: Number.isFinite(sedeId) ? sedeId : null,
    nombre: row.nombre ?? null,
    pais: row.pais ?? null,
    torneosOficialesHabilitados: Boolean(row.torneos_oficiales_habilitados),
  });
}

app.get('/api/auth/mi-rol', handleGetMiRol);
app.get('/api/usuarios/mi-rol', handleGetMiRol);

async function requireSuperAdmin(req, res) {
  const user = await authUserFromBearer(req);
  if (!user?.id) {
    res.status(401).json({ error: 'No autorizado' });
    return null;
  }
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || String(data?.role || '').toLowerCase() !== 'super_admin') {
    res.status(403).json({ error: 'Sin permiso' });
    return null;
  }
  return user;
}

// Contrato de lectura para QA. Super Admin no tiene cupo; el envío real queda
// explícitamente deshabilitado en este backend de validación.
app.get('/api/push/admin-quota', async (req, res) => {
  if (!await requireSuperAdmin(req, res)) return;
  res.json({ unlimited: true, limit: null, used: 0, remaining: null });
});
app.get('/api/push/admin-history', async (req, res) => {
  if (!await requireSuperAdmin(req, res)) return;
  res.json([]);
});
app.post('/api/push/admin-segment-preview', async (req, res) => {
  if (!await requireSuperAdmin(req, res)) return;
  res.json({ recipients: 0, withPushToken: 0, category: 'transactional' });
});
app.get('/api/push/admin-search-players', async (req, res) => {
  if (!await requireSuperAdmin(req, res)) return;
  res.json([]);
});
app.post('/api/push/send-admin', async (req, res) => {
  if (!await requireSuperAdmin(req, res)) return;
  res.status(503).json({ code: 'QA_DISPATCH_DISABLED', error: 'El envío real está deshabilitado en QA.' });
});

registerWhatsappCrmRoutes(app, { pgPool, authUserFromBearer });

export default app;
