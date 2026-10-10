-- FIPA Next Generation · operación por sede (DEV/QA candidate).
-- No contiene datos ni altera módulos existentes.

create extension if not exists pgcrypto;

create table if not exists public.ng_jornadas (
  id uuid primary key default gen_random_uuid(),
  sede_id bigint not null references public.sedes(id) on delete restrict,
  nombre text not null check (length(trim(nombre)) between 3 and 120),
  fecha_hora timestamptz not null,
  coach text not null check (length(trim(coach)) between 2 and 120),
  categoria text not null check (categoria in ('U14','U16','U18')),
  cupo integer not null check (cupo between 1 and 500),
  canchas integer not null check (canchas between 1 and 50),
  estado text not null default 'borrador' check (estado in ('borrador','publicada','cerrada')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sede_id, fecha_hora, categoria)
);

create table if not exists public.ng_jornada_inscripciones (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid not null references public.ng_jornadas(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nombre text not null check (length(trim(nombre)) between 2 and 160),
  email text,
  cancel_token_hash text unique check (cancel_token_hash is null or cancel_token_hash ~ '^[0-9a-f]{64}$'),
  estado text not null default 'confirmado' check (estado in ('confirmado','espera','cancelado')),
  asistencia text not null default 'pendiente' check (asistencia in ('pendiente','presente','ausente')),
  posicion_espera integer check (posicion_espera is null or posicion_espera > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jornada_id, user_id)
);

create unique index if not exists ng_jornada_espera_posicion_unique
  on public.ng_jornada_inscripciones(jornada_id, posicion_espera)
  where estado = 'espera';

create table if not exists public.ng_grupos_continuidad (
  id uuid primary key default gen_random_uuid(),
  sede_id bigint not null references public.sedes(id) on delete restrict,
  nombre text not null check (length(trim(nombre)) between 3 and 120),
  categoria text not null check (categoria in ('U14','U16','U18')),
  coach text not null check (length(trim(coach)) between 2 and 120),
  estado text not null default 'activo' check (estado in ('activo','cerrado')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sede_id, nombre)
);

create table if not exists public.ng_grupo_miembros (
  grupo_id uuid not null references public.ng_grupos_continuidad(id) on delete cascade,
  inscripcion_id uuid not null references public.ng_jornada_inscripciones(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (grupo_id, inscripcion_id)
);

create index if not exists ng_jornadas_sede_fecha_idx on public.ng_jornadas(sede_id, fecha_hora desc);
create index if not exists ng_inscripciones_jornada_estado_idx on public.ng_jornada_inscripciones(jornada_id, estado);
create index if not exists ng_grupos_sede_estado_idx on public.ng_grupos_continuidad(sede_id, estado);

create or replace function public.ng_puede_administrar_sede(p_sede_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and (
        ur.role = 'super_admin'
        or (ur.role in ('admin_club','empleado') and ur.sede_id = p_sede_id)
      )
  );
$$;

revoke all on function public.ng_puede_administrar_sede(bigint) from public, anon;
grant execute on function public.ng_puede_administrar_sede(bigint) to authenticated;

alter table public.ng_jornadas enable row level security;
alter table public.ng_jornada_inscripciones enable row level security;
alter table public.ng_grupos_continuidad enable row level security;
alter table public.ng_grupo_miembros enable row level security;

create policy ng_jornadas_admin_sede on public.ng_jornadas
  for all to authenticated
  using (public.ng_puede_administrar_sede(sede_id))
  with check (public.ng_puede_administrar_sede(sede_id));

create policy ng_inscripciones_admin_sede on public.ng_jornada_inscripciones
  for all to authenticated
  using (exists (select 1 from public.ng_jornadas j where j.id = jornada_id and public.ng_puede_administrar_sede(j.sede_id)))
  with check (exists (select 1 from public.ng_jornadas j where j.id = jornada_id and public.ng_puede_administrar_sede(j.sede_id)));

create policy ng_grupos_admin_sede on public.ng_grupos_continuidad
  for all to authenticated
  using (public.ng_puede_administrar_sede(sede_id))
  with check (public.ng_puede_administrar_sede(sede_id));

create policy ng_grupo_miembros_admin_sede on public.ng_grupo_miembros
  for all to authenticated
  using (exists (select 1 from public.ng_grupos_continuidad g where g.id = grupo_id and public.ng_puede_administrar_sede(g.sede_id)))
  with check (exists (select 1 from public.ng_grupos_continuidad g where g.id = grupo_id and public.ng_puede_administrar_sede(g.sede_id)));

grant select, insert, update, delete on public.ng_jornadas to authenticated;
grant select, insert, update, delete on public.ng_jornada_inscripciones to authenticated;
grant select, insert, update, delete on public.ng_grupos_continuidad to authenticated;
grant select, insert, update, delete on public.ng_grupo_miembros to authenticated;

comment on table public.ng_jornadas is 'Jornadas operativas FIPA Next Generation, aisladas por sede.';
comment on table public.ng_grupos_continuidad is 'Grupos de continuidad posteriores a jornadas FIPA Next Generation.';
