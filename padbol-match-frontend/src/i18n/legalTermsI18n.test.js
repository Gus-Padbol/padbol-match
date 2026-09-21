import fs from 'fs';
import path from 'path';
import i18n from './index';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_ENTITY,
  LEGAL_REGISTERED_ADDRESS,
} from '../constants/legalIdentity';

describe('Terms and conditions translations', () => {
  it('keeps every legal section and routes its copy through i18n', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'TerminosCondiciones.jsx'), 'utf8');
    ['ownerTitle', 'whatTitle', 'useTitle', 'bookingTitle', 'tournamentsTitle', 'reportsTitle', 'liabilityTitle', 'ipTitle', 'lawTitle', 'contactTitle']
      .forEach((key) => expect(source).toContain(`legal.termsPage.${key}`));
    ['Términos y Condiciones', 'Reservas de canchas', 'Responsabilidad limitada']
      .forEach((literal) => expect(source).not.toContain(literal));
    expect(source).toContain('LEGAL_ENTITY');
    expect(source).toContain('LEGAL_REGISTERED_ADDRESS');
    expect(source).toContain('LEGAL_CONTACT_EMAIL');
    expect(LEGAL_ENTITY).toBe('ENTERTAINMENT SPORT SERVICE LLC');
    expect(LEGAL_REGISTERED_ADDRESS).toBe('30 N Gould St Ste R, Sheridan, WY 82801, USA');
    expect(LEGAL_CONTACT_EMAIL).toBe('padbolmatch@padbol.com');
    expect(source).toContain('PADBOL®');
    expect(source).toContain('FIPA');
  });

  it('preserves legal concepts in Romanian and Czech', () => {
    const ro = i18n.getResourceBundle('ro', 'translation').legal.termsPage;
    const cs = i18n.getResourceBundle('cs', 'translation').legal.termsPage;
    expect(Object.keys(ro)).toHaveLength(31);
    expect(Object.keys(cs)).toHaveLength(31);
    expect(ro.bookingFee).toMatch(/0%.*Padbol Match|Padbol Match.*0%/iu);
    expect(ro.bookingFee).not.toMatch(/3%/u);
    expect(ro.lawBody).toMatch(/Wyoming.*consumatorilor/iu);
    expect(cs.bookingFee).toMatch(/0 %.*Padbol Match|Padbol Match.*0 %/iu);
    expect(cs.bookingFee).not.toMatch(/3 %/u);
    expect(cs.lawBody).toMatch(/Wyoming.*spotřebitelů/iu);
  });
});
