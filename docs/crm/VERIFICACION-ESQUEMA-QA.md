# Verificación del esquema CRM en Supabase QA

Proyecto: `vxikhdulhuvghfqeutnp` (`padbol-match-qa`, ACTIVE_HEALTHY).
Aplicado por Management API (`POST /v1/projects/{ref}/database/query`), **sin tocar el
historial de migraciones** (QA es compartido con otros repos).

## Cadena aplicada (paso 5) · 3 archivos, HTTP 201 cada uno

| orden | archivo | efecto |
|---|---|---|
| 1 | `20260912000000_whatsapp_crm_contacts_base.sql` | crea `whatsapp_crm_contacts`, `whatsapp_crm_contact_origins`, `whatsapp_crm_timeline` + índices, checks y `note_origin`/`sede_for_tenant` |
| 2 | `20260912010000_whatsapp_crm_country_prefixes.sql` | `country_prefixes()`, `country_code()`, `national_min()`, `national_max()` |
| 3 | `20260912020000_whatsapp_crm_pendientes.sql` | D2/D8/D9/D11/D12/D13 (recuperado literal, 408 líneas) + triggers de sincronización |

## Objetos presentes tras aplicar

`crm_contacts` ✅ · `crm_origins` ✅ · `crm_timeline` ✅ · `fn_upsert` ✅ · `fn_inbox` ✅ ·
`fn_prefixes` ✅ · `idx_outbox_uniq` ✅ · trigger entrante ✅ · trigger outbox ✅

## Casos de aceptación D10 — coinciden EXACTAMENTE con la evidencia

| entrada | resultado | esperado |
|---|---|---|
| `5492215550147` | `542215550147` | `542215550147` ✅ |
| `542215550147` | `542215550147` | idempotente ✅ |
| país inferido de `5492215550147` | `AR` | `AR` ✅ |
| `5550132` | `null` (no concluyente) | `null` ✅ |
| `country_code('AR')` / `national_min('AR')` | `54` / `10` | `54` / `10` ✅ |

## Prueba punta a punta (transacción con `rollback`, sin dejar datos)

`upsert_contact('5492215550147', …)` → ficha `tel:542215550147`, país y `phone_pais` `AR`,
`status=nuevo`, `consent_status=unknown`, origen `whatsapp`, evento `origen` en historial.
`upsert_contact('5550132', …)` → ficha `review:5550132`, `needs_review=true`,
`review_reason=phone_not_conclusive`.
Post-rollback: `contacts=0`, `origins=0`, `timeline=0` → **QA no quedó con datos de prueba**.

## Límites respetados

Sin producción · sin publicar · sin envíos (ningún flag de salida activado) · sin borrar datos ·
sin usuarios nuevos · las 3 tablas son nuevas y estaban vacías, así que nada preexistente cambió.

## Procedencia de lo reconstruido (no estaba en ningún árbol)

Las candidatas `contacts` (DDL), `hardening` y `consent` NO sobreviven: sólo quedaron hunks
parciales. La reconstrucción se ancló en evidencia literal — los `OUT` de
`whatsapp_crm_inbox()`, los `INSERT` de `sync_inbound`/`sync_outbox`/`backfill`, la firma del
upsert, el nombre `whatsapp_crm_contacts_consent_status_check` y los casos D10 — y cada punto
no literal está marcado `[RECONSTRUIDO]` en el SQL. La referencia de prefijos usa ITU-T E.164.
