import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(
  process.env.REACT_APP_SUPABASE_URL || 'https://auth.padbolmatch.com',
).replace(/\/$/, '');
const supabaseAnonKey = 'sb_publishable_dY0TIrAnqgzg5yJ_XoZx-g_4aNMfHKY';

/**
 * Auth: PKCE + sesión en URL para callbacks; sin redirect global en la app.
 * Tras confirmar email / OAuth: incluir en Supabase → Authentication → Redirect URLs la URL del sitio, p. ej.
 * `${origin}/auth/callback` (Google y Facebook) y `${origin}/login` si aplica.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});