-- Colores editables del hero en sede pública (Admin Mi Sede).
alter table public.sedes add column if not exists color_hero_primario text default '#4C1D95';
alter table public.sedes add column if not exists color_hero_secundario text default '#7C3AED';
alter table public.sedes add column if not exists color_borde_hero text default '#6D28D9';
