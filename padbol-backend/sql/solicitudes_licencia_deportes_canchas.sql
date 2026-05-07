-- Deportes ofrecidos y canchas opcionales por deporte (solicitud pública /unirse).
ALTER TABLE public.solicitudes_licencia
  ADD COLUMN IF NOT EXISTS deportes_canchas jsonb NULL;

COMMENT ON COLUMN public.solicitudes_licencia.deportes_canchas IS
  'JSON: { "deportes": ["padbol", ...], "canchas": { "padbol": 2, ... } }';
