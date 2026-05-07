-- Registro de webhooks (Mercado Pago, Stripe) — ejecutar en Supabase SQL Editor
-- Incluye mp_payment_id para idempotencia en notificaciones de pago MP.

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('mercadopago', 'stripe')),
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}',
  procesado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.webhook_logs IS 'Auditoría de webhooks entrantes; procesado=true tras manejo exitoso (o skip idempotente).';

-- Opcional pero necesario para idempotencia MP por payment_id:
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS mp_payment_id text;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_source_created
  ON public.webhook_logs (source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_mp_payment_id
  ON public.webhook_logs (mp_payment_id)
  WHERE source = 'mercadopago' AND mp_payment_id IS NOT NULL;
