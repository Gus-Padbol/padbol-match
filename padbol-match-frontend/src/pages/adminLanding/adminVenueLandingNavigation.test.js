/**
 * Evita que la landing de sedes vuelva a quedar aislada de la web pública.
 */

const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, 'AdminVenueLandingPage.jsx'), 'utf8');

describe('planes de la landing para sedes', () => {
  it('lleva ambos CTA a la pantalla de planes ya existente', () => {
    expect(page.match(/to="\/unirse"/g)).toHaveLength(2);
  });

  it('no duplica el comparador comercial dentro de la landing', () => {
    expect(page).not.toMatch(/id="planes"/);
    ['Gratis', 'Start', 'Club', 'Pro', 'US$ 99'].forEach((value) => {
      expect(page).not.toContain(value);
    });
  });
});
