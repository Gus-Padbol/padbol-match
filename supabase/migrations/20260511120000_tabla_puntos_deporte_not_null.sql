-- Puntos de ranking por torneo: denormalizar deporte desde torneos para integridad y filtros defensivos.
-- Ejecutar en Supabase SQL editor o vía CLI migrate.

alter table public.tabla_puntos
  add column if not exists deporte text;

update public.tabla_puntos tp
set deporte = coalesce(
  nullif(trim(lower(t.deporte::text)), ''),
  'padbol'
)
from public.torneos t
where t.id = tp.torneo_id
  and (tp.deporte is null or trim(tp.deporte) = '');

update public.tabla_puntos
set deporte = 'padbol'
where deporte is null or trim(deporte) = '';

alter table public.tabla_puntos
  alter column deporte set default 'padbol';

alter table public.tabla_puntos
  alter column deporte set not null;

create index if not exists idx_tabla_puntos_deporte_torneo
  on public.tabla_puntos (deporte, torneo_id);
