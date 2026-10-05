# CRM production backend release

Target Supabase project: `vpldffhsxhgnmitiikof`. Never use the QA project
`vxikhdulhuvghfqeutnp` for this deployment.

## Required Production environment

- `SUPABASE_URL=https://vpldffhsxhgnmitiikof.supabase.co` (or the equivalent
  production custom Auth origin if supported by server-side PostgREST)
- `SUPABASE_SERVICE_ROLE_KEY` from the production project
- `SUPABASE_KEY` production anon/publishable key (recommended; authentication
  also safely falls back to the service client)
- `CORS_ORIGINS=https://www.padbolmatch.com,https://padbolmatch.com`
- `BACKEND_RUNTIME_MODE=standard`
- `BACKGROUND_JOBS_ENABLED=false`
- `OUTBOUND_DELIVERY_ENABLED=false`
- `PUSH_SEND_ENABLED=false`
- `WHATSAPP_CLOUD_SEND_ENABLED=false`

Optional and disabled when absent:

- `CRM_INBOUND_EMAIL_SECRET` only when the approved public form/backend caller
  is ready. It protects both canonical inbound endpoints.
- `DATABASE_URL` is not required at runtime. Use a temporary direct production
  connection only for `pg_dump` and migrations; do not retain it in Vercel.

Do not configure Twilio, WhatsApp Meta, Expo, Resend, Stripe, Mercado Pago,
Make, Anthropic, SMTP or other provider secrets for this CRM-only release.

## Snapshot and migration order

1. Run `sql/20261005090000_crm_production_preflight.sql` and save its result.
2. With a temporary direct connection, export schema plus the CRM/NG tables:
   `pg_dump --format=custom --no-owner --no-acl --schema=public --file=crm-prod-before.dump "$DATABASE_URL"`.
   Store it outside the repository and record its SHA-256.
3. Apply, in order, inside one controlled maintenance session:
   - `sql/20260915000000_crm_unified_inbox.sql`
   - `sql/20260916000000_crm_inbound_content.sql`
   - `sql/20260917000000_crm_operational_history_and_inbound_events.sql`
   - `sql/20261004193000_crm_multisede_scope.sql`
4. Re-run the preflight SQL. Existing counts must not decrease. No fixture or
   synthetic conversation is inserted by these migrations.

## Backend gate before frontend

- `/api/health` is 200.
- `/api/auth/mi-rol` is 401 without a valid Bearer.
- authenticated Super Admin can list CRM; venue admin is restricted to its
  canonical `sede_id`; an ordinary account is 403.
- manual intake preserves origin and assignment; cross-venue reads are 404.
- runtime readiness reports background, outbound and push disabled.
- no frontend or canonical-domain alias is changed until all checks pass.

Rollback the backend alias to its previous deployment first. Schema additions
are backward compatible and must not be dropped during an incident; restore
from the verified dump only for confirmed data corruption.
