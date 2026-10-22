-- Repair deployed eligibility contract only. No historical profiles or account deletion changes.
create table if not exists public.cuentas_elegibilidad_legal (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fecha_nacimiento date not null,
  franja_edad text not null check (franja_edad in ('under_13', 'requires_verified_parent', 'minor_16_17', 'adult')),
  estado text not null check (estado in ('bloqueada', 'habilitada_restringida', 'habilitada')),
  privacidad_reforzada boolean not null default true,
  verificado_at timestamptz not null default now(),
  fuente text not null default 'unknown',
  updated_at timestamptz not null default now()
);

alter table public.cuentas_elegibilidad_legal enable row level security;
revoke all on public.cuentas_elegibilidad_legal from public, anon, authenticated;
grant all on public.cuentas_elegibilidad_legal to service_role;
grant select on public.cuentas_elegibilidad_legal to authenticated;
do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='cuentas_elegibilidad_legal' and policyname='cuentas_elegibilidad_legal_select_own') then
create policy cuentas_elegibilidad_legal_select_own on public.cuentas_elegibilidad_legal for select to authenticated using (user_id=auth.uid()); end if; end $$;

create or replace function public.registrar_elegibilidad_cuenta_actual(p_fecha_nacimiento date, p_fuente text default 'unknown')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_uid uuid := auth.uid();
  v_age int;
  v_band text;
  v_state text;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_fecha_nacimiento is null or p_fecha_nacimiento > current_date or p_fecha_nacimiento < date '1900-01-01' then
    raise exception 'birth_date_invalid' using errcode = '22007';
  end if;
  v_age := extract(year from age(current_date, p_fecha_nacimiento));
  if v_age < 13 then v_band := 'under_13'; v_state := 'bloqueada';
  elsif v_age < 16 then v_band := 'requires_verified_parent'; v_state := 'bloqueada';
  elsif v_age < 18 then v_band := 'minor_16_17'; v_state := 'habilitada_restringida';
  else v_band := 'adult'; v_state := 'habilitada'; end if;
  insert into public.cuentas_elegibilidad_legal (user_id, fecha_nacimiento, franja_edad, estado, privacidad_reforzada, fuente)
  values (v_uid, p_fecha_nacimiento, v_band, v_state, v_age < 18, left(coalesce(p_fuente, 'unknown'), 40))
  on conflict (user_id) do update set fecha_nacimiento = excluded.fecha_nacimiento, franja_edad = excluded.franja_edad,
    estado = excluded.estado, privacidad_reforzada = excluded.privacidad_reforzada, fuente = excluded.fuente,
    verificado_at = now(), updated_at = now();
  return jsonb_build_object('age_band', v_band, 'status', v_state, 'allowed', v_state in ('habilitada', 'habilitada_restringida'));
end;
$$;

create or replace function public.estado_elegibilidad_cuenta_actual()
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce((select jsonb_build_object('age_band', franja_edad, 'status', estado,
    'allowed', estado in ('habilitada', 'habilitada_restringida'), 'enhanced_privacy', privacidad_reforzada)
    from public.cuentas_elegibilidad_legal where user_id = auth.uid()),
    jsonb_build_object('age_band', null, 'status', 'pendiente', 'allowed', false, 'enhanced_privacy', true));
$$;


revoke all on function public.registrar_elegibilidad_cuenta_actual(date,text) from public,anon;
revoke all on function public.estado_elegibilidad_cuenta_actual() from public,anon;
grant execute on function public.registrar_elegibilidad_cuenta_actual(date,text) to authenticated;
grant execute on function public.estado_elegibilidad_cuenta_actual() to authenticated;
notify pgrst, 'reload schema';
