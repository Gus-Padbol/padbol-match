-- Rollback de emergencia para 20260909143000_secure_mobile_push_delivery.sql.
-- Sólo es automático si todavía no hay datos generados por el sistema nuevo.
-- Si el guard falla, exportar/revisar retención y hacer una reversión manual.

begin;

do $$
begin
  if exists (select 1 from public.push_notification_preferences limit 1)
     or exists (select 1 from public.push_token_audit limit 1)
     or exists (select 1 from public.push_preference_audit limit 1)
     or exists (select 1 from public.push_delivery_jobs limit 1)
     or exists (select 1 from public.push_delivery_attempts limit 1) then
    raise exception 'push rollback blocked: export and review retained push data first';
  end if;
end
$$;

drop function if exists public.register_mobile_push_token(uuid, text, text, text);
drop function if exists public.revoke_mobile_push_token(uuid, text, text);
drop function if exists public.set_mobile_push_preferences(uuid, boolean, boolean, text);

alter table if exists public.notificaciones_admin_log drop column if exists push_job_id;
alter table if exists public.notificaciones_admin_log drop column if exists idempotency_key;

drop table if exists public.push_delivery_attempts;
drop table if exists public.push_delivery_jobs;
drop table if exists public.push_preference_audit;
drop table if exists public.push_token_audit;
drop table if exists public.push_notification_preferences;

drop index if exists public.push_tokens_active_user_idx;
drop index if exists public.push_tokens_installation_uidx;
drop index if exists public.push_tokens_expo_token_uidx;

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'push_tokens' and column_name = 'token'
  ) then
    execute 'update public.push_tokens set token = expo_push_token where token is null';
  end if;
end
$$;

alter table if exists public.push_tokens drop column if exists device_id;
alter table if exists public.push_tokens drop column if exists enabled;
alter table if exists public.push_tokens drop column if exists last_seen_at;
alter table if exists public.push_tokens drop column if exists revoked_at;
alter table if exists public.push_tokens drop column if exists invalidated_at;
alter table if exists public.push_tokens drop column if exists invalidation_reason;
alter table if exists public.push_tokens
  add constraint push_tokens_user_id_expo_push_token_key unique (user_id, expo_push_token);

-- No se restauran grants directos para anon/authenticated. El rollback deja push
-- deshabilitado hasta decidir expresamente un modelo de acceso seguro.

commit;
