-- Tabla de contratos de sedes
CREATE TABLE IF NOT EXISTS public.contratos_sedes (
  id bigserial PRIMARY KEY,
  sede_id bigint NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  fecha_inicio date NOT NULL,
  fecha_vencimiento date NULL,
  referencia text NULL,
  archivo_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contratos_sedes_sede_id_idx
  ON public.contratos_sedes (sede_id);

CREATE INDEX IF NOT EXISTS contratos_sedes_created_at_idx
  ON public.contratos_sedes (created_at DESC);

-- Bucket Storage para archivos de contratos
INSERT INTO storage.buckets (id, name, public)
SELECT 'contratos', 'contratos', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'contratos'
);
