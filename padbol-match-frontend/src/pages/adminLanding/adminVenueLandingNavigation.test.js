/**
 * Evita que la landing de sedes vuelva a quedar aislada de la web pública.
 */

const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, 'AdminVenueLandingPage.jsx'), 'utf8');

describe('planes de la landing para sedes', () => {
  it('lleva el CTA de captación a los planes y nunca al formulario heredado', () => {
    expect(page.match(/href="#planes"/g)).toHaveLength(2);
    expect(page).not.toMatch(/to="\/unirse"/);
    expect(page).not.toMatch(/UnirsePage/);
  });

  it('expone las cuatro opciones comerciales antes de cualquier alta', () => {
    expect(page).toMatch(/id="planes"/);
    ['Gratis', 'Start', 'Club', 'Pro', 'US$ 99'].forEach((value) => {
      expect(page).toContain(value);
    });
  });
});
