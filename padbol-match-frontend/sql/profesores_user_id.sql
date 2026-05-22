-- Vincula un profesor con la cuenta auth (autogestión WhatsApp / bio en Mi Perfil)
ALTER TABLE public.profesores ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profesores_user_id_unique
  ON public.profesores (user_id)
  WHERE user_id IS NOT NULL;
