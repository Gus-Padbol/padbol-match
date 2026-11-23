import fs from 'node:fs';
import path from 'node:path';

test('módulo administrativo expone jornadas, estados, asistencia y continuidad', () => {
  const source = fs.readFileSync(path.join(__dirname, 'AdminNextGeneration.jsx'), 'utf8');
  expect(source).toContain('Nueva jornada');
  expect(source).toContain('Grupo de continuidad');
  expect(source).toContain('Editar jornada');
  expect(source).toContain('Agregar al grupo');
  expect(source).toContain("setSessionState(jornada, 'publicada')");
  expect(source).toContain("setSessionState(jornada, 'cerrada')");
  expect(source).toContain("setAttendance(registration, 'presente')");
  expect(source).toContain('confirmados');
  expect(source).toContain('en espera');
  expect(source).toContain('cancelados');
});
