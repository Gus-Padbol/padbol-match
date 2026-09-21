import {
  COMMERCIAL_PLANS_PREVIEW,
  PADBOL_COURTS_PRO_DISCOUNT_PERCENT,
  PADBOL_COURTS_VENUE_SERVICE_PERCENT,
  PADBOL_COURTS_PRO_MONTHLY_AMOUNT_USD,
  PADBOL_COURTS_PRO_OBJECTIVES_DISCOUNT_PERCENT,
  PADBOL_COURTS_PRO_OBJECTIVES_MONTHLY_AMOUNT_USD,
  PRO_MONTHLY_AMOUNT_USD,
  normalizeCommercialCatalog,
} from './commercialPlans';

describe('catálogo comercial V1', () => {
  it('mantiene tres planes de club y no publica Premium del jugador', () => {
    expect(COMMERCIAL_PLANS_PREVIEW.map((plan) => plan.slug)).toEqual(['starter', 'pro', 'business']);
  });

  it('mantiene Pro a USD 68 y deriva descuentos sucesivos a USD 34 y USD 17', () => {
    const pro = COMMERCIAL_PLANS_PREVIEW.find((plan) => plan.slug === 'pro');

    expect(PRO_MONTHLY_AMOUNT_USD).toBe(68);
    expect(PADBOL_COURTS_PRO_DISCOUNT_PERCENT).toBe(50);
    expect(PADBOL_COURTS_PRO_MONTHLY_AMOUNT_USD).toBe(34);
    expect(pro).toMatchObject({
      monthlyAmount: 68,
      annualAmount: 680,
      padbolCourtsBenefit: { monthlyAmount: 34, discountPercent: 50 },
    });
    expect(pro.padbolCourtsBenefit.monthlyAmount).toBe(pro.monthlyAmount / 2);
    expect(PADBOL_COURTS_VENUE_SERVICE_PERCENT).toBe(0);
    expect(pro.commissionPercent).toBe(0.65);
    expect(COMMERCIAL_PLANS_PREVIEW.find((plan) => plan.slug === 'starter').commissionPercent).toBe(1);
    expect(PADBOL_COURTS_PRO_OBJECTIVES_DISCOUNT_PERCENT).toBe(50);
    expect(PADBOL_COURTS_PRO_OBJECTIVES_MONTHLY_AMOUNT_USD).toBe(17);
    expect(PADBOL_COURTS_PRO_OBJECTIVES_MONTHLY_AMOUNT_USD).toBe(
      PADBOL_COURTS_PRO_MONTHLY_AMOUNT_USD * (1 - PADBOL_COURTS_PRO_OBJECTIVES_DISCOUNT_PERCENT / 100),
    );
    expect(PADBOL_COURTS_PRO_OBJECTIVES_MONTHLY_AMOUNT_USD).toBe(PRO_MONTHLY_AMOUNT_USD / 4);
  });

  it('mantiene los CTA como solicitudes sin rutas de pago o checkout', () => {
    expect(COMMERCIAL_PLANS_PREVIEW.map((plan) => plan.ctaPath).join(' ')).not.toMatch(/checkout|pago|payment/i);
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
