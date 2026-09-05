-- Cadenas multisede: administración central limitada a un conjunto explícito de sedes.
-- También deja preparado (sin activar reglas) el programa de beneficios por objetivos.

begin;

create table if not exists public.organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_legal text,
  pais_principal text,
  email_contacto text,
  whatsapp_contacto text,
  plan_codigo text not null default 'business',
  limite_sedes integer not null default 1,
  limite_canchas_total integer not null default 1,
  limite_admins_centrales integer not null default 1,
  funciones_habilitadas text[] not null default array['reservas', 'torneos', 'jugadores', 'reportes']::text[],
  estado text not null default 'activa',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizaciones_nombre_check check (length(trim(nombre)) > 0),
  constraint organizaciones_estado_check check (estado in ('activa', 'pausada', 'baja')),
  constraint organizaciones_limites_check check (
    limite_sedes > 0 and limite_canchas_total > 0 and limite_admins_centrales > 0
  )
);

create table if not exists public.organizacion_sedes (
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  sede_id bigint not null references public.sedes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organizacion_id, sede_id),
  constraint organizacion_sedes_sede_unica unique (sede_id)
);

alter table public.user_roles
  add column if not exists organizacion_id uuid references public.organizaciones(id) on delete set null;

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('super_admin', 'admin_nacional', 'admin_cadena', 'admin_club', 'empleado', 'editor_contenido'));

alter table public.user_roles drop constraint if exists user_roles_alcance_check;
alter table public.user_roles
  add constraint user_roles_alcance_check
  check (alcance in ('sede', 'organizacion', 'ciudad', 'provincia', 'pais', 'global'));

alter table public.invitaciones_admin
  add column if not exists organizacion_id uuid references public.organizaciones(id) on delete set null;

alter table public.sedes_pendientes
  add column if not exists organizacion_id uuid references public.organizaciones(id) on delete set null,
  add column if not exists cantidad_canchas_solicitadas integer;

alter table public.sedes_pendientes drop constraint if exists sedes_pendientes_cantidad_canchas_solicitadas_check;
alter table public.sedes_pendientes
  add constraint sedes_pendientes_cantidad_canchas_solicitadas_check
  check (cantidad_canchas_solicitadas is null or cantidad_canchas_solicitadas > 0);

create index if not exists idx_user_roles_organizacion_id
  on public.user_roles (organizacion_id)
  where organizacion_id is not null;
create index if not exists idx_organizacion_sedes_sede_id on public.organizacion_sedes (sede_id);
create index if not exists idx_sedes_pendientes_organizacion_id
  on public.sedes_pendientes (organizacion_id)
  where organizacion_id is not null;

comment on table public.organizaciones is
  'Empresa o cadena multisede. No equivale a un administrador nacional ni amplía permisos geográficos.';
comment on table public.organizacion_sedes is
  'Lista cerrada de sedes que puede administrar una cadena multisede.';
comment on column public.user_roles.organizacion_id is
  'Organización administrada cuando role=admin_cadena y alcance=organizacion.';
comment on column public.invitaciones_admin.organizacion_id is
  'Organización asignada en una invitación de administrador central multisede.';

-- Programa comercial extensible. Las reglas quedan desactivadas hasta que la
-- organización defina mínimos, períodos consecutivos y condiciones de validez.
create table if not exists public.sede_programas_beneficios (
  id uuid primary key default gen_random_uuid(),
  sede_id bigint not null references public.sedes(id) on delete cascade,
  codigo text not null,
  estado text not null default 'borrador',
  meses_base integer not null default 0,
  meses_desbloqueados integer not null default 0,
  fecha_inicio date,
  fecha_fin_base date,
  reglas_version text,
  configuracion jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sede_id, codigo),
  constraint sede_programas_beneficios_estado_check
    check (estado in ('borrador', 'activo', 'pausado', 'finalizado')),
  constraint sede_programas_beneficios_meses_check
    check (meses_base >= 0 and meses_desbloqueados >= 0)
);

create table if not exists public.sede_beneficio_progreso (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.sede_programas_beneficios(id) on delete cascade,
  periodo date not null,
  metricas jsonb not null default '{}'::jsonb,
  evidencia jsonb not null default '{}'::jsonb,
  estado text not null default 'pendiente',
  meses_desbloqueados integer not null default 0,
  evaluado_at timestamptz,
  evaluado_por text,
  created_at timestamptz not null default now(),
  unique (programa_id, periodo),
  constraint sede_beneficio_progreso_estado_check
    check (estado in ('pendiente', 'cumplido', 'no_cumplido', 'anulado')),
  constraint sede_beneficio_progreso_meses_check check (meses_desbloqueados >= 0)
);

alter table public.organizaciones enable row level security;
alter table public.organizacion_sedes enable row level security;
alter table public.sede_programas_beneficios enable row level security;
alter table public.sede_beneficio_progreso enable row level security;

revoke all on table public.organizaciones from anon, authenticated;
revoke all on table public.organizacion_sedes from anon, authenticated;
revoke all on table public.sede_programas_beneficios from anon, authenticated;
revoke all on table public.sede_beneficio_progreso from anon, authenticated;
grant all on table public.organizaciones to service_role;
grant all on table public.organizacion_sedes to service_role;
grant all on table public.sede_programas_beneficios to service_role;
grant all on table public.sede_beneficio_progreso to service_role;

commit;
