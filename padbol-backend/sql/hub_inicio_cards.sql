-- Pantalla de inicio del hub: 4 slots en `hub_config`.
-- `titulo` = clave del deporte (p. ej. padbol, padel); `foto_url` = imagen (CMS o subida desde Admin).
-- Equivalente lógico a JSON { deporte, foto_url } en dos columnas.
--
-- Ejecutar en Supabase si aún no existen estos `id`. Ajustá columnas (p. ej. `activo`) según tu esquema.

INSERT INTO hub_config (id, orden, titulo, subtitulo, foto_url, activo)
VALUES
  ('hub_inicio_card_1', 100, 'padbol', '', NULL, true),
  ('hub_inicio_card_2', 101, 'padel', '', NULL, true),
  ('hub_inicio_card_3', 102, 'pickleball', '', NULL, true),
  ('hub_inicio_card_4', 103, 'tenis', '', NULL, true)
ON CONFLICT (id) DO NOTHING;
