-- Supabase SQL Editor: fondo del logo en perfil público de sede
ALTER TABLE sedes ADD COLUMN IF NOT EXISTS color_fondo_logo TEXT DEFAULT '#000000';
