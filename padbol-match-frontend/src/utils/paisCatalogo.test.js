import { mismosPaises, paisesCatalogoUnicos } from './paisI18n';
test('Argentina variants share one catalog item without dropping venues', () => {
  const rows = [{ pais: 'Argentina' }, { pais: 'argentina ' }, { pais: '🇦🇷 Argentina' }, { pais: 'AR' }, { pais: 'Italia' }];
  expect(paisesCatalogoUnicos(rows)).toEqual(['Argentina', 'Italia']);
  expect(rows.filter(r => mismosPaises(r.pais, 'Argentina'))).toHaveLength(4);
  expect(mismosPaises('Argentina', 'Italia')).toBe(false);
  expect(mismosPaises('', '')).toBe(false);
});
