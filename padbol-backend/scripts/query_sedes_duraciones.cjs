#!/usr/bin/env node
/**
 * Diagnóstico: SELECT equivalente a
 *   SELECT * FROM sedes_duraciones WHERE sede_id = ? AND activo = true;
 * Uso: node scripts/query_sedes_duraciones.cjs [sede_id]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const sedeId = parseInt(process.argv[2] || '1', 10);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('Faltan SUPABASE_URL / SUPABASE_KEY en padbol-backend/.env');
  process.exit(1);
}

const supabase = createClient(url, key);

(async () => {
  const { data, error } = await supabase
    .from('sedes_duraciones')
    .select('*')
    .eq('sede_id', sedeId)
    .eq('activo', true);
  console.log('SQL equivalente:');
  console.log(`SELECT * FROM sedes_duraciones WHERE sede_id = ${sedeId} AND activo = true;`);
  console.log('---');
  if (error) {
    console.error('Error:', error.message, error.code, error.details);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
})();
