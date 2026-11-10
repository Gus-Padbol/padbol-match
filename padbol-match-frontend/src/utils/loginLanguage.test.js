import {applyRequestedEnglishLanguage} from './loginLanguage';

test('?lang=en fuerza inglés y restaura el idioma anterior al salir', () => {
  const changeLanguage = jest.fn();
  const i18n = {language: 'es', changeLanguage};
  const cleanup = applyRequestedEnglishLanguage('?redirect=%2Fnations-cup%2Fnations-cup-napoli-2026%2Finscripcion&lang=en', i18n);
  expect(changeLanguage).toHaveBeenCalledWith('en');
  cleanup();
  expect(changeLanguage).toHaveBeenLastCalledWith('es');
});

test('sin lang=en no cambia el idioma global', () => {
  const changeLanguage = jest.fn();
  applyRequestedEnglishLanguage('?redirect=%2Fhub', {language: 'es', changeLanguage});
  expect(changeLanguage).not.toHaveBeenCalled();
});
