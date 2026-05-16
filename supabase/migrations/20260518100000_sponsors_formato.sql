-- Formato de visualización: ticker | card | ambos (default ticker).
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS formato text NULL;

COMMENT ON COLUMN public.sponsors.formato IS
  'Visualización: ticker (banda horizontal), card (card destacada full-bleed), ambos. NULL = ticker.';

UPDATE public.sponsors
SET formato = 'ticker'
WHERE formato IS NULL OR trim(formato) = '';
