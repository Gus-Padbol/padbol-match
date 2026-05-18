-- BUG-02: teléfono único en registro
-- La app usa jugadores_perfil.whatsapp (E.164), no public.profiles.phone.
-- Antes de aplicar: revisar duplicados:
--   SELECT whatsapp, COUNT(*) FROM jugadores_perfil
--   WHERE whatsapp IS NOT NULL AND trim(whatsapp) <> ''
--   GROUP BY whatsapp HAVING COUNT(*) > 1;
-- Conservar el registro más reciente (created_at) y anular whatsapp en los demás.

CREATE UNIQUE INDEX IF NOT EXISTS jugadores_perfil_whatsapp_unique
  ON public.jugadores_perfil (whatsapp)
  WHERE whatsapp IS NOT NULL AND trim(whatsapp) <> '';
