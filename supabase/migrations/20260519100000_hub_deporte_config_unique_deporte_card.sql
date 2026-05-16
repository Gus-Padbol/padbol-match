-- Una fila por (deporte, card_key); evita que un upload pise otros deportes.
ALTER TABLE public.hub_deporte_config DROP CONSTRAINT IF EXISTS hub_deporte_config_card_key_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'hub_deporte_config'
      AND c.conname = 'hub_deporte_config_deporte_card_key_uniq'
  ) THEN
    ALTER TABLE public.hub_deporte_config
      ADD CONSTRAINT hub_deporte_config_deporte_card_key_uniq UNIQUE (deporte, card_key);
  END IF;
END $$;
