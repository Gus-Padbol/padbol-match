ALTER TABLE torneos ADD COLUMN IF NOT EXISTS cupos_maximos integer;
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS horas_revelar_equipos integer DEFAULT 48;
