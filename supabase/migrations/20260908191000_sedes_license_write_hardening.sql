-- Cierra la edición directa de los campos que definen una sede oficial.
-- Las mutaciones de licencia deben llegar por el backend con service_role.

begin;

-- La política INSERT existente admite administradores nacionales. Una cuenta
-- cliente no puede convertir ese permiso en una licencia oficial autodeclarada.
create or replace function public.proteger_alta_licencia_sede()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_role text := coalesce(auth.jwt() ->> 'role',
    current_setting('request.jwt.claim.role', true), '');
begin
  if v_request_role <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin')
     and (new.numero_licencia is not null
       or new.fecha_licencia is not null
       or new.licencia_activa is true) then
    raise exception 'La licencia oficial debe habilitarse mediante el backend autorizado'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.proteger_alta_licencia_sede() from public, anon, authenticated;
grant execute on function public.proteger_alta_licencia_sede() to service_role;
drop trigger if exists trg_sedes_proteger_alta_licencia on public.sedes;
create trigger trg_sedes_proteger_alta_licencia
before insert on public.sedes
for each row execute function public.proteger_alta_licencia_sede();

create table if not exists public.sede_licencia_auditoria (
  id bigint generated always as identity primary key,
  sede_id bigint not null references public.sedes(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text,
  old_numero_licencia text,
  new_numero_licencia text,
  old_fecha_licencia date,
  new_fecha_licencia date,
  old_licencia_activa boolean,
  new_licencia_activa boolean,
  old_tipo_licencia text,
  new_tipo_licencia text,
  changed_at timestamptz not null default now()
);

alter table public.sede_licencia_auditoria enable row level security;
alter table public.sede_licencia_auditoria force row level security;
revoke all on table public.sede_licencia_auditoria from public, anon, authenticated;
grant select, insert on table public.sede_licencia_auditoria to service_role;
grant usage, select on sequence public.sede_licencia_auditoria_id_seq to service_role;

create or replace function public.pm_auth_can_update_sede(p_sede_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.sedes s on s.id = p_sede_id
    where ur.user_id = auth.uid()
      and (
        ur.role = 'super_admin'
        or (
          ur.role = 'admin_club'
          and ur.sede_id = p_sede_id
        )
        or (
          ur.role = 'admin_nacional'
          and length(trim(coalesce(ur.pais, ''))) > 0
          and lower(trim(ur.pais)) = lower(trim(coalesce(s.pais, '')))
        )
        or (
          ur.role = 'admin_cadena'
          and ur.organizacion_id is not null
          and exists (
            select 1
            from public.organizacion_sedes os
            join public.organizaciones o on o.id = os.organizacion_id
            where os.organizacion_id = ur.organizacion_id
              and os.sede_id = p_sede_id
              and o.estado = 'activa'
          )
        )
      )
  );
$$;

revoke all on function public.pm_auth_can_update_sede(bigint) from public;
grant execute on function public.pm_auth_can_update_sede(bigint) to authenticated, service_role;

drop policy if exists "Admin edita su sede" on public.sedes;
drop policy if exists sedes_update_admin_scoped on public.sedes;
create policy sedes_update_admin_scoped on public.sedes
  for update to authenticated
  using (public.pm_auth_can_update_sede(id))
  with check (public.pm_auth_can_update_sede(id));

create or replace function public.proteger_y_auditar_licencia_sede()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_role text := coalesce(
    auth.jwt() ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  );
  v_actor_text text := nullif(current_setting('app.fipa_actor_user_id', true), '');
  v_actor_user_id uuid;
begin
  if old.numero_licencia is not distinct from new.numero_licencia
     and old.fecha_licencia is not distinct from new.fecha_licencia
     and old.licencia_activa is not distinct from new.licencia_activa
     and old.tipo_licencia is not distinct from new.tipo_licencia then
    return new;
  end if;

  if v_request_role <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Los datos de licencia sólo pueden modificarse mediante el backend autorizado'
      using errcode = '42501';
  end if;

  if v_actor_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_actor_user_id := v_actor_text::uuid;
  else
    v_actor_user_id := auth.uid();
  end if;

  insert into public.sede_licencia_auditoria (
    sede_id, actor_user_id, actor_role,
    old_numero_licencia, new_numero_licencia,
    old_fecha_licencia, new_fecha_licencia,
    old_licencia_activa, new_licencia_activa,
    old_tipo_licencia, new_tipo_licencia
  ) values (
    old.id, v_actor_user_id, nullif(v_request_role, ''),
    old.numero_licencia, new.numero_licencia,
    old.fecha_licencia, new.fecha_licencia,
    old.licencia_activa, new.licencia_activa,
    old.tipo_licencia, new.tipo_licencia
  );
  return new;
end;
$$;

revoke all on function public.proteger_y_auditar_licencia_sede() from public, anon, authenticated;
grant execute on function public.proteger_y_auditar_licencia_sede() to service_role;

drop trigger if exists trg_sedes_proteger_licencia on public.sedes;
create trigger trg_sedes_proteger_licencia
before update of numero_licencia, fecha_licencia, licencia_activa, tipo_licencia
on public.sedes
for each row execute function public.proteger_y_auditar_licencia_sede();

create or replace function public.actualizar_licencia_oficial_sede(
  p_sede_id bigint,
  p_numero_licencia text,
  p_fecha_licencia date,
  p_licencia_activa boolean,
  p_tipo_licencia text,
  p_reviewer_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sede public.sedes%rowtype;
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_reviewer_user_id and ur.role = 'super_admin'
  ) then
    raise exception 'Se requiere super_admin real' using errcode = '42501';
  end if;
  if p_licencia_activa is null then
    raise exception 'El estado de licencia es obligatorio' using errcode = '22023';
  end if;
  if p_licencia_activa and length(trim(coalesce(p_numero_licencia, ''))) = 0 then
    raise exception 'Una licencia activa requiere número' using errcode = '22023';
  end if;

  perform set_config('app.fipa_actor_user_id', p_reviewer_user_id::text, true);
  update public.sedes set
    numero_licencia = nullif(trim(p_numero_licencia), ''),
    fecha_licencia = p_fecha_licencia,
    licencia_activa = p_licencia_activa,
    tipo_licencia = coalesce(nullif(trim(p_tipo_licencia), ''), tipo_licencia),
    updated_at = now()
  where id = p_sede_id
  returning * into v_sede;
  if not found then raise no_data_found; end if;

  return jsonb_build_object(
    'id', v_sede.id,
    'numero_licencia', v_sede.numero_licencia,
    'fecha_licencia', v_sede.fecha_licencia,
    'licencia_activa', v_sede.licencia_activa,
    'tipo_licencia', v_sede.tipo_licencia
  );
end;
$$;

revoke all on function public.actualizar_licencia_oficial_sede(bigint, text, date, boolean, text, uuid)
  from public, anon, authenticated;
grant execute on function public.actualizar_licencia_oficial_sede(bigint, text, date, boolean, text, uuid)
  to service_role;

comment on function public.pm_auth_can_update_sede(bigint) is
  'Alcance por fila para editar una sede; reemplaza la política que sólo comprobaba la existencia de un rol admin.';
comment on table public.sede_licencia_auditoria is
  'Historial append-only de cambios en los campos que determinan la licencia oficial Padbol.';

commit;
