begin;

alter table public.crm_conversations
  add column if not exists sede_id bigint references public.sedes(id) on delete set null,
  add column if not exists assigned_by text,
  add column if not exists assigned_at timestamptz;

create index if not exists idx_crm_conversations_sede_updated
  on public.crm_conversations (sede_id, updated_at desc);

do $$ begin
  alter table public.crm_conversations add constraint crm_conversations_assignment_check
    check (
      (sede_id is null and assigned_by is null and assigned_at is null)
      or (sede_id is not null and assigned_by is not null and assigned_at is not null)
    );
exception when duplicate_object then null; end $$;

comment on column public.crm_conversations.sede_id is
  'Sede canónica asignada explícitamente. NULL queda sólo en bandeja global del Super Admin.';
comment on column public.crm_conversations.origin is
  'Origen preservado. Las altas manuales usan manual:in_person, manual:phone, manual:whatsapp, manual:email o manual:other.';

alter table public.ng_solicitudes_sede
  add column if not exists canonical_sede_id bigint references public.sedes(id) on delete set null;
create unique index if not exists uq_ng_solicitudes_canonical_sede
  on public.ng_solicitudes_sede (canonical_sede_id) where canonical_sede_id is not null;

-- El acceso directo permanece cerrado; el backend valida JWT, rol y sede canónica.
revoke all on table public.crm_contacts from anon, authenticated;
revoke all on table public.crm_conversations from anon, authenticated;
revoke all on table public.crm_activities from anon, authenticated;
revoke all on table public.crm_inbound_events from anon, authenticated;

commit;
