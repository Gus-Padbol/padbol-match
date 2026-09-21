-- Invitaciones privadas para vincular perfiles oficiales FIPA existentes.
-- El contacto y el token nunca forman parte de las tablas públicas del ranking.

create table if not exists public.fipa_jugador_invitaciones (
  id uuid primary key default gen_random_uuid(),
  jugador_fipa_id bigint not null references public.fipa_jugadores_oficiales(id) on delete restrict,
  destino_tipo text not null check (destino_tipo in ('email', 'whatsapp')),
  destino_valor text not null,
  token_hash text not null unique,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'usada', 'cancelada', 'vencida')),
  vence_at timestamptz not null,
  creada_por uuid references auth.users(id) on delete set null,
  usada_por uuid references auth.users(id) on delete set null,
  usada_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_fipa_invitacion_activa_jugador
  on public.fipa_jugador_invitaciones (jugador_fipa_id)
  where estado = 'pendiente';

create index if not exists idx_fipa_invitaciones_estado_vence
  on public.fipa_jugador_invitaciones (estado, vence_at);

alter table public.fipa_jugador_invitaciones enable row level security;

-- No se crea ninguna política pública: solo el backend con service_role accede
-- a contactos y hashes. La API nunca devuelve destino_valor en rutas públicas.

create or replace function public.aceptar_invitacion_jugador_fipa(
  p_token_hash text,
  p_user_id uuid
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.fipa_jugador_invitaciones;
  v_previous text;
begin
  if p_user_id is null or coalesce(trim(p_token_hash), '') = '' then
    raise exception 'Invitación inválida';
  end if;

  select * into v_inv
  from public.fipa_jugador_invitaciones
  where token_hash = p_token_hash
  for update;

  if not found then raise exception 'Invitación inexistente'; end if;
  if v_inv.estado <> 'pendiente' then raise exception 'La invitación ya no está disponible'; end if;
  if v_inv.vence_at <= now() then
    update public.fipa_jugador_invitaciones set estado = 'vencida' where id = v_inv.id;
    raise exception 'La invitación venció';
  end if;

  select estado_vinculacion into v_previous
  from public.fipa_jugadores_oficiales
  where id = v_inv.jugador_fipa_id
  for update;

  update public.fipa_jugadores_oficiales set
    user_id = p_user_id,
    estado_vinculacion = 'vinculado',
    updated_at = now()
  where id = v_inv.jugador_fipa_id and user_id is null;
  if not found then raise exception 'El perfil FIPA ya está vinculado'; end if;

  update public.fipa_jugador_invitaciones set
    estado = 'usada',
    usada_por = p_user_id,
    usada_at = now()
  where id = v_inv.id;

  insert into public.fipa_jugador_vinculacion_auditoria
    (jugador_fipa_id, accion, estado_anterior, estado_nuevo,
     justificacion, responsable_user_id, detalle)
  values
    (v_inv.jugador_fipa_id, 'aceptar_invitacion', v_previous, 'vinculado',
     'Vinculación aceptada mediante invitación oficial FIPA', p_user_id,
     jsonb_build_object('invitacion_id', v_inv.id));

  return v_inv.jugador_fipa_id;
end;
$$;

revoke all on function public.aceptar_invitacion_jugador_fipa(text, uuid) from public;
revoke all on function public.aceptar_invitacion_jugador_fipa(text, uuid) from anon;
revoke all on function public.aceptar_invitacion_jugador_fipa(text, uuid) from authenticated;
grant execute on function public.aceptar_invitacion_jugador_fipa(text, uuid) to service_role;

grant all on table public.fipa_jugador_invitaciones to service_role;

