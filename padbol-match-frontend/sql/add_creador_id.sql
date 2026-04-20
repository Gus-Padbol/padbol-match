-- Identidad local del creador (sin depender solo de email)
alter table if exists equipos add column if not exists creador_id text;

comment on column equipos.creador_id is 'UUID del usuario local (padbolUsuarioBasico) que creó el equipo';
