import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNextGenerationOverview } from './nextGenerationAdmin.js';

test('consolida fuente canónica, estados y trazabilidad sin duplicados', () => {
  const overview = buildNextGenerationOverview({
    venues: [{ id: 'v1', sede_club: 'Sede QA' }],
    sessions: [{ id: 's1', sede_id: 'v1', nombre_publico: 'Jornada QA' }],
    registrations: [
      { id: 'r1', sesion_id: 's1', estado: 'confirmada', created_at: '2026-10-01' },
      { id: 'r1', sesion_id: 's1', estado: 'confirmada', created_at: '2026-10-01' },
      { id: 'r2', sesion_id: 's1', estado: 'en_espera', created_at: '2026-10-02' },
      { id: 'r3', sesion_id: 's1', estado: 'cancelada', created_at: '2026-10-03' },
    ],
    participants: [{ id: 'p1', inscripcion_id: 'r1', nombre: 'Jugador' }],
    events: [
      { id: 1, inscripcion_id: 'r1', tipo: 'creada_confirmada', created_at: '2026-10-01' },
      { id: 1, inscripcion_id: 'r1', tipo: 'creada_confirmada', created_at: '2026-10-01' },
    ],
  });
  assert.deepEqual(overview.summary, { total: 3, confirmadas: 1, en_espera: 1, canceladas: 1 });
  assert.equal(overview.inscripciones.find((row) => row.id === 'r1').eventos.length, 1);
  assert.equal(overview.inscripciones.find((row) => row.id === 'r1').sede.sede_club, 'Sede QA');
});
