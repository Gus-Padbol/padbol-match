import { useCallback, useEffect, useMemo, useState } from 'react';
import { hubTickerSponsors, pickHubCardSponsor, pickTercerTiempoSedeSponsor } from '../utils/hubSponsorsFilter';
import { fetchPublicSponsorsList, normalizeSponsorDeporteQueryParam } from '../utils/sponsorDeportePublic';

/**
 * Sponsors del hub: card 3er tiempo (sede) + lista para banda rotativa.
 * @param {{ sedeId?: number|null, pais?: string|null, deporte?: string|null, enabled?: boolean }} ctx
 */
export function useHubSponsors(ctx) {
  const enabled = ctx.enabled !== false;
  const sedeKey = ctx.sedeId != null && Number.isFinite(Number(ctx.sedeId)) ? Number(ctx.sedeId) : null;
  const paisKey = ctx.pais != null ? String(ctx.pais).trim() : '';
  const deporteKey = normalizeSponsorDeporteQueryParam(ctx.deporte);

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
      const data = await fetchPublicSponsorsList({ deporte: deporteKey });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, deporteKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const tercerTiempo = useMemo(
    () => pickTercerTiempoSedeSponsor(rows, sedeKey),
    [rows, sedeKey],
  );

  const tickerList = useMemo(() => {
    const exId = tercerTiempo?.id ?? null;
    const withExclude = hubTickerSponsors(rows, { sedeId: sedeKey, pais: paisKey }, exId);
    if (withExclude.length > 0) return withExclude;
    return hubTickerSponsors(rows, { sedeId: sedeKey, pais: paisKey });
  }, [rows, sedeKey, paisKey, tercerTiempo?.id]);

  const cardSponsor = useMemo(
    () => pickHubCardSponsor(rows, { sedeId: sedeKey, pais: paisKey }),
    [rows, sedeKey, paisKey],
  );

  return useMemo(
    () => ({
      loading,
      error,
      reload: load,
      tercerTiempoSponsor: tercerTiempo,
      tickerSponsors: tickerList,
      cardSponsor,
    }),
    [loading, error, load, tercerTiempo, tickerList, cardSponsor],
  );
}
