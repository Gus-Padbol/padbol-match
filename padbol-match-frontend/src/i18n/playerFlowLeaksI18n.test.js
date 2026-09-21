import fs from 'fs';
import path from 'path';
import i18n from './index';

const pageSource = (name) => fs.readFileSync(path.join(__dirname, '..', 'pages', name), 'utf8');

describe('Player flow translation leaks', () => {
  it('localizes class, play, failed-payment, notification and scoreboard fallbacks', () => {
    const pages = ['ClaseDetallePage.jsx', 'Jugar.jsx', 'PagoFallido.jsx', 'NotificacionesPage.jsx', 'ScoreboardControl.jsx', 'ScoreboardJoin.jsx']
      .map(pageSource)
      .join('\n');
    ['Detalle de clase', 'Del club', 'Ver más', 'El pago no se completó', 'Error de red', 'Error en la acción', 'No hay partido activo ahora']
      .forEach((literal) => expect(pages).not.toContain(literal));
  });

  it('formats notification dates with the selected language', () => {
    const source = pageSource('NotificacionesPage.jsx');
    expect(source).toContain("i18n.resolvedLanguage || i18n.language || 'en'");
    expect(source).toContain('fechaNotifLabel(n.created_at, dateLocale)');
    expect(source).not.toContain("toLocaleString('es-AR'");
  });

  it('has direct Romanian and Czech copy for the club promotion badge', () => {
    expect(i18n.getResourceBundle('ro', 'translation').jugar.fromClub).toBe('Din partea clubului');
    expect(i18n.getResourceBundle('cs', 'translation').jugar.fromClub).toBe('Od klubu');
  });
});
