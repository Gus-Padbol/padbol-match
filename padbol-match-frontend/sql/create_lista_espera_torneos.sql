-- Lista de espera antes de abrir inscripción (torneos en planificación / próximo).
CREATE TABLE IF NOT EXISTS public.lista_espera_torneos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id bigint NOT NULL REFERENCES public.torneos (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  nombre text,
  whatsapp text,
  inscripcion_abierta_notificado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lista_espera_torneos_torneo_user UNIQUE (torneo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lista_espera_torneos_torneo_id ON public.lista_espera_torneos (torneo_id);
