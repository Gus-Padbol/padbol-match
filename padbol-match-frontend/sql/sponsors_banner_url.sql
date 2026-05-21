-- Igual que supabase/migrations/20260520140000_sponsors_banner_url.sql
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS banner_url text NULL;

COMMENT ON COLUMN public.sponsors.banner_url IS 'Banner publicitario full-width (sponsors/banners/).';
