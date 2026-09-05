import fs from 'fs';
import path from 'path';
import i18n from './index';

describe('Privacy policy translations', () => {
  it('keeps every privacy section and routes it through i18n', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'PoliticaPrivacidad.jsx'), 'utf8');
    ['dataTitle', 'useTitle', 'noSaleTitle', 'paymentsTitle', 'deletionTitle', 'cookiesTitle', 'gdprTitle', 'contactTitle']
      .forEach((key) => expect(source).toContain(`legal.privacyPage.${key}`));
    ['Política de Privacidad', 'Qué datos recolectamos', 'No vendemos tus datos']
      .forEach((literal) => expect(source).not.toContain(literal));
    expect(source).toContain('Mercado Pago');
    expect(source).toContain('Stripe');
    expect(source).toContain('/eliminar-cuenta');
  });

  it('preserves privacy rights in Romanian and Czech', () => {
    const ro = i18n.getResourceBundle('ro', 'translation').legal.privacyPage;
    const cs = i18n.getResourceBundle('cs', 'translation').legal.privacyPage;
    expect(Object.keys(ro)).toHaveLength(33);
    expect(Object.keys(cs)).toHaveLength(33);
    expect(ro.gdprBody).toMatch(/accesul.*rectificarea.*plângeri/iu);
    expect(cs.gdprBody).toMatch(/přístup.*opravu.*stížnost/iu);
    expect(ro.noSaleBody).toMatch(/Nu vindem.*terți/iu);
  });
});
