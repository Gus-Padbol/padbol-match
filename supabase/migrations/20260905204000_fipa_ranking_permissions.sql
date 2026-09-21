-- Privilegios explícitos: RLS define qué filas se ven; los grants habilitan el
-- acceso público de solo lectura y las operaciones controladas del backend.
grant select on table
  public.fipa_jugadores_oficiales,
  public.fipa_ranking_instantaneas,
  public.fipa_ranking_entradas
to anon, authenticated;

grant select on table public.fipa_jugador_reclamaciones to authenticated;

grant all privileges on table
  public.fipa_asociaciones_nacionales,
  public.fipa_jugadores_oficiales,
  public.fipa_ranking_instantaneas,
  public.fipa_ranking_entradas,
  public.fipa_jugador_reclamaciones,
  public.fipa_jugador_vinculacion_auditoria
to service_role;

grant usage, select on all sequences in schema public to service_role;

