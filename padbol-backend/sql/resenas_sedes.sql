-- =============================================================================
-- Reseñas de sede en Supabase / PostgREST.
--
-- La tabla expuesta en la API es: public.resenas
-- (no existe public.sede_resenas en este proyecto; el backend usa .from('resenas')).
--
-- Ejecutar en Supabase → SQL Editor. Idempotente (IF NOT EXISTS / ADD COLUMN).
-- =============================================================================

-- Tabla nueva (solo si aún no existe)
create table if not exists public.resenas (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references public.sedes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null default '',
  estrellas integer not null check (estrellas >= 1 and estrellas <= 5),
  comentario text not null default '',
  created_at timestamptz not null default now(),
  constraint resenas_sede_usuario unique (sede_id, user_id)
);

-- Si la tabla ya existía sin columna nombre (migración desde versión anterior)
alter table public.resenas add column if not exists nombre text not null default '';

-- Índice para listados por sede (más recientes primero)
create index if not exists idx_resenas_sede_created on public.resenas (sede_id, created_at desc);

comment on table public.resenas is 'Reseñas por sede; una fila por (sede_id, user_id). Expuesta en PostgREST como resenas.';
