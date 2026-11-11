import {normalizeTorneoPostPerfilPath} from './torneoPostPerfilNavigation';

test('conserva retorno Napoli tras completar ficha', () => {
  expect(normalizeTorneoPostPerfilPath('/nations-cup/nations-cup-napoli-2026/inscripcion'))
    .toBe('/nations-cup/nations-cup-napoli-2026/inscripcion');
});
