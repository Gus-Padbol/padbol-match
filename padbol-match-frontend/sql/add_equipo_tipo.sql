-- Tipo de inscripción del equipo: abierto (solicitudes) | cerrado (solo invitación)
alter table if exists equipos add column if not exists tipo text;

comment on column equipos.tipo is 'abierto | cerrado (equivalente lógico a equipo_abierto)';
