import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NIVELES_DEPORTIVOS,
  TORNEO_CATEGORIA_EDAD_ADULTA,
  TORNEO_CATEGORIA_EDAD_DIVISION_ESPECIAL,
  TORNEO_CATEGORIA_EDAD_JUVENIL,
  TORNEO_CATEGORIA_EDAD_LEGADO,
  TORNEO_CATEGORIA_EDAD_OFRECIDAS,
  TORNEO_CATEGORIA_EDAD_VALORES,
  categoriaJuvenilParaEdad,
  edadEnFechaCorte,
  esCategoriaAdultaPadbol,
  esCategoriaJuvenilNextGeneration,
  esCategoriaLegado,
  esDivisionEspecial,
  esNacimientoElegibleParaCategoria,
  isNivelDeportivoValido,
  isTorneoCategoriaEdadValida,
  normalizeTorneoCategoriaEdad,
  normalizeTorneoFechaCorteEdad,
  programaDeCategoria,
  torneoEsNextGeneration,
} from './torneoCategoriasEdad.js';

test('Next Generation es exclusivamente U13 / U15 / U17', () => {
  assert.deepEqual([...TORNEO_CATEGORIA_EDAD_JUVENIL], ['u13', 'u15', 'u17']);
  for (const v of TORNEO_CATEGORIA_EDAD_JUVENIL) {
    assert.equal(esCategoriaJuvenilNextGeneration(v), true);
    assert.equal(programaDeCategoria(v), 'next_generation');
  }
});

test('adultos pertenecen a Padbol; +50 es división especial opcional (no una marca nueva)', () => {
  assert.deepEqual([...TORNEO_CATEGORIA_EDAD_ADULTA], ['open']);
  assert.deepEqual([...TORNEO_CATEGORIA_EDAD_DIVISION_ESPECIAL], ['master_50']);
  assert.equal(esCategoriaAdultaPadbol('open'), true);
  assert.equal(esDivisionEspecial('master_50'), true);
  // Ni open ni master_50 son Next Generation.
  assert.equal(esCategoriaJuvenilNextGeneration('open'), false);
  assert.equal(esCategoriaJuvenilNextGeneration('master_50'), false);
  assert.equal(programaDeCategoria('open'), 'padbol');
  assert.equal(programaDeCategoria('master_50'), 'padbol');
  // No se implementan +30 ni +40 como categorías principales.
  for (const v of ['master_30', 'master_40']) {
    assert.equal(TORNEO_CATEGORIA_EDAD_OFRECIDAS.includes(v), false, `${v} no debe ofrecerse`);
  }
});

test('+50 no sustituye el nivel deportivo: ejes independientes', () => {
  // Un jugador +50 sigue teniendo un nivel entre los niveles deportivos.
  assert.equal(esNacimientoElegibleParaCategoria('master_50', '1970-01-01', '2026-06-30'), true);
  assert.equal(isNivelDeportivoValido('Principiante'), true);
  assert.equal(isNivelDeportivoValido('Elite'), true);
});

test('niveles deportivos incluyen 6ta (normalización con torneos y backend)', () => {
  assert.deepEqual(
    [...NIVELES_DEPORTIVOS],
    ['Principiante', '6ta', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'],
  );
  assert.equal(isNivelDeportivoValido('6ta'), true);
  assert.equal(isNivelDeportivoValido('7ma'), false);
});

test('legado histórico válido pero no ofrecido (sub_18 y master_40)', () => {
  assert.deepEqual([...TORNEO_CATEGORIA_EDAD_LEGADO], ['sub_18', 'master_40']);
  for (const v of TORNEO_CATEGORIA_EDAD_LEGADO) {
    assert.equal(isTorneoCategoriaEdadValida(v), true, `${v} debe seguir siendo válido`);
    assert.equal(esCategoriaLegado(v), true);
    assert.equal(TORNEO_CATEGORIA_EDAD_OFRECIDAS.includes(v), false, `${v} no se ofrece en altas nuevas`);
  }
  assert.equal(isTorneoCategoriaEdadValida('sub_20'), false);
  assert.equal(isTorneoCategoriaEdadValida('master_30'), false, 'master_30 no debe existir');
});

test('valores válidos y normalización', () => {
  assert.deepEqual([...TORNEO_CATEGORIA_EDAD_VALORES], ['u13', 'u15', 'u17', 'open', 'master_50', 'sub_18', 'master_40']);
  assert.equal(normalizeTorneoCategoriaEdad('  U13 '), 'u13');
  assert.equal(normalizeTorneoCategoriaEdad('MASTER_50'), 'master_50');
  assert.equal(normalizeTorneoCategoriaEdad('Sub_18'), 'sub_18');
  assert.equal(normalizeTorneoCategoriaEdad('master_30'), null);
});

test('torneoEsNextGeneration por categoría juvenil o marca explícita', () => {
  assert.equal(torneoEsNextGeneration({ categoria_edad: 'u15' }), true);
  assert.equal(torneoEsNextGeneration({ categoria_edad: 'master_50' }), false);
  assert.equal(torneoEsNextGeneration({ categoria_edad: 'open', programa: 'next_generation' }), true);
  assert.equal(torneoEsNextGeneration(null), false);
});

test('normalizeTorneoFechaCorteEdad: vacío→null, inválido→null, válido se conserva', () => {
  assert.equal(normalizeTorneoFechaCorteEdad(null), null);
  assert.equal(normalizeTorneoFechaCorteEdad(''), null);
  assert.equal(normalizeTorneoFechaCorteEdad('   '), null);
  assert.equal(normalizeTorneoFechaCorteEdad('30-06-2026'), null);
  assert.equal(normalizeTorneoFechaCorteEdad('2026-02-30'), null);
  assert.equal(normalizeTorneoFechaCorteEdad('2026-6-1'), null);
  assert.equal(normalizeTorneoFechaCorteEdad('2026-06-30'), '2026-06-30');
  assert.equal(normalizeTorneoFechaCorteEdad(' 2026-06-30 '), '2026-06-30');
});

test('edadEnFechaCorte: fechas inválidas y cumpleaños', () => {
  assert.equal(edadEnFechaCorte('2010-13-01', '2026-01-01'), null);
  assert.equal(edadEnFechaCorte('2010-02-30', '2026-01-01'), null);
  assert.equal(edadEnFechaCorte('2010-03-10', '2026-03-09'), 15);
  assert.equal(edadEnFechaCorte('2010-03-10', '2026-03-10'), 16);
});

test('límites juveniles U13 / U15 / U17 con fecha de corte configurable', () => {
  const corte = '2026-06-30';
  assert.equal(categoriaJuvenilParaEdad(edadEnFechaCorte('2012-07-01', corte)), 'u13');
  assert.equal(categoriaJuvenilParaEdad(edadEnFechaCorte('2011-06-30', corte)), 'u15');
  assert.equal(categoriaJuvenilParaEdad(edadEnFechaCorte('2009-06-30', corte)), 'u17');
  assert.equal(categoriaJuvenilParaEdad(edadEnFechaCorte('2008-06-30', corte)), null);
});

test('elegibilidad +50 y legado master_40', () => {
  assert.equal(esNacimientoElegibleParaCategoria('master_50', '1976-06-30', '2026-06-30'), true); // 50
  assert.equal(esNacimientoElegibleParaCategoria('master_50', '1976-07-01', '2026-06-30'), false); // 49
  assert.equal(esNacimientoElegibleParaCategoria('master_40', '1986-06-30', '2026-06-30'), true); // 40
  assert.equal(esNacimientoElegibleParaCategoria('open', '1950-01-01', '2026-06-30'), true);
  assert.equal(esNacimientoElegibleParaCategoria('sub_18', '2008-01-01', '2026-06-30'), false); // 18
});
