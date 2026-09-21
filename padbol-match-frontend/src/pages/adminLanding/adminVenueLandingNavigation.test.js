/**
 * Evita que la landing de sedes vuelva a quedar aislada de la web pública.
 */

const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, 'AdminVenueLandingPage.jsx'), 'utf8');
const plansPage = fs.readFileSync(path.join(__dirname, 'VenuePlansPage.jsx'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, 'adminVenueLandingOverrides.css'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../../App.js'), 'utf8');
const es = require('../../i18n/locales/es.json');

describe('planes de la landing para sedes', () => {
  it('lleva los CTA comerciales de administradores a la pantalla de planes', () => {
    expect(page.match(/to="\/planes"/g)).toHaveLength(3);
    expect(app).toContain('path="/planes"');
  });

  it('no duplica el comparador comercial dentro de la landing', () => {
    expect(page).not.toMatch(/id="planes"/);
    expect(plansPage).toContain('id="planes"');
  });

  it('concentra la decisión después de los precios y evita nombres que parecen planes adicionales', () => {
    expect(plansPage).toContain('copy.faqs.map');
    expect(plansPage).toContain('copy.faqAccent');
    expect(plansPage).toContain("new Event('padbol:open-chivi')");
    expect(plansPage).toContain('{copy.talk}');
    expect(plansPage).not.toMatch(/>HABLEMOS</);
    expect(require('../../config/commercialPlans').COMMERCIAL_PLANS_PREVIEW.at(-1).ctaLabel).toBe('CONSULTAR PLAN BUSINESS');
    expect(plansPage).not.toContain('venue-plans__multisport');
    expect(plansPage).not.toContain('venue-plans__scoreboard');
    expect(plansPage).not.toContain('venue-plans__experiences');
  });

  it('no intercala una aclaración de comisión al jugador antes del beneficio para sedes Padbol', () => {
    expect(plansPage).not.toContain('venue-plans__player-fee');
    expect(plansPage).not.toContain('copy.playerFeeTitle');
    expect(plansPage).not.toContain('copy.playerFeeText');
  });

  it('destaca completas las frases principales solicitadas en español', () => {
    expect(es.adminLanding.reportsTitlePrefix).toBe('Tu sede ');
    expect(es.adminLanding.reportsTitlePrimaryAccent).toBe('no solo se mueve.');
    expect(es.adminLanding.reportsTitleContinuation).toBe('También ');
    expect(es.adminLanding.reportsTitleAccent).toBe('se entiende.');
    expect(es.adminLanding.dataTitle).toBe('Tus datos ');
    expect(es.adminLanding.dataTitleAccent).toBe('no quedan cautivos.');
    expect(es.adminLanding.closingTitle).toBe('Cada partido ');
    expect(es.adminLanding.closingTitleAccent).toBe('activa lo que sigue.');
    expect(page).toContain("language === 'es'");
  });

  it('integra la imagen sin marco rígido y anima los tres principios en secuencia', () => {
    expect(styles).toContain('radial-gradient(ellipse 82% 78% at 42% 50%');
    expect(styles).toContain('admin-data-point-sequence 3.9s');
    expect(styles).toContain('span:nth-child(2) { animation-delay: 1.3s; }');
    expect(styles).toContain('span:nth-child(3) { animation-delay: 2.6s; }');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
