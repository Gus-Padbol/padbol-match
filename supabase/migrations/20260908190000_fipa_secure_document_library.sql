-- Biblioteca documental FIPA. Toda lectura y escritura operativa pasa por el
-- backend con service_role; los objetos nunca tienen una URL pública estable.

begin;

create table if not exists public.fipa_library_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  category text not null,
  locale text not null default 'es',
  version text not null,
  storage_path text not null unique,
  original_filename text not null,
  byte_size bigint,
  sha256 text,
  access_level text not null check (access_level in ('authenticated', 'member')),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  sort_order integer not null default 0,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, locale),
  constraint fipa_library_documents_text_check check (
    length(trim(slug)) > 0
    and length(trim(title)) > 0
    and length(trim(version)) > 0
    and length(trim(storage_path)) > 0
    and length(trim(original_filename)) > 0
  ),
  constraint fipa_library_documents_published_integrity_check check (
    status <> 'published'
    or (
      published_at is not null
      and byte_size is not null
      and byte_size > 0
      and sha256 is not null
      and sha256 ~ '^[a-f0-9]{64}$'
    )
  )
);

create table if not exists public.fipa_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  email_snapshot text,
  sede_id bigint references public.sedes(id) on delete set null,
  declared_sede_id bigint,
  venue_not_listed boolean not null default false,
  club_name text,
  country text,
  city text,
  address text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reason_code text not null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  updated_at timestamptz not null default now(),
  constraint fipa_access_requests_declared_details_check check (
    sede_id is not null
    or declared_sede_id is not null
    or (
      venue_not_listed
      and length(trim(coalesce(club_name, ''))) > 0
      and length(trim(coalesce(country, ''))) > 0
      and length(trim(coalesce(city, ''))) > 0
      and length(trim(coalesce(address, ''))) > 0
    )
  ),
  constraint fipa_access_requests_review_check check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'pending' and reviewed_at is not null)
  )
);

create unique index if not exists uq_fipa_access_request_pending_user
  on public.fipa_access_requests(user_id)
  where status = 'pending';
create index if not exists idx_fipa_access_requests_review_queue
  on public.fipa_access_requests(status, requested_at);

create table if not exists public.fipa_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid references public.fipa_access_requests(id) on delete set null,
  sede_id bigint references public.sedes(id) on delete set null,
  access_level text not null default 'member' check (access_level = 'member'),
  source text not null check (source in ('manual_exception', 'verified_membership')),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  updated_at timestamptz not null default now(),
  constraint fipa_access_grants_expiry_check check (expires_at is null or expires_at > granted_at),
  constraint fipa_access_grants_revocation_check check (
    (status = 'revoked' and revoked_at is not null and length(trim(coalesce(revocation_reason, ''))) > 0)
    or (status <> 'revoked' and revoked_at is null)
  )
);

create unique index if not exists uq_fipa_access_grant_active_user
  on public.fipa_access_grants(user_id)
  where status = 'active';
create index if not exists idx_fipa_access_grants_user_status
  on public.fipa_access_grants(user_id, status, expires_at);

create table if not exists public.fipa_library_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  purpose text not null check (purpose in (
    'aprender_jugar', 'jugador', 'entrenador_arbitro', 'club_sede',
    'organizar_competencia', 'investigacion_prensa', 'evaluar_proyecto', 'otro'
  )),
  purpose_other text,
  plays_padbol text not null check (plays_padbol in ('yes', 'no', 'prefer_not')),
  linked_to_club text not null check (linked_to_club in ('yes', 'no', 'prefer_not')),
  sede_id bigint references public.sedes(id) on delete set null,
  declared_sede_id bigint,
  venue_not_listed boolean not null default false,
  club_name text,
  country text,
  city text,
  address text,
  venue_reason_code text not null,
  whatsapp text,
  whatsapp_consent boolean not null default false,
  whatsapp_consent_at timestamptz,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fipa_library_profiles_other_check check (
    (purpose = 'otro' and length(trim(coalesce(purpose_other, ''))) > 0)
    or (purpose <> 'otro' and purpose_other is null)
  ),
  constraint fipa_library_profiles_linked_venue_check check (
    linked_to_club <> 'yes'
    or sede_id is not null
    or (
      length(trim(coalesce(club_name, ''))) > 0
      and length(trim(coalesce(country, ''))) > 0
      and length(trim(coalesce(city, ''))) > 0
      and length(trim(coalesce(address, ''))) > 0
    )
  ),
  constraint fipa_library_profiles_whatsapp_check check (
    (whatsapp is null and not whatsapp_consent and whatsapp_consent_at is null)
    or (length(trim(coalesce(whatsapp, ''))) > 0 and whatsapp_consent and whatsapp_consent_at is not null)
  )
);

create table if not exists public.fipa_document_access_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in (
    'request_submitted',
    'profile_upserted',
    'request_approved',
    'request_rejected',
    'grant_revoked',
    'download_authorized',
    'download_link_issued',
    'download_link_failed',
    'download_link_denied'
  )),
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  request_id uuid references public.fipa_access_requests(id) on delete set null,
  grant_id uuid references public.fipa_access_grants(id) on delete set null,
  document_id uuid references public.fipa_library_documents(id) on delete set null,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_fipa_document_events_actor_time
  on public.fipa_document_access_events(actor_user_id, occurred_at desc);
create index if not exists idx_fipa_document_events_request
  on public.fipa_document_access_events(request_id, occurred_at);

alter table public.fipa_library_documents enable row level security;
alter table public.fipa_library_documents force row level security;
alter table public.fipa_access_requests enable row level security;
alter table public.fipa_access_requests force row level security;
alter table public.fipa_access_grants enable row level security;
alter table public.fipa_access_grants force row level security;
alter table public.fipa_library_profiles enable row level security;
alter table public.fipa_library_profiles force row level security;
alter table public.fipa_document_access_events enable row level security;
alter table public.fipa_document_access_events force row level security;

revoke all on table public.fipa_library_documents from public, anon, authenticated;
revoke all on table public.fipa_access_requests from public, anon, authenticated;
revoke all on table public.fipa_access_grants from public, anon, authenticated;
revoke all on table public.fipa_library_profiles from public, anon, authenticated;
revoke all on table public.fipa_document_access_events from public, anon, authenticated;

grant select on table public.fipa_library_documents to service_role;
grant select on table public.fipa_access_requests to service_role;
grant select on table public.fipa_access_grants to service_role;
grant select on table public.fipa_library_profiles to service_role;
grant select, insert on table public.fipa_document_access_events to service_role;
grant usage, select on sequence public.fipa_document_access_events_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fipa-secure-documents',
  'fipa-secure-documents',
  false,
  26214400,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Una política permisiva global preexistente de Storage podría autorizar un
-- bucket privado. Esta política RESTRICTIVE mantiene este bucket fuera de toda
-- operación de cliente aunque exista otra política más amplia. service_role
-- conserva el bypass de RLS que usa el backend para cargar y firmar objetos.
drop policy if exists fipa_secure_documents_backend_only on storage.objects;
create policy fipa_secure_documents_backend_only
  on storage.objects
  as restrictive
  for all
  to anon, authenticated
  using (bucket_id <> 'fipa-secure-documents')
  with check (bucket_id <> 'fipa-secure-documents');

-- Se crean como borradores: publicar exige cargar el objeto real y completar
-- tamaño, SHA-256 y fecha. La migración por sí sola nunca expone placeholders.
insert into public.fipa_library_documents
  (slug, title, category, locale, version, storage_path, original_filename, byte_size, sha256, access_level, status, sort_order)
values
  ('reglamento-oficial', 'Reglamento Oficial de Padbol', 'reglas', 'es', '2026',
   'reglamento-oficial/2026/Reglamento-Oficial-Padbol-Propuesta-2026-ES.pdf',
   'Reglamento-Oficial-Padbol-Propuesta-2026-ES.pdf', 9369926,
   'c40130aadfd1b2eca4bee56d29f5426e19729cd7af1654a0a3db27199b1c62f4', 'authenticated', 'draft', 10),
  ('reglamento-oficial', 'Official Padbol Rules', 'reglas', 'en', '2026',
   'reglamento-oficial/2026/Reglamento-Oficial-Padbol-Propuesta-2026-EN.pdf',
   'Reglamento-Oficial-Padbol-Propuesta-2026-EN.pdf', 9364568,
   '767ab82a21db43d72d284f053b534b12fd189e5d59356487d3cb6eb5c4225db5', 'authenticated', 'draft', 11),
  ('codigo-conducta', 'Código de Conducta de Competiciones Oficiales', 'conducta', 'es-en', '2026',
   'codigo-conducta/2026/08_Codigo_de_Conducta_Competiciones_Oficiales_Padbol_2026_Bilingue.pdf',
   '08_Codigo_de_Conducta_Competiciones_Oficiales_Padbol_2026_Bilingue.pdf', 258494,
   'fe68afe7af7e4f56f6d194cebe79e263b99515a1a27670c083c5b717e4404c9a', 'authenticated', 'draft', 20),
  ('reglamento-competiciones-internacionales', 'Reglamento de Competiciones Internacionales FIPA', 'competencias', 'es-en', '2026',
   'documentos-miembros/2026/01_Reglamento_de_Competiciones_Internacionales_FIPA_2026_Bilingue.pdf',
   '01_Reglamento_de_Competiciones_Internacionales_FIPA_2026_Bilingue.pdf', 90546,
   '551451a0c16fde072ef1fa196586bf4f6e1f4ed7b5340c0329b9406070dfdeae', 'member', 'draft', 30),
  ('manual-arbitros', 'Reglamento y Manual de Árbitros FIPA', 'arbitraje', 'es-en', '2026',
   'documentos-miembros/2026/02_Reglamento_y_Manual_de_Arbitros_FIPA_2026_Bilingue.pdf',
   '02_Reglamento_y_Manual_de_Arbitros_FIPA_2026_Bilingue.pdf', 79672,
   '20e20ea24774556900fcc27ce87a31ba349bc6191684440e6579201fc71f76fc', 'member', 'draft', 40),
  ('protocolo-contingencia-planilla', 'Protocolo de Contingencia y Planilla Oficial Padbol Match', 'operacion', 'es-en', '2026',
   'documentos-miembros/2026/03_Protocolo_de_Contingencia_y_Planilla_Oficial_Padbol_Match_FIPA_2026_Bilingue.pdf',
   '03_Protocolo_de_Contingencia_y_Planilla_Oficial_Padbol_Match_FIPA_2026_Bilingue.pdf', 82754,
   'db1e95dfa30826e4a1fe4cd52d9c28abcdca720eb5255aff32c8b585fa30533e', 'member', 'draft', 50),
  ('criterios-ranking-desempate', 'Criterios de Ranking y Desempate FIPA', 'ranking', 'es-en', '2026',
   'documentos-miembros/2026/04_Criterios_de_Ranking_y_Desempate_FIPA_2026_Bilingue.pdf',
   '04_Criterios_de_Ranking_y_Desempate_FIPA_2026_Bilingue.pdf', 93403,
   'ece85a9720b1198fdddb6d09c341006905cff6e3de6488dc5619440072500ef9', 'member', 'draft', 60),
  ('manual-organizador', 'Manual del Organizador FIPA', 'organizacion', 'es-en', '2026',
   'documentos-miembros/2026/05_Manual_del_Organizador_FIPA_2026_Bilingue.pdf',
   '05_Manual_del_Organizador_FIPA_2026_Bilingue.pdf', 75358,
   '109b85df01e1e01ca881df5a9cbdfa65a1a1b3a8409b51c778b79868090d964e', 'member', 'draft', 70),
  ('patrocinio-marca-transmision', 'Especificaciones de Patrocinio, Marca y Transmisión FIPA', 'marca', 'es-en', '2026',
   'documentos-miembros/2026/06_Especificaciones_de_Patrocinio_Marca_y_Transmision_FIPA_2026_Bilingue.pdf',
   '06_Especificaciones_de_Patrocinio_Marca_y_Transmision_FIPA_2026_Bilingue.pdf', 76840,
   'bc8c80812a829d0bce29f78648fa52ca714cc56e9fd5199e4391645d6a2e75c5', 'member', 'draft', 80),
  ('inscripcion-autorizacion-imagen', 'Formularios de Inscripción y Autorización de Imagen FIPA', 'formularios', 'es-en', '2026',
   'documentos-miembros/2026/07_Formularios_de_Inscripcion_y_Autorizacion_de_Imagen_FIPA_2026_Bilingue.pdf',
   '07_Formularios_de_Inscripcion_y_Autorizacion_de_Imagen_FIPA_2026_Bilingue.pdf', 76277,
   'd3772ae05d3a27981fb85dd6823d351a29975d5256b8b946e42cc8c12249accc', 'member', 'draft', 90)
on conflict (slug, locale) do update set
  title = excluded.title,
  category = excluded.category,
  locale = excluded.locale,
  version = excluded.version,
  storage_path = excluded.storage_path,
  original_filename = excluded.original_filename,
  byte_size = excluded.byte_size,
  sha256 = excluded.sha256,
  access_level = excluded.access_level,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace function public.guardar_perfil_biblioteca_fipa(
  p_user_id uuid,
  p_purpose text,
  p_purpose_other text,
  p_plays_padbol text,
  p_linked_to_club text,
  p_sede_id bigint,
  p_declared_sede_id bigint,
  p_venue_not_listed boolean,
  p_club_name text,
  p_country text,
  p_city text,
  p_address text,
  p_venue_reason_code text,
  p_whatsapp text,
  p_whatsapp_consent boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verified_sede_id bigint;
  v_venue_reason_code text := coalesce(nullif(trim(p_venue_reason_code), ''), 'profile_saved_without_venue');
  v_whatsapp text := nullif(trim(p_whatsapp), '');
  v_whatsapp_consent boolean := coalesce(p_whatsapp_consent, false) and nullif(trim(p_whatsapp), '') is not null;
  v_completed_at timestamptz;
begin
  if p_user_id is null then raise exception 'Usuario requerido' using errcode = '22023'; end if;
  if p_purpose not in (
    'aprender_jugar', 'jugador', 'entrenador_arbitro', 'club_sede',
    'organizar_competencia', 'investigacion_prensa', 'evaluar_proyecto', 'otro'
  ) then raise exception 'Propósito inválido' using errcode = '22023'; end if;
  if p_plays_padbol not in ('yes', 'no', 'prefer_not')
     or p_linked_to_club not in ('yes', 'no', 'prefer_not') then
    raise exception 'Respuesta de perfil inválida' using errcode = '22023';
  end if;
  if p_purpose = 'otro' and length(trim(coalesce(p_purpose_other, ''))) = 0 then
    raise exception 'Debe indicarse el otro propósito' using errcode = '22023';
  end if;
  if v_whatsapp is not null and not v_whatsapp_consent then
    raise exception 'WhatsApp requiere consentimiento' using errcode = '22023';
  end if;

  if p_sede_id is not null and exists (
    select 1 from public.sedes s
    where s.id = p_sede_id
      and s.licencia_activa is true
      and length(trim(coalesce(s.numero_licencia, ''))) > 0
  ) then
    v_verified_sede_id := p_sede_id;
  elsif p_sede_id is not null then
    v_venue_reason_code := 'request_received_venue_to_review';
  end if;

  insert into public.fipa_library_profiles (
    user_id, purpose, purpose_other, plays_padbol, linked_to_club,
    sede_id, declared_sede_id, venue_not_listed,
    club_name, country, city, address, venue_reason_code,
    whatsapp, whatsapp_consent, whatsapp_consent_at
  ) values (
    p_user_id, p_purpose,
    case when p_purpose = 'otro' then nullif(trim(p_purpose_other), '') else null end,
    p_plays_padbol, p_linked_to_club, v_verified_sede_id, p_declared_sede_id,
    coalesce(p_venue_not_listed, false), nullif(trim(p_club_name), ''),
    nullif(trim(p_country), ''), nullif(trim(p_city), ''), nullif(trim(p_address), ''),
    v_venue_reason_code, v_whatsapp, v_whatsapp_consent,
    case when v_whatsapp_consent then now() else null end
  )
  on conflict (user_id) do update set
    purpose = excluded.purpose,
    purpose_other = excluded.purpose_other,
    plays_padbol = excluded.plays_padbol,
    linked_to_club = excluded.linked_to_club,
    sede_id = excluded.sede_id,
    declared_sede_id = excluded.declared_sede_id,
    venue_not_listed = excluded.venue_not_listed,
    club_name = excluded.club_name,
    country = excluded.country,
    city = excluded.city,
    address = excluded.address,
    venue_reason_code = excluded.venue_reason_code,
    whatsapp = excluded.whatsapp,
    whatsapp_consent = excluded.whatsapp_consent,
    whatsapp_consent_at = excluded.whatsapp_consent_at,
    updated_at = now()
  returning completed_at into v_completed_at;

  insert into public.fipa_document_access_events (
    event_type, actor_user_id, subject_user_id, metadata
  ) values (
    'profile_upserted', p_user_id, p_user_id,
    jsonb_build_object(
      'purpose', p_purpose,
      'plays_padbol', p_plays_padbol,
      'linked_to_club', p_linked_to_club,
      'venue_reason_code', v_venue_reason_code,
      'whatsapp_consent', v_whatsapp_consent
    )
  );

  return jsonb_build_object(
    'purpose', p_purpose,
    'plays_padbol', p_plays_padbol,
    'linked_to_club', p_linked_to_club,
    'sede_id', v_verified_sede_id,
    'venue_reason_code', v_venue_reason_code,
    'whatsapp_provided', v_whatsapp is not null,
    'completed_at', v_completed_at
  );
end;
$$;

create or replace function public.registrar_solicitud_acceso_documentos_fipa(
  p_user_id uuid,
  p_email_snapshot text,
  p_sede_id bigint,
  p_declared_sede_id bigint,
  p_venue_not_listed boolean,
  p_club_name text,
  p_country text,
  p_city text,
  p_address text,
  p_reason_code text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_verified_sede_id bigint;
  v_reason_code text := coalesce(nullif(trim(p_reason_code), ''), 'request_received_venue_to_review');
begin
  if p_user_id is null then raise exception 'Usuario requerido' using errcode = '22023'; end if;

  if p_sede_id is not null and exists (
    select 1 from public.sedes s
    where s.id = p_sede_id
      and s.licencia_activa is true
      and length(trim(coalesce(s.numero_licencia, ''))) > 0
  ) then
    v_verified_sede_id := p_sede_id;
  elsif p_sede_id is not null then
    v_reason_code := 'request_received_venue_to_review';
  end if;

  if v_verified_sede_id is null
     and p_declared_sede_id is null
     and not coalesce(p_venue_not_listed, false) then
    raise exception 'Debe indicarse una sede o una cancha no listada' using errcode = '22023';
  end if;

  if v_verified_sede_id is null
     and p_declared_sede_id is null
     and (
       length(trim(coalesce(p_club_name, ''))) = 0
       or length(trim(coalesce(p_country, ''))) = 0
       or length(trim(coalesce(p_city, ''))) = 0
       or length(trim(coalesce(p_address, ''))) = 0
     ) then
    raise exception 'Faltan datos de la cancha no listada' using errcode = '22023';
  end if;

  insert into public.fipa_access_requests (
    user_id, email_snapshot, sede_id, declared_sede_id, venue_not_listed,
    club_name, country, city, address, reason_code
  ) values (
    p_user_id, nullif(trim(p_email_snapshot), ''), v_verified_sede_id,
    p_declared_sede_id, coalesce(p_venue_not_listed, false),
    nullif(trim(p_club_name), ''), nullif(trim(p_country), ''),
    nullif(trim(p_city), ''), nullif(trim(p_address), ''), v_reason_code
  ) returning id into v_request_id;

  insert into public.fipa_document_access_events (
    event_type, actor_user_id, subject_user_id, request_id, metadata
  ) values (
    'request_submitted', p_user_id, p_user_id, v_request_id,
    jsonb_build_object('reason_code', v_reason_code, 'venue_not_listed', coalesce(p_venue_not_listed, false))
  );
  return v_request_id;
end;
$$;

create or replace function public.resolver_solicitud_acceso_documentos_fipa(
  p_request_id uuid,
  p_approve boolean,
  p_reviewer_user_id uuid,
  p_review_note text,
  p_expires_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.fipa_access_requests%rowtype;
  v_grant_id uuid;
  v_status text;
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_reviewer_user_id and ur.role = 'super_admin'
  ) then
    raise exception 'Se requiere super_admin real' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_review_note, ''))) = 0 then
    raise exception 'La nota de revisión es obligatoria' using errcode = '22023';
  end if;
  if p_approve and p_expires_at is not null and p_expires_at <= now() then
    raise exception 'El vencimiento debe ser futuro' using errcode = '22023';
  end if;

  select * into v_request
  from public.fipa_access_requests
  where id = p_request_id
  for update;
  if not found then raise no_data_found; end if;
  if v_request.status <> 'pending' then
    raise exception 'La solicitud ya fue revisada' using errcode = 'P0001';
  end if;

  if p_approve then
    update public.fipa_access_grants
      set status = 'expired', updated_at = now()
    where user_id = v_request.user_id
      and status = 'active'
      and expires_at is not null
      and expires_at <= now();

    select id into v_grant_id
    from public.fipa_access_grants
    where user_id = v_request.user_id and status = 'active'
    order by granted_at desc
    limit 1
    for update;

    if v_grant_id is null then
      insert into public.fipa_access_grants (
        user_id, request_id, sede_id, source, status, granted_by, expires_at
      ) values (
        v_request.user_id, v_request.id, v_request.sede_id,
        'manual_exception', 'active', p_reviewer_user_id, p_expires_at
      ) returning id into v_grant_id;
    end if;
    v_status := 'approved';
  else
    v_status := 'rejected';
  end if;

  update public.fipa_access_requests set
    status = v_status,
    reason_code = case when p_approve
      then 'access_granted_manual_grant'
      else 'request_review_completed_no_access'
    end,
    reviewed_by = p_reviewer_user_id,
    reviewed_at = now(),
    review_note = trim(p_review_note),
    updated_at = now()
  where id = v_request.id;

  insert into public.fipa_document_access_events (
    event_type, actor_user_id, subject_user_id, request_id, grant_id, metadata
  ) values (
    case when p_approve then 'request_approved' else 'request_rejected' end,
    p_reviewer_user_id, v_request.user_id, v_request.id, v_grant_id,
    jsonb_build_object('review_note', trim(p_review_note), 'expires_at', p_expires_at)
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'status', v_status,
    'grant_id', v_grant_id
  );
end;
$$;

create or replace function public.revocar_habilitacion_documentos_fipa(
  p_grant_id uuid,
  p_reviewer_user_id uuid,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.fipa_access_grants%rowtype;
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_reviewer_user_id and ur.role = 'super_admin'
  ) then
    raise exception 'Se requiere super_admin real' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'El motivo de revocación es obligatorio' using errcode = '22023';
  end if;

  select * into v_grant
  from public.fipa_access_grants
  where id = p_grant_id
  for update;
  if not found then raise no_data_found; end if;
  if v_grant.status <> 'active' then
    raise exception 'La habilitación no está activa' using errcode = 'P0001';
  end if;

  update public.fipa_access_grants set
    status = 'revoked',
    revoked_by = p_reviewer_user_id,
    revoked_at = now(),
    revocation_reason = trim(p_reason),
    updated_at = now()
  where id = v_grant.id;

  insert into public.fipa_document_access_events (
    event_type, actor_user_id, subject_user_id, request_id, grant_id, metadata
  ) values (
    'grant_revoked', p_reviewer_user_id, v_grant.user_id,
    v_grant.request_id, v_grant.id,
    jsonb_build_object('reason', trim(p_reason))
  );
  return v_grant.id;
end;
$$;

revoke all on function public.registrar_solicitud_acceso_documentos_fipa(uuid, text, bigint, bigint, boolean, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.guardar_perfil_biblioteca_fipa(uuid, text, text, text, text, bigint, bigint, boolean, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.resolver_solicitud_acceso_documentos_fipa(uuid, boolean, uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.revocar_habilitacion_documentos_fipa(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.registrar_solicitud_acceso_documentos_fipa(uuid, text, bigint, bigint, boolean, text, text, text, text, text)
  to service_role;
grant execute on function public.guardar_perfil_biblioteca_fipa(uuid, text, text, text, text, bigint, bigint, boolean, text, text, text, text, text, text, boolean)
  to service_role;
grant execute on function public.resolver_solicitud_acceso_documentos_fipa(uuid, boolean, uuid, text, timestamptz)
  to service_role;
grant execute on function public.revocar_habilitacion_documentos_fipa(uuid, uuid, text)
  to service_role;

comment on table public.fipa_access_requests is
  'Solicitud de acceso a documentos FIPA; conserva sede elegida y datos declarados aun cuando requieran revisión.';
comment on table public.fipa_document_access_events is
  'Auditoría append-only. No guardar JWT, URL firmada, service key, contenido PDF, IP ni user-agent sin revisión de privacidad.';

commit;
