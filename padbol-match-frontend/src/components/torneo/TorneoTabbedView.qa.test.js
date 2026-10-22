import fs from 'fs';
import path from 'path';

test('la clasificación no inventa filas ni separadores vacíos', () => {
  const source = fs.readFileSync(path.join(__dirname, 'TorneoTabbedView.jsx'), 'utf8');
  expect(source).toContain(".filter((f) => f.posicion >= 4 && f.posicion <= 10 && String(f.equipoNombre || '').trim())");
  expect(source).toContain(".filter((value) => value && value !== '—').join(' • ')");
  expect(source).not.toContain("equipo: 'Equipo por confirmar'");
});
