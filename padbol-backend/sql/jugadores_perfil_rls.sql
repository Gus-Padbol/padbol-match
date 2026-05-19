-- =============================================================================
-- jugadores_perfil: habilitar RLS y políticas por jugador + service_role
-- Ejecutar en Supabase → SQL Editor (o: supabase db execute / migración).
-- Re-ejecutable: elimina políticas con el mismo nombre antes de crearlas.
-- =============================================================================

ALTER TABLE jugadores_perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jugador_select_propio" ON jugadores_perfil;
DROP POLICY IF EXISTS "jugador_insert_propio" ON jugadores_perfil;
DROP POLICY IF EXISTS "jugador_update_propio" ON jugadores_perfil;
DROP POLICY IF EXISTS "service_role_all" ON jugadores_perfil;

-- Ver fila por user_id o por email de sesión (legacy sin user_id)
CREATE POLICY "jugador_select_propio" ON jugadores_perfil
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR lower(trim(coalesce(email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );

CREATE POLICY "jugador_insert_propio" ON jugadores_perfil
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "jugador_update_propio" ON jugadores_perfil
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR lower(trim(coalesce(email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
  WITH CHECK (auth.uid() = user_id);

-- El backend con service_role puede hacer todo (para operaciones admin)
CREATE POLICY "service_role_all" ON jugadores_perfil
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
