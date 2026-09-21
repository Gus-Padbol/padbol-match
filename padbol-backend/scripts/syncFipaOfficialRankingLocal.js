#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import {
  FIPA_OFFICIAL_RANKING_SOURCE_URL,
  fipaRankingSourceHash,
  parseFipaOfficialRankingCsv,
} from '../lib/fipaOfficialRanking.js';

const supabaseUrl = String(process.env.SUPABASE_URL || process.env.API_URL || '').trim();
const serviceRoleKey = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SECRET_KEY || '',
).trim();
let currentStage = 'inicio';
process.on('uncaughtException', (error) => {
  console.error(JSON.stringify({ stage: currentStage, error: error?.message || error, details: error }));
  process.exit(1);
});
process.on('unhandledRejection', (error) => {
  console.error(JSON.stringify({ stage: currentStage, error: error?.message || error, details: error }));
  process.exit(1);
});

function assertLocalUrl(value) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Falta una URL local válida de Supabase'); }
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('Esta herramienta se niega a escribir en una base que no sea local');
  }
}

assertLocalUrl(supabaseUrl);
if (!serviceRoleKey) throw new Error('Falta la clave service_role del Supabase local');

currentStage = 'descarga_fuente';
const response = await fetch(FIPA_OFFICIAL_RANKING_SOURCE_URL, { headers: { accept: 'text/csv' } });
if (!response.ok) throw new Error(`La fuente oficial respondió HTTP ${response.status}`);
const csv = await response.text();
const parsed = parseFipaOfficialRankingCsv(csv);
if (parsed.players.length !== 209) {
  throw new Error(`Se esperaban 209 jugadores completos y llegaron ${parsed.players.length}`);
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
currentStage = 'publicacion_rpc';
const { data: snapshotId, error } = await client.rpc('publicar_ranking_fipa_oficial', {
  p_hash_fuente: fipaRankingSourceHash(csv),
  p_etiqueta_actualizacion: parsed.updatedLabel,
  p_fuente_url: FIPA_OFFICIAL_RANKING_SOURCE_URL,
  p_importado_por: null,
  p_jugadores: parsed.players,
});
if (error) {
  throw new Error(`No se pudo publicar la instantánea: ${JSON.stringify(error)}`);
}

currentStage = 'conteos';
const [{ data: playerRows, error: playersError }, { data: entryRows, error: entriesError }] = await Promise.all([
  client.from('fipa_jugadores_oficiales').select('id'),
  client.from('fipa_ranking_entradas').select('id').eq('instantanea_id', snapshotId),
]);
if (playersError) throw new Error(`No se pudieron contar perfiles: ${JSON.stringify(playersError)}`);
if (entriesError) throw new Error(`No se pudieron contar entradas: ${JSON.stringify(entriesError)}`);
const playersCount = playerRows?.length ?? 0;
const entriesCount = entryRows?.length ?? 0;
if (playersCount !== 209 || entriesCount !== 209) {
  throw new Error(`Importación incompleta: perfiles=${playersCount}, entradas=${entriesCount}`);
}

const { data: linkedRows, error: linkedError } = await client
  .from('fipa_jugadores_oficiales')
  .select('id')
  .not('user_id', 'is', null);
if (linkedError) throw new Error(`No se pudieron comprobar vínculos: ${JSON.stringify(linkedError)}`);
const linkedUsers = linkedRows?.length ?? 0;
if (linkedUsers !== 0) throw new Error(`La importación creó ${linkedUsers} vínculos de usuario inesperados`);

console.log(JSON.stringify({
  ok: true,
  snapshotId,
  updatedLabel: parsed.updatedLabel,
  officialProfiles: playersCount,
  rankingEntries: entriesCount,
  linkedUsers,
}));
