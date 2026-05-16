import { useCallback, useEffect, useMemo, useState } from 'react';
import { hubTickerSponsors } from '../utils/hubSponsorsFilter';
import { fetchPublicSponsorsList, normalizeSponsorDeporteQueryParam } from '../utils/sponsorDeportePublic';

/**
 * Sponsors para banda en contexto de una sede: alcance global + sede de esa sede (sin torneo ni nacional).
 * @param {number|null|undefined} sedeId
 * @param {{ enabled?: boolean, deporte?: string|null }} [options]
 */
export function useSedeTickerSponsors(sedeId, options = {}) {
  const enabled = options.enabled !== false;
  const sid = sedeId != null && Number.isFinite(Number(sedeId)) ? Number(sedeId) : null;
  const deporteKey = normalizeSponsorDeporteQueryParam(options.deporte);

  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && sid));

  const load = useCallback(async () => {
    if (!enabled || !sid) {
      setSponsors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchPublicSponsorsList({ deporte: deporteKey });
      setSponsors(hubTickerSponsors(rows, { sedeId: sid, pais: '' }));
    } catch {
      setSponsors([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, sid, deporteKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({
      sponsors,
      loading,
      reload: load,
    }),
    [sponsors, loading, load],
  );
}
