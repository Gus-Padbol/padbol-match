import fs from 'fs';
import path from 'path';
import i18n from './index';

describe('Public venue list translations', () => {
  it('routes all visible venue-list copy through the locale catalog', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'SedesPublicas.jsx'), 'utf8');
    [
      'Reserva tu cancha',
      'Explorar sedes',
      'Clubes cerca de ti',
      'Mostrando todas las canchas',
      'Buscar por nombre, ciudad o país',
      'No hay sedes habilitadas por el momento',
      'Toca la tarjeta para ver la sede',
    ].forEach((literal) => expect(source).not.toContain(literal));
    expect(source).toContain("useSafeTranslation as useTranslation");
  });

  it('has complete Romanian venue-list copy and preserves Padbol Court', () => {
    const ro = i18n.getResourceBundle('ro', 'translation').sedes.listado;
    expect(Object.keys(ro)).toHaveLength(17);
    expect(ro.reserveTitle).toBe('Rezervă un Padbol Court');
    expect(ro.searchPlaceholder).toMatch(/nume.*oraș.*țară/iu);
    expect(ro.openVenue).toMatch(/clubul/iu);
  });

  it('has complete Czech venue-list copy', () => {
    const cs = i18n.getResourceBundle('cs', 'translation').sedes.listado;
    expect(Object.keys(cs)).toHaveLength(17);
    expect(cs.reserveTitle).toBe('Rezervovat Padbol Court');
    expect(cs.searchPlaceholder).toMatch(/názvu.*města.*země/iu);
  });
});
