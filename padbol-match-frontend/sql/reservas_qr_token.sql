-- QR check-in: token único por reserva + auditoría de ingreso.
-- Ejecutar en Supabase SQL Editor (no se aplica automáticamente desde el repo).

ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS qr_token text UNIQUE;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS checkin_at timestamptz;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS checkin_by text;
CREATE INDEX IF NOT EXISTS idx_reservas_qr_token ON public.reservas(qr_token);
