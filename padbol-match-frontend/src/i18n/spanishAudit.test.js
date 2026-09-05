import i18n from './index';
import en from './locales/en.json';
import es from './locales/es.json';
import { ADDITIONAL_LOCALE_OVERRIDES } from './additionalLocaleOverrides';
import PUBLIC_SITE_GENERATED_LOCALES from './publicSiteGeneratedLocales.json';
import SPANISH_PADCOINS_CORE_OVERRIDES from './spanishPadcoinsCoreOverrides.json';
import SPANISH_PADCOINS_EXPERIENCE_OVERRIDES from './spanishPadcoinsExperienceOverrides.json';
import SPANISH_POLISH_OVERRIDES from './spanishPolishOverrides.json';
import SPANISH_IDENTICAL_ALLOWLIST from './spanishIdenticalAllowlist.json';

function flatten(value, prefix = '', output = {}) {
  Object.entries(value || {}).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, output);
    else output[path] = String(child);
  });
  return output;
}

describe('Spanish audit', () => {
  it('has direct Spanish copy with only approved identical terms', () => {
    const english = flatten(en);
    const direct = {
      ...flatten(es),
      ...flatten({ publicSite: PUBLIC_SITE_GENERATED_LOCALES.es }),
      ...flatten(ADDITIONAL_LOCALE_OVERRIDES.es),
      ...flatten(SPANISH_PADCOINS_CORE_OVERRIDES),
      ...flatten(SPANISH_PADCOINS_EXPERIENCE_OVERRIDES),
      ...flatten(SPANISH_POLISH_OVERRIDES),
    };
    const resolved = flatten(i18n.getResourceBundle('es', 'translation'));
    const missingDirect = Object.keys(english).filter((key) => !(key in direct));
    const identicalResolved = Object.keys(english).filter((key) => resolved[key] === english[key]);
    expect(missingDirect).toEqual([]);
    expect(identicalResolved.sort()).toEqual(SPANISH_IDENTICAL_ALLOWLIST);
  });
});
