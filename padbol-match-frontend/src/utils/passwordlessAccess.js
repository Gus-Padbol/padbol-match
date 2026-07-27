export function buildPasswordlessRedirectUrl(origin, destination = '/hub') {
  const base = String(origin || '').replace(/\/$/, '');
  const safeDestination =
    typeof destination === 'string' && destination.startsWith('/') && !destination.startsWith('//')
      ? destination
      : '/hub';
  return `${base}/auth/callback?redirect=${encodeURIComponent(safeDestination)}`;
}

export async function requestPasswordlessAccess({
  auth,
  email,
  origin,
  destination = '/hub',
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: buildPasswordlessRedirectUrl(origin, destination),
    },
  });
}
