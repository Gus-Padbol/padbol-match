import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCanchaDeporteWritePatch,
  mapCanchaPublicDto,
  normalizeCanchaDeporteColumnaBody,
  resolveDeporteLabel,
  validateCanchaNombreVisible,
} from './canchaDeporteCustom.js';

test('mej07: padbol create omit custom columns', () => {
  const r = buildCanchaDeporteWritePatch({ deporte: 'padbol' }, { mode: 'create' });
  assert.equal(r.ok, true);
  assert.equal(r.patch.deporte, 'padbol');
  assert.ok(!Object.prototype.hasOwnProperty.call(r.patch, 'deporte_personalizado'));
});

test('mej07: custom válida', () => {
  const r = buildCanchaDeporteWritePatch({
    deporte: 'custom',
    deporte_personalizado: 'Beach Tennis',
    cantidad_jugadores: 4,
    modalidad_custom: 'parejas',
  }, { mode: 'create' });
  assert.equal(r.ok, true);
  assert.equal(r.patch.deporte, 'custom');
});

test('mej07: validations 400', () => {
  assert.equal(buildCanchaDeporteWritePatch({
    deporte: 'custom', cantidad_jugadores: 4, modalidad_custom: 'individual',
  }, { mode: 'create' }).ok, false);
  assert.equal(buildCanchaDeporteWritePatch({
    deporte: 'custom', deporte_personalizado: 'X', modalidad_custom: 'individual',
  }, { mode: 'create' }).ok, false);
  assert.equal(buildCanchaDeporteWritePatch({
    deporte: 'custom', deporte_personalizado: 'X', cantidad_jugadores: 0, modalidad_custom: 'individual',
  }, { mode: 'create' }).ok, false);
  assert.equal(buildCanchaDeporteWritePatch({
    deporte: 'custom', deporte_personalizado: 'X', cantidad_jugadores: 2, modalidad_custom: 'xyz',
  }, { mode: 'create' }).ok, false);
  assert.equal(buildCanchaDeporteWritePatch({
    deporte: 'custom', deporte_personalizado: 'X', cantidad_jugadores: 2, modalidad_custom: 'individual',
    duracion_sugerida_min: 10,
  }, { mode: 'create' }).ok, false);
});

test('mej07: no remap custom→padbol; torneo set sin custom', () => {
  assert.equal(normalizeCanchaDeporteColumnaBody('custom'), 'custom');
  assert.equal(normalizeCanchaDeporteColumnaBody('nope'), null);
  const torneo = new Set(['padbol', 'padel', 'pickleball', 'squash', 'tenis', 'futbol_5', 'futbol_7']);
  assert.equal(torneo.has('custom'), false);
});

test('mej07: DTO labels + histórico', () => {
  assert.equal(mapCanchaPublicDto({ id: 1, deporte: 'padbol', nombre: 'A' }).deporte_label, 'Padbol');
  assert.equal(mapCanchaPublicDto({
    id: 2, deporte: 'custom', deporte_personalizado: 'Box', nombre: 'B',
  }).deporte_label, 'Box');
  assert.equal(resolveDeporteLabel({ deporte: 'custom', deporte_personalizado: 'Box' }), 'Box');
  const hist = mapCanchaPublicDto({ id: 3, deporte: 'tenis', nombre: 'T' });
  assert.equal(hist.es_deporte_personalizado, false);
  assert.equal(hist.deporte_personalizado, null);
});

test('mej07: patch oficial→custom y custom→oficial', () => {
  const toCustom = buildCanchaDeporteWritePatch({
    deporte: 'custom',
    deporte_personalizado: 'Z',
    cantidad_jugadores: 3,
    modalidad_custom: 'equipos',
  }, { mode: 'patch', existing: { deporte: 'padbol' } });
  assert.equal(toCustom.ok, true);
  const toOfficial = buildCanchaDeporteWritePatch({ deporte: 'squash' }, {
    mode: 'patch',
    existing: { deporte: 'custom', deporte_personalizado: 'Z', cantidad_jugadores: 3, modalidad_custom: 'equipos' },
  });
  assert.equal(toOfficial.patch.deporte, 'squash');
  assert.equal(toOfficial.patch.deporte_personalizado, null);
});

test('mej07: nombre visible', () => {
  assert.equal(validateCanchaNombreVisible('  Ok  ').nombre, 'Ok');
  assert.equal(validateCanchaNombreVisible('').ok, false);
});
