-- Corrección: si hubo UNIQUE solo sobre card_key, todas las filas compartían la misma clave lógica por card
-- y un deporte pisaba las fotos del otro. Ejecutar en Supabase SQL Editor una sola vez (revisar errores).
--
-- Quitar nombre típico de Postgres para UNIQUE(card_key).
ALTER TABLE hub_deporte_config DROP CONSTRAINT IF EXISTS hub_deporte_config_card_key_key;

-- Añadir UNIQUE(deporte, card_key) solo si aún no existe este nombre.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'hub_deporte_config'
      AND c.conname = 'hub_deporte_config_deporte_card_key_uniq'
  ) THEN
    ALTER TABLE hub_deporte_config
      ADD CONSTRAINT hub_deporte_config_deporte_card_key_uniq UNIQUE (deporte, card_key);
  END IF;
END $$;
