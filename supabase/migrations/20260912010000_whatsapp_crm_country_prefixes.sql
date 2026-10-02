-- ══════════════════════════════════════════════════════════════════════════════════════
-- CRM de WhatsApp · referencia de prefijos internacionales (soporte de D8/D10/D13)
--
-- POR QUÉ EXISTE ESTE ARCHIVO
--   `whatsapp_crm_pendientes_candidate.sql` (recuperado completo, 408 líneas) LLAMA a
--   `public.whatsapp_crm_country_prefixes()`, `whatsapp_crm_country_code()`,
--   `whatsapp_crm_national_min()` y `whatsapp_crm_national_max()`, pero NO las define:
--   vienen de `sql/candidates/whatsapp_crm_consent_candidate.sql`, que pertenece a una
--   "ronda anterior" (documentos/WHATSAPP-D1-D13-Y-LIMITES.md, fila D10: «ronda anterior,
--   NO reimplementado»). Ese archivo NO sobrevive en ningún árbol de esta máquina
--   (verificado: no está en entregas/cola-ronda3, ni frente-d, ni /private/tmp).
--
--   [RECONSTRUIDO] Los DATOS de referencia (código de país + longitud nacional plausible)
--   se reconstruyen con la norma pública ITU-T E.164 / planes de numeración nacionales.
--   NO son una invención de comportamiento: son la tabla de referencia estándar que la
--   función perdida necesariamente consultaba. Las CUATRO FIRMAS y su SEMÁNTICA sí están
--   fijadas por evidencia literal, porque `pendientes.sql` las invoca así:
--     · `whatsapp_crm_country_prefixes()` → columnas (codigo, pais, min_nacional, max_nacional)
--       [EVIDENCIA] pendientes.sql líneas 30, 51-53, 83-88 usan p.pais, p.codigo,
--       p.min_nacional, p.max_nacional, y ordenan por length(p.codigo) desc.
--     · `whatsapp_crm_country_code(p_pais)` → codigo textual [EVIDENCIA] línea 73.
--     · `whatsapp_crm_national_min(p_pais)` / `_max` → int [EVIDENCIA] líneas 93-94.
--
-- CASOS DE ACEPTACIÓN QUE ESTA TABLA DEBE SATISFACER (evidencia D10, documento citado):
--   · `5492215550147` → `tel:542215550147`  (cc 54; se quita el `9` de móvil AR)
--   · `5550132`       → `review:5550132` + `phone_not_conclusive`
--     (7 dígitos: coincide cc 55 = BR, nacional 50132 = 5 dígitos < mínimo ⇒ NO concluyente)
--
-- `codigo` es ÚNICO a propósito: `whatsapp_crm_pais_for_cc` hace `where codigo = ... limit 1`.
-- Los países que comparten prefijo (NANP +1, +7) se resuelven a un único titular para que la
-- inferencia sea determinista y nunca adivine de más.
-- Idempotente.
-- ══════════════════════════════════════════════════════════════════════════════════════

create or replace function public.whatsapp_crm_country_prefixes()
returns table (codigo text, pais text, min_nacional int, max_nacional int)
language sql immutable as $fn$
  select v.codigo, v.pais, v.min_nacional, v.max_nacional
  from (values
    ('54','AR',10,11), ('55','BR',10,11), ('1','US',10,10),  ('34','ES',9,9),
    ('39','IT',9,10),  ('44','GB',10,10), ('49','DE',10,11), ('33','FR',9,9),
    ('52','MX',10,10), ('56','CL',9,9),   ('57','CO',10,10), ('51','PE',9,9),
    ('598','UY',8,8),  ('595','PY',9,9),  ('591','BO',8,8),  ('593','EC',9,9),
    ('58','VE',10,10), ('351','PT',9,9),  ('31','NL',9,9),   ('41','CH',9,9),
    ('43','AT',10,11), ('61','AU',9,9),   ('81','JP',10,10), ('86','CN',11,11),
    ('91','IN',10,10), ('27','ZA',9,9),   ('20','EG',10,10), ('7','RU',10,10),
    ('380','UA',9,9),  ('48','PL',9,9),   ('30','GR',10,10), ('90','TR',10,10),
    ('972','IL',9,9),  ('966','SA',9,9),  ('971','AE',9,9),  ('65','SG',8,8),
    ('60','MY',9,10),  ('62','ID',9,12),  ('63','PH',10,10), ('66','TH',9,9),
    ('84','VN',9,10),  ('82','KR',9,10),  ('64','NZ',8,10),  ('353','IE',9,9),
    ('46','SE',9,9),   ('47','NO',8,8),   ('45','DK',8,8),   ('358','FI',9,10),
    ('32','BE',9,9),   ('36','HU',9,9),   ('420','CZ',9,9),  ('40','RO',9,9)
  ) as v(codigo, pais, min_nacional, max_nacional);
$fn$;

-- [EVIDENCIA] pendientes.sql:73 · país declarado (ISO-2) → código de discado.
create or replace function public.whatsapp_crm_country_code(p_pais text)
returns text language sql immutable as $fn$
  select p.codigo from public.whatsapp_crm_country_prefixes() p
  where p.pais = upper(trim(coalesce(p_pais, ''))) limit 1;
$fn$;

-- [EVIDENCIA] pendientes.sql:93-94 · longitud nacional mínima plausible del país declarado.
create or replace function public.whatsapp_crm_national_min(p_pais text)
returns int language sql immutable as $fn$
  select p.min_nacional from public.whatsapp_crm_country_prefixes() p
  where p.pais = upper(trim(coalesce(p_pais, ''))) limit 1;
$fn$;

-- [EVIDENCIA] pendientes.sql:94 · longitud nacional máxima plausible.
create or replace function public.whatsapp_crm_national_max(p_pais text)
returns int language sql immutable as $fn$
  select p.max_nacional from public.whatsapp_crm_country_prefixes() p
  where p.pais = upper(trim(coalesce(p_pais, ''))) limit 1;
$fn$;

do $do$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.whatsapp_crm_country_prefixes() to service_role;
    grant execute on function public.whatsapp_crm_country_code(text) to service_role;
    grant execute on function public.whatsapp_crm_national_min(text) to service_role;
    grant execute on function public.whatsapp_crm_national_max(text) to service_role;
  end if;
end $do$;
