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

  it('ofrece un plan gratis de reservas y escala las experiencias, automatizaciones e IA', () => {
    ['Gratis', 'Start', 'Club', 'Pro', 'Sin cargo', 'Una experiencia visual a elección', 'Dos experiencias visuales a elección', 'Las cinco experiencias visuales', 'Chivi por voz y texto', 'novedades de IA', 'US$ 99', 'Mensual', 'Anual', 'Incluye', '2 meses bonificados'].forEach((value) => {
      expect(plans).toContain(value);
    });
  });

  it('no ofrece una consulta ni deriva a ningún formulario antes de habilitar el checkout', () => {
    expect(plans).not.toContain('https://wa.me/');
    expect(plans).not.toContain('Consultar este plan');
    expect(plans).not.toMatch(/to="\/contacto"/);
    expect(plans).not.toMatch(/\/unirse/);
  });
});
