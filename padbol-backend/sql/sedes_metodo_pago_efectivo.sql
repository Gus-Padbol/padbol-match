-- Añade 'efectivo' como método de cobro de reservas/torneos en sedes (pago presencial en club, sin pasarela).
ALTER TABLE public.sedes DROP CONSTRAINT IF EXISTS sedes_metodo_pago_check;

ALTER TABLE public.sedes
  ADD CONSTRAINT sedes_metodo_pago_check
  CHECK (
    metodo_pago IS NULL
    OR lower(trim(metodo_pago)) IN ('mercadopago', 'stripe', 'manual', 'efectivo')
  );

UPDATE public.sedes
SET metodo_pago = 'mercadopago'
WHERE metodo_pago IS NOT NULL
  AND lower(trim(metodo_pago)) NOT IN ('mercadopago', 'stripe', 'manual', 'efectivo');
