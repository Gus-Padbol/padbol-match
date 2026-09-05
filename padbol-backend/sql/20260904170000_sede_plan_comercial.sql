-- Estado comercial explícito: al terminar un beneficio sin suscripción paga,
-- la sede conserva Starter y sus datos, pero deja de tener acceso Pro.

begin;

alter table public.sedes
  add column if not exists plan_comercial text not null default 'starter';

alter table public.sedes drop constraint if exists sedes_plan_comercial_check;
alter table public.sedes
  add constraint sedes_plan_comercial_check
  check (plan_comercial in ('starter', 'pro', 'business'));

comment on column public.sedes.plan_comercial is
  'Plan efectivo de la sede. Starter nunca implica deuda ni baja de los datos.';

create or replace function public.activar_plan_pro_por_beneficio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.codigo = 'padbol_pro_renovable' and new.estado = 'activo' then
    update public.sedes
    set plan_comercial = 'pro',
        suscripcion_estado = case
          when nullif(trim(coalesce(stripe_subscription_id, '')), '') is null then 'beneficio'
          else suscripcion_estado
        end,
        updated_at = now()
    where id = new.sede_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_activar_plan_pro_por_beneficio on public.sede_programas_beneficios;
create trigger trg_activar_plan_pro_por_beneficio
after insert or update of estado, beneficio_hasta
on public.sede_programas_beneficios
for each row execute function public.activar_plan_pro_por_beneficio();

create or replace function public.reconciliar_beneficios_vencidos(p_hoy date default current_date)
returns table (programas_finalizados integer, sedes_en_starter integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programas integer := 0;
  v_sedes integer := 0;
begin
  with vencidos as (
    update public.sede_programas_beneficios
    set estado = 'finalizado', updated_at = now()
    where codigo = 'padbol_pro_renovable'
      and estado = 'activo'
      and beneficio_hasta < p_hoy
    returning sede_id
  ), candidatas as (
    select distinct sede_id from vencidos
  ), bajadas as (
    update public.sedes as sede
    set plan_comercial = 'starter',
        suscripcion_estado = 'sin_suscripcion',
        suscripcion_proximo_cobro = null,
        updated_at = now()
    from candidatas
    where sede.id = candidatas.sede_id
      and nullif(trim(coalesce(sede.stripe_subscription_id, '')), '') is null
    returning sede.id
  )
  select
    (select count(*)::integer from vencidos),
    (select count(*)::integer from bajadas)
  into v_programas, v_sedes;

  return query select v_programas, v_sedes;
end;
$$;

revoke all on function public.reconciliar_beneficios_vencidos(date) from public, anon, authenticated;
grant execute on function public.reconciliar_beneficios_vencidos(date) to service_role;

commit;
