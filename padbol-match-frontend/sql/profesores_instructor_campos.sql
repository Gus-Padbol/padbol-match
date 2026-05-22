-- Campos para solicitud Instructor FIPA desde Mi Perfil
ALTER TABLE public.profesores ADD COLUMN IF NOT EXISTS fecha_nacimiento date;
ALTER TABLE public.profesores ADD COLUMN IF NOT EXISTS genero text;

COMMENT ON COLUMN public.profesores.fecha_nacimiento IS 'Fecha de nacimiento (solicitud instructor)';
COMMENT ON COLUMN public.profesores.genero IS 'masculino | femenino | no_decir';
