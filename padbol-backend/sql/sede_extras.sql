-- Extras opcionales por sede (tercer tiempo) — checkout armar partido / Mercado Pago.
-- El club crea filas; solo visibles al público si activo y aprobado_super.

CREATE TABLE IF NOT EXISTS public.sede_extras (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sede_id bigint NOT NULL REFERENCES public.sedes (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  precio numeric NOT NULL,
  precio_moneda text NOT NULL DEFAULT 'ARS',
  imagen_url text,
  activo boolean NOT NULL DEFAULT true,
  aprobado_super boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sede_extras_sede_activo_aprobado
  ON public.sede_extras (sede_id)
  WHERE activo = true AND aprobado_super = true;

CREATE INDEX IF NOT EXISTS idx_sede_extras_pendientes
  ON public.sede_extras (sede_id, created_at DESC)
  WHERE activo = true AND aprobado_super = false;

COMMENT ON TABLE public.sede_extras IS 'Productos/servicios opcionales post-reserva (tercer tiempo); requieren aprobación super_admin para mostrarse al jugador.';
COMMENT ON COLUMN public.sede_extras.aprobado_super IS 'Si es true, el extra puede listarse en checkout público.';
