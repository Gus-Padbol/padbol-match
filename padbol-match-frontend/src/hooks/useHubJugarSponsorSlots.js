import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  normalizeHubJugarSlot,
  normalizeHubJugarTickerList,
  normalizeReservaBannerPaso3,
} from '../constants/hubJugarSponsorSlots';

/**
 * Lee sponsor_config.id = 1: hub_jugar_slots, hub_jugar_ticker, hub_reserva_banner_paso3.
 * Si alguna columna no existe aún, hace fallback solo a hub_jugar_slots.
 */
export function useHubJugarSponsorSlots() {
  const [slots, setSlots] = useState({});
  const [tickerItems, setTickerItems] = useState([]);
  const [reservaBannerPaso3, setReservaBannerPaso3] = useState(() => normalizeReservaBannerPaso3(null));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fullSelect =
        'hub_jugar_slots, hub_jugar_ticker, hub_reserva_banner_paso3';
      let { data, error } = await supabase
        .from('sponsor_config')
        .select(fullSelect)
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (
          msg.includes('hub_jugar_ticker') ||
          msg.includes('hub_reserva_banner') ||
          msg.includes('column') ||
          error.code === '42703'
        ) {
          const r2 = await supabase
            .from('sponsor_config')
            .select('hub_jugar_slots')
            .eq('id', 1)
            .maybeSingle();
          if (r2.error) {
            const m2 = String(r2.error.message || '').toLowerCase();
            if (m2.includes('hub_jugar_slots') || m2.includes('column') || r2.error.code === '42703') {
              setSlots({});
              setTickerItems([]);
              setReservaBannerPaso3(normalizeReservaBannerPaso3(null));
              return;
            }
            throw r2.error;
          }
          const rawSlots = r2.data?.hub_jugar_slots;
          if (rawSlots && typeof rawSlots === 'object' && !Array.isArray(rawSlots)) setSlots(rawSlots);
          else setSlots({});
          setTickerItems([]);
          setReservaBannerPaso3(normalizeReservaBannerPaso3(null));
          return;
        }
        throw error;
      }

      const rawSlots = data?.hub_jugar_slots;
      if (rawSlots && typeof rawSlots === 'object' && !Array.isArray(rawSlots)) setSlots(rawSlots);
      else setSlots({});

      setTickerItems(normalizeHubJugarTickerList(data?.hub_jugar_ticker));
      setReservaBannerPaso3(normalizeReservaBannerPaso3(data?.hub_reserva_banner_paso3));
    } catch {
      setSlots({});
      setTickerItems([]);
      setReservaBannerPaso3(normalizeReservaBannerPaso3(null));
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

  return useMemo(
    () => ({
      loading,
      slots,
      tickerItems,
      reservaBannerPaso3,
      getSlot,
      reload: load,
    }),
    [loading, slots, tickerItems, reservaBannerPaso3, getSlot, load],
  );
}
