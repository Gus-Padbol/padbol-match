import { PADBOL_LANGUAGE_CODES, canonicalPadbolLanguageCode } from '../constants/padbolLanguages';
import { ADDITIONAL_LOCALE_OVERRIDES } from './additionalLocaleOverrides';
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

  it('includes Czech copy beyond the language selector', () => {
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.whatIs.title).toBe('Co je Padbol Match');
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.status.title).toBe('Padbol Match přidává nové sporty');
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.playerPath.items.book.title).toBe('Rezervovat');
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.playerRecord.ownershipStrong).toBe('Vaše data patří vám.');
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.venuePath.items.scoreboard.title).toBe('Chytrá výsledková tabule');
  });

  it('protects the international Padbol Court name', () => {
    expect(PADBOL_COURT_TERM).toBe('Padbol Court');
    expect(PROTECTED_PADBOL_TERMS).toContain('Padbol Court');
  });
});
