-- RLS: políticas de escritura/edición/eliminación por rol (acceso directo frontend con anon key).
-- El backend con service_role bypassa RLS. Ejecutar en Supabase SQL Editor o vía migraciones.

-- ─── Helpers (roles admin) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pm_auth_has_admin_role(roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (roles)
  );
$$;

REVOKE ALL ON FUNCTION public.pm_auth_has_admin_role(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pm_auth_has_admin_role(text[]) TO authenticated, anon;

-- ─── public.reservas ─────────────────────────────────────────────────────────
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario ve sus reservas" ON public.reservas;
CREATE POLICY "Usuario ve sus reservas"
ON public.reservas
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin puede ver todas las reservas de su sede" ON public.reservas;
CREATE POLICY "Admin puede ver todas las reservas de su sede"
ON public.reservas
FOR SELECT
USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]));

DROP POLICY IF EXISTS "Usuario actualiza sus reservas" ON public.reservas;
CREATE POLICY "Usuario actualiza sus reservas"
ON public.reservas
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuario cancela sus reservas" ON public.reservas;
CREATE POLICY "Usuario cancela sus reservas"
ON public.reservas
FOR DELETE
USING (auth.uid() = user_id);

-- ─── public.torneos ────────────────────────────────────────────────────────────
ALTER TABLE public.torneos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin crea torneos" ON public.torneos;
CREATE POLICY "Admin crea torneos"
ON public.torneos
FOR INSERT
WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]));

DROP POLICY IF EXISTS "Admin edita torneos" ON public.torneos;
CREATE POLICY "Admin edita torneos"
ON public.torneos
FOR UPDATE
USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]));

DROP POLICY IF EXISTS "Admin elimina torneos" ON public.torneos;
CREATE POLICY "Admin elimina torneos"
ON public.torneos
FOR DELETE
USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]));

-- ─── public.jugadores ──────────────────────────────────────────────────────────
DO $jug$
BEGIN
  IF to_regclass('public.jugadores') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.jugadores ENABLE ROW LEVEL SECURITY;

  EXECUTE 'DROP POLICY IF EXISTS "Admin ve todos los jugadores" ON public.jugadores';
  EXECUTE $p$
    CREATE POLICY "Admin ve todos los jugadores"
    ON public.jugadores
    FOR SELECT
    USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
  $p$;

  EXECUTE 'DROP POLICY IF EXISTS "Usuario crea su perfil" ON public.jugadores';
  EXECUTE $p$
    CREATE POLICY "Usuario crea su perfil"
    ON public.jugadores
    FOR INSERT
    WITH CHECK (auth.uid() = user_id)
  $p$;
END
$jug$;

-- ─── public.sedes ──────────────────────────────────────────────────────────────
ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin crea sedes" ON public.sedes;
CREATE POLICY "Admin crea sedes"
ON public.sedes
FOR INSERT
WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_nacional', 'super_admin']::text[]));

DROP POLICY IF EXISTS "Admin edita su sede" ON public.sedes;
CREATE POLICY "Admin edita su sede"
ON public.sedes
FOR UPDATE
USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]));

-- ─── public.courts / public.canchas ────────────────────────────────────────────
DO $canchas$
DECLARE
  t text;
BEGIN
  IF to_regclass('public.courts') IS NOT NULL THEN
    t := 'courts';
  ELSIF to_regclass('public.canchas') IS NOT NULL THEN
    t := 'canchas';
  ELSE
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS "Admin gestiona canchas" ON public.%I', t);
  EXECUTE format(
    $p$
      CREATE POLICY "Admin gestiona canchas"
      ON public.%I
      FOR ALL
      USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
      WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
    $p$,
    t
  );
END
$canchas$;

-- ─── public.user_roles ─────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Solo super_admin gestiona roles" ON public.user_roles;
CREATE POLICY "Solo super_admin gestiona roles"
ON public.user_roles
FOR ALL
USING (public.pm_auth_has_admin_role(ARRAY['super_admin']::text[]))
WITH CHECK (public.pm_auth_has_admin_role(ARRAY['super_admin']::text[]));

DROP POLICY IF EXISTS "Usuario ve su propio rol" ON public.user_roles;
CREATE POLICY "Usuario ve su propio rol"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- ─── public.sponsors ───────────────────────────────────────────────────────────
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsors_super_admin_all" ON public.sponsors;

DROP POLICY IF EXISTS "Admin gestiona sponsors de su sede" ON public.sponsors;
CREATE POLICY "Admin gestiona sponsors de su sede"
ON public.sponsors
FOR ALL
TO authenticated
USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]));

-- sponsors_select_public_vigentes (migración previa) se mantiene para lectura pública.

-- ─── public.jugadores_torneo ───────────────────────────────────────────────────
ALTER TABLE public.jugadores_torneo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario se inscribe a torneo" ON public.jugadores_torneo;
CREATE POLICY "Usuario se inscribe a torneo"
ON public.jugadores_torneo
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuario ve su inscripción" ON public.jugadores_torneo;
CREATE POLICY "Usuario ve su inscripción"
ON public.jugadores_torneo
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin ve inscriptos" ON public.jugadores_torneo;
CREATE POLICY "Admin ve inscriptos"
ON public.jugadores_torneo
FOR SELECT
USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]));

-- ─── public.ranking_jugadores ──────────────────────────────────────────────────
DO $rk$
BEGIN
  IF to_regclass('public.ranking_jugadores') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.ranking_jugadores ENABLE ROW LEVEL SECURITY;

  EXECUTE 'DROP POLICY IF EXISTS "Solo sistema actualiza rankings" ON public.ranking_jugadores';
  EXECUTE $p$
    CREATE POLICY "Solo sistema actualiza rankings"
    ON public.ranking_jugadores
    FOR ALL
    USING (public.pm_auth_has_admin_role(ARRAY['admin_nacional', 'super_admin']::text[]))
    WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_nacional', 'super_admin']::text[]))
  $p$;

  EXECUTE 'DROP POLICY IF EXISTS "Lectura pública rankings" ON public.ranking_jugadores';
  EXECUTE $p$
    CREATE POLICY "Lectura pública rankings"
    ON public.ranking_jugadores
    FOR SELECT
    USING (true)
  $p$;
END
$rk$;

-- ─── public.tabla_puntos ─────────────────────────────────────────────────────
ALTER TABLE public.tabla_puntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Solo sistema actualiza puntos" ON public.tabla_puntos;
CREATE POLICY "Solo sistema actualiza puntos"
ON public.tabla_puntos
FOR ALL
USING (public.pm_auth_has_admin_role(ARRAY['admin_nacional', 'super_admin']::text[]))
WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_nacional', 'super_admin']::text[]));

DROP POLICY IF EXISTS "Lectura pública puntos" ON public.tabla_puntos;
CREATE POLICY "Lectura pública puntos"
ON public.tabla_puntos
FOR SELECT
USING (true);

-- ─── horarios_excepcionales, config_puntos, clasificaciones ────────────────────
DO $cfg$
BEGIN
  IF to_regclass('public.horarios_excepcionales') IS NOT NULL THEN
    ALTER TABLE public.horarios_excepcionales ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Admin gestiona horarios" ON public.horarios_excepcionales';
    EXECUTE $p$
      CREATE POLICY "Admin gestiona horarios"
      ON public.horarios_excepcionales
      FOR ALL
      USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
      WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
    $p$;
  END IF;

  IF to_regclass('public.config_puntos') IS NOT NULL THEN
    ALTER TABLE public.config_puntos ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Admin gestiona config puntos" ON public.config_puntos';
    EXECUTE $p$
      CREATE POLICY "Admin gestiona config puntos"
      ON public.config_puntos
      FOR ALL
      USING (public.pm_auth_has_admin_role(ARRAY['admin_nacional', 'super_admin']::text[]))
      WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_nacional', 'super_admin']::text[]))
    $p$;
  END IF;

  IF to_regclass('public.clasificaciones') IS NOT NULL THEN
    ALTER TABLE public.clasificaciones ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Admin gestiona clasificaciones" ON public.clasificaciones';
    EXECUTE $p$
      CREATE POLICY "Admin gestiona clasificaciones"
      ON public.clasificaciones
      FOR ALL
      USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
      WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
    $p$;
  END IF;
END
$cfg$;

-- ─── creditos, equipos, games, partidos, clientes, locations ─────────────────
DO $misc$
BEGIN
  IF to_regclass('public.creditos') IS NOT NULL THEN
    ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Usuario ve sus créditos" ON public.creditos';
    EXECUTE 'DROP POLICY IF EXISTS "Admin gestiona créditos" ON public.creditos';
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'creditos' AND column_name = 'user_id'
    ) THEN
      EXECUTE $p$
        CREATE POLICY "Usuario ve sus créditos"
        ON public.creditos FOR SELECT USING (auth.uid() = user_id)
      $p$;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'creditos' AND column_name = 'email'
    ) THEN
      EXECUTE $p$
        CREATE POLICY "Usuario ve sus créditos"
        ON public.creditos FOR SELECT
        USING (lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
      $p$;
    END IF;
    EXECUTE $p$
      CREATE POLICY "Admin gestiona créditos"
      ON public.creditos
      FOR ALL
      USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
      WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
    $p$;
  END IF;

  IF to_regclass('public.equipos') IS NOT NULL THEN
    ALTER TABLE public.equipos ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Lectura pública equipos" ON public.equipos';
    EXECUTE 'DROP POLICY IF EXISTS "Admin gestiona equipos" ON public.equipos';
    EXECUTE 'CREATE POLICY "Lectura pública equipos" ON public.equipos FOR SELECT USING (true)';
    EXECUTE $p$
      CREATE POLICY "Admin gestiona equipos"
      ON public.equipos
      FOR ALL
      USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
      WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
    $p$;
  END IF;

  IF to_regclass('public.partidos') IS NOT NULL THEN
    ALTER TABLE public.partidos ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Lectura pública partidos" ON public.partidos';
    EXECUTE 'DROP POLICY IF EXISTS "Usuario crea partido" ON public.partidos';
    EXECUTE 'DROP POLICY IF EXISTS "Usuario edita su partido" ON public.partidos';
    EXECUTE 'CREATE POLICY "Lectura pública partidos" ON public.partidos FOR SELECT USING (true)';
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'partidos' AND column_name = 'user_id'
    ) THEN
      EXECUTE $p$
        CREATE POLICY "Usuario crea partido"
        ON public.partidos FOR INSERT WITH CHECK (auth.uid() = user_id)
      $p$;
      EXECUTE $p$
        CREATE POLICY "Usuario edita su partido"
        ON public.partidos FOR UPDATE USING (auth.uid() = user_id)
      $p$;
    END IF;
  END IF;

  IF to_regclass('public.games') IS NOT NULL THEN
    ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Lectura pública games" ON public.games';
    EXECUTE 'CREATE POLICY "Lectura pública games" ON public.games FOR SELECT USING (true)';
  END IF;

  IF to_regclass('public.clientes') IS NOT NULL THEN
    ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Lectura pública clientes" ON public.clientes';
    EXECUTE 'DROP POLICY IF EXISTS "Admin gestiona clientes" ON public.clientes';
    EXECUTE 'CREATE POLICY "Lectura pública clientes" ON public.clientes FOR SELECT USING (true)';
    EXECUTE $p$
      CREATE POLICY "Admin gestiona clientes"
      ON public.clientes
      FOR ALL
      USING (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
      WITH CHECK (public.pm_auth_has_admin_role(ARRAY['admin_club', 'admin_nacional', 'super_admin']::text[]))
    $p$;
  END IF;

  IF to_regclass('public.locations') IS NOT NULL THEN
    ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Lectura pública locations" ON public.locations';
    EXECUTE 'DROP POLICY IF EXISTS "Super admin gestiona locations" ON public.locations';
    EXECUTE 'CREATE POLICY "Lectura pública locations" ON public.locations FOR SELECT USING (true)';
    EXECUTE $p$
      CREATE POLICY "Super admin gestiona locations"
      ON public.locations
      FOR ALL
      USING (public.pm_auth_has_admin_role(ARRAY['super_admin']::text[]))
      WITH CHECK (public.pm_auth_has_admin_role(ARRAY['super_admin']::text[]))
    $p$;
  END IF;
END
$misc$;

NOTIFY pgrst, 'reload schema';
