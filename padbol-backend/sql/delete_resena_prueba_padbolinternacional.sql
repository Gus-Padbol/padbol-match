-- Borrar reseña(s) de prueba sin comentario del usuario padbolinternacional@gmail.com.
-- Tabla real del proyecto: public.resenas (ver resenas_sedes.sql).
-- Ejecutar en Supabase → SQL Editor.

DELETE FROM public.resenas r
USING auth.users u
WHERE r.user_id = u.id
  AND lower(u.email) = lower('padbolinternacional@gmail.com')
  AND (r.comentario IS NULL OR trim(r.comentario) = '');
