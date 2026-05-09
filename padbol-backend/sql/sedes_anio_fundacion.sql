-- Año de fundación del club (perfil público / estadísticas «En números»).
alter table public.sedes add column if not exists anio_fundacion integer;

comment on column public.sedes.anio_fundacion is 'Año de fundación opcional (1800–2100); visible en /sede/:id si está cargado.';
