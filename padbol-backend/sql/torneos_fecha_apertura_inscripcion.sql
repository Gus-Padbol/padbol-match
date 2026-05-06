-- Apertura automática de inscripción (cron en server.js)
ALTER TABLE torneos ADD COLUMN IF NOT EXISTS fecha_apertura_inscripcion timestamptz;
