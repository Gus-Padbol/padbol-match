-- Instantánea oficial FIPA independiente de las cuentas de Padbol Match.
-- Permite publicar el ranking actual sin fabricar usuarios y vincular el perfil
-- oficial cuando el deportista real completa una reclamación revisada.

create table if not exists public.fipa_jugadores_oficiales (
  id bigserial primary key,
  source_key text not null unique,
  nombre text not null,
  apellido text not null,
  pais text not null,
  continente text not null check (continente in ('america', 'europa', 'oriente_medio', 'africa', 'asia', 'oceania')),
  asociacion_fipa_id bigint references public.fipa_asociaciones_nacionales(id),
  user_id uuid unique references auth.users(id) on delete set null,
  estado_vinculacion text not null default 'no_reclamado'
    check (estado_vinculacion in ('no_reclamado', 'invitado', 'reclamacion_pendiente', 'vinculado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((estado_vinculacion = 'vinculado') = (user_id is not null))
);

create table if not exists public.fipa_ranking_instantaneas (
  id bigserial primary key,
  hash_fuente text not null unique,
  etiqueta_actualizacion text,
  fuente_url text not null,
  cantidad_jugadores integer not null check (cantidad_jugadores > 0),
  vigente boolean not null default false,
  publicada_at timestamptz,
  importado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_fipa_ranking_una_instantanea_vigente
  on public.fipa_ranking_instantaneas (vigente) where vigente;

create table if not exists public.fipa_ranking_entradas (
  id bigserial primary key,
  instantanea_id bigint not null references public.fipa_ranking_instantaneas(id) on delete restrict,
  jugador_fipa_id bigint not null references public.fipa_jugadores_oficiales(id) on delete restrict,
  posicion integer not null check (posicion > 0),
  posicion_secundaria integer,
  puntos numeric(12,3) not null check (puntos >= 0),
  puntos_fuente text not null,
  destacado boolean not null default false,
  nombre text not null,
  apellido text not null,
  pais text not null,
  continente text not null check (continente in ('america', 'europa', 'oriente_medio', 'africa', 'asia', 'oceania')),
  detalle_fuente jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (instantanea_id, jugador_fipa_id)
);

create table if not exists public.fipa_jugador_reclamaciones (
  id bigserial primary key,
  jugador_fipa_id bigint not null references public.fipa_jugadores_oficiales(id) on delete restrict,
  solicitante_user_id uuid not null references auth.users(id) on delete restrict,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  evidencia jsonb not null default '[]'::jsonb,
  justificacion text,
  revisada_por uuid references auth.users(id) on delete set null,
  revisada_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_fipa_reclamacion_pendiente_jugador
  on public.fipa_jugador_reclamaciones (jugador_fipa_id) where estado = 'pendiente';

create table if not exists public.fipa_jugador_vinculacion_auditoria (
  id bigserial primary key,
  jugador_fipa_id bigint not null references public.fipa_jugadores_oficiales(id) on delete restrict,
  reclamacion_id bigint references public.fipa_jugador_reclamaciones(id) on delete set null,
  accion text not null,
  estado_anterior text,
  estado_nuevo text,
  justificacion text not null,
  responsable_user_id uuid references auth.users(id) on delete set null,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_fipa_jugadores_continente on public.fipa_jugadores_oficiales(continente);
create index if not exists idx_fipa_ranking_entradas_posicion on public.fipa_ranking_entradas(instantanea_id, posicion);
create index if not exists idx_fipa_reclamaciones_solicitante on public.fipa_jugador_reclamaciones(solicitante_user_id, created_at desc);

alter table public.fipa_jugadores_oficiales enable row level security;
alter table public.fipa_ranking_instantaneas enable row level security;
alter table public.fipa_ranking_entradas enable row level security;
alter table public.fipa_jugador_reclamaciones enable row level security;
alter table public.fipa_jugador_vinculacion_auditoria enable row level security;

drop policy if exists fipa_jugadores_lectura_publica on public.fipa_jugadores_oficiales;
create policy fipa_jugadores_lectura_publica on public.fipa_jugadores_oficiales
  for select using (true);
drop policy if exists fipa_instantaneas_publicadas_lectura on public.fipa_ranking_instantaneas;
create policy fipa_instantaneas_publicadas_lectura on public.fipa_ranking_instantaneas
  for select using (publicada_at is not null);
drop policy if exists fipa_entradas_publicadas_lectura on public.fipa_ranking_entradas;
create policy fipa_entradas_publicadas_lectura on public.fipa_ranking_entradas
  for select using (
    exists (
      select 1 from public.fipa_ranking_instantaneas i
      where i.id = instantanea_id and i.publicada_at is not null
    )
  );
drop policy if exists fipa_reclamaciones_propias_lectura on public.fipa_jugador_reclamaciones;
create policy fipa_reclamaciones_propias_lectura on public.fipa_jugador_reclamaciones
  for select using (auth.uid() = solicitante_user_id);

-- Importación transaccional. Solo service_role puede invocarla. Una instantánea
-- ya publicada no se reescribe: cada actualización oficial genera otra.
create or replace function public.publicar_ranking_fipa_oficial(
  p_hash_fuente text,
  p_etiqueta_actualizacion text,
  p_fuente_url text,
  p_importado_por uuid,
  p_jugadores jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot_id bigint;
  v_player jsonb;
  v_player_id bigint;
  v_association_id bigint;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('publicar_ranking_fipa_oficial'));
  v_count := jsonb_array_length(coalesce(p_jugadores, '[]'::jsonb));
  if v_count < 1 then raise exception 'La instantánea FIPA no contiene jugadores'; end if;
  if coalesce(trim(p_hash_fuente), '') = '' then raise exception 'Falta hash de fuente'; end if;

  select id into v_snapshot_id
  from public.fipa_ranking_instantaneas where hash_fuente = p_hash_fuente;
  if v_snapshot_id is not null then return v_snapshot_id; end if;

  insert into public.fipa_ranking_instantaneas
    (hash_fuente, etiqueta_actualizacion, fuente_url, cantidad_jugadores, vigente, importado_por)
  values
    (p_hash_fuente, p_etiqueta_actualizacion, p_fuente_url, v_count, false, p_importado_por)
  returning id into v_snapshot_id;

  for v_player in select value from jsonb_array_elements(p_jugadores)
  loop
    if coalesce(v_player->>'source_key', '') = ''
      or coalesce(v_player->>'nombre', '') = ''
      or coalesce(v_player->>'apellido', '') = ''
      or coalesce(v_player->>'pais', '') = ''
      or (v_player->>'continente') not in ('america', 'europa', 'oriente_medio', 'africa', 'asia', 'oceania')
      or coalesce((v_player->>'posicion')::integer, 0) < 1
      or (v_player->>'puntos') is null
    then raise exception 'Fila FIPA inválida: %', v_player;
    end if;

    insert into public.fipa_asociaciones_nacionales (pais, continente, nombre)
    values (v_player->>'pais', v_player->>'continente', v_player->>'pais')
    on conflict (pais) do update set
      continente = excluded.continente,
      updated_at = now()
    returning id into v_association_id;

    insert into public.fipa_jugadores_oficiales
      (source_key, nombre, apellido, pais, continente, asociacion_fipa_id)
    values
      (v_player->>'source_key', v_player->>'nombre', v_player->>'apellido',
       v_player->>'pais', v_player->>'continente', v_association_id)
    on conflict (source_key) do update set
      nombre = excluded.nombre,
      apellido = excluded.apellido,
      pais = excluded.pais,
      continente = excluded.continente,
      asociacion_fipa_id = excluded.asociacion_fipa_id,
      updated_at = now()
    returning id into v_player_id;

    insert into public.fipa_ranking_entradas
      (instantanea_id, jugador_fipa_id, posicion, posicion_secundaria, puntos,
       puntos_fuente, destacado, nombre, apellido, pais, continente, detalle_fuente)
    values
      (v_snapshot_id, v_player_id, (v_player->>'posicion')::integer,
       nullif(v_player->>'posicion_secundaria', '')::integer,
       (v_player->>'puntos')::numeric, coalesce(v_player->>'puntos_fuente', v_player->>'puntos'),
       coalesce((v_player->>'destacado')::boolean, false), v_player->>'nombre',
       v_player->>'apellido', v_player->>'pais', v_player->>'continente',
       coalesce(v_player->'detalle', '{}'::jsonb));
  end loop;

  update public.fipa_ranking_instantaneas set vigente = false where vigente;
  update public.fipa_ranking_instantaneas
    set vigente = true, publicada_at = now() where id = v_snapshot_id;
  return v_snapshot_id;
end;
$$;

revoke all on function public.publicar_ranking_fipa_oficial(text, text, text, uuid, jsonb) from public;
revoke all on function public.publicar_ranking_fipa_oficial(text, text, text, uuid, jsonb) from anon;
revoke all on function public.publicar_ranking_fipa_oficial(text, text, text, uuid, jsonb) from authenticated;
grant execute on function public.publicar_ranking_fipa_oficial(text, text, text, uuid, jsonb) to service_role;

create or replace function public.resolver_reclamacion_jugador_fipa(
  p_reclamacion_id bigint,
  p_aprobar boolean,
  p_responsable_user_id uuid,
  p_justificacion text
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.fipa_jugador_reclamaciones;
  v_previous text;
begin
  if coalesce(trim(p_justificacion), '') = '' then
    raise exception 'La justificación es obligatoria';
  end if;
  select * into v_claim from public.fipa_jugador_reclamaciones
    where id = p_reclamacion_id for update;
  if not found then raise exception 'Reclamación inexistente'; end if;
  if v_claim.estado <> 'pendiente' then raise exception 'La reclamación ya fue resuelta'; end if;

  select estado_vinculacion into v_previous from public.fipa_jugadores_oficiales
    where id = v_claim.jugador_fipa_id for update;

  update public.fipa_jugador_reclamaciones set
    estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
    justificacion = p_justificacion,
    revisada_por = p_responsable_user_id,
    revisada_at = now()
  where id = p_reclamacion_id;

  if p_aprobar then
    update public.fipa_jugadores_oficiales set
      user_id = v_claim.solicitante_user_id,
      estado_vinculacion = 'vinculado',
      updated_at = now()
    where id = v_claim.jugador_fipa_id and user_id is null;
    if not found then raise exception 'El perfil FIPA ya está vinculado'; end if;
  else
    update public.fipa_jugadores_oficiales set
      estado_vinculacion = 'no_reclamado',
      updated_at = now()
    where id = v_claim.jugador_fipa_id and user_id is null;
  end if;

  insert into public.fipa_jugador_vinculacion_auditoria
    (jugador_fipa_id, reclamacion_id, accion, estado_anterior, estado_nuevo,
     justificacion, responsable_user_id)
  values
    (v_claim.jugador_fipa_id, v_claim.id,
     case when p_aprobar then 'vincular' else 'rechazar_reclamacion' end,
     v_previous, case when p_aprobar then 'vinculado' else 'no_reclamado' end,
     p_justificacion, p_responsable_user_id);
  return v_claim.jugador_fipa_id;
end;
$$;

revoke all on function public.resolver_reclamacion_jugador_fipa(bigint, boolean, uuid, text) from public;
revoke all on function public.resolver_reclamacion_jugador_fipa(bigint, boolean, uuid, text) from anon;
revoke all on function public.resolver_reclamacion_jugador_fipa(bigint, boolean, uuid, text) from authenticated;
grant execute on function public.resolver_reclamacion_jugador_fipa(bigint, boolean, uuid, text) to service_role;
