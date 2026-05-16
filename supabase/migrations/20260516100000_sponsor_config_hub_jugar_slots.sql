-- Slots publicitarios del hub /jugar (JSONB en sponsor_config fila id=1).
-- Claves esperadas en hub_jugar_slots (objeto JSON): hub_jugar_banner_top, hub_jugar_overlay_reservar,
-- hub_jugar_overlay_buscar, hub_jugar_overlay_armar, hub_jugar_strip, hub_jugar_card_ad, hub_jugar_confirmacion_banner.
-- Cada valor: { "imagen_url": "...", "url_destino": "...", "texto_corto": "..." } (campos opcionales).

ALTER TABLE public.sponsor_config
  ADD COLUMN IF NOT EXISTS hub_jugar_slots jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.sponsor_config.hub_jugar_slots IS 'Anuncios hub /jugar: claves hub_jugar_* con imagen_url, url_destino, texto_corto.';
