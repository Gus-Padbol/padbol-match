-- Mercado Pago Public Key por sede (checkout / Wallet Brick).
-- Ejecutar manualmente en Supabase SQL Editor (no se aplica automáticamente).

ALTER TABLE public.sedes
ADD COLUMN IF NOT EXISTS mp_public_key text;

COMMENT ON COLUMN public.sedes.mp_public_key IS
  'Public Key APP_USR-… de Mercado Pago de la cuenta del club (visible en frontend; el Access Token queda en mp_access_token).';
