-- Igual que supabase/migrations/20260516100000_sponsor_config_hub_jugar_slots.sql

ALTER TABLE public.sponsor_config
  ADD COLUMN IF NOT EXISTS hub_jugar_slots jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.sponsor_config.hub_jugar_slots IS 'Anuncios hub /jugar (JSON).';
