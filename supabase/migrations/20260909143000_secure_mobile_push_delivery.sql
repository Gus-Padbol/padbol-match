begin;

create extension if not exists pgcrypto;

create table if not exists public.push_tokens (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text,
  platform text,
  device_id text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  invalidated_at timestamptz,
  invalidation_reason text
);

alter table public.push_tokens add column if not exists expo_push_token text;
alter table public.push_tokens add column if not exists device_id text;
alter table public.push_tokens add column if not exists enabled boolean not null default true;
alter table public.push_tokens add column if not exists updated_at timestamptz not null default now();
alter table public.push_tokens add column if not exists last_seen_at timestamptz not null default now();
alter table public.push_tokens add column if not exists revoked_at timestamptz;
alter table public.push_tokens add column if not exists invalidated_at timestamptz;
alter table public.push_tokens add column if not exists invalidation_reason text;

-- CREATE TABLE IF NOT EXISTS no completa constraints sobre una tabla heredada.
-- Garantizar el borrado en cascada para altas nuevas sin eliminar posibles filas
-- huérfanas legadas durante esta migración. La validación histórica se hará luego
-- de auditar esos datos, pero PostgreSQL aplica el FK a escrituras nuevas y a los
-- usuarios existentes alcanzados por un DELETE.
do $$
begin
  if not exists (
    select 1
      from pg_constraint constraint_row
     where constraint_row.conrelid = 'public.push_tokens'::regclass
       and constraint_row.contype = 'f'
       and constraint_row.confrelid = 'auth.users'::regclass
  ) then
    alter table public.push_tokens
      add constraint push_tokens_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'push_tokens'
       and column_name = 'token'
  ) then
    execute 'update public.push_tokens set expo_push_token = token where expo_push_token is null';
    execute 'alter table public.push_tokens alter column token drop not null';
  end if;
end
$$;

update public.push_tokens
   set platform = lower(coalesce(nullif(trim(platform), ''), 'unknown')),
       device_id = coalesce(nullif(trim(device_id), ''), 'legacy-' || id::text),
       enabled = coalesce(enabled, true),
       updated_at = coalesce(updated_at, created_at, now()),
       last_seen_at = coalesce(last_seen_at, updated_at, created_at, now());

alter table public.push_tokens alter column device_id set not null;

alter table public.push_tokens drop constraint if exists push_tokens_user_id_platform_key;
alter table public.push_tokens drop constraint if exists push_tokens_user_id_expo_push_token_key;

-- Un token Expo identifica una instalación. Si el esquema legado permitió que el
-- mismo token quedara asociado a más de una cuenta, conservar sólo el registro
-- visto más recientemente antes de imponer la unicidad global.
with ranked_tokens as (
  select id,
         row_number() over (
           partition by expo_push_token
           order by last_seen_at desc nulls last, updated_at desc nulls last, id desc
         ) as row_rank
    from public.push_tokens
   where expo_push_token is not null
)
delete from public.push_tokens p
 using ranked_tokens ranked
 where p.id = ranked.id
   and ranked.row_rank > 1;

create unique index if not exists push_tokens_expo_token_uidx
  on public.push_tokens (expo_push_token)
  where expo_push_token is not null;
create unique index if not exists push_tokens_installation_uidx
  on public.push_tokens (user_id, platform, device_id);
create index if not exists push_tokens_active_user_idx
  on public.push_tokens (user_id)
  where enabled = true and revoked_at is null and invalidated_at is null;

create table if not exists public.push_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  transactional_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_token_audit (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  device_id text,
  platform text,
  token_fingerprint text,
  action text not null check (action in ('registered', 'rotated', 'revoked', 'reassigned', 'invalidated')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists push_token_audit_user_created_idx
  on public.push_token_audit (user_id, created_at desc);

create table if not exists public.push_preference_audit (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  transactional_enabled boolean not null,
  marketing_enabled boolean not null,
  source text not null default 'api',
  created_at timestamptz not null default now()
);

create table if not exists public.push_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  source text not null,
  category text not null check (category in ('transactional', 'marketing')),
  event_type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  recipient_count integer not null default 0,
  token_count integer not null default 0,
  accepted_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'partial', 'no_tokens', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_delivery_attempts (
  id bigserial primary key,
  job_id uuid not null references public.push_delivery_jobs(id) on delete cascade,
  push_token_id bigint references public.push_tokens(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  token_fingerprint text not null,
  expo_ticket_id text,
  status text not null
    check (status in ('ticket_ok', 'ticket_error', 'delivered', 'receipt_error', 'invalidated', 'receipt_timeout')),
  error_code text,
  error_message text,
  attempt_count integer not null default 1,
  receipt_check_count integer not null default 0,
  next_receipt_check_at timestamptz,
  receipt_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_delivery_attempts_pending_receipt_idx
  on public.push_delivery_attempts (next_receipt_check_at)
  where status = 'ticket_ok' and expo_ticket_id is not null;

create table if not exists public.notificaciones_admin_log (
  id bigserial primary key,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  titulo text not null,
  mensaje text not null,
  segmento jsonb not null default '{}'::jsonb,
  cantidad_enviadas integer not null default 0,
  estado text not null default 'sent',
  created_at timestamptz not null default now()
);

alter table public.notificaciones_admin_log add column if not exists estado text not null default 'sent';
alter table public.notificaciones_admin_log add column if not exists idempotency_key text;
alter table public.notificaciones_admin_log add column if not exists push_job_id uuid references public.push_delivery_jobs(id) on delete set null;
create index if not exists notificaciones_admin_log_admin_created_idx
  on public.notificaciones_admin_log (admin_user_id, created_at desc);
create unique index if not exists notificaciones_admin_log_idempotency_uidx
  on public.notificaciones_admin_log (idempotency_key)
  where idempotency_key is not null;

create or replace function public.register_mobile_push_token(
  p_user_id uuid,
  p_token text,
  p_platform text,
  p_device_id text
) returns public.push_tokens
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.push_tokens;
  v_row public.push_tokens;
  v_token text := trim(coalesce(p_token, ''));
  v_platform text := lower(trim(coalesce(p_platform, '')));
  v_device_id text := trim(coalesce(p_device_id, ''));
begin
  if p_user_id is null or v_token = '' or v_device_id = '' or v_platform not in ('ios', 'android') then
    raise exception 'invalid_push_registration';
  end if;

  select * into v_existing
    from public.push_tokens
   where user_id = p_user_id and platform = v_platform and device_id = v_device_id
   for update;

  if v_existing.id is not null and v_existing.expo_push_token is distinct from v_token then
    insert into public.push_token_audit
      (user_id, device_id, platform, token_fingerprint, action, reason)
    values
      (p_user_id, v_device_id, v_platform,
       encode(digest(coalesce(v_existing.expo_push_token, ''), 'sha256'), 'hex'),
       'rotated', 'token_rotation');
  end if;

  insert into public.push_token_audit
    (user_id, device_id, platform, token_fingerprint, action, reason)
  select user_id, device_id, platform,
         encode(digest(coalesce(expo_push_token, ''), 'sha256'), 'hex'),
         'reassigned', 'token_claimed_by_authenticated_installation'
    from public.push_tokens
   where expo_push_token = v_token
     and (user_id, platform, device_id) is distinct from (p_user_id, v_platform, v_device_id);

  delete from public.push_tokens
   where expo_push_token = v_token
     and (user_id, platform, device_id) is distinct from (p_user_id, v_platform, v_device_id);

  insert into public.push_tokens
    (user_id, expo_push_token, platform, device_id, enabled, created_at, updated_at,
     last_seen_at, revoked_at, invalidated_at, invalidation_reason)
  values
    (p_user_id, v_token, v_platform, v_device_id, true, now(), now(), now(), null, null, null)
  on conflict (user_id, platform, device_id) do update
    set expo_push_token = excluded.expo_push_token,
        enabled = true,
        updated_at = now(),
        last_seen_at = now(),
        revoked_at = null,
        invalidated_at = null,
        invalidation_reason = null
  returning * into v_row;

  insert into public.push_token_audit
    (user_id, device_id, platform, token_fingerprint, action, reason)
  values
    (p_user_id, v_device_id, v_platform, encode(digest(v_token, 'sha256'), 'hex'),
     'registered', case when v_existing.id is null then 'new_installation' else 'refresh' end);

  insert into public.push_notification_preferences (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  return v_row;
end
$$;

create or replace function public.revoke_mobile_push_token(
  p_user_id uuid,
  p_token text default null,
  p_device_id text default null
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  if p_user_id is null or (nullif(trim(coalesce(p_token, '')), '') is null and nullif(trim(coalesce(p_device_id, '')), '') is null) then
    raise exception 'push_token_or_device_required';
  end if;

  with candidates as (
    select * from public.push_tokens
     where user_id = p_user_id
       and (nullif(trim(coalesce(p_token, '')), '') is null or expo_push_token = trim(p_token))
       and (nullif(trim(coalesce(p_device_id, '')), '') is null or device_id = trim(p_device_id))
       and enabled = true
     for update
  ), audited as (
    insert into public.push_token_audit
      (user_id, device_id, platform, token_fingerprint, action, reason)
    select user_id, device_id, platform,
           encode(digest(coalesce(expo_push_token, ''), 'sha256'), 'hex'),
           'revoked', 'authenticated_user_request'
      from candidates
    returning 1
  )
  update public.push_tokens p
     set enabled = false,
         revoked_at = now(),
         updated_at = now(),
         invalidation_reason = 'user_revoked'
   where p.id in (select id from candidates);

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create or replace function public.set_mobile_push_preferences(
  p_user_id uuid,
  p_transactional_enabled boolean,
  p_marketing_enabled boolean,
  p_source text default 'api'
) returns public.push_notification_preferences
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.push_notification_preferences;
begin
  if p_user_id is null or p_transactional_enabled is null or p_marketing_enabled is null then
    raise exception 'invalid_push_preferences';
  end if;

  insert into public.push_notification_preferences
    (user_id, transactional_enabled, marketing_enabled, created_at, updated_at)
  values
    (p_user_id, p_transactional_enabled, p_marketing_enabled, now(), now())
  on conflict (user_id) do update
    set transactional_enabled = excluded.transactional_enabled,
        marketing_enabled = excluded.marketing_enabled,
        updated_at = now()
  returning * into v_row;

  insert into public.push_preference_audit
    (user_id, transactional_enabled, marketing_enabled, source)
  values
    (p_user_id, p_transactional_enabled, p_marketing_enabled,
     left(coalesce(nullif(trim(p_source), ''), 'api'), 80));

  return v_row;
end
$$;

alter table public.push_tokens enable row level security;
alter table public.push_notification_preferences enable row level security;
alter table public.push_token_audit enable row level security;
alter table public.push_preference_audit enable row level security;
alter table public.push_delivery_jobs enable row level security;
alter table public.push_delivery_attempts enable row level security;
alter table public.notificaciones_admin_log enable row level security;

drop policy if exists "Users can manage own push tokens" on public.push_tokens;
drop policy if exists "Usuarios gestionan sus push tokens" on public.push_tokens;

revoke all on public.push_tokens from anon, authenticated;
revoke all on public.push_notification_preferences from anon, authenticated;
revoke all on public.push_token_audit from anon, authenticated;
revoke all on public.push_preference_audit from anon, authenticated;
revoke all on public.push_delivery_jobs from anon, authenticated;
revoke all on public.push_delivery_attempts from anon, authenticated;
revoke all on public.notificaciones_admin_log from anon, authenticated;
revoke all on function public.register_mobile_push_token(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.revoke_mobile_push_token(uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_mobile_push_preferences(uuid, boolean, boolean, text) from public, anon, authenticated;

grant all on public.push_tokens to service_role;
grant all on public.push_notification_preferences to service_role;
grant all on public.push_token_audit to service_role;
grant all on public.push_preference_audit to service_role;
grant all on public.push_delivery_jobs to service_role;
grant all on public.push_delivery_attempts to service_role;
grant all on public.notificaciones_admin_log to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.register_mobile_push_token(uuid, text, text, text) to service_role;
grant execute on function public.revoke_mobile_push_token(uuid, text, text) to service_role;
grant execute on function public.set_mobile_push_preferences(uuid, boolean, boolean, text) to service_role;

comment on table public.push_tokens is 'Registro privado y revocable de instalaciones Expo Push; nunca se expone al cliente.';
comment on table public.push_notification_preferences is 'Preferencias push por cuenta. Marketing requiere opt-in expreso.';
comment on table public.push_delivery_jobs is 'Outbox idempotente y auditable de notificaciones Expo Push.';
comment on table public.push_delivery_attempts is 'Tickets/receipts Expo por destino, identificados sólo por fingerprint.';

commit;
