alter table public.sedes
  add column if not exists comision_plataforma_porcentaje numeric(6,3);

alter table public.sedes
  drop constraint if exists sedes_comision_plataforma_porcentaje_check;

alter table public.sedes
  add constraint sedes_comision_plataforma_porcentaje_check
  check (
    comision_plataforma_porcentaje is null
    or (comision_plataforma_porcentaje >= 0 and comision_plataforma_porcentaje <= 100)
  );

comment on column public.sedes.comision_plataforma_porcentaje is
  'Porcentaje contractual opcional que Padbol Match descuenta a la sede. NULL usa el valor del plan comercial.';
