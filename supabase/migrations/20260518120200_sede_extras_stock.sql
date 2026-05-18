-- MEJ-04: stock en extras del tercer tiempo (tabla real: sede_extras; alias informe: productos_tercer_tiempo)

ALTER TABLE public.sede_extras
  ADD COLUMN IF NOT EXISTS stock integer DEFAULT NULL;

COMMENT ON COLUMN public.sede_extras.stock IS 'NULL = stock ilimitado; 0 = agotado (activo puede pasar a false vía trigger).';

-- activo ya existe en sede_extras.sql

CREATE OR REPLACE FUNCTION public.check_stock_agotado_sede_extras()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock IS NOT NULL AND NEW.stock = 0 AND (OLD.stock IS NULL OR OLD.stock > 0) THEN
    NEW.activo := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_stock_agotado ON public.sede_extras;
CREATE TRIGGER trigger_stock_agotado
  BEFORE UPDATE OF stock ON public.sede_extras
  FOR EACH ROW
  EXECUTE FUNCTION public.check_stock_agotado_sede_extras();

NOTIFY pgrst, 'reload schema';
