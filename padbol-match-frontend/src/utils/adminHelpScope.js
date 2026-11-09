import { useEffect, useState } from 'react';

/** Read-only invalidation signals. Never used to authorize help content. */
const ROLE_STORAGE_KEY = 'user_role_data';

export function readAdminHelpScopeKey() {
  try {
    const raw = window.localStorage.getItem(ROLE_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return JSON.stringify({
      rol: data?.rol ?? null,
      sedeId: data?.sedeId ?? null,
      pais: data?.pais ?? null,
      organizacionId: data?.organizacionId ?? null,
    });
  } catch {
    return '';
  }
}

export default function useAdminHelpScopeKey() {
  const [scopeKey, setScopeKey] = useState(() => readAdminHelpScopeKey());
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    // Focus/visibility always force a server revalidation, even when the
    // cached role/scope text is identical. The API remains the only authorizer.
    const invalidate = () => {
      setScopeKey(readAdminHelpScopeKey());
      setRefreshTick((value) => value + 1);
    };
    const onStorage = (event) => { if (!event.key || event.key === ROLE_STORAGE_KEY) invalidate(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', invalidate);
    document.addEventListener('visibilitychange', invalidate);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', invalidate);
      document.removeEventListener('visibilitychange', invalidate);
    };
  }, []);
  return `${scopeKey}|${refreshTick}`;
}
