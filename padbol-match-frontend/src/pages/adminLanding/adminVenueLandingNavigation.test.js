/**
 * Evita que la landing de sedes vuelva a quedar aislada de la web pública.
 */

const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, 'AdminVenueLandingPage.jsx'), 'utf8');
const plansPage = fs.readFileSync(path.join(__dirname, 'VenuePlansPage.jsx'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../../App.js'), 'utf8');

describe('planes de la landing para sedes', () => {
  it('lleva los CTA comerciales de administradores a la pantalla de planes', () => {
    expect(page.match(/to="\/planes"/g)).toHaveLength(3);
    expect(app).toContain('path="/planes"');
  });

  it('no duplica el comparador comercial dentro de la landing', () => {
    expect(page).not.toMatch(/id="planes"/);
    expect(plansPage).toContain('id="planes"');
  });
});
