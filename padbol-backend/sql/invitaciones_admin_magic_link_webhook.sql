-- =============================================================================
-- Magic link para invitaciones admin (ejecutar en Supabase SQL Editor)
-- Flujo: INSERT en invitaciones_admin → webhook → Make → POST backend
--        https://<BACKEND>/api/webhooks/invitacion-admin
-- Header: x-webhook-secret = INVITATION_WEBHOOK_SECRET (o MERCADOPAGO_WEBHOOK_SECRET)
-- =============================================================================

-- Opción A (recomendada): Database Webhook en Dashboard
--   Table: invitaciones_admin | Events: INSERT
--   URL: https://padbol-backend.onrender.com/api/webhooks/invitacion-admin
--   Headers: x-webhook-secret: <tu secreto>
--
-- Opción B: pg_net + trigger (requiere extensión pg_net habilitada)

/*
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_invitacion_admin_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  webhook_url text := 'https://padbol-backend.onrender.com/api/webhooks/invitacion-admin';
  webhook_secret text := current_setting('app.invitation_webhook_secret', true);
  payload jsonb;
begin
  if TG_OP <> 'INSERT' then
    return NEW;
  end if;

  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'invitaciones_admin',
    'record', jsonb_build_object(
      'id', NEW.id,
      'email', NEW.email,
      'invited_role', NEW.invited_role,
      'nombre_club', NEW.nombre_club,
      'pais', NEW.pais,
      'provincia', NEW.provincia,
      'ciudad', NEW.ciudad,
      'sede_id', NEW.sede_id,
      'estado', NEW.estado
    )
  );

  perform net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(webhook_secret, '')
    ),
    body := payload
  );

  return NEW;
end;
$$;

drop trigger if exists trg_invitaciones_admin_webhook on public.invitaciones_admin;

create trigger trg_invitaciones_admin_webhook
  after insert on public.invitaciones_admin
  for each row
  execute function public.notify_invitacion_admin_webhook();
*/
