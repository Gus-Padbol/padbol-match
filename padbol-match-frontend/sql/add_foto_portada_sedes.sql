-- Supabase SQL Editor: foto de portada/hero elegida en admin (Mi Sede → Imágenes)
ALTER TABLE sedes ADD COLUMN IF NOT EXISTS foto_portada TEXT;

-- Migrar hero previo desde fotos_destacadas[0] si existía
UPDATE sedes
SET foto_portada = TRIM(fotos_destacadas->>0)
WHERE foto_portada IS NULL
  AND fotos_destacadas IS NOT NULL
  AND jsonb_typeof(fotos_destacadas) = 'array'
  AND jsonb_array_length(fotos_destacadas) > 0
  AND TRIM(fotos_destacadas->>0) <> '';
