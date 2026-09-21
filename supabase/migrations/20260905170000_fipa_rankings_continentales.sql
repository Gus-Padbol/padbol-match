-- Ranking FIPA mundial y continental. Los continentes son valores canónicos,
-- no texto libre, para que una asociación no pueda aparecer en dos rankings.
create table if not exists public.fipa_asociaciones_nacionales (
  id bigserial primary key,
  pais text not null unique,
  continente text not null check (continente in ('america', 'europa', 'oriente_medio', 'africa', 'asia', 'oceania')),
  nombre text,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jugadores_perfil
  add column if not exists asociacion_fipa_id bigint references public.fipa_asociaciones_nacionales(id);

alter table public.torneos
  add column if not exists continente_sede text,
  add column if not exists temporada_fipa integer;

alter table public.torneos
  drop constraint if exists torneos_continente_sede_check;
alter table public.torneos
  add constraint torneos_continente_sede_check
  check (continente_sede is null or continente_sede in ('america', 'europa', 'oriente_medio', 'africa', 'asia', 'oceania'));

-- La obligatoriedad se aplica a altas y ediciones nuevas. Los torneos históricos
-- quedan explícitamente pendientes de clasificación, sin inventar su continente.
create or replace function public.validar_continente_sede_torneo()
returns trigger language plpgsql as $$
begin
  if new.fecha_inicio >= current_date and new.continente_sede is null then
    raise exception 'continente_sede es obligatorio para torneos nuevos';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_torneos_continente_sede on public.torneos;
create trigger trg_torneos_continente_sede
before insert or update of fecha_inicio, continente_sede on public.torneos
for each row execute function public.validar_continente_sede_torneo();

create table if not exists public.fipa_temporadas (
  id bigserial primary key,
  anio integer not null unique check (anio between 2000 and 2200),
  estado text not null default 'borrador' check (estado in ('borrador', 'publicada', 'cerrada')),
  calendario_abre_at timestamptz,
  max_resultados_computables integer check (max_resultados_computables is null or max_resultados_computables > 0),
  plazas_regionales jsonb not null default '{}'::jsonb,
  metas_eventos_puntuables jsonb not null default '{}'::jsonb,
  ajustes_disponibilidad jsonb not null default '{}'::jsonb,
  publicada_at timestamptz,
  publicada_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fipa_ranking_excepciones_auditoria (
  id bigserial primary key,
  temporada_id bigint not null references public.fipa_temporadas(id),
  jugador_email text,
  autorizacion text not null,
  justificacion text not null,
  responsable_user_id uuid,
  responsable_email text,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Una temporada cerrada es inmutable: una corrección se registra en auditoría,
-- nunca reescribe su configuración ni recalcula sus posiciones históricas.
create or replace function public.proteger_temporada_fipa_cerrada()
returns trigger language plpgsql as $$
begin
  if old.estado = 'cerrada' then
    raise exception 'Una temporada FIPA cerrada no puede modificarse';
  end if;
  if old.estado = 'publicada' and new.estado = 'borrador' then
    raise exception 'Una temporada FIPA publicada no puede volver a borrador';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_proteger_temporada_fipa_cerrada on public.fipa_temporadas;
create trigger trg_proteger_temporada_fipa_cerrada
before update on public.fipa_temporadas
for each row execute function public.proteger_temporada_fipa_cerrada();

create index if not exists idx_jugadores_perfil_asociacion_fipa on public.jugadores_perfil(asociacion_fipa_id);
create index if not exists idx_torneos_ranking_fipa on public.torneos(estado, nivel_torneo, deporte, fecha_fin);
create index if not exists idx_fipa_asociaciones_continente on public.fipa_asociaciones_nacionales(continente);
