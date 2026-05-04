-- Costo de inscripción por equipo (0 = gratis). Opcional en UI al crear torneo.
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS costo_inscripcion numeric DEFAULT 0;
