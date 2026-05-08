-- Ejecutar en Supabase SQL Editor (o migración).
-- Invitaciones para que un futuro admin de club complete el alta de sede vía enlace.

create table if not exists public.invitaciones_admin (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  pais text not null,
  nombre_club text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'completada', 'expirada', 'cancelada')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  sede_id bigint references public.sedes (id) on delete set null
);

create index if not exists idx_invitaciones_admin_token on public.invitaciones_admin (token);
create index if not exists idx_invitaciones_admin_email_estado on public.invitaciones_admin (email, estado);
create index if not exists idx_invitaciones_admin_estado_created on public.invitaciones_admin (estado, created_at desc);

comment on table public.invitaciones_admin is 'Invitaciones super_admin → futuro admin_club; token en email, validez típica 48h.';
