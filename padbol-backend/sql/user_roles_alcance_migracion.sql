-- 1) Nueva columna de alcance geográfico en user_roles.
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS alcance text;

-- 2) Constraint de valores permitidos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_alcance_check'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_alcance_check
      CHECK (alcance IN ('sede', 'ciudad', 'provincia', 'pais', 'global'));
  END IF;
END $$;

-- 3) Valor por defecto para nuevas filas.
ALTER TABLE public.user_roles
ALTER COLUMN alcance SET DEFAULT 'sede';

-- 4) Migración automática de roles existentes (sin romper comportamiento actual).
UPDATE public.user_roles
SET alcance = CASE
  WHEN role = 'super_admin' THEN 'global'
  WHEN role = 'admin_nacional' THEN 'pais'
  WHEN role = 'admin_club' THEN 'sede'
  ELSE COALESCE(alcance, 'sede')
END
WHERE alcance IS NULL
   OR alcance NOT IN ('sede', 'ciudad', 'provincia', 'pais', 'global');

-- 5) Recomendado: campos geográficos para nuevos alcances.
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS ciudad text,
ADD COLUMN IF NOT EXISTS provincia text;

-- 6) Endurecer: evitar NULL luego de migrar.
ALTER TABLE public.user_roles
ALTER COLUMN alcance SET NOT NULL;
