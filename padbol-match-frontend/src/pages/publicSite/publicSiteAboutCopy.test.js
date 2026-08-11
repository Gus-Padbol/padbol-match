const es = require('../../i18n/locales/es.json');
const en = require('../../i18n/locales/en.json');

describe('contenido público de Quiénes somos', () => {
  it.each([
    ['es', es],
    ['en', en],
  ])('incluye nombre, cita y cargos del fundador en %s', (_lang, locale) => {
    const founder = locale.publicSite.about.founder;
    expect(founder.name).toBe('Gustavo Miguens');
    expect(founder.quote).toBeTruthy();
    expect(founder.padbolRole).toBeTruthy();
    expect(founder.federationRole).toBeTruthy();
    expect(founder.matchRole).toBeTruthy();
  });

  it('describe la foto actual como retrato del fundador, no como foto de equipo', () => {
    expect(es.publicSite.about.visualAlt).toMatch(/Gustavo Miguens/);
    expect(es.publicSite.about.visualAlt).not.toMatch(/equipo reunido/i);
  });
});
