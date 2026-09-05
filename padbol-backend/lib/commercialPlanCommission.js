const DEFAULT_PERCENT_BY_PLAN = Object.freeze({
  starter: 1,
  pro: 0.65,
  business: 0.35,
});

export function commercialCommissionPercent(planRaw, customPercentRaw = null) {
  const custom = Number(customPercentRaw);
  if (customPercentRaw != null && customPercentRaw !== '' && Number.isFinite(custom) && custom >= 0 && custom <= 100) {
    return custom;
  }
  const plan = String(planRaw || 'starter').trim().toLowerCase();
  return DEFAULT_PERCENT_BY_PLAN[plan] ?? DEFAULT_PERCENT_BY_PLAN.starter;
}

export function commercialCommissionMinor(amountMinorRaw, planRaw, customPercentRaw = null) {
  const amount = Number(amountMinorRaw);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.max(0, Math.min(Math.round(amount), Math.round(amount * commercialCommissionPercent(planRaw, customPercentRaw) / 100)));
}
