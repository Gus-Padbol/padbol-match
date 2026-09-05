import fs from 'fs';
import path from 'path';
import i18n from './index';

describe('Account registration translations', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'AccesoCuenta.jsx'), 'utf8');

  it('does not hardcode Spanish accessibility labels', () => {
    ['País del jugador', 'Lateralidad para torneos', 'Nivel o categoría para torneos', 'País para torneos']
      .forEach((literal) => expect(source).not.toContain(literal));
  });

  it('localizes country labels while preserving the stored source value', () => {
    expect(source).toContain('value={`${p.bandera} ${p.nombre}`}');
    expect(source).toContain('t(paisLabelKey(p.nombre))');
    expect(i18n.getResourceBundle('ro', 'translation').paises.rumania).toBe('România');
    expect(i18n.getResourceBundle('ro', 'translation').paises.suiza).toBe('Elveția');
    expect(i18n.getResourceBundle('cs', 'translation').paises.rumania).toBe('Rumunsko');
  });

  it('uses natural Romanian registration terminology', () => {
    const auth = i18n.getResourceBundle('ro', 'translation').auth;
    expect(auth.firstName).toBe('Prenume');
    expect(auth.lastName).toBe('Nume de familie');
    expect(auth.handednessRight).toBe('Dreptaci');
    expect(auth.handednessLeft).toBe('Stângaci');
  });
});
