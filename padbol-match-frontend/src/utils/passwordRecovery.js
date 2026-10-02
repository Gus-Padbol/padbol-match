export function buildPasswordRecoveryRedirectUrl(origin, destination = '/admin') {
  const base = String(origin || '').replace(/\/$/, '');
  const safeDestination =
    typeof destination === 'string' && destination.startsWith('/') && !destination.startsWith('//')
      ? destination : '/admin';
  const recoveryPath = `/auth/recovery?redirect=${encodeURIComponent(safeDestination)}`;
  return `${base}/auth/callback?redirect=${encodeURIComponent(recoveryPath)}`;
}

export async function requestPasswordRecovery({ auth, email, origin, destination = '/admin' }) {
  return auth.resetPasswordForEmail(String(email || '').trim().toLowerCase(), {
    redirectTo: buildPasswordRecoveryRedirectUrl(origin, destination),
  });
}
