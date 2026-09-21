-- DEPRECADO: no ejecutar este archivo en Supabase SQL Editor.
--
-- El esquema anterior no tenía device_id, preferencias separadas, rotación,
-- revocación, idempotencia, receipts ni el cierre RLS/service-role requerido.
-- Se conserva este archivo únicamente para que los enlaces históricos fallen de
-- manera segura y conduzcan a la única definición vigente:
--
--   supabase/migrations/20260909143000_secure_mobile_push_delivery.sql
--
-- La migración canónica debe revisarse y aplicarse mediante el flujo controlado
-- de staging. No se aplicó automáticamente al preparar esta implementación.

do $$
begin
  raise exception
    'SQL push legado deshabilitado: usar la migración 20260909143000_secure_mobile_push_delivery.sql';
end
$$;
