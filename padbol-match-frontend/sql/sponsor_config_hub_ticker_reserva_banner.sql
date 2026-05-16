-- Igual que supabase/migrations/20260516120000_sponsor_config_hub_ticker_reserva_banner.sql

ALTER TABLE public.sponsor_config
  ADD COLUMN IF NOT EXISTS hub_jugar_ticker jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sponsor_config
  ADD COLUMN IF NOT EXISTS hub_reserva_banner_paso3 jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.sponsor_config.hub_jugar_ticker IS 'Array de sponsors hub /jugar.';
COMMENT ON COLUMN public.sponsor_config.hub_reserva_banner_paso3 IS 'Banner checkout paso 3 reserva.';
