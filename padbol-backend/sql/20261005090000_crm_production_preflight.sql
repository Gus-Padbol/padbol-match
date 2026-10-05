-- READ-ONLY. Ejecutar en el SQL Editor del proyecto productivo antes de migrar.
-- No devuelve cuerpos de mensajes, emails, teléfonos, tokens ni otros secretos.
select current_database() as database_name,
       current_setting('request.jwt.claims', true) is null as direct_sql_session;

select table_name,
       to_regclass(format('public.%I', table_name)) is not null as exists
from (values
  ('sedes'), ('user_roles'), ('crm_contacts'), ('crm_conversations'),
  ('crm_activities'), ('crm_inbound_events'), ('crm_replies'),
  ('ng_solicitudes_sede'), ('ng_registrations')
) as expected(table_name)
order by table_name;

do $preflight$
declare
  table_name text;
  row_count bigint;
  unassigned_count bigint;
  assigned_venues bigint;
  prueba_23_count bigint;
begin
  foreach table_name in array array['crm_contacts','crm_conversations','crm_activities','crm_inbound_events'] loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise notice '%: MISSING', table_name;
    else
      execute format('select count(*) from public.%I', table_name) into row_count;
      raise notice '%: % rows', table_name, row_count;
    end if;
  end loop;

  if to_regclass('public.crm_conversations') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='crm_conversations' and column_name='sede_id') then
    execute 'select count(*), count(distinct sede_id) from public.crm_conversations where sede_id is null or sede_id is not null'
      into unassigned_count, assigned_venues;
    execute 'select count(*) from public.crm_conversations where sede_id is null' into unassigned_count;
    raise notice 'crm_unassigned: %, crm_assigned_venues: %', unassigned_count, assigned_venues;
  else
    raise notice 'crm venue assignment: NOT INSTALLED';
  end if;

  if to_regclass('public.crm_conversations') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='crm_conversations' and column_name='subject') then
    execute 'select count(*) from public.crm_conversations where subject = $1'
      into prueba_23_count using 'Prueba 23';
    raise notice 'Prueba 23 exact matches: %', prueba_23_count;
  else
    raise notice 'Prueba 23 exact matches: unavailable before subject migration';
  end if;
end
$preflight$;
