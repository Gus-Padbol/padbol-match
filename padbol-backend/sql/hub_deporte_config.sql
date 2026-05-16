-- Hub: fotos y textos por deporte y card (Reservar / Buscar partido / Torneos / Armar partido).
-- No reemplaza la tabla legacy `hub_config` (CMS por id texto + orden); conviven.
-- Ejecutar en Supabase SQL Editor o como migración.
--
-- Si las fotos de un deporte pisaban a otro, puede haber existido UNIQUE errónea solo en card_key:
-- ver `hub_deporte_config_fix_unique_deporte_card.sql`.

CREATE TABLE IF NOT EXISTS hub_deporte_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deporte text NOT NULL,
  card_key text NOT NULL,
  imagen_url text,
  titulo text,
  subtitulo text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (deporte, card_key)
);

CREATE INDEX IF NOT EXISTS idx_hub_deporte_config_deporte ON hub_deporte_config (deporte);
