/**
 * Evita que la landing de sedes vuelva a quedar aislada de la web pública.
 */

const fs = require('fs');
const path = require('path');

const landing = fs.readFileSync(path.join(__dirname, 'AdminVenueLandingPage.jsx'), 'utf8');
const plans = fs.readFileSync(path.join(__dirname, 'VenuePlansPage.jsx'), 'utf8');

describe('navegación a los planes para sedes', () => {
  it('lleva los dos CTA a una página propia y nunca al formulario heredado', () => {
    expect(landing.match(/to="\/planes"/g)).toHaveLength(2);
    expect(landing).not.toMatch(/\/unirse/);
    expect(landing).not.toMatch(/href="#planes"/);
  });

  it('expone las cuatro opciones y sus modalidades de pago en la página de planes', () => {
    ['Gratis', 'Start', 'Club', 'Pro', 'US$ 99', 'Mensual', 'Anual', 'Incluye'].forEach((value) => {
      expect(plans).toContain(value);
    });
  });

  it('abre la consulta comercial por WhatsApp, sin pasar por contacto ni por el alta heredada', () => {
    expect(plans).toContain('https://wa.me/');
    expect(plans).toContain('Consultar este plan');
    expect(plans).not.toMatch(/to="\/contacto"/);
    expect(plans).not.toMatch(/\/unirse/);
  });
});
