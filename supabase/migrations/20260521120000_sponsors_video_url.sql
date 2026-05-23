-- Sponsors: soporte de video en banners (MP4 URL + tipo de media).
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS tipo_media text DEFAULT 'imagen';

ALTER TABLE public.sponsors
  DROP CONSTRAINT IF EXISTS sponsors_tipo_media_check;

ALTER TABLE public.sponsors
  ADD CONSTRAINT sponsors_tipo_media_check
  CHECK (tipo_media IN ('imagen', 'video'));

COMMENT ON COLUMN public.sponsors.video_url IS 'URL directa a MP4 para banner de video.';
COMMENT ON COLUMN public.sponsors.tipo_media IS 'imagen | video — determina qué URL usar en banners públicos.';
