-- Incentivos renovables: cada período mensual cumplido extiende un mes el beneficio.
-- Depende de 20260904150000_multisede_organizations.sql.

begin;

alter table public.sede_programas_beneficios
  add column if not exists beneficio_hasta date,
  add column if not exists racha_actual integer not null default 0,
  add column if not exists racha_maxima integer not null default 0,
  add column if not exists ultimo_periodo_cumplido date,
  add column if not exists ultimo_periodo_evaluado date;

alter table public.sede_programas_beneficios drop constraint if exists sede_programas_beneficios_rachas_check;
alter table public.sede_programas_beneficios
  add constraint sede_programas_beneficios_rachas_check
  check (racha_actual >= 0 and racha_maxima >= 0);

create or replace function public.registrar_evaluacion_beneficio(
  p_programa_id uuid,
  p_periodo date,
  p_metricas jsonb,
  p_evidencia jsonb,
  p_cumplido boolean,
  p_evaluado_por text
)
returns table (
  progreso_id uuid,
  credito_otorgado boolean,
  beneficio_hasta date,
  meses_desbloqueados integer,
  racha_actual integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programa public.sede_programas_beneficios%rowtype;
  v_progreso public.sede_beneficio_progreso%rowtype;
  v_ya_cumplido boolean := false;
  v_credito boolean := false;
  v_racha integer := 0;
begin
  select * into v_programa
  from public.sede_programas_beneficios
  where id = p_programa_id
  for update;

  if not found then
    raise exception 'Programa no encontrado';
  end if;
  if v_programa.estado <> 'activo' then
    raise exception 'El programa no está activo';
  end if;

  select * into v_progreso
  from public.sede_beneficio_progreso
  where programa_id = p_programa_id and periodo = p_periodo;
  v_ya_cumplido := found and v_progreso.estado = 'cumplido';

  insert into public.sede_beneficio_progreso (
    programa_id, periodo, metricas, evidencia, estado,
    meses_desbloqueados, evaluado_at, evaluado_por
  ) values (
    p_programa_id, p_periodo, coalesce(p_metricas, '{}'::jsonb),
    coalesce(p_evidencia, '{}'::jsonb),
    case when p_cumplido then 'cumplido' else 'no_cumplido' end,
    case when p_cumplido then 1 else 0 end, now(), p_evaluado_por
  )
  on conflict (programa_id, periodo) do update set
    metricas = excluded.metricas,
    evidencia = excluded.evidencia,
    estado = case
      when sede_beneficio_progreso.estado = 'cumplido' then 'cumplido'
      else excluded.estado
    end,
    meses_desbloqueados = greatest(sede_beneficio_progreso.meses_desbloqueados, excluded.meses_desbloqueados),
    evaluado_at = excluded.evaluado_at,
    evaluado_por = excluded.evaluado_por
  returning * into v_progreso;

  if p_cumplido and not v_ya_cumplido then
    v_racha := case
      when v_programa.ultimo_periodo_cumplido = (p_periodo - interval '1 month')::date
        then v_programa.racha_actual + 1
      else 1
    end;
    update public.sede_programas_beneficios as programa set
      meses_desbloqueados = programa.meses_desbloqueados + 1,
      beneficio_hasta = (greatest(coalesce(programa.beneficio_hasta, current_date), current_date) + interval '1 month')::date,
      racha_actual = v_racha,
      racha_maxima = greatest(programa.racha_maxima, v_racha),
      ultimo_periodo_cumplido = p_periodo,
      ultimo_periodo_evaluado = greatest(coalesce(programa.ultimo_periodo_evaluado, p_periodo), p_periodo),
      updated_at = now()
    where programa.id = p_programa_id
    returning programa.* into v_programa;
    v_credito := true;
  elsif not p_cumplido
    and not v_ya_cumplido
    and p_periodo < date_trunc('month', current_date)::date
    and (v_programa.ultimo_periodo_evaluado is null or p_periodo >= v_programa.ultimo_periodo_evaluado)
  then
    update public.sede_programas_beneficios as programa set
      racha_actual = 0,
      ultimo_periodo_evaluado = p_periodo,
      updated_at = now()
    where programa.id = p_programa_id
    returning programa.* into v_programa;
  end if;

  return query select
    v_progreso.id,
    v_credito,
    v_programa.beneficio_hasta,
    v_programa.meses_desbloqueados,
    v_programa.racha_actual;
end;
$$;

revoke all on function public.registrar_evaluacion_beneficio(uuid, date, jsonb, jsonb, boolean, text) from public, anon, authenticated;
grant execute on function public.registrar_evaluacion_beneficio(uuid, date, jsonb, jsonb, boolean, text) to service_role;

comment on function public.registrar_evaluacion_beneficio is
  'Registra una evaluación mensual de forma idempotente y concede como máximo un mes por programa y período.';

commit;
