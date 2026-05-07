ALTER TABLE public.sedes
ADD COLUMN IF NOT EXISTS metodo_pago text,
ADD COLUMN IF NOT EXISTS stripe_account_id text,
ADD COLUMN IF NOT EXISTS mp_access_token text,
ADD COLUMN IF NOT EXISTS pago_manual_instrucciones text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sedes_metodo_pago_check'
  ) THEN
    ALTER TABLE public.sedes
      ADD CONSTRAINT sedes_metodo_pago_check
      CHECK (metodo_pago IN ('mercadopago', 'stripe', 'manual'));
  END IF;
END $$;

UPDATE public.sedes
SET metodo_pago = COALESCE(NULLIF(lower(trim(metodo_pago)), ''), 'mercadopago')
WHERE metodo_pago IS NULL
   OR lower(trim(metodo_pago)) NOT IN ('mercadopago', 'stripe', 'manual');

ALTER TABLE public.sedes
ALTER COLUMN metodo_pago SET DEFAULT 'mercadopago';
