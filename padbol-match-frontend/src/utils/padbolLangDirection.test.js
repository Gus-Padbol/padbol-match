import { applyPadbolDocumentDirection } from './padbolLang';

describe('Padbol document direction', () => {
  beforeEach(() => {
    document.documentElement.dir = '';
    document.body.className = '';
  });

  test.each([
    ['ar', 'lang-ar'],
    ['fa-IR', 'lang-fa'],
    ['he', 'lang-he'],
  ])('%s enables complete RTL mode', (language, languageClass) => {
    applyPadbolDocumentDirection(language);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.body).toHaveClass('lang-rtl', languageClass);
  });

  test('returning to an LTR edition clears every RTL language class', () => {
    applyPadbolDocumentDirection('ar');
    applyPadbolDocumentDirection('he');
    applyPadbolDocumentDirection('fa-IR');
    applyPadbolDocumentDirection('ro');

    expect(document.documentElement.dir).toBe('ltr');
    expect(document.body).not.toHaveClass('lang-rtl', 'lang-ar', 'lang-he', 'lang-fa');
  });
});
