-- Reservas vinculadas al usuario de Auth (perfil / listados por cuenta)
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_reservas_user_id ON public.reservas (user_id);
