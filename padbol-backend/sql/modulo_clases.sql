-- Módulo clases / profesores / inscripciones

CREATE TABLE IF NOT EXISTS public.profesores (
  id bigserial PRIMARY KEY,
  sede_id bigint NOT NULL REFERENCES public.sedes (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  apellido text,
  foto_url text,
  bio text,
  deportes text[] NOT NULL DEFAULT '{}',
  certificado_fipa boolean NOT NULL DEFAULT false,
  aprobado boolean NOT NULL DEFAULT false,
  aprobado_por uuid,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profesores_sede ON public.profesores (sede_id);
CREATE INDEX IF NOT EXISTS idx_profesores_sede_aprobado ON public.profesores (sede_id, aprobado, activo);

CREATE TABLE IF NOT EXISTS public.clases (
  id bigserial PRIMARY KEY,
  sede_id bigint NOT NULL REFERENCES public.sedes (id) ON DELETE CASCADE,
  profesor_id bigint NOT NULL REFERENCES public.profesores (id) ON DELETE RESTRICT,
  cancha_id bigint REFERENCES public.canchas (id) ON DELETE SET NULL,
  deporte text NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  tipo text NOT NULL DEFAULT 'grupal',
  cupo_maximo integer NOT NULL DEFAULT 4 CHECK (cupo_maximo > 0),
  duracion_minutos integer NOT NULL DEFAULT 60 CHECK (duracion_minutos > 0),
  precio numeric NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clases_sede ON public.clases (sede_id, activo);
CREATE INDEX IF NOT EXISTS idx_clases_profesor ON public.clases (profesor_id);

CREATE TABLE IF NOT EXISTS public.clases_horarios (
  id bigserial PRIMARY KEY,
  clase_id bigint NOT NULL REFERENCES public.clases (id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clases_horarios_clase ON public.clases_horarios (clase_id);

CREATE TABLE IF NOT EXISTS public.inscripciones_clases (
  id bigserial PRIMARY KEY,
  clase_id bigint NOT NULL REFERENCES public.clases (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  reserva_id bigint REFERENCES public.reservas (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inscripciones_clases_slot_user
  ON public.inscripciones_clases (clase_id, user_id, fecha, hora_inicio);

CREATE INDEX IF NOT EXISTS idx_inscripciones_clases_clase_fecha
  ON public.inscripciones_clases (clase_id, fecha, hora_inicio);

ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS tipo text;
