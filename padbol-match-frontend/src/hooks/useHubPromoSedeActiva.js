import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Promo activa del hub para la sede del jugador (pantalla Jugar).
 * @param {number|null|undefined} sedeId
 */
export function useHubPromoSedeActiva(sedeId) {
  const sid = sedeId != null && Number.isFinite(Number(sedeId)) ? Number(sedeId) : null;

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(Boolean(sid));
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (sid == null) {
      setRow(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('hub_promo_sede')
        .select('id,sede_id,activo,imagen_url,titulo,subtitulo,texto_boton,url_destino')
        .eq('sede_id', sid)
        .eq('activo', true)
        .maybeSingle();
      if (qErr) throw qErr;
      setRow(data && data.activo ? data : null);
    } catch (e) {
      setError(e?.message || String(e));
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [sid]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(() => ({ loading, error, row, reload: load }), [loading, error, row, load]);
}
