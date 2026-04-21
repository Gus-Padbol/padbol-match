-- Ejecutar en Supabase SQL Editor (una vez) antes de usar el flujo de pago de inscripción a torneos.

alter table public.equipos
  add column if not exists inscripcion_estado text default 'pendiente';

comment on column public.equipos.inscripcion_estado is
  'pendiente = equipo creado, sin pago; confirmado = inscripción pagada vía Mercado Pago';

-- Opcional: precio por equipo en el torneo (si no existe, el frontend usa fallback 5000 ARS)
alter table public.torneos
  add column if not exists precio_inscripcion_equipo numeric default 0;
