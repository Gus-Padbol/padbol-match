-- PostgREST upsert onConflict=user_id emits ON CONFLICT(user_id) without a predicate.
-- The older partial unique index cannot arbitrate that statement (Postgres 42P10).
-- Keep all existing indexes, rows, and RLS policies; a full unique index permits
-- multiple NULL legacy identities while making authenticated profile upserts valid.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.jugadores_perfil WHERE user_id IS NOT NULL
             GROUP BY user_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate profile identities: repair requires separate review';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS jugadores_perfil_user_id_upsert_unique
  ON public.jugadores_perfil (user_id);
NOTIFY pgrst, 'reload schema';
COMMIT;
