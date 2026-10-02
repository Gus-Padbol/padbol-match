-- ════════════════════════════════════════════════════════════════════════════════════════
-- CRM de WhatsApp · PENDIENTES TÉCNICOS AUTORIZADOS · MIGRACIÓN CANDIDATA (NO APLICADA)
-- ════════════════════════════════════════════════════════════════════════════════════════
--
-- SÓLO PostgreSQL LOCAL DESCARTABLE. No se aplica en QA ni en producción.
-- Se aplica DESPUÉS de `whatsapp_crm_consent_candidate.sql` (que a su vez va después de la
-- candidata base y de la de endurecimiento). No modifica esos archivos: los REDEFINE.
-- Idempotente: puede correr varias veces sin efectos adicionales.
--
-- Arregla los defectos D2, D8, D9, D11, D12 y D13 del informe
-- `/private/tmp/whatsapp-crm-backend-qa/INFORME_CRM_BACKEND.md` §4.2.
-- D7 no se toca (documentado y correcto). D10 ya está corregido por la candidata de
-- consentimiento (verificado: el entrante internacional queda `tel:<canónico>`).
--
-- No habilita envíos, no toca el outbox como cola, no activa flags, no crea usuarios.
-- `CRM_DISPATCH_ALLOWED` sigue en false: este archivo NO envía ni reintenta nada.
--
-- ORDEN DEL ARCHIVO: primero las funciones y objetos, los permisos AL FINAL, para que ningún
-- REVOKE/GRANT referencie algo que todavía no existe (mismo criterio que el endurecimiento).
-- ════════════════════════════════════════════════════════════════════════════════════════

-- ══ 1. D13 · país resuelto: el país inferido del prefijo YA NO SE DESCARTA ══════════════
-- El endurecimiento escribe `coalesce(p_pais, '')` en `country` y `phone_pais`, y TODOS los
-- llamadores pasan `p_pais` vacío. El país se deducía internamente para calcular la clave
-- canónica y se tiraba. Estas dos funciones lo hacen recuperable.

/** ISO del país a partir del prefijo internacional, usando la tabla del proyecto. */
create or replace function public.whatsapp_crm_pais_for_cc(p_cc text)
returns text language sql immutable as $$
  select (select p.pais from public.whatsapp_crm_country_prefixes() p
    where p.codigo = nullif(trim(coalesce(p_cc, '')), '') limit 1);
$$;

/**
 * País efectivo de un teléfono, con la MISMA precedencia que la identidad canónica:
 *   1) si el llamador declara el país, se respeta tal cual (comportamiento previo intacto);
 *   2) si no, se deriva del prefijo internacional del teléfono CANÓNICO ya resuelto.
 * Devuelve '' cuando no se puede concluir (ficha en revisión): NO se adivina.
 */
create or replace function public.whatsapp_crm_resolved_pais(p_value text, p_pais text default null)
returns text language plpgsql immutable as $$
declare
  v_declared text := upper(trim(coalesce(p_pais, '')));
  v_canonical text;
  v_pais text;
begin
  if v_declared <> '' then return v_declared; end if;
  v_canonical := public.whatsapp_crm_canonical_phone(p_value, p_pais);
  if v_canonical is null then return ''; end if;
  -- `canónico = prefijo || nacional`: el prefijo más largo que coincide ES el código de país.
  select p.pais into v_pais from public.whatsapp_crm_country_prefixes() p
    where left(v_canonical, length(p.codigo)) = p.codigo
    order by length(p.codigo) desc limit 1;
  return coalesce(v_pais, '');
end $$;

-- ══ 2. D8 · el `0` de discado argentino se normaliza ════════════════════════════════════
-- Antes: `0221 555 1234` (con país AR) daba `5402215551234`, mientras `2215551234` daba
-- `542215551234`: MISMA persona, DOS claves. El `0` es el prefijo troncal de discado, no
-- parte del número, así que se elimina cuando el país ya está determinado.
--
-- Se conserva EXACTAMENTE la regla de conclusividad de la candidata de consentimiento
-- (inferencia sólo con prefijo conocido + longitud plausible + techo E.164 de 15 dígitos);
-- lo único que cambia es el saneo del troncal y la revalidación posterior.
--
-- NOTA: el `15` de móvil NO se toca. Su posición depende de la longitud del código de área
-- (`011 15 5550 0199` vs `0221 15 555 0101`) y esa política no está definida en el contrato
-- (ver §"Pendiente por decisión" del informe). Se deja tal cual y se documenta.
create or replace function public.whatsapp_crm_canonical_phone(p_value text, p_pais text default null)
returns text language plpgsql immutable as $$
declare
  v_digits text := public.whatsapp_crm_normalize_phone(p_value);
  v_cc text := public.whatsapp_crm_country_code(p_pais);
  v_min int;
  v_max int;
  v_national text;
begin
  if v_digits is null or length(v_digits) < 7 then return null; end if;
  if length(v_digits) > 15 then return null; end if;   -- E.164: 15 dígitos como máximo

  if v_cc is null then
    -- (b) Inferencia por prefijo internacional (entrante de WhatsApp y formulario público).
    select p.codigo, p.min_nacional, p.max_nacional
      into v_cc, v_min, v_max
      from public.whatsapp_crm_country_prefixes() p
      where left(v_digits, length(p.codigo)) = p.codigo
      order by length(p.codigo) desc
      limit 1;
    if v_cc is null then return null; end if;          -- sin prefijo conocido → revisión
    v_national := substr(v_digits, length(v_cc) + 1);
  else
    -- (a) País declarado: se respeta la semántica previa.
    v_min := public.whatsapp_crm_national_min(p_pais);
    v_max := public.whatsapp_crm_national_max(p_pais);
    v_national := case when left(v_digits, length(v_cc)) = v_cc
      then substr(v_digits, length(v_cc) + 1) else v_digits end;
  end if;

  -- D8 · troncal de discado: sólo con país conocido y sólo si queda número suficiente.
  if v_cc is not null and v_national is not null and left(v_national, 1) = '0' then
    v_national := substr(v_national, 2);
  end if;

  -- AR: se quita el `9` de móvil, así `+54 9 221…`, `549221…`, `54221…` y `0221…` coinciden.
  if v_cc = '54' and left(v_national, 1) = '9' then
    v_national := substr(v_national, 2);
  end if;

  if v_national is null or v_national = '' then return null; end if;
  if length(v_national) < v_min or (v_max is not null and length(v_national) > v_max) then
    return null;   -- longitud no plausible → revisión (la revalidación es DESPUÉS del saneo)
  end if;
  return v_cc || v_national;
end $$;

-- ══ 3. D13 · el upsert persiste el país resuelto ════════════════════════════════════════
-- Misma firma y mismo tipo de retorno que la versión vigente (del endurecimiento), así que
-- `create or replace` es suficiente y ningún llamador cambia. Lo único distinto es que
-- `country` y `phone_pais` reciben el país RESUELTO (declarado o inferido) en lugar de
-- `p_pais` crudo.
create or replace function public.whatsapp_crm_upsert_contact(
  p_phone_original text, p_display_name text default '', p_pais text default '',
  p_sede_id bigint default null, p_origin text default 'whatsapp', p_source_ref text default '',
  p_actor_user_id uuid default null, p_first_contact_at timestamptz default null,
  p_last_contact_at timestamptz default null
) returns table (contact_id uuid, created boolean, needs_review boolean) language plpgsql as $$
declare
  v_canonical text := public.whatsapp_crm_canonical_phone(p_phone_original, p_pais);
  v_digits text := public.whatsapp_crm_normalize_phone(p_phone_original);
  v_pais text := public.whatsapp_crm_resolved_pais(p_phone_original, p_pais);   -- D13
  v_key text;
  v_id uuid;
  v_created boolean := false;
  v_review boolean := false;
begin
  if v_digits is null then
    raise exception 'telefono invalido' using errcode = '22023';
  end if;
  if p_origin not in ('whatsapp','importacion','manual','formulario','otro') then
    raise exception 'origen invalido' using errcode = '22023';
  end if;

  if v_canonical is null then
    -- No concluyente: ficha propia marcada para revisión, sin unión automática.
    v_key := 'review:' || v_digits;
    v_review := true;
  else
    v_key := 'tel:' || v_canonical;
  end if;

  insert into public.whatsapp_crm_contacts (identity_key, phone_normalized, phone_original,
    display_name, country, sede_id, first_contact_at, last_contact_at, created_by,
    needs_review, review_reason, phone_pais)
  values (v_key, coalesce(v_canonical, v_digits), coalesce(p_phone_original, ''),
    coalesce(p_display_name, ''), v_pais, p_sede_id, p_first_contact_at,
    p_last_contact_at, p_actor_user_id, v_review,
    case when v_review then 'phone_not_conclusive' else '' end, v_pais)
  on conflict (identity_key) do nothing
  returning id, (xmax = 0) into v_id, v_created;

  if v_id is null then
    select id into v_id from public.whatsapp_crm_contacts where identity_key = v_key;
    v_created := false;
    update public.whatsapp_crm_contacts set
      display_name = case when coalesce(display_name, '') = '' then coalesce(p_display_name, '') else display_name end,
      -- El país ya conocido no se pisa; si estaba vacío, ahora SÍ se completa (D13).
      country = case when coalesce(country, '') = '' then v_pais else country end,
      phone_pais = case when coalesce(phone_pais, '') = '' then v_pais else phone_pais end,
      -- La sede ya conocida no se pisa con null.
      sede_id = coalesce(sede_id, p_sede_id),
      first_contact_at = least(coalesce(first_contact_at, p_first_contact_at), coalesce(p_first_contact_at, first_contact_at)),
      last_contact_at = greatest(coalesce(last_contact_at, p_last_contact_at), coalesce(p_last_contact_at, last_contact_at))
    where id = v_id;
    select c.needs_review into v_review from public.whatsapp_crm_contacts c where c.id = v_id;
  end if;

  perform public.whatsapp_crm_note_origin(v_id, p_origin, coalesce(p_source_ref, ''));
  return query select v_id, v_created, coalesce(v_review, false);
end $$;

-- ══ 4. D2 · la bandeja vuelve a exponer TODAS las columnas de la ficha ══════════════════
-- `whatsapp_crm_inbox()` quedó con la lista de columnas previa al endurecimiento: no devolvía
-- `created_by`, `needs_review`, `review_reason`, `phone_pais` ni ninguna de las cinco de
-- consentimiento. El servicio no la usa (escribe su propio SQL), pero cualquier otro
-- consumidor de la función sí queda desactualizado.
--
-- Cambiar los parámetros OUT cambia el tipo de retorno y `create or replace` NO lo permite:
-- PostgreSQL exige eliminar la función antes de recrearla. Por eso el `drop` explícito; los
-- permisos se vuelven a otorgar al final del archivo.
drop function if exists public.whatsapp_crm_inbox(text, bigint);

create or replace function public.whatsapp_crm_inbox(p_status text default null, p_sede_id bigint default null)
returns table (
  id uuid, identity_key text, phone_normalized text, phone_original text, display_name text,
  country text, sede_id bigint, market text, interest text, first_contact_at timestamptz,
  last_contact_at timestamptz, owner_user_id uuid, status text, next_action text,
  next_action_at timestamptz, notes text, origins text[],
  -- Campos que el endurecimiento y la candidata de consentimiento agregaron:
  needs_review boolean, review_reason text, phone_pais text, created_by uuid,
  updated_at timestamptz,
  consent_status text, consent_version text, consent_source text, consent_at timestamptz,
  consent_revoked_at timestamptz
) language sql stable as $$
  select c.id, c.identity_key, c.phone_normalized, c.phone_original, c.display_name,
    c.country, c.sede_id, c.market, c.interest, c.first_contact_at, c.last_contact_at,
    c.owner_user_id, c.status, c.next_action, c.next_action_at, c.notes,
    coalesce((select array_agg(distinct o.origin order by o.origin)
      from public.whatsapp_crm_contact_origins o where o.contact_id = c.id), '{}') as origins,
    c.needs_review, c.review_reason, c.phone_pais, c.created_by, c.updated_at,
    c.consent_status, c.consent_version, c.consent_source, c.consent_at, c.consent_revoked_at
  from public.whatsapp_crm_contacts c
  where (p_status is null or c.status = p_status)
    and (p_sede_id is null or c.sede_id = p_sede_id)
  order by c.last_contact_at desc nulls last, c.id
  limit 200;
$$;

-- ══ 5. D12 · el backfill de entrantes vuelve a encontrar las fichas ═════════════════════
-- La versión de la candidata base une por `c.identity_key = 'tel:' || normalize_phone(...)`.
-- Desde el endurecimiento la clave puede ser `review:<dígitos>`, así que el join NUNCA
-- coincidía: devolvía 0 filas SIN error (falla cerrado pero en silencio).
-- Ahora la clave esperada se construye con la MISMA regla que el upsert, y el evento se
-- inserta con `source_ref`, de modo que el índice único parcial lo protege de duplicados
-- igual que a los eventos del trigger.
create or replace function public.whatsapp_crm_backfill_inbound_messages(p_limit int default 5000)
returns int language plpgsql as $$
declare v_count int;
begin
  with candidatos as (
    select c.id as contact_id, i.id as inbound_id, i.received_at, i.text_body, i.from_wa_id
    from public.whatsapp_inbound_messages i
    join public.whatsapp_crm_contacts c
      on c.identity_key = case
           when public.whatsapp_crm_canonical_phone(i.from_wa_id, '') is not null
             then 'tel:' || public.whatsapp_crm_canonical_phone(i.from_wa_id, '')
           else 'review:' || public.whatsapp_crm_normalize_phone(i.from_wa_id)
         end
    where public.whatsapp_crm_normalize_phone(i.from_wa_id) is not null
      and not exists (
        select 1 from public.whatsapp_crm_timeline t
        where t.contact_id = c.id and t.kind = 'mensaje_entrante'
          and t.source_ref = 'inbound:' || i.id::text)
    order by i.received_at
    limit greatest(1, least(p_limit, 20000))
  )
  insert into public.whatsapp_crm_timeline
    (contact_id, kind, at, detail, payload, source_ref, source_status)
  select contact_id, 'mensaje_entrante', received_at, coalesce(text_body, ''),
    jsonb_build_object('sourceRef', 'inbound:' || inbound_id::text, 'channel', 'whatsapp'),
    'inbound:' || inbound_id::text, ''
  from candidatos
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ══ 6. D9 · UN solo evento de saliente por mensaje de outbox ═══════════════════════════
-- Dos problemas del trigger anterior:
--   a) el trigger dispara en `AFTER INSERT OR UPDATE OF status`, así que un envío real dejaba
--      TRES filas `mensaje_saliente` (pending, sending, sent) para el mismo mensaje;
--   b) cada fila repetía el texto del mensaje, así que el historial informaba el mismo
--      saliente varias veces.
-- Ahora se ACTUALIZA la fila del mensaje si ya existe y sólo se inserta la primera vez:
-- exactamente UNA fila por mensaje de outbox, con su estado vigente en `source_status` y en
-- `payload.status`.
--
-- Lo que NO se decide acá (queda documentado como pendiente): si un saliente RETENIDO
-- (`pending`, nunca enviado) debe aparecer o no en el historial. Hoy aparece, y es
-- distinguible: `source_status='pending'` y `payload.status='pending'`. Ocultarlo u omitirlo
-- es una decisión de producto, no un defecto de código.
--
-- Reparación de los datos que el defecto ya dejó: se colapsan las filas duplicadas por
-- mensaje (se conserva la más reciente) y recién ahí se crea el índice que hace REAL la
-- invariante "una fila por mensaje de outbox".
do $$
declare v_borradas int;
begin
  with ranked as (
    select t.id, row_number() over (
      partition by t.contact_id, t.source_ref order by t.at desc, t.id desc) as rn
    from public.whatsapp_crm_timeline t
    where t.source_ref like 'outbox:%'
  )
  delete from public.whatsapp_crm_timeline t
  using ranked r where t.id = r.id and r.rn > 1;
  get diagnostics v_borradas = row_count;
  if v_borradas > 0 then
    raise notice 'D9: filas mensaje_saliente duplicadas colapsadas = %', v_borradas;
  end if;
end $$;

create unique index if not exists whatsapp_crm_timeline_outbox_unique
  on public.whatsapp_crm_timeline (contact_id, source_ref)
  where source_ref like 'outbox:%';

create or replace function public.whatsapp_crm_sync_outbox()
returns trigger language plpgsql as $$
declare v_id uuid; v_created boolean; v_sede bigint; v_status text; v_rows int;
begin
  v_id := null;
  if public.whatsapp_crm_normalize_phone(new.to_wa_id) is not null then
    v_sede := public.whatsapp_crm_sede_for_tenant(new.tenant_id);
    select u.contact_id, u.created into v_id, v_created
      from public.whatsapp_crm_upsert_contact(new.to_wa_id, '', '', v_sede, 'whatsapp',
        'outbox:' || new.id::text, null, new.created_at, new.created_at) u;
  end if;
  if v_id is null and new.inbound_message_id is not null then
    select t.contact_id into v_id from public.whatsapp_crm_timeline t
      where t.source_ref = 'inbound:' || new.inbound_message_id::text limit 1;
  end if;
  if v_id is null then return new; end if;

  v_status := coalesce(nullif(new.status, ''), 'desconocido');

  update public.whatsapp_crm_timeline t set
    at = coalesce(new.sent_at, new.created_at),
    detail = coalesce(new.text_body, ''),
    source_status = v_status,
    payload = jsonb_build_object('status', v_status, 'channel', 'whatsapp',
      'messageType', coalesce(new.message_type, ''), 'attempts', coalesce(new.attempts, 0),
      'providerMessageId', coalesce(new.provider_message_id, ''),
      'hasError', (new.last_error is not null and new.last_error <> ''))
  where t.contact_id = v_id
    and t.kind = 'mensaje_saliente'
    and t.source_ref = 'outbox:' || new.id::text;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    insert into public.whatsapp_crm_timeline
      (contact_id, kind, at, detail, payload, source_ref, source_status)
    values (v_id, 'mensaje_saliente', coalesce(new.sent_at, new.created_at), coalesce(new.text_body, ''),
      jsonb_build_object('status', v_status, 'channel', 'whatsapp',
        'messageType', coalesce(new.message_type, ''), 'attempts', coalesce(new.attempts, 0),
        'providerMessageId', coalesce(new.provider_message_id, ''),
        'hasError', (new.last_error is not null and new.last_error <> '')),
      'outbox:' || new.id::text, v_status)
    on conflict do nothing;
  end if;
  return new;
end $$;

-- ══ 7. D11 · un fallo de sincronización ya no se traga en silencio ═════════════════════
-- Antes: `exception when others then raise warning '<código>'` SIN re-lanzar. Consecuencia:
-- el entrante se guardaba, la ficha NO, el webhook respondía 200 y el proveedor NUNCA
-- reintentaba. El fallo era invisible para el llamador y para Meta.
-- Ahora se emite un aviso con el SQLSTATE (sin datos del contacto) y se RE-LANZA, así la
-- transacción del entrante se revierte, el webhook responde error y el proveedor reintenta.
--
-- INTERACCIÓN CONOCIDA Y REPORTADA: con D1 todavía abierto (un `wa_id` de 1–6 dígitos viola
-- `whatsapp_crm_contacts_phone_check`), este cambio convierte la pérdida silenciosa de la
-- ficha en un error visible. Es preferible (fail-loud) pero D1 está FUERA del alcance
-- autorizado de esta ronda, así que se documenta como dependencia.
create or replace function public.whatsapp_crm_sync_inbound()
returns trigger language plpgsql as $$
declare v_id uuid; v_created boolean; v_sede bigint;
begin
  if public.whatsapp_crm_normalize_phone(new.from_wa_id) is null then return new; end if;
  v_sede := public.whatsapp_crm_sede_for_tenant(new.tenant_id);   -- sede del buzón, no del cliente
  select u.contact_id, u.created into v_id, v_created
    from public.whatsapp_crm_upsert_contact(new.from_wa_id, '', '', v_sede, 'whatsapp',
      'inbound:' || new.id::text, null, new.received_at, new.received_at) u;
  insert into public.whatsapp_crm_timeline
    (contact_id, kind, at, detail, payload, source_ref, source_status)
  values (v_id, 'mensaje_entrante', new.received_at, coalesce(new.text_body, ''),
    jsonb_build_object('channel', 'whatsapp', 'messageType', new.message_type),
    'inbound:' || new.id::text, '')
  on conflict do nothing;
  return new;
exception when others then
  -- Sólo el SQLSTATE: nunca el mensaje crudo ni datos del contacto.
  raise warning 'whatsapp_crm_sync_inbound_failed sqlstate=%', sqlstate;
  raise;   -- se propaga: la transacción se revierte y el proveedor reintenta
end $$;

-- Los triggers ya existen; se re-crean para que queden atados a la versión nueva de las
-- funciones (mismo criterio de reejecutabilidad que el endurecimiento).
drop trigger if exists whatsapp_crm_sync_inbound_trigger on public.whatsapp_inbound_messages;
create trigger whatsapp_crm_sync_inbound_trigger after insert on public.whatsapp_inbound_messages
  for each row execute function public.whatsapp_crm_sync_inbound();

drop trigger if exists whatsapp_crm_sync_outbox_trigger on public.whatsapp_outbox;
create trigger whatsapp_crm_sync_outbox_trigger after insert or update of status on public.whatsapp_outbox
  for each row execute function public.whatsapp_crm_sync_outbox();

-- ══ 8. Permisos AL FINAL ══════════════════════════════════════════════════════════════
-- Las funciones se crean primero y recién acá se ajustan los permisos. Ninguna tabla ni
-- secuencia recibe un GRANT nuevo y RLS queda intacto.
do $$
declare
  v_firma text;
  v_funciones text[] := array[
    'public.whatsapp_crm_pais_for_cc(text)',
    'public.whatsapp_crm_resolved_pais(text,text)',
    'public.whatsapp_crm_canonical_phone(text,text)',
    'public.whatsapp_crm_upsert_contact(text,text,text,bigint,text,text,uuid,timestamptz,timestamptz)',
    'public.whatsapp_crm_inbox(text,bigint)',
    'public.whatsapp_crm_backfill_inbound_messages(integer)',
    'public.whatsapp_crm_sync_inbound()',
    'public.whatsapp_crm_sync_outbox()'
  ];
begin
  foreach v_firma in array v_funciones loop
    execute format('revoke all on function %s from public, anon, authenticated', v_firma);
    execute format('grant execute on function %s to service_role', v_firma);
  end loop;
end $$;

-- Sin cambios de RLS ni permisos amplios. Sin envíos. `dispatchAllowed` sigue en false.
