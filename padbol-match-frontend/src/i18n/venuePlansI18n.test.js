import fs from 'fs';
import path from 'path';
import { venuePlansCopy } from '../pages/adminLanding/venuePlansCopy';

describe('venue plans localization', () => {
  it('provides a complete, natural Romanian commercial page', () => {
    const ro = venuePlansCopy('ro');
    expect(ro.title).toBe('Întregul tău club.');
    expect(ro.padbolOwnerTitle).toContain('Padbol Courts');
    expect(ro.plans.starter.features).toHaveLength(10);
    expect(ro.plans.pro.features).toHaveLength(9);
    expect(ro.plans.business.features).toHaveLength(7);
    expect(ro.membershipText).toMatch(/prețul.*rezervările incluse.*PadCoins/iu);
  });

  it('uses English instead of Spanish as the safe fallback for remaining editions', () => {
    expect(venuePlansCopy('de').title).toBe('Your entire club.');
    expect(venuePlansCopy('es').title).toBe('Todo tu club.');
  });

  it('provides a complete direct Czech commercial page', () => {
    const cs = venuePlansCopy('cs');
    expect(cs.title).toBe('Celý váš klub.');
    expect(cs.start).toBe('ZAČÍT BEZ PAUŠÁLU');
    expect(cs.padbolOwnerTitle).toContain('Padbol Courts');
    expect(cs.plans.starter.features).toHaveLength(10);
    expect(cs.plans.pro.features).toHaveLength(9);
    expect(cs.plans.business.features).toHaveLength(7);
  });

  it('keeps Brazilian and European Portuguese as distinct direct editions', () => {
    const brazil = venuePlansCopy('pt-BR');
    const portugal = venuePlansCopy('pt-PT');
    expect(brazil.title).toBe('Todo o seu clube.');
    expect(brazil.plans.starter.features[2]).toContain('quadras');
    expect(portugal.plans.starter.features[2]).toContain('campos');
    expect(portugal.plans.starter.features[6]).toContain('ecrã');
    expect(portugal.sports).toContain('Ténis');
    expect(portugal.devices).toContain('Telemóvel');
    expect(brazil.plans.pro.features).toHaveLength(9);
    expect(portugal.plans.business.features).toHaveLength(7);
  });

  it('keeps visible copy out of the page component', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'pages', 'adminLanding', 'VenuePlansPage.jsx'),
      'utf8',
    );
    expect(source).not.toContain('Reservas, jugadores, partidos');
    expect(source).not.toContain('BENEFICIO EXCLUSIVO PARA SEDES');
    expect(source).not.toContain('CREÁ TU PROPIA MEMBRESÍA');
  });
});
