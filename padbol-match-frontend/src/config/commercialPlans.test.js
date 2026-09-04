import { COMMERCIAL_PLANS_PREVIEW, normalizeCommercialCatalog } from './commercialPlans';

describe('catálogo comercial V1', () => {
  it('mantiene tres planes de club y no publica Premium del jugador', () => {
    expect(COMMERCIAL_PLANS_PREVIEW.map((plan) => plan.slug)).toEqual(['starter', 'pro', 'business']);
  });

  it('normaliza solo planes válidos y conserva las funciones reales', () => {
    const plans = normalizeCommercialCatalog({ plans: [
      { slug: 'starter', name: 'Starter', features: ['Reservas', '', null] },
      { name: 'Sin slug' },
    ] });
    expect(plans).toHaveLength(1);
    expect(plans[0].features).toEqual(['Reservas']);
  });

  it('describe prestaciones concretas sin categorías comerciales ambiguas', () => {
    const copy = COMMERCIAL_PLANS_PREVIEW.flatMap((plan) => [
      plan.summary,
      plan.ctaLabel,
      ...plan.features,
    ]).join(' ');

    expect(copy).not.toMatch(/\bbásic[oa]s?\b/i);
    expect(copy).not.toMatch(/\bavanzad[oa]s?\b/i);
    expect(copy).not.toContain('sin límite configurado');
    expect(copy).not.toContain('EMPEZAR GRATIS');
    expect(copy).toContain('sin abono mensual');
    expect(copy).toContain('Creación de campañas, promociones, premios y canjes con PadCoins');
  });
});
