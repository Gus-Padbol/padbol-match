import fs from 'fs';
import path from 'path';
import i18n from './index';

describe('Admin dynamic pricing translations', () => {
  it('does not leave visible Spanish literals in the time-band pricing UI', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'AdminDashboard.jsx'), 'utf8');
    [
      'Descuento máximo (%)',
      'Guardar Surge',
      'Precios por Franja Horaria',
      'Cargando franjas…',
      'Sin franjas configuradas.',
      'Todos los días',
    ].forEach((literal) => expect(source).not.toContain(literal));
  });

  it('provides natural Romanian copy for the full section', () => {
    const ro = i18n.getResourceBundle('ro', 'translation').admin.franjas;
    expect(ro.pricingTitle).toBe('Prețuri pe intervale orare');
    expect(ro.surgeExplanation).toMatch(/gradul de ocupare.*rezervărilor/iu);
    expect(ro.allDays).toBe('În fiecare zi');
    expect(ro.sunday).toBe('Duminică');
  });

  it('keeps the complete Czech catalog in sync', () => {
    const cs = i18n.getResourceBundle('cs', 'translation').admin.franjas;
    expect(cs.pricingTitle).toBe('Ceny podle časového pásma');
    expect(cs.surgeExplanation).toMatch(/obsazenosti.*rezervací/iu);
    expect(cs.allDays).toBe('Každý den');
  });
});
