-- Suscripción mensual Padbol Match (Stripe Billing) — ejecutar en Supabase SQL Editor
-- Añade columnas a public.sedes para customer/subscription y estado operativo.

ALTER TABLE public.sedes
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS suscripcion_estado text DEFAULT 'sin_suscripcion',
  ADD COLUMN IF NOT EXISTS suscripcion_proximo_cobro timestamptz;

COMMENT ON COLUMN public.sedes.stripe_customer_id IS 'Stripe Customer id (cus_...) del club';
COMMENT ON COLUMN public.sedes.stripe_subscription_id IS 'Stripe Subscription id (sub_...)';
COMMENT ON COLUMN public.sedes.suscripcion_estado IS 'sin_suscripcion | pendiente_pago | activa | vencida | cancelada';
COMMENT ON COLUMN public.sedes.suscripcion_proximo_cobro IS 'Próximo cobro / fin de periodo actual (UTC)';
