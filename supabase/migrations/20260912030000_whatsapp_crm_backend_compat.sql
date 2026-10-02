-- Compatibilidad entre el esquema CRM reconstruido y el backend contractual.
-- Sólo agrega trazabilidad; no borra ni reescribe contactos, orígenes o eventos.

alter table public.whatsapp_crm_contact_origins
  add column if not exists first_seen_at timestamptz,
  add column if not exists last_seen_at timestamptz;

update public.whatsapp_crm_contact_origins
set first_seen_at = coalesce(first_seen_at, created_at, now()),
    last_seen_at = coalesce(last_seen_at, created_at, now())
where first_seen_at is null or last_seen_at is null;

alter table public.whatsapp_crm_contact_origins
  alter column first_seen_at set default now(),
  alter column first_seen_at set not null,
  alter column last_seen_at set default now(),
  alter column last_seen_at set not null;

alter table public.whatsapp_crm_timeline
  add column if not exists actor_user_id uuid;

comment on column public.whatsapp_crm_contact_origins.first_seen_at is
  'Primera detección de esta procedencia para la ficha CRM.';
comment on column public.whatsapp_crm_contact_origins.last_seen_at is
  'Última detección de esta procedencia para la ficha CRM.';
comment on column public.whatsapp_crm_timeline.actor_user_id is
  'Usuario autenticado que ejecutó la acción; null para sincronizaciones automáticas o formularios públicos.';
