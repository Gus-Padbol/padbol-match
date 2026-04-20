import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vpldffhsxhgnmitiikof.supabase.co';
const supabaseAnonKey = 'sb_publishable_dY0TIrAnqgzg5yJ_XoZx-g_4aNMfHKY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);