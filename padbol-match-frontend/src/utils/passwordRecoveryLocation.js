export function isPasswordRecoveryLocation(locationLike) {
  const search = String(locationLike?.search || '');
  const hash = String(locationLike?.hash || '');
  try {
    if (new URLSearchParams(search).get('password_reset') === '1') return true;
  } catch {
    /* ignore malformed search */
  }
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    return params.get('type') === 'recovery';
  } catch {
    return false;
  }
}

