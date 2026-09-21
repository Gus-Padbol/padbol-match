// Padbol Match charges no commission to the player. Venue and processor fees
// are independent and must not be added by this display calculation.
export function calculatePlayerPricing(basePrice, extrasSubtotal = 0) {
  const base = Number(basePrice ?? 0);
  const extras = Number(extrasSubtotal ?? 0);
  return { base, extrasSubtotal: extras, fee: 0, total: base + extras };
}
