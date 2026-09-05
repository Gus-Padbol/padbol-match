import i18n from './index';

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
});
