-- Limpieza manual BUG-02 (ejecutar ANTES de 20260518120100_jugadores_perfil_whatsapp_unique.sql)
-- IDs específicos de producción Padbol Match — no ejecutar en otros entornos sin revisar.

-- Verificación previa (opcional)
-- SELECT id, user_id, email, whatsapp, created_at
-- FROM jugadores_perfil
-- WHERE id IN (2, 3, 4, 21546, 21547, 21548, 21549)
--    OR whatsapp IN ('+542215676810')
-- ORDER BY whatsapp, created_at DESC;

-- Eliminar huérfanos (sin user_id)
DELETE FROM jugadores_perfil WHERE id IN (2, 3);

-- Eliminar duplicados de tu número (conservás id 4)
DELETE FROM jugadores_perfil WHERE id IN (21546, 21547);

-- Eliminar duplicado de +542215676810 (conservás id 21548)
DELETE FROM jugadores_perfil WHERE id IN (21549);

-- Después: aplicar migración del índice único
-- supabase/migrations/20260518120100_jugadores_perfil_whatsapp_unique.sql
