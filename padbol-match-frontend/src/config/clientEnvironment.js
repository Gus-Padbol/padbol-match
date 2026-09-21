const PRODUCTION_API_URL = 'https://padbol-backend.onrender.com';
const PRODUCTION_SUPABASE_URL = 'https://auth.padbolmatch.com';
const PRODUCTION_SUPABASE_PUBLIC_KEY = 'sb_publishable_dY0TIrAnqgzg5yJ_XoZx-g_4aNMfHKY';
const PRODUCTION_SUPABASE_REF = 'vpldffhsxhgnmitiikof';
const PRODUCTION_HOSTS = new Set([
  `${PRODUCTION_SUPABASE_REF}.supabase.co`,
  'padbol-backend.onrender.com', 'api.padbolmatch.com', 'auth.padbolmatch.com',
  'padbolmatch.com', 'www.padbolmatch.com', 'padbol-match-9abn.vercel.app',
]);

function clean(value) { return String(value || '').trim().replace(/\/+$/, ''); }

function qaUrl(value, name) {
  if (!value) throw new Error(`QA requires ${name}.`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`QA requires a valid ${name}.`); }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || url.pathname !== '/' || PRODUCTION_HOSTS.has(hostname)
      || hostname.endsWith('.padbolmatch.com')) {
    throw new Error(`QA requires an isolated HTTPS origin for ${name}; production is forbidden.`);
  }
  return url.origin;
}

function publicSupabaseKey(value) {
  if (value.startsWith('sb_publishable_') && value.length > 20) return true;
  if (!value.startsWith('eyJ')) return false;
  try {
    const payload = value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    const payloadData = JSON.parse(decoded);
    return payloadData.role === 'anon' && payloadData.ref !== PRODUCTION_SUPABASE_REF;
  } catch { return false; }
}

function resolveClientEnvironment(env = {}) {
  const variant = clean(env.REACT_APP_APP_VARIANT) || 'production';
  if (!['qa', 'production', 'development'].includes(variant)) throw new Error('Unknown REACT_APP_APP_VARIANT.');
  const isQA = variant === 'qa';
  let apiBaseUrl = clean(env.REACT_APP_API_BASE_URL);
  let apiLegacyUrl = clean(env.REACT_APP_API_URL);
  let supabaseUrl = clean(env.REACT_APP_SUPABASE_URL);
  const supabaseAnonKey = String(env.REACT_APP_SUPABASE_ANON_KEY || '').trim();
  if (isQA) {
    apiBaseUrl = qaUrl(apiBaseUrl, 'REACT_APP_API_BASE_URL');
    apiLegacyUrl = qaUrl(apiLegacyUrl, 'REACT_APP_API_URL');
    if (apiBaseUrl !== apiLegacyUrl) throw new Error('QA API aliases must use the same origin.');
    supabaseUrl = qaUrl(supabaseUrl, 'REACT_APP_SUPABASE_URL');
    if (apiBaseUrl === supabaseUrl) throw new Error('QA API and Supabase must use their respective isolated origins.');
    if (supabaseAnonKey === PRODUCTION_SUPABASE_PUBLIC_KEY || !publicSupabaseKey(supabaseAnonKey)) throw new Error('QA requires a public Supabase anon/publishable key; secret/service-role keys are forbidden.');
  }
  return { variant, isQA, apiBaseUrl, apiLegacyUrl, supabaseUrl, supabaseAnonKey };
}

module.exports = { resolveClientEnvironment, PRODUCTION_API_URL, PRODUCTION_SUPABASE_URL, PRODUCTION_SUPABASE_PUBLIC_KEY };
