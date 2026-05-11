-- Campos comerciales y de ranking para torneos.
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS inscripcion_monto numeric;
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS inscripcion_moneda text;
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS premios_descripcion text;
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS puntos_total integer;
