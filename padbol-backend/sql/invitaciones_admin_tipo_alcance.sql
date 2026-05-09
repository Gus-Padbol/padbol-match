-- Alcance geográfico y tipo de invitación (admin club vs admin nacional / región).
-- Ejecutar en Supabase SQL Editor tras desplegar backend que lee estas columnas.

alter table public.invitaciones_admin
  add column if not exists invited_role text not null default 'admin_club',
  add column if not exists invited_alcance text,
  add column if not exists provincia text,
  add column if not exists ciudad text;

comment on column public.invitaciones_admin.invited_role is 'admin_club | admin_nacional';
comment on column public.invitaciones_admin.invited_alcance is 'null = flujo sede (club); pais | provincia | ciudad = solo asignación de rol geo';
