import { useEffect, useState } from 'react';
import { fetchActivePadcoinsCampaignForSede } from '../utils/padcoinsCampaignsPlayer';

/**
 * Carga campaña PadCoins activa para una sede sin bloquear el flujo si falla.
 */
export function usePadcoinsActiveCampaign(sedeId, {
  apiBaseUrl,
  accessToken = null,
  enabled = true,
} = {}) {
  const [campaign, setCampaign] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setCampaign(null);
      return undefined;
    }

    const sid = Number.parseInt(String(sedeId ?? '').trim(), 10);
    if (!Number.isFinite(sid) || sid <= 0 || !apiBaseUrl) {
      setCampaign(null);
      return undefined;
    }

    let cancelled = false;
    void fetchActivePadcoinsCampaignForSede(sid, { apiBaseUrl, accessToken })
      .then((parsed) => {
        if (!cancelled) setCampaign(parsed);
      })
      .catch(() => {
        if (!cancelled) setCampaign(null);
      });

    return () => {
      cancelled = true;
    };
  }, [sedeId, apiBaseUrl, accessToken, enabled]);

  return { campaign };
}
