const LEGACY_PLAYER_DESCRIPTION = 'Monthly plan for players with access to bookings, competitions, and exclusive club benefits.';
const SPANISH_PLAYER_DESCRIPTION = 'Plan mensual para jugadores con acceso a reservas, competiciones y beneficios exclusivos del club.';

// Presentation only: keep the stored plan and its edit payload unchanged.
export function membershipPlanDescription(description, language) {
  const spanish = /^es(?:[-_]|$)/i.test(String(language || ''));
  return spanish && description === LEGACY_PLAYER_DESCRIPTION
    ? SPANISH_PLAYER_DESCRIPTION
    : description;
}
