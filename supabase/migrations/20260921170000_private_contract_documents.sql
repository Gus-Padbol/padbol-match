-- Contract documents contain confidential commercial information. Keep their
-- object paths server-side and issue short-lived download URLs only after the
-- backend verifies a super administrator.

alter table public.contratos_sedes
  add column if not exists storage_path text;

update public.contratos_sedes
set storage_path = substring(
  archivo_url from '/storage/v1/object/public/contratos/(.+)$'
)
where storage_path is null
  and archivo_url like '%/storage/v1/object/public/contratos/%';

update public.contratos_sedes
set archivo_url = null
where storage_path is not null;

update storage.buckets
set public = false
where id = 'contratos';

drop policy if exists contratos_backend_only on storage.objects;
create policy contratos_backend_only
  on storage.objects
  as restrictive
  for all
  to anon, authenticated
  using (bucket_id <> 'contratos')
  with check (bucket_id <> 'contratos');
