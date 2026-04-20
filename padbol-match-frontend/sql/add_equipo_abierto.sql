-- Ejecutar en Supabase SQL editor (una vez).
-- null = equipos antiguos (siguen aceptando solicitudes como hasta ahora).
-- false = cerrado (solo el creador suma jugadores).
-- true = abierto (etiquetas + solicitudes para unirse).

alter table equipos
  add column if not exists equipo_abierto boolean default null;

comment on column equipos.equipo_abierto is 'null legacy acepta solicitudes; false cerrado; true abierto';
