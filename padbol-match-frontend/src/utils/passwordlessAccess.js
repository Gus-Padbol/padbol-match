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
  try {
    return await auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: buildPasswordlessRedirectUrl(origin, destination),
      },
    });
  } catch (error) {
    return { error };
  }
}

export function passwordlessAccessErrorTranslationKey(error) {
  if (error?.code === 'otp_disabled') return 'auth.accessLinkRegistrationRequired';
  if (error?.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error?.code)) return 'auth.accessLinkRateLimited';
  return 'auth.accessLinkFailed';
}
