# Atención / CRM — contrato de despliegue QA

Este documento describe el entorno aislado necesario para validar Atención / CRM sin tocar producción.

## Dependencias de datos

Aplicar en el proyecto Supabase **QA**, en este orden:

1. Las migraciones canónicas que crean `ng_sesiones`, `ng_inscripciones` y `ng_inscripcion_eventos` del PR `padbol-web#8`.
2. `padbol-web/supabase/migrations/20261001_next_generation_crm_bridge.sql`, que crea la vista `ng_crm_eventos` con `security_invoker`.
3. El seed QA `padbol-web/supabase/qa/next_generation_registration_seed.sql` únicamente en QA.

La API lee `ng_crm_eventos` con el cliente service-role del backend. Nunca se expone esa clave al navegador. Los identificadores verificables son `event_id`, `registration_id`, `session_id`, `event_type` y `contact_ref`; `contact_ref` es un hash y no contiene PII.

Eventos esperados:

- `nextgen.registration.created`
- `nextgen.waitlist.joined`
- `nextgen.registration.cancelled`
- `nextgen.lead.promoted`
- `nextgen.registration.corrected`
- `nextgen.lead.club_continuity`

## Variables del backend QA

Partir de `padbol-backend/.env.staging.example` y configurar externamente:

- `BACKEND_RUNTIME_MODE=staging`
- `STAGING_SUPABASE_PROJECT_REF`
- `SUPABASE_URL`
- `SUPABASE_KEY` (publishable/anon del proyecto QA)
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor QA)
- `FRONTEND_URL` y `CORS_ORIGINS` con el origen exacto de la preview
- `BACKGROUND_JOBS_ENABLED=false`
- `OUTBOUND_DELIVERY_ENABLED=false`
- `PUSH_SEND_ENABLED=false`
- `WHATSAPP_CLOUD_SEND_ENABLED=false`
- `WHATSAPP_ASSISTANT_DISPATCH_ALLOWED=false`

## Variables de la preview frontend

- `REACT_APP_APP_VARIANT=qa`
- `REACT_APP_API_BASE_URL=<backend QA HTTPS>`
- `REACT_APP_API_URL=<mismo backend QA HTTPS>`
- `REACT_APP_SUPABASE_URL=<Supabase QA HTTPS>`
- `REACT_APP_SUPABASE_ANON_KEY=<publishable/anon QA>`

La validación de entorno rechaza hosts y claves de producción cuando `REACT_APP_APP_VARIANT=qa`.

## Rutas de verificación

Con JWT QA de un usuario con rol `super_admin`:

- `GET /api/admin/crm/permissions`
- `GET /api/admin/crm/inbox?limit=100`

La bandeja debe devolver elementos reales de `ng_crm_eventos`. Un usuario común debe recibir `403`. Sin JWT debe devolver `401`.

## Bloqueo externo actual

El proyecto Vercel Preview no tiene configuradas las variables QA anteriores y no hay una URL de backend QA disponible. Hasta que se suministren el proyecto Supabase QA, su service-role y un backend QA, la preview solo puede mostrar el workspace y un estado de conexión pendiente; no debe usar mocks ni insertar datos en producción.
