-- Lista de espera general de torneos por sede y deporte (admin Mi Sede).
CREATE TABLE IF NOT EXISTS public.lista_espera_general (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id bigint NOT NULL REFERENCES public.sedes (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  deporte text NOT NULL DEFAULT 'padbol',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lista_espera_general_sede_user_deporte UNIQUE (sede_id, user_id, deporte)
);

CREATE INDEX IF NOT EXISTS idx_lista_espera_general_sede_id ON public.lista_espera_general (sede_id);
CREATE INDEX IF NOT EXISTS idx_lista_espera_general_sede_deporte ON public.lista_espera_general (sede_id, deporte);
