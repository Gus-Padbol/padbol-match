-- Banner full-width para torneos / SponsorBannerFade (bucket sponsors/banners/).
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS banner_url text NULL;

COMMENT ON COLUMN public.sponsors.banner_url IS 'Imagen banner publicitario full-width (storage sponsors/banners/).';
