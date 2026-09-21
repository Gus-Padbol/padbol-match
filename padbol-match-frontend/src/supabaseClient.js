import { createClient } from '@supabase/supabase-js';
import clientEnvironment from './config/clientEnvironment.js';
const { resolveClientEnvironment, PRODUCTION_SUPABASE_URL, PRODUCTION_SUPABASE_PUBLIC_KEY } = clientEnvironment;

const environment = resolveClientEnvironment(process.env);
const supabaseUrl = environment.supabaseUrl || PRODUCTION_SUPABASE_URL;
const supabaseAnonKey = environment.supabaseAnonKey || PRODUCTION_SUPABASE_PUBLIC_KEY;

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
