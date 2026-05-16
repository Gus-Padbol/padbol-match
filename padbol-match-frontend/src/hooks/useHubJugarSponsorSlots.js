import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { normalizeHubJugarSlot } from '../constants/hubJugarSponsorSlots';

/**
 * Lee sponsor_config.id = 1, columna hub_jugar_slots (jsonb).
 * Si la columna no existe aún en la base, devuelve slots vacíos sin romper la pantalla.
 */
export function useHubJugarSponsorSlots() {
  const [slots, setSlots] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('sponsor_config').select('hub_jugar_slots').eq('id', 1).maybeSingle();
      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('hub_jugar_slots') || msg.includes('column') || error.code === '42703') {
          setSlots({});
          return;
        }
        throw error;
      }
      const raw = data?.hub_jugar_slots;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) setSlots(raw);
      else setSlots({});
    } catch {
      setSlots({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const getSlot = useCallback(
    (key) => normalizeHubJugarSlot(slots && typeof slots === 'object' ? slots[key] : null),
    [slots],
  );

  return useMemo(() => ({ loading, slots, getSlot, reload: load }), [loading, slots, getSlot, load]);
}
