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

registerWhatsappCrmRoutes(app, { pgPool, authUserFromBearer });

export default app;
