-- Duración variable de reservas.
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS duracion_minutos integer DEFAULT 90;

UPDATE reservas
SET duracion_minutos = COALESCE(duracion_minutos, duracion, 90)
WHERE duracion_minutos IS NULL;

ALTER TABLE reservas ALTER COLUMN duracion_minutos SET DEFAULT 90;
