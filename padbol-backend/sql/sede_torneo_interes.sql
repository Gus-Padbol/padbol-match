-- Jugadores que quieren que la sede organice un torneo (lista de espera a nivel sede).
CREATE TABLE IF NOT EXISTS public.sede_torneo_interes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id bigint NOT NULL REFERENCES public.sedes (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  nombre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sede_torneo_interes_sede_user UNIQUE (sede_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sede_torneo_interes_sede_id ON public.sede_torneo_interes (sede_id);
