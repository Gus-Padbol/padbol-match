import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vpldffhsxhgnmitiikof.supabase.co';
const supabaseAnonKey = 'sb_publishable_dY0TIrAnqgzg5yJ_XoZx-g_4aNMfHKY';

/**
 * Auth: PKCE + sesión en URL para callbacks; sin redirect global en la app.
 * Tras confirmar email: agregar `${origin}/login` en Supabase → Redirect URLs.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});