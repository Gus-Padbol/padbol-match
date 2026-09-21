import fs from 'fs';
import path from 'path';
import i18n from './index';

describe('About Padbol Match page translations', () => {
  it('contains no visible hardcoded Spanish copy', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SobrePadbolMatch.jsx'), 'utf8');
    ['¿Qué es Padbol Match?', '¿Listo para jugar?', 'Explorar sedes', 'Términos', 'Privacidad']
      .forEach((literal) => expect(source).not.toContain(literal));
  });

  it('has polished Romanian and Czech editions', () => {
    const ro = i18n.getResourceBundle('ro', 'translation').aboutPage;
    const cs = i18n.getResourceBundle('cs', 'translation').aboutPage;
    expect(ro.title).toBe('Ce este Padbol Match?');
    expect(ro.intro).toContain('Padbol Courts');
    expect(cs.title).toBe('Co je Padbol Match?');
    expect(cs.intro).toContain('Padbol Courts');
  });
});
