const mockChangeLanguage = jest.fn(() => Promise.resolve());

jest.mock('../i18n', () => ({
  __esModule: true,
  default: { changeLanguage: (...args) => mockChangeLanguage(...args) },
}));

const {
  PADBOL_LANGUAGE_STORAGE_KEY,
  bootstrapPadbolLanguage,
  detectPadbolBrowserLanguage,
  getNavigatorLanguageCandidates,
  resolveInitialPadbolLanguage,
} = require('./padbolLang');

function storageWith(value) {
  return {
    getItem: jest.fn(() => value),
  };
}

describe('Padbol Match browser language', () => {
  beforeEach(() => {
    mockChangeLanguage.mockClear();
    document.documentElement.dir = '';
    document.body.className = '';
  });

  it('uses the first supported locale from navigator.languages', () => {
    expect(detectPadbolBrowserLanguage({
      languages: ['zh-Hans-CN', 'ro-RO', 'es-AR'],
      language: 'en-US',
    })).toBe('ro');
    expect(detectPadbolBrowserLanguage({ languages: ['es-AR'], language: 'en-US' })).toBe('es');
    expect(detectPadbolBrowserLanguage({ languages: ['en-GB'] })).toBe('en');
  });

  it('falls back to English only after all browser locales are unsupported', () => {
    expect(detectPadbolBrowserLanguage({
      languages: ['ja-JP', 'zh-Hans-CN'],
      language: 'ko-KR',
    })).toBe('en');
  });

  it('keeps a valid manual choice ahead of the browser locale', () => {
    const storage = storageWith('es');
    expect(resolveInitialPadbolLanguage({
      storage,
      navigatorLike: { languages: ['ro-RO', 'en-US'] },
    })).toBe('es');
    expect(storage.getItem).toHaveBeenCalledWith(PADBOL_LANGUAGE_STORAGE_KEY);
  });

  it('ignores an invalid stored value and continues through browser preferences', () => {
    expect(resolveInitialPadbolLanguage({
      storage: storageWith('xx-invalid'),
      navigatorLike: { languages: ['zh-CN', 'ro-RO'] },
    })).toBe('ro');
  });

  it('keeps navigator.languages order and deduplicates navigator.language', () => {
    expect(getNavigatorLanguageCandidates({
      languages: ['ro-RO', 'es-AR'],
      language: 'ro-RO',
    })).toEqual(['ro-RO', 'es-AR']);
  });

  it('bootstraps the detected locale instead of overwriting it with English', () => {
    const resolved = bootstrapPadbolLanguage({
      storage: storageWith(null),
      navigatorLike: { languages: ['ro-RO', 'en-US'] },
    });
    expect(resolved).toBe('ro');
    expect(mockChangeLanguage).toHaveBeenCalledWith('ro');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
