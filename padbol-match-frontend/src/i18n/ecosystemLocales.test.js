import { PADBOL_LANGUAGE_CODES, canonicalPadbolLanguageCode } from '../constants/padbolLanguages';
import { ADDITIONAL_LOCALE_OVERRIDES } from './additionalLocaleOverrides';
import { PADBOL_COURT_TERM, PROTECTED_PADBOL_TERMS } from './terminology';
import en from './locales/en.json';

const leafPaths = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  return child && typeof child === 'object' && !Array.isArray(child)
    ? leafPaths(child, path)
    : [path];
});

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
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.continuity.title).toBe('Před zápasem, během něj i po něm');
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.expansion.items.eshop.status).toBe('Ve vývoji');
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.footer.language).toBe('Jazyk');
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.communityMatches.mockSlots).toContain('{{filled}}');
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.about.text).toContain('Padbol Court');
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.meta.title).toBe('Padbol Match — Platforma');
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.smartScoreboard.comingSoon).toBe('Dostupné dnes · Živě');
    expect(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite.matchIntelligence.signal.title).toContain('TRÉNINK');
  });

  it('has direct Czech copy for every public-site field', () => {
    const englishPaths = leafPaths(en.publicSite);
    const czechPaths = new Set(leafPaths(ADDITIONAL_LOCALE_OVERRIDES.cs.publicSite));
    expect(englishPaths.filter((path) => !czechPaths.has(path))).toEqual([]);
  });

  it('has direct Czech copy for account access and global navigation', () => {
    [
      'general', 'auth', 'nav', 'jugar', 'competir',
      'torneos', 'armarPartido', 'partidosAbiertos', 'checkin',
      'reservas', 'sedes', 'precios', 'pago', 'clases', 'sponsors', 'ranking', 'equipos', 'notificaciones',
      'adminLanding', 'chatbot', 'hub', 'perfil', 'perfilPublico', 'pwa', 'legal', 'landing', 'paises',
      'resenas', 'reputacion', 'campanita', 'instructor', 'profesor',
    ].forEach((section) => {
      const englishPaths = leafPaths(en[section]);
      const czechPaths = new Set(leafPaths(ADDITIONAL_LOCALE_OVERRIDES.cs[section]));
      expect(englishPaths.filter((path) => !czechPaths.has(path))).toEqual([]);
    });
  });

  it('has direct Czech copy for the foundational admin panel', () => {
    [
      'onboarding', 'role', 'panel', 'tabs', 'notifications', 'alerts', 'torneosSection',
      'weekdays', 'confirmaciones', 'overview', 'bookingsSummary', 'tournamentLabels', 'common', 'franjas', 'roles', 'reservas', 'jugadores', 'resenas', 'scoreboard', 'metrics', 'metricas', 'pushNotif', 'notif', 'profesores', 'sponsors', 'hub', 'formularios',
    ].forEach((section) => {
      const englishPaths = leafPaths(en.admin[section]);
      const czechPaths = new Set(leafPaths(ADDITIONAL_LOCALE_OVERRIDES.cs.admin[section]));
      expect(englishPaths.filter((path) => !czechPaths.has(path))).toEqual([]);
    });
    ['mi_sede', 'canchas', 'ingresos', 'productos', 'loading', 'nueva_sede', 'guardar', 'reservasLabel']
      .forEach((key) => expect(ADDITIONAL_LOCALE_OVERRIDES.cs.admin[key]).toBeTruthy());
  });

  it('protects the international Padbol Court name', () => {
    expect(PADBOL_COURT_TERM).toBe('Padbol Court');
    expect(PROTECTED_PADBOL_TERMS).toContain('Padbol Court');
  });
});
