import { useEffect, useState } from 'react';
import { CHIVI_AVATAR_DEFAULT_SRC, HUB_CHIVI_CONFIG_ID } from '../constants/hubChiviConfig';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

/**
 * URL del avatar de Chivi (hub_config.chivi_imagen_url o foto_url en fila hub_chivi).
 * @returns {{ avatarUrl: string, loading: boolean }}
 */
export function useHubChiviAvatar() {
  const [avatarUrl, setAvatarUrl] = useState(CHIVI_AVATAR_DEFAULT_SRC);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/hub-config`);
        const data = await res.json().catch(() => []);
        if (cancelled || !res.ok || !Array.isArray(data)) return;
        const row = data.find((r) => String(r?.id || '').trim() === HUB_CHIVI_CONFIG_ID);
        const custom = String(row?.chivi_imagen_url || row?.foto_url || '').trim();
        if (custom) setAvatarUrl(custom);
        else setAvatarUrl(CHIVI_AVATAR_DEFAULT_SRC);
      } catch {
        if (!cancelled) setAvatarUrl(CHIVI_AVATAR_DEFAULT_SRC);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { avatarUrl, loading };
}
