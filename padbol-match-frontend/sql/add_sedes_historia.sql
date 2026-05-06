-- Historia / descripción larga del club (perfil público + edición Mi Sede)
ALTER TABLE sedes ADD COLUMN IF NOT EXISTS historia text;
