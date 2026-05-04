-- Apodo para saludo en app (ej. "Gus"); opcional.
ALTER TABLE jugadores_perfil
  ADD COLUMN IF NOT EXISTS apodo text;

COMMENT ON COLUMN jugadores_perfil.apodo IS 'Nombre informal para saludo en la app; si vacío se usa nombre legal.';
