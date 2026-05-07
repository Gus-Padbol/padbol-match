-- Matchmaking: el jugador puede marcarse como disponible para que otros lo encuentren en su sede.
ALTER TABLE public.jugadores_perfil
  ADD COLUMN IF NOT EXISTS busca_companero boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jugadores_perfil.busca_companero IS
  'Si true, puede aparecer en «Jugadores disponibles» del inicio para la misma sede (club habitual / sede_id).';
