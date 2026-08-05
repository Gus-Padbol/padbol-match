/**
 * Evita que la landing de sedes vuelva a quedar aislada de la web pública.
 */

const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, 'AdminVenueLandingPage.jsx'), 'utf8');

describe('navegación de la landing para sedes', () => {
  it('ofrece rutas claras para regresar y recorrer Padbol Match', () => {
    expect(page).toMatch(/Navegación principal de Padbol Match/);
    expect(page).toMatch(/to="\/plataforma">Inicio/);
    expect(page).toMatch(/to="\/plataforma#jugadores">Para jugadores/);
    expect(page).toMatch(/Para sedes/);
    expect(page).toMatch(/to="\/contacto">Contacto/);
  });

  it('anticipa que cada módulo abre una explicación con sus opciones', () => {
    expect(page).toMatch(/Ver explicación y opciones/);
    expect(page).toMatch(/onMouseEnter=\{\(\) => openModule\(module\)\}/);
    expect(page).not.toMatch(/manual-administradores\.pdf/);
    expect(page).not.toMatch(/Descargar guía PDF/);
  });
});
