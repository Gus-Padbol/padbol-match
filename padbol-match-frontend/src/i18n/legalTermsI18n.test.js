import fs from 'fs';
import path from 'path';
import i18n from './index';

describe('Terms and conditions translations', () => {
  it('keeps every legal section and routes its copy through i18n', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'TerminosCondiciones.jsx'), 'utf8');
    ['ownerTitle', 'whatTitle', 'useTitle', 'bookingTitle', 'tournamentsTitle', 'reportsTitle', 'liabilityTitle', 'ipTitle', 'lawTitle', 'contactTitle']
      .forEach((key) => expect(source).toContain(`legal.termsPage.${key}`));
    ['Términos y Condiciones', 'Reservas de canchas', 'Responsabilidad limitada']
      .forEach((literal) => expect(source).not.toContain(literal));
    expect(source).toContain('Entertainment and Sports Services LLC');
    expect(source).toContain('PADBOL®');
    expect(source).toContain('FIPA');
  });

  it('preserves legal concepts in Romanian and Czech', () => {
    const ro = i18n.getResourceBundle('ro', 'translation').legal.termsPage;
    const cs = i18n.getResourceBundle('cs', 'translation').legal.termsPage;
    expect(Object.keys(ro)).toHaveLength(31);
    expect(Object.keys(cs)).toHaveLength(31);
    expect(ro.bookingFee).toMatch(/3%.*Mercado Pago|Mercado Pago.*3%/iu);
    expect(ro.lawBody).toMatch(/Florida.*consumatorilor/iu);
    expect(cs.bookingFee).toMatch(/3 %.*Mercado Pago|Mercado Pago.*3 %/iu);
    expect(cs.lawBody).toMatch(/Florida.*spotřebitelů/iu);
  });
});
