-- Columna opcional para apellido (nombre legal en `nombre`).
ALTER TABLE jugadores_perfil ADD COLUMN IF NOT EXISTS apellido TEXT;
