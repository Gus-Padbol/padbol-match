// Staging isolates data and makes all delivery switches explicit.
export const BACKEND_RELEASE = '2026-09-09.1';
export function backendRuntime(env = process.env) {
  const staging = env.BACKEND_RUNTIME_MODE === 'staging';
  const enabled = (name) => env[name] == null || env[name] === '' ? !staging : env[name] === 'true';
  return Object.freeze({ staging, mode: staging ? 'staging' : 'standard',
    backgroundJobsEnabled: enabled('BACKGROUND_JOBS_ENABLED'),
    outboundDeliveryEnabled: enabled('OUTBOUND_DELIVERY_ENABLED'),
    pushSendEnabled: enabled('OUTBOUND_DELIVERY_ENABLED') && enabled('PUSH_SEND_ENABLED'),
  });
}
export function assertStagingIsolation(env = process.env) {
  if (env.BACKEND_RUNTIME_MODE !== 'staging') return;
  const expected = String(env.STAGING_SUPABASE_PROJECT_REF || '').trim();
  const production = String(env.PRODUCTION_SUPABASE_PROJECT_REF || '').trim();
  if (!expected || !production || expected === production ||
      env.SUPABASE_URL !== `https://${expected}.supabase.co`) {
    throw new Error('STAGING_SUPABASE_ISOLATION_REQUIRED');
  }
  if (!env.SUPABASE_KEY || !(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY)) {
    throw new Error('STAGING_SUPABASE_CREDENTIALS_REQUIRED');
  }
  // The REST client is pinned above. A separate SQL connection needs its own
  // independently verified target; this staging bundle deliberately does not use it.
  if (env.DATABASE_URL) throw new Error('STAGING_DATABASE_URL_NOT_ALLOWED');
  if (env.STRIPE_SECRET_KEY || env.TWILIO_AUTH_TOKEN || env.RESEND_API_KEY || env.ANTHROPIC_API_KEY || env.MERCADOPAGO_ACCESS_TOKEN || env.MP_ACCESS_TOKEN) {
    throw new Error('STAGING_PROVIDER_CREDENTIALS_NOT_ALLOWED');
  }
}
export async function backendReadiness({ supabaseAdmin, serviceRoleConfigured, runtime, timeoutMs = 4000 }) {
  const base = { release: BACKEND_RELEASE, runtime: runtime.mode,
    backgroundJobsEnabled: runtime.backgroundJobsEnabled,
    outboundDeliveryEnabled: runtime.outboundDeliveryEnabled, pushSendEnabled: runtime.pushSendEnabled };
  if (!supabaseAdmin || !serviceRoleConfigured) return { ...base, ready: false, reason: 'database_not_configured' };
  let timer;
  try {
    const result = await Promise.race([
      supabaseAdmin.rpc('match_backend_release_readiness'),
      new Promise((resolve) => { timer = setTimeout(() => resolve({ error: true }), timeoutMs); }),
    ]);
    if (result.error || result.data?.release !== BACKEND_RELEASE || result.data?.ready !== true) {
      return { ...base, ready: false, reason: 'schema_not_ready' };
    }
    return { ...base, ready: true, schema: result.data };
  } catch { return { ...base, ready: false, reason: 'database_unavailable' }; }
  finally { clearTimeout(timer); }
}
