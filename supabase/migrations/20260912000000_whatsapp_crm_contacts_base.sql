-- ══════════════════════════════════════════════════════════════════════════════════════
-- CRM de WhatsApp · candidata BASE (fichas, orígenes e historial)
--
-- ORIGEN DE ESTE ARCHIVO (honestidad de procedencia)
--   El archivo original `sql/candidates/whatsapp_crm_contacts_candidate.sql` NO sobrevive
--   en `entregas/cola-ronda3`: sólo quedaron hunks parciales de patch, no el DDL.
--   Este archivo RECONSTRUYE fielmente ese esquema a partir de evidencia verificable:
--
--   1) `evidencia/T4-h3/whatsappCrm.js.entregado` (627 líneas, módulo backend entregado):
--      consulta `whatsapp_crm_contacts`, `whatsapp_crm_contact_origins`,
--      `whatsapp_crm_timeline`, llama `whatsapp_crm_upsert_contact` y nombra la restricción
--      `whatsapp_crm_contacts_consent_status_check`.
--   2) `parches/T4-whatsapp-pendientes.diff` (recuperado completo, 408 líneas):
--      - los parámetros OUT de `whatsapp_crm_inbox()` enumeran TODAS las columnas de la ficha
--        (base + endurecimiento + consentimiento);
--      - `whatsapp_crm_upsert_contact()` enumera las columnas del INSERT/UPDATE;
--      - `whatsapp_crm_sync_inbound()` / `whatsapp_crm_sync_outbox()` /
--        `whatsapp_crm_backfill_inbound_messages()` enumeran las columnas de `timeline`.
--   3) `documentos/T4-candidato-final/ARRANCAR.sh` fija el orden de la cadena y los nombres
--      de tabla (`contacts`, `origins`, `timeline`).
--
--   Cada punto reconstruido (no literal) está marcado con `-- [RECONSTRUIDO]` y su motivo.
--   Lo que es literal de la evidencia está marcado `-- [EVIDENCIA]`.
--
-- RE-EJECUTABLE: todo usa `if not exists` / `create or replace` y es seguro de aplicar
-- dos veces (ARRANCAR.sh aplica la cadena dos veces a propósito).
-- ══════════════════════════════════════════════════════════════════════════════════════

-- [RECONSTRUIDO] Helpers de teléfono y país que `whatsapp_crm_upsert_contact` invoca
-- (`whatsapp_crm_canonical_phone`, `whatsapp_crm_normalize_phone`, `whatsapp_crm_resolved_pais`,
-- `whatsapp_crm_pais_for_cc`) se definen en `whatsapp_crm_pendientes_candidate.sql`, que sí se
-- recuperó completo y se aplica DESPUÉS. Aquí sólo se garantiza que `normalize_phone` exista,
-- porque la restricción CHECK de la ficha se apoya en ella.
create or replace function public.whatsapp_crm_normalize_phone(p_value text)
returns text language sql immutable as $fn$
  select nullif(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g'), '');
$fn$;

-- ══ 1. FICHAS ═══════════════════════════════════════════════════════════════════════════
-- [EVIDENCIA] Columnas tomadas de los parámetros OUT de `whatsapp_crm_inbox()`:
--   id, identity_key, phone_normalized, phone_original, display_name, country, sede_id,
--   market, interest, first_contact_at, last_contact_at, owner_user_id, status, next_action,
--   next_action_at, notes, needs_review, review_reason, phone_pais, created_by, updated_at,
--   consent_status, consent_version, consent_source, consent_at, consent_revoked_at.
create table if not exists public.whatsapp_crm_contacts (
  id                uuid primary key default gen_random_uuid(),
  identity_key      text        not null,
  phone_normalized  text        not null,
  phone_original    text        not null default '',
  display_name      text        not null default '',
  country           text        not null default '',
  sede_id           bigint,
  market            text        not null default '',
  interest          text        not null default '',
  first_contact_at  timestamptz,
  last_contact_at   timestamptz,
  owner_user_id     uuid,
  status            text        not null default 'nuevo',
  next_action       text        not null default '',
  next_action_at    timestamptz,
  notes             text        not null default '',
  -- endurecimiento
  needs_review      boolean     not null default false,
  review_reason     text        not null default '',
  phone_pais        text        not null default '',
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- consentimiento
  consent_status    text        not null default 'unknown',
  consent_version   text        not null default '',
  consent_source    text        not null default '',
  consent_at        timestamptz,
  consent_revoked_at timestamptz
);

-- [EVIDENCIA] `on conflict (identity_key)` en `whatsapp_crm_upsert_contact` ⇒ unique.
create unique index if not exists whatsapp_crm_contacts_identity_key_unique
  on public.whatsapp_crm_contacts (identity_key);

create index if not exists whatsapp_crm_contacts_phone_normalized_idx
  on public.whatsapp_crm_contacts (phone_normalized);
create index if not exists whatsapp_crm_contacts_last_contact_at_idx
  on public.whatsapp_crm_contacts (last_contact_at desc nulls last);

-- [EVIDENCIA] `CRM_STATUSES` del cliente (`src/utils/whatsappCrmLeads.js`) y del contrato.
alter table public.whatsapp_crm_contacts drop constraint if exists whatsapp_crm_contacts_status_check;
alter table public.whatsapp_crm_contacts add constraint whatsapp_crm_contacts_status_check
  check (status in ('nuevo','pendiente_revision','asignado','llamada_programada','no_respondio',
                    'seguimiento','interesado','no_interesado','derivado','cerrado'));

-- [EVIDENCIA] Nombre literal citado en `whatsappCrm.js.entregado` (409 CRM_CONSENT_REVOKED_WINS).
alter table public.whatsapp_crm_contacts
  drop constraint if exists whatsapp_crm_contacts_consent_status_check;
alter table public.whatsapp_crm_contacts add constraint whatsapp_crm_contacts_consent_status_check
  check (consent_status in ('unknown','granted','denied','revoked'));

-- [EVIDENCIA] `whatsapp_crm_pendientes.diff` §7 documenta que «un `wa_id` de 1–6 dígitos viola
-- `whatsapp_crm_contacts_phone_check`» ⇒ el mínimo exigido es 7 dígitos.
alter table public.whatsapp_crm_contacts drop constraint if exists whatsapp_crm_contacts_phone_check;
alter table public.whatsapp_crm_contacts add constraint whatsapp_crm_contacts_phone_check
  check (phone_normalized ~ '^[0-9]{7,}$');

-- [EVIDENCIA] `review_reason` sólo puede ser vacío o el valor que produce el upsert.
alter table public.whatsapp_crm_contacts drop constraint if exists whatsapp_crm_contacts_review_reason_check;
alter table public.whatsapp_crm_contacts add constraint whatsapp_crm_contacts_review_reason_check
  check (review_reason in ('', 'phone_not_conclusive'));

-- [RECONSTRUIDO] `whatsapp_crm_upsert_contact` escribe `updated_at` implícitamente y la bandeja
-- lo expone; se mantiene con trigger para que ninguna escritura lo deje viejo.
create or replace function public.whatsapp_crm_touch_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at := now();
  return new;
end $fn$;

drop trigger if exists whatsapp_crm_contacts_touch_updated_at on public.whatsapp_crm_contacts;
create trigger whatsapp_crm_contacts_touch_updated_at
  before update on public.whatsapp_crm_contacts
  for each row execute function public.whatsapp_crm_touch_updated_at();

-- ══ 2. ORÍGENES (una fila por procedencia real de la ficha) ════════════════════════════
-- [EVIDENCIA] `whatsapp_crm_inbox()` agrega `array_agg(distinct o.origin order by o.origin)
-- from public.whatsapp_crm_contact_origins o where o.contact_id = c.id` ⇒ (contact_id, origin).
create table if not exists public.whatsapp_crm_contact_origins (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.whatsapp_crm_contacts(id) on delete cascade,
  origin     text not null,
  source_ref text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists whatsapp_crm_contact_origins_unique
  on public.whatsapp_crm_contact_origins (contact_id, origin);

-- [EVIDENCIA] Valores admitidos por `whatsapp_crm_upsert_contact`:
--   `p_origin not in ('whatsapp','importacion','manual','formulario','otro')` ⇒ error 22023.
alter table public.whatsapp_crm_contact_origins
  drop constraint if exists whatsapp_crm_contact_origins_origin_check;
alter table public.whatsapp_crm_contact_origins add constraint whatsapp_crm_contact_origins_origin_check
  check (origin in ('whatsapp','importacion','manual','formulario','otro'));

-- [EVIDENCIA] `perform public.whatsapp_crm_note_origin(v_id, p_origin, p_source_ref)` es
-- invocada por el upsert; su cuerpo no sobrevivió. [RECONSTRUIDO] a partir de su nombre,
-- de su firma de llamada y de la forma de las tablas: registra la procedencia sin duplicar
-- y deja el rastro en el historial.
create or replace function public.whatsapp_crm_note_origin(
  p_contact_id uuid, p_origin text, p_source_ref text default ''
) returns void language plpgsql as $fn$
begin
  if p_contact_id is null then return; end if;
  if p_origin is null or p_origin not in ('whatsapp','importacion','manual','formulario','otro') then
    return;
  end if;
  insert into public.whatsapp_crm_contact_origins (contact_id, origin, source_ref)
  values (p_contact_id, p_origin, coalesce(p_source_ref, ''))
  on conflict (contact_id, origin) do nothing;

  insert into public.whatsapp_crm_timeline
    (contact_id, kind, at, detail, payload, source_ref, source_status)
  values (p_contact_id, 'origen', now(), p_origin,
    jsonb_build_object('origin', p_origin, 'sourceRef', coalesce(p_source_ref, '')),
    coalesce(p_source_ref, ''), '')
  on conflict do nothing;
end $fn$;

-- ══ 3. HISTORIAL ═══════════════════════════════════════════════════════════════════════
-- [EVIDENCIA] Columnas exactas del INSERT en `whatsapp_crm_sync_inbound`,
-- `whatsapp_crm_sync_outbox` y `whatsapp_crm_backfill_inbound_messages`:
--   (contact_id, kind, at, detail, payload, source_ref, source_status).
create table if not exists public.whatsapp_crm_timeline (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references public.whatsapp_crm_contacts(id) on delete cascade,
  kind          text not null,
  at            timestamptz not null default now(),
  detail        text not null default '',
  payload       jsonb not null default '{}'::jsonb,
  source_ref    text not null default '',
  source_status text not null default '',
  created_at    timestamptz not null default now()
);

-- [EVIDENCIA] Tipos citados en la evidencia + los que produce la UI/API del CRM.
alter table public.whatsapp_crm_timeline drop constraint if exists whatsapp_crm_timeline_kind_check;
alter table public.whatsapp_crm_timeline add constraint whatsapp_crm_timeline_kind_check
  check (kind in ('mensaje_entrante','mensaje_saliente','nota','estado','llamada',
                  'seguimiento','asignacion','revision','consentimiento','formulario','origen'));

create index if not exists whatsapp_crm_timeline_contact_at_idx
  on public.whatsapp_crm_timeline (contact_id, at desc, id desc);

-- [EVIDENCIA] El propio `whatsapp_crm_pendientes.diff` §6 crea ESTE índice (idempotente).
create unique index if not exists whatsapp_crm_timeline_outbox_unique
  on public.whatsapp_crm_timeline (contact_id, source_ref)
  where source_ref like 'outbox:%';

-- [EVIDENCIA] El backfill usa `on conflict do nothing` contra `(contact_id, source_ref)` para
-- entrantes, y el trigger de entrantes también ⇒ hace falta el gemelo del índice de outbox.
create unique index if not exists whatsapp_crm_timeline_inbound_unique
  on public.whatsapp_crm_timeline (contact_id, source_ref)
  where source_ref like 'inbound:%';

-- ══ 4. SEDE DEL BUZÓN ══════════════════════════════════════════════════════════════════
-- [EVIDENCIA] `whatsapp_crm_sync_inbound`/`sync_outbox` llaman
-- `public.whatsapp_crm_sede_for_tenant(new.tenant_id)` con el comentario «sede del buzón, no
-- del cliente». El cuerpo no sobrevivió.
-- [RECONSTRUIDO] `whatsapp_tenants` (creada por `20260910220000_whatsapp_base_schema.sql`)
-- es el buzón; se toma su `sede_id` si la columna existe, y si no se devuelve null.
create or replace function public.whatsapp_crm_sede_for_tenant(p_tenant_id uuid)
returns bigint language plpgsql stable as $fn$
declare v_sede bigint;
begin
  if p_tenant_id is null then return null; end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'whatsapp_tenants' and column_name = 'sede_id'
  ) then
    execute 'select sede_id from public.whatsapp_tenants where id = $1'
      into v_sede using p_tenant_id;
  end if;
  return v_sede;
exception when others then
  return null;
end $fn$;

-- ══ 5. PERMISOS ════════════════════════════════════════════════════════════════════════
-- El backend entra con service_role; la bandeja se expone por API, nunca directo al navegador.
do $do$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.whatsapp_crm_contacts to service_role;
    grant select, insert, update, delete on public.whatsapp_crm_contact_origins to service_role;
    grant select, insert, update, delete on public.whatsapp_crm_timeline to service_role;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.whatsapp_crm_contacts from authenticated;
    revoke all on public.whatsapp_crm_contact_origins from authenticated;
    revoke all on public.whatsapp_crm_timeline from authenticated;
  end if;
end $do$;
