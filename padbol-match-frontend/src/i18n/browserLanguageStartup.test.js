import { readInitialLng } from './index';

const storageWith = (value) => ({ getItem: () => value });

describe('i18n browser startup', () => {
  it('connects i18n startup to the first supported browser language', () => {
    expect(readInitialLng({
      storage: storageWith(null),
      navigatorLike: { languages: ['zh-CN', 'ro-RO', 'es-AR'] },
    })).toBe('ro');
  });

  it('keeps an explicit manual language and falls back to English for unknown locales', () => {
    expect(readInitialLng({
      storage: storageWith('es'),
      navigatorLike: { languages: ['ro-RO'] },
    })).toBe('es');
    expect(readInitialLng({
      storage: storageWith(null),
      navigatorLike: { languages: ['ja-JP', 'zh-CN'] },
    })).toBe('en');
  });
});
