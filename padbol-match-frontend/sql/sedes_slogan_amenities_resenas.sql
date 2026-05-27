-- Slogan, amenities JSONB, respuesta admin en reseñas de sede, reseñas de jugadores.
-- Ejecutar en Supabase SQL Editor (idempotente).

ALTER TABLE public.sedes ADD COLUMN IF NOT EXISTS slogan text;
ALTER TABLE public.sedes ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.resenas ADD COLUMN IF NOT EXISTS respuesta_admin text;
ALTER TABLE public.resenas ADD COLUMN IF NOT EXISTS fecha_respuesta timestamptz;

CREATE TABLE IF NOT EXISTS public.resenas_jugadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jugador_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  autor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  estrellas integer NOT NULL CHECK (estrellas >= 1 AND estrellas <= 5),
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resenas_jugadores_unique UNIQUE (jugador_user_id, autor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_resenas_jugadores_jugador_created
  ON public.resenas_jugadores (jugador_user_id, created_at DESC);

COMMENT ON TABLE public.resenas_jugadores IS 'Reseñas que otros jugadores dejan sobre un perfil público.';
