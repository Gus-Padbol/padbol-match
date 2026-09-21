const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function assessAgeEligibility(birthDate, referenceDate = new Date()) {
  const match = ISO_DATE.exec(String(birthDate || '').trim());
  if (!match) return { allowed: false, band: 'invalid', birthDate: null };
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return { allowed: false, band: 'invalid', birthDate: null };
  const reference = new Date(referenceDate);
  let age = reference.getUTCFullYear() - year;
  if (reference.getUTCMonth() + 1 < month || (reference.getUTCMonth() + 1 === month && reference.getUTCDate() < day)) age -= 1;
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  if (age < 13) return { allowed: false, age, band: 'under_13', birthDate: normalized };
  if (age < 16) return { allowed: false, age, band: 'requires_verified_parent', birthDate: normalized };
  return { allowed: true, age, band: age < 18 ? 'minor_16_17' : 'adult', birthDate: normalized };
}
