import { mismosPaises, paisesCatalogoUnicos } from './paisI18n';
test('Argentina variants share one catalog item without dropping venues', () => {
  const rows = [{ pais: 'Argentina' }, { pais: 'argentina ' }, { pais: '🇦🇷 Argentina' }, { pais: 'AR' }, { pais: 'Italia' }];
  expect(paisesCatalogoUnicos(rows)).toEqual(['Argentina', 'Italia']);
  expect(rows.filter(r => mismosPaises(r.pais, 'Argentina'))).toHaveLength(4);
  expect(mismosPaises('Argentina', 'Italia')).toBe(false);
  expect(mismosPaises('', '')).toBe(false);
});

test('unlisted countries are preserved rather than erased from the catalog', () => {
  expect(paisesCatalogoUnicos([{pais: 'Islandia'}, {pais: 'ISLANDIA'}, {pais: 'Malta'}])).toEqual(['Islandia', 'Malta']);
  expect(mismosPaises('Islandia', 'ISLANDIA')).toBe(true);
});
