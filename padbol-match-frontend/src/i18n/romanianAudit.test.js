import i18n from './index';
import en from './locales/en.json';
import ro from './locales/ro.json';
import PUBLIC_SITE_GENERATED_LOCALES from './publicSiteGeneratedLocales.json';
import ROMANIAN_LOCALE_OVERRIDES from './romanianLocaleOverrides';
import ROMANIAN_GENERATED_OVERRIDES from './romanianGeneratedOverrides.json';
import ROMANIAN_ADMIN_OVERRIDES from './romanianAdminOverrides.json';
import ROMANIAN_OPERATIONS_OVERRIDES from './romanianOperationsOverrides.json';
import ROMANIAN_ADMIN_LANDING_OVERRIDES from './romanianAdminLandingOverrides.json';
import ROMANIAN_PADCOINS_OVERRIDES from './romanianPadcoinsOverrides.json';
import ROMANIAN_ENGLISH_LEAK_OVERRIDES from './romanianEnglishLeakOverrides.json';
import ROMANIAN_POLISH_OVERRIDES from './romanianPolishOverrides.json';
import ROMANIAN_IDENTICAL_ALLOWLIST from './romanianIdenticalAllowlist.json';

function flatten(value, prefix = '', output = {}) {
  Object.entries(value || {}).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, output);
    else output[path] = String(child);
  });
  return output;
}

describe('Romanian audit', () => {
  it('has direct Romanian copy for every English catalog field', () => {
    const english = flatten(en);
    const direct = {
      ...flatten(ro),
      ...flatten({ publicSite: PUBLIC_SITE_GENERATED_LOCALES.ro }),
      ...flatten(ROMANIAN_GENERATED_OVERRIDES),
      ...flatten(ROMANIAN_ADMIN_OVERRIDES),
      ...flatten(ROMANIAN_OPERATIONS_OVERRIDES),
      ...flatten(ROMANIAN_ADMIN_LANDING_OVERRIDES),
      ...flatten(ROMANIAN_PADCOINS_OVERRIDES),
      ...flatten(ROMANIAN_ENGLISH_LEAK_OVERRIDES),
      ...flatten(ROMANIAN_POLISH_OVERRIDES),
      ...flatten(ROMANIAN_LOCALE_OVERRIDES),
    };
    const resolved = flatten(i18n.getResourceBundle('ro', 'translation'));
    const missingDirect = Object.keys(english).filter((key) => !(key in direct));
    const identicalResolved = Object.keys(english).filter((key) => resolved[key] === english[key]);
    expect(missingDirect).toEqual([]);
    expect(identicalResolved.sort()).toEqual(ROMANIAN_IDENTICAL_ALLOWLIST);
  });

  it('does not expose legal or basketball mistranslations for the playing court', () => {
    const resolved = flatten(i18n.getResourceBundle('ro', 'translation'));
    const forbidden = Object.entries(resolved)
      .filter(([, value]) => /\b(?:tribunal(?:ul|e|ele|elor)?|instan(?:ță|ţa|te|ței)|baschet)\b/iu.test(value));
    expect(forbidden).toEqual([]);
  });

  it('keeps the international Padbol Court name wherever the source uses it', () => {
    const english = flatten(en);
    const resolved = flatten(i18n.getResourceBundle('ro', 'translation'));
    const missingBrand = Object.keys(english)
      .filter((key) => english[key].includes('Padbol Court') && !resolved[key]?.includes('Padbol Court'));
    expect(missingBrand).toEqual([]);
  });
});
