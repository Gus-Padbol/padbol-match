import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { hubSponsorsEligibles } from '../utils/hubSponsorsFilter';

/**
 * Sponsors para banda en contexto de una sede: alcance global + sede de esa sede (sin torneo ni nacional).
 * @param {number|null|undefined} sedeId
 * @param {{ enabled?: boolean }} [options]
 */
export function useSedeTickerSponsors(sedeId, options = {}) {
  const enabled = options.enabled !== false;
  const sid = sedeId != null && Number.isFinite(Number(sedeId)) ? Number(sedeId) : null;

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
      const { data, error } = await supabase
        .from('sponsors')
        .select('*')
        .eq('activo', true)
        .eq('aprobado', true);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      setSponsors(hubSponsorsEligibles(rows, { sedeId: sid, pais: '' }));
    } catch {
      setSponsors([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, sid]);

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
