-- Bucket público para fotos de profesores (solicitud instructor: {user_id}/foto.jpg)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profesores', 'profesores', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "profesores_bucket_public_read" ON storage.objects;
CREATE POLICY "profesores_bucket_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profesores');

DROP POLICY IF EXISTS "profesores_bucket_auth_insert_own" ON storage.objects;
CREATE POLICY "profesores_bucket_auth_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profesores'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "profesores_bucket_auth_update_own" ON storage.objects;
CREATE POLICY "profesores_bucket_auth_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profesores'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profesores'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "profesores_bucket_auth_delete_own" ON storage.objects;
CREATE POLICY "profesores_bucket_auth_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profesores'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
