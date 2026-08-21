-- Publicidad del marcador: una misma pieza puede usarse en varias pausas.
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS scoreboard_placements text[] NOT NULL
    DEFAULT ARRAY['ticker', 'game_break', 'rest', 'set_break', 'waiting']::text[],
  ADD COLUMN IF NOT EXISTS scoreboard_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.sponsors
  DROP CONSTRAINT IF EXISTS sponsors_scoreboard_placements_check;

ALTER TABLE public.sponsors
  ADD CONSTRAINT sponsors_scoreboard_placements_check
  CHECK (scoreboard_placements <@ ARRAY['ticker', 'game_break', 'rest', 'set_break', 'waiting']::text[]);

COMMENT ON COLUMN public.sponsors.scoreboard_placements IS 'Ubicaciones del marcador donde aparece la pieza publicitaria.';
COMMENT ON COLUMN public.sponsors.scoreboard_order IS 'Orden ascendente dentro de cada carrusel del marcador.';
