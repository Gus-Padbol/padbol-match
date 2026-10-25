/**
 * App-requested OAuth/email links use PKCE. A server-requested email link can
 * return a verified implicit fragment instead. Let the SDK consume that exact
 * callback format; it still validates the bearer with Supabase before session creation.
 * Never return, log or copy the fragment's credential values.
 */
export function authFlowForCallbackLocation(location) {
  if (location?.pathname !== '/auth/callback') return 'pkce';
  const fragment = new URLSearchParams(String(location?.hash || '').replace(/^#/, ''));
  return ['access_token','refresh_token','expires_in','token_type'].every(key=>Boolean(fragment.get(key)))
    ? 'implicit'
    : 'pkce';
}

/** Reload after consuming an implicit email link so subsequent auth starts in PKCE. */
export function navigateAfterAuth(destination, {flowType, navigate, replace = path => window.location.replace(path)}) {
  if (flowType === 'implicit') replace(destination);
  else navigate(destination, {replace:true});
}
