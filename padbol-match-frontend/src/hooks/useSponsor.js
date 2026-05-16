import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { pickSponsorForContext, sponsorDateYmdLocal } from '../utils/sponsorPick';
import { sponsorRowApproved } from '../utils/hubSponsorsFilter';
import { fetchPublicSponsorsList, normalizeSponsorDeporteQueryParam } from '../utils/sponsorDeportePublic';

/**
 * Sponsor vigente más específico para la vista (torneo > sede > nacional > global).
 * @param {number|null|undefined} sedeId
 * @param {number|null|undefined} torneoId
 * @param {{ pais?: string|null, deporte?: string|null, enabled?: boolean }} [options]
 */
export function useSponsor(sedeId, torneoId, options = {}) {
  const paisOpt = options.pais != null ? String(options.pais).trim() : '';
  const deporteKey = normalizeSponsorDeporteQueryParam(options.deporte);
  const enabled = options.enabled !== false;
  const [sponsor, setSponsor] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const sedeKey = sedeId != null && Number.isFinite(Number(sedeId)) ? Number(sedeId) : null;
  const torneoKey = torneoId != null && Number.isFinite(Number(torneoId)) ? Number(torneoId) : null;

  const load = useCallback(async () => {
    if (!enabled) {
      setSponsor(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let paisEff = paisOpt || null;
      if (!paisEff && sedeKey != null) {
        const { data: sedeRow, error: sedeErr } = await supabase
          .from('sedes')
          .select('pais')
          .eq('id', sedeKey)
          .maybeSingle();
        if (sedeErr) throw sedeErr;
        paisEff = sedeRow?.pais != null ? String(sedeRow.pais).trim() : '';
      }

      const rows = await fetchPublicSponsorsList({ deporte: deporteKey });

      const ymd = sponsorDateYmdLocal();
      const activeRows = (Array.isArray(rows) ? rows : []).filter((r) => {
        if (r.activo === false) return false;
        if (!sponsorRowApproved(r)) return false;
        const desde = r.fecha_desde != null && String(r.fecha_desde).trim() !== '' ? String(r.fecha_desde).slice(0, 10) : null;
        const hasta = r.fecha_hasta != null && String(r.fecha_hasta).trim() !== '' ? String(r.fecha_hasta).slice(0, 10) : null;
        if (desde && ymd < desde) return false;
        if (hasta && ymd > hasta) return false;
        return true;
      });

      const picked = pickSponsorForContext(activeRows, {
        sedeId: sedeKey,
        torneoId: torneoKey,
        pais: paisEff || null,
      });
      setSponsor(picked);
    } catch (e) {
      setError(e?.message || String(e));
      setSponsor(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, sedeKey, torneoKey, paisOpt, deporteKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({
      sponsor,
      loading,
      error,
      reload: load,
    }),
    [sponsor, loading, error, load],
  );
}
