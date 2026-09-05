import i18n from './index';
import en from './locales/en.json';
import { PADBOL_LANGUAGE_CODES } from '../constants/padbolLanguages';

function flatten(value, prefix = '', output = {}) {
  Object.entries(value || {}).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, output);
    else output[path] = String(child);
  });
  return output;
}

describe('Cross-locale editorial corrections', () => {
  test.each([
    ['ar', /لقطات شاشة.*نتائجك.*بطولاتك/iu, /حملات.*الرعاة/iu],
    ['fa-IR', /اسکرین‌شات.*نتایج.*تورنمنت/iu, /کمپین.*حامیان مالی/iu],
    ['nl-BE', /screenshots.*resultaten.*toernooien/iu, /campagnes.*sponsors/iu],
    ['nl-NL', /screenshots.*resultaten.*toernooien/iu, /campagnes.*sponsors/iu],
    ['sv', /skärmbilder.*resultat.*turneringar/iu, /kampanjer.*sponsorer/iu],
    ['el', /στιγμιότυπα οθόνης.*αποτελέσματα.*τουρνουά/iu, /καμπάνιες.*χορηγών/iu],
    ['hu', /képernyőképeket.*eredményeidről.*versenyeidről/iu, /szponzori.*kampányokat/iu],
    ['he', /צילומי מסך.*התוצאות.*הטורנירים/iu, /קמפיינים.*חסות/iu],
    ['pl', /zrzuty ekranu.*wyników.*turniejów/iu, /kampanie.*sponsorów/iu],
    ['uk', /знімки екрана.*результатів.*турнірів/iu, /кампанії.*спонсорів/iu],
    ['af', /skermskote.*uitslae.*toernooie/iu, /veldtogte.*borge/iu],
    ['de', /Screenshots.*Ergebnisse.*Turniere/iu, /Kampagnen.*Sponsoren/iu],
    ['fr', /captures d'écran.*résultats.*tournois/iu, /campagnes.*sponsors/iu],
    ['it', /schermate.*risultati.*tornei/iu, /campagne.*sponsor/iu],
    ['pt-BR', /capturas de tela.*resultados.*torneios/iu, /campanhas.*patrocinadores/iu],
    ['pt-PT', /capturas.*resultados.*torneios/iu, /campanhas.*patrocinadores/iu],
  ])('%s keeps the player-record and commercial-scoreboard messages aligned', (code, recordCopy, campaigns) => {
    const resolved = flatten(i18n.getResourceBundle(code, 'translation'));
    expect(resolved['publicSite.playerRecord.copy']).toMatch(recordCopy);
    expect(resolved['publicSite.playerRecord.ownership']).toBeTruthy();
    expect(resolved['publicSite.venueAdmin.items.scoreboard.steps.2']).toMatch(campaigns);
    expect(resolved['publicSite.venueAdmin.items.scoreboard.steps.3']).toBeTruthy();
    expect(resolved['publicSite.venueAdmin.items.scoreboard.result']).toBeTruthy();
  });

  it('keeps the complete Czech player-record message in its current full edition', () => {
    const resolved = flatten(i18n.getResourceBundle('cs', 'translation'));
    expect(resolved['publicSite.playerRecord.copy']).toMatch(/snímky obrazovky.*výsledků.*turnajů/iu);
    expect(resolved['publicSite.playerRecord.ownershipStrong']).toMatch(/Nežádáme.*vzdali/iu);
  });

  it('keeps isolated Hungarian and Afrikaans public fields aligned', () => {
    const hungarian = flatten(i18n.getResourceBundle('hu', 'translation'));
    const afrikaans = flatten(i18n.getResourceBundle('af', 'translation'));
    expect(hungarian['publicSite.status.items.next.text']).toMatch(/szponzori.*hirdetési.*Padbol Match Shop/iu);
    expect(afrikaans['publicSite.hero.globe.aria']).toMatch(/spelers.*klubs.*wedstryde.*toernooie/iu);
  });

  it('does not contain severely truncated or displaced long messages in any edition', () => {
    const english = flatten(en);
    const longKeys = Object.keys(english).filter((key) => english[key].length > 90);
    const suspicious = [];
    PADBOL_LANGUAGE_CODES.filter((code) => !['en', 'es'].includes(code)).forEach((code) => {
      const resolved = flatten(i18n.getResourceBundle(code, 'translation'));
      longKeys.forEach((key) => {
        if (!resolved[key]) return;
        const ratio = resolved[key].length / english[key].length;
        if (ratio < 0.42 || ratio > 2.35) suspicious.push(`${code}:${key}`);
      });
    });
    expect(suspicious).toEqual([]);
  });
});
