-- Preferencia de idioma usada para comunicaciones segmentadas autorizadas.
ALTER TABLE public.jugadores_perfil
  ADD COLUMN IF NOT EXISTS idioma_preferido text;

CREATE INDEX IF NOT EXISTS jugadores_perfil_idioma_preferido_idx
  ON public.jugadores_perfil (idioma_preferido)
  WHERE idioma_preferido IS NOT NULL;

COMMENT ON COLUMN public.jugadores_perfil.idioma_preferido IS
  'Idioma elegido por la persona en Padbol Match. Se usa para enviar comunicaciones en ese idioma.';
