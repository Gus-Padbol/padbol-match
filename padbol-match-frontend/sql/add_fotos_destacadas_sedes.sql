-- Supabase SQL Editor: orden del carrusel (hasta 4 URLs de fotos_urls)
ALTER TABLE sedes ADD COLUMN IF NOT EXISTS fotos_destacadas JSONB DEFAULT '[]'::jsonb;
