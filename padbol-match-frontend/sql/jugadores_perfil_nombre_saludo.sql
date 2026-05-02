-- Saludo personalizado en hub (opcional). Ejecutar en Supabase SQL editor.
ALTER TABLE jugadores_perfil ADD COLUMN IF NOT EXISTS nombre_saludo TEXT;
