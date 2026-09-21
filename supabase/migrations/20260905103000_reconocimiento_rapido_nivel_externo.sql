-- Reconocimiento rápido de nivel externo.
-- Sólo actualiza jugadores_perfil.nivel; no escribe en tablas de ranking, puntos ni resultados.

alter table public.recorridos_externos
  add column if not exists deporte text,
  add column if not exists nivel_reclamado text,
  add column if not exists perfil_url text,
  add column if not exists aval_tipo text not null default 'ninguno',
  add column if not exists aval_nombre text,
  add column if not exists aval_contacto text,
  add column if not exists validacion_automatica boolean not null default false,
  add column if not exists aprobado_automaticamente_at timestamptz,
  add column if not exists nivel_anterior text;

alter table public.recorridos_externos
  drop constraint if exists recorridos_externos_aval_tipo_check;
alter table public.recorridos_externos
  add constraint recorridos_externos_aval_tipo_check
  check (aval_tipo in ('ninguno', 'club', 'entrenador', 'companero'));

create or replace function public.registrar_nivel_externo_automatico(
  p_user_id uuid,
  p_email text,
  p_origen text,
  p_deporte text,
  p_nivel_reclamado text,
  p_perfil_url text,
  p_aval_tipo text,
  p_aval_nombre text,
  p_aval_contacto text,
  p_categorias text[],
  p_comentario text,
  p_capturas_paths text[]
)
returns public.recorridos_externos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nivel_anterior text;
  v_solicitud public.recorridos_externos;
begin
  if coalesce(array_length(p_capturas_paths, 1), 0) not between 2 and 3 then
    raise exception 'Se requieren 2 o 3 capturas.';
  end if;

  select nivel into v_nivel_anterior
  from public.jugadores_perfil
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'No encontramos tu perfil de jugador.';
  end if;

  update public.jugadores_perfil
  set nivel = p_nivel_reclamado,
      pendiente_validacion = false
  where user_id = p_user_id;

  insert into public.recorridos_externos (
    user_id, email, origen, deporte, nivel_reclamado, perfil_url,
    aval_tipo, aval_nombre, aval_contacto, categorias, comentario, capturas_paths,
    estado, datos_reconocidos, nota_revision, validacion_automatica,
    aprobado_automaticamente_at, nivel_anterior, revisar_antes_de, revisado_at
  ) values (
    p_user_id, nullif(trim(p_email), ''), p_origen, p_deporte, p_nivel_reclamado, p_perfil_url,
    p_aval_tipo, p_aval_nombre, p_aval_contacto, p_categorias, p_comentario, p_capturas_paths,
    'aprobado',
    jsonb_build_object(
      'nivel', p_nivel_reclamado,
      'deporte', p_deporte,
      'origen', p_origen,
      'metodo', 'nivel_externo_automatico'
    ),
    'Nivel externo reconocido automáticamente: fuente, nivel declarado y 2–3 evidencias privadas recibidas.',
    true, now(), v_nivel_anterior, now(), now()
  ) returning * into v_solicitud;

  return v_solicitud;
end;
$$;

revoke all on function public.registrar_nivel_externo_automatico(
  uuid, text, text, text, text, text, text, text, text, text[], text, text[]
) from public;

comment on function public.registrar_nivel_externo_automatico is
  'Reconoce un nivel externo con evidencia privada. No modifica puntos, rankings ni resultados.';
