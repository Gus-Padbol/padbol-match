import { PADBOL_LANGUAGE_CODES, canonicalPadbolLanguageCode } from '../constants/padbolLanguages';
import { PADBOL_COURT_TERM, PROTECTED_PADBOL_TERMS } from './terminology';

const CANONICAL_ECOSYSTEM_EDITIONS = [
  'de', 'es', 'en', 'ar', 'fa-IR', 'nl-BE', 'fr', 'it', 'ro', 'nl-NL',
  'sv', 'pt-BR', 'pt-PT', 'el', 'hu', 'he', 'pl', 'uk', 'af', 'cs',
];

describe('canonical Padbol ecosystem locales', () => {
  it('offers the same 20 editions, including Czech', () => {
    expect(PADBOL_LANGUAGE_CODES).toEqual(CANONICAL_ECOSYSTEM_EDITIONS);
  });

  it('accepts Czech language aliases', () => {
    expect(canonicalPadbolLanguageCode('cs')).toBe('cs');
    expect(canonicalPadbolLanguageCode('cs-CZ')).toBe('cs');
    expect(canonicalPadbolLanguageCode('cz')).toBe('cs');
  });

  it('protects the international Padbol Court name', () => {
    expect(PADBOL_COURT_TERM).toBe('Padbol Court');
    expect(PROTECTED_PADBOL_TERMS).toContain('Padbol Court');
  });
});
