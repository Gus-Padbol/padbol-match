-- =============================================================================
-- Reseñas por sede — modelo equivalente a "reseñas_sedes" (Supabase SQL Editor).
--
-- La API y el frontend usan la tabla **public.resenas** (sin tilde; PostgREST).
-- Columnas: id (uuid), sede_id, user_id, estrellas (1–5), comentario (opcional),
-- nombre (caché de autor al insertar), created_at; una fila por (sede_id, user_id).
--
-- Si ya ejecutaste padbol-backend/sql/resenas_sedes.sql, aplicá solo la sección
-- «Migración» más abajo si hace falta.
-- =============================================================================

-- --- Creación (solo si no existe la tabla) ------------------------------------
create table if not exists public.resenas (
  id uuid primary key default gen_random_uuid(),
  sede_id integer not null references public.sedes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  estrellas integer not null check (estrellas >= 1 and estrellas <= 5),
  comentario text,
  nombre text not null default '',
  created_at timestamptz not null default now(),
  constraint resenas_sede_usuario unique (sede_id, user_id)
);

alter table public.resenas add column if not exists nombre text not null default '';

-- Comentario opcional (versiones viejas tenían NOT NULL default '')
alter table public.resenas alter column comentario drop not null;
alter table public.resenas alter column comentario drop default;

create index if not exists idx_resenas_sede_created on public.resenas (sede_id, created_at desc);

comment on table public.resenas is 'Reseñas por sede (concepto producto: reseñas_sedes). Una por jugador y sede.';
