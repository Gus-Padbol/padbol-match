import fs from 'fs';
import path from 'path';

/** Evita regresión del botón «Filtros» en Buscar partido (filtro inline vía HubDeporteSelect). */
describe('PartidosAbiertos (Buscar partido)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'PartidosAbiertos.jsx'), 'utf8');

  it('no usa botón ni panel «Filtros»', () => {
    expect(src).not.toMatch(/showFilters/);
    expect(src).not.toMatch(/IconGeroFiltros/);
    expect(src).not.toMatch(/>\s*Filtros\s*</);
  });

  it('expone selector de deporte inline', () => {
    expect(src).toMatch(/HubDeporteSelect/);
  });
});
