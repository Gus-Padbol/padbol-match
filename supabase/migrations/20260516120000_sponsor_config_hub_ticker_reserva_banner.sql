-- Ticker de sponsors en hub /jugar (array JSON) y banner paso 3 reserva (objeto JSON).

ALTER TABLE public.sponsor_config
  ADD COLUMN IF NOT EXISTS hub_jugar_ticker jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sponsor_config
  ADD COLUMN IF NOT EXISTS hub_reserva_banner_paso3 jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.sponsor_config.hub_jugar_ticker IS 'Array de sponsors hub /jugar: { nombre, imagen_url?, url_destino? }.';
COMMENT ON COLUMN public.sponsor_config.hub_reserva_banner_paso3 IS 'Banner checkout paso 3: { imagen_url, titulo, descripcion, url_destino }.';
