import i18n from './index';
import en from './locales/en.json';
import { ADDITIONAL_LOCALE_OVERRIDES } from './additionalLocaleOverrides';
import CZECH_POLISH_OVERRIDES from './czechPolishOverrides.json';
import CZECH_IDENTICAL_ALLOWLIST from './czechIdenticalAllowlist.json';

function flatten(value, prefix = '', output = {}) {
  Object.entries(value || {}).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, output);
    else output[path] = String(child);
  });
  return output;
}

describe('Czech audit', () => {
  it('has direct Czech copy with only approved identical terms', () => {
    const english = flatten(en);
    const direct = { ...flatten(ADDITIONAL_LOCALE_OVERRIDES.cs), ...flatten(CZECH_POLISH_OVERRIDES) };
    const resolved = flatten(i18n.getResourceBundle('cs', 'translation'));
    const missingDirect = Object.keys(english).filter((key) => !(key in direct));
    const identicalResolved = Object.keys(english).filter((key) => resolved[key] === english[key]);
    expect(missingDirect).toEqual([]);
    expect(identicalResolved.sort()).toEqual(CZECH_IDENTICAL_ALLOWLIST);
  });
});
