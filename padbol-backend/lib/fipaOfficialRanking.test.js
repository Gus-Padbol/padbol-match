import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterOfficialFipaRanking,
  fipaRankingSourceHash,
  normalizeFipaContinent,
  officialFipaRankingDto,
  parseFipaOfficialRankingCsv,
  parseFipaPoints,
} from './fipaOfficialRanking.js';

const CSV = [
  '"#","#","*","-","-","-","(Last updated: August 2026)"',
  '"","","","Name","Player","Team","Continent",""',
  '"1","1","*","Olivian","Surugiu","Romania","Europe","2180","event"',
  '"1","1","*","Victoras","Popescu","Romania","Europe","2180","event"',
  '"2","2","","Sebastián","Sanroman","Uruguay","America","1700,8","event"',
  '"3","","","","Bardini","Italy","Europe","100","partial"',
].join('\n');

test('parses the official FIPA format without rounding decimal points', () => {
  const parsed = parseFipaOfficialRankingCsv(CSV);
  assert.equal(parsed.updatedLabel, '(Last updated: August 2026)');
  assert.equal(parsed.players.length, 3);
  assert.equal(parsed.players[2].puntos, 1700.8);
  assert.equal(parsed.players[2].puntos_fuente, '1700,8');
  assert.equal(parsed.players[0].detalle.celdas_torneos[0], 'event');
});

test('uses the same complete-name rule as Web Padbol and preserves ties', () => {
  const parsed = parseFipaOfficialRankingCsv(CSV);
  assert.deepEqual(parsed.players.map((row) => row.posicion), [1, 1, 2]);
  assert.equal(parsed.players.some((row) => row.apellido === 'Bardini'), false);
});

test('normalizes official continent labels to the shared canonical values', () => {
  assert.equal(normalizeFipaContinent('Europe'), 'europa');
  assert.equal(normalizeFipaContinent('América'), 'america');
  assert.equal(normalizeFipaContinent('Middle East'), 'oriente_medio');
  assert.equal(normalizeFipaContinent('unknown'), null);
});

test('builds continental positions with the same points and preserves the world position', () => {
  const players = parseFipaOfficialRankingCsv(CSV).players;
  const america = filterOfficialFipaRanking(players, { continente: 'america' });
  assert.equal(america.length, 1);
  assert.equal(america[0].posicion, 1);
  assert.equal(america[0].posicion_mundial, 2);
  assert.equal(america[0].puntos, 1700.8);
});

test('maps an unregistered official player without fabricating a user account', () => {
  const player = parseFipaOfficialRankingCsv(CSV).players[0];
  const dto = officialFipaRankingDto(player);
  assert.equal(dto.user_id, null);
  assert.equal(dto.estado_vinculacion, 'no_reclamado');
  assert.equal(dto.puede_reclamar, true);
  assert.equal(dto.ranking_oficial, true);
});

test('source hashes are stable and points parser supports comma decimals', () => {
  assert.equal(fipaRankingSourceHash(CSV), fipaRankingSourceHash(CSV));
  assert.notEqual(fipaRankingSourceHash(CSV), fipaRankingSourceHash(`${CSV}\n`));
  assert.equal(parseFipaPoints('1.700,8'), 1700.8);
});
