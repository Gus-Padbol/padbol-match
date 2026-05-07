-- Jugadores que buscan pareja para un torneo (dupla).
-- Ejecutar en el SQL Editor de Supabase si aún no existen las tablas.

CREATE TABLE IF NOT EXISTS public.busca_dupla_torneo (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  torneo_id bigint NOT NULL REFERENCES public.torneos (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT busca_dupla_torneo_torneo_user_uniq UNIQUE (torneo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_busca_dupla_torneo_torneo_id ON public.busca_dupla_torneo (torneo_id);

COMMENT ON TABLE public.busca_dupla_torneo IS
  'Jugadores registrados como “busco dupla” para un torneo (torneo_id + user_id).';

-- Invitación in-app para formar equipo desde busca dupla.
CREATE TABLE IF NOT EXISTS public.busca_dupla_invitacion (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  torneo_id bigint NOT NULL REFERENCES public.torneos (id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT busca_dupla_invitacion_distinto CHECK (from_user_id <> to_user_id),
  CONSTRAINT busca_dupla_invitacion_estado_chk CHECK (
    estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')
  ),
  CONSTRAINT busca_dupla_invitacion_triple_uniq UNIQUE (torneo_id, from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_busca_dupla_inv_torneo ON public.busca_dupla_invitacion (torneo_id);
CREATE INDEX IF NOT EXISTS idx_busca_dupla_inv_to_pendiente ON public.busca_dupla_invitacion (to_user_id)
  WHERE estado = 'pendiente';

COMMENT ON TABLE public.busca_dupla_invitacion IS
  'Invitación de un jugador a otro para formar dupla; al aceptar se crea el equipo.';
