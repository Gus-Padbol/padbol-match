import fs from 'fs';
import path from 'path';
import i18n from './index';

describe('Account deletion translations', () => {
  it('routes every visible instruction and confirmation through i18n', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'EliminarCuenta.jsx'), 'utf8');
    ['Eliminar tu cuenta', 'Qué ocurre con tus datos', '¿Solicitar la eliminación de tu cuenta?', 'Sí, eliminar mi cuenta']
      .forEach((literal) => expect(source).not.toContain(literal));
    expect(source).toContain("source: 'web'");
    expect(source).toContain('requestAccountDeletion');
  });

  it('has complete Romanian and Czech deletion instructions', () => {
    const ro = i18n.getResourceBundle('ro', 'translation').accountDeletion;
    const cs = i18n.getResourceBundle('cs', 'translation').accountDeletion;
    expect(Object.keys(ro)).toHaveLength(19);
    expect(Object.keys(cs)).toHaveLength(19);
    expect(ro.confirmMessage).toMatch(/ștergerea.*anonimizarea/iu);
    expect(cs.dataRetention).toMatch(/právními.*účetními/iu);
  });
});
