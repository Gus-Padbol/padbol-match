import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { hubTickerSponsors, pickTercerTiempoSedeSponsor } from '../utils/hubSponsorsFilter';

/**
 * Sponsors del hub: card 3er tiempo (sede) + lista para banda rotativa.
 * @param {{ sedeId?: number|null, pais?: string|null, enabled?: boolean }} ctx
 */
export function useHubSponsors(ctx) {
  const enabled = ctx.enabled !== false;
  const sedeKey = ctx.sedeId != null && Number.isFinite(Number(ctx.sedeId)) ? Number(ctx.sedeId) : null;
  const paisKey = ctx.pais != null ? String(ctx.pais).trim() : '';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase.from('sponsors').select('*').eq('activo', true);
      if (qErr) throw qErr;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const tercerTiempo = useMemo(
    () => pickTercerTiempoSedeSponsor(rows, sedeKey),
    [rows, sedeKey],
  );

  const tickerList = useMemo(
    () => hubTickerSponsors(rows, { sedeId: sedeKey, pais: paisKey }, tercerTiempo?.id ?? null),
    [rows, sedeKey, paisKey, tercerTiempo?.id],
  );

  return useMemo(
    () => ({
      loading,
      error,
      reload: load,
      tercerTiempoSponsor: tercerTiempo,
      tickerSponsors: tickerList,
    }),
    [loading, error, load, tercerTiempo, tickerList],
  );
}
