-- Upsert por user_id (OAuth / completar perfil) + ver/editar fila legacy por email de sesión.

CREATE UNIQUE INDEX IF NOT EXISTS jugadores_perfil_user_id_unique
  ON public.jugadores_perfil (user_id)
  WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "jugador_select_propio" ON public.jugadores_perfil;
DROP POLICY IF EXISTS "jugador_insert_propio" ON public.jugadores_perfil;
DROP POLICY IF EXISTS "jugador_update_propio" ON public.jugadores_perfil;
DROP POLICY IF EXISTS "service_role_all" ON public.jugadores_perfil;

CREATE POLICY "jugador_select_propio" ON public.jugadores_perfil
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR lower(trim(coalesce(email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );

CREATE POLICY "jugador_insert_propio" ON public.jugadores_perfil
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "jugador_update_propio" ON public.jugadores_perfil
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR lower(trim(coalesce(email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_all" ON public.jugadores_perfil
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
