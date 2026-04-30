-- Supabase SQL Editor: franjas de precio editables por sede (JSONB)
ALTER TABLE sedes ADD COLUMN IF NOT EXISTS franjas_horarias JSONB DEFAULT '[]'::jsonb;
