-- Logo opcional del torneo en pantalla TV del scoreboard
ALTER TABLE public.scoreboard_partidos
  ADD COLUMN IF NOT EXISTS logo_torneo_url TEXT;
