# Super Admin integrado — evidencia QA 2026-10-03

## Candidato

- Rama: `codex/release-superadmin-integrated`
- Integración CRM/push: merge `98fae79e`
- Integración clases/profesores: merge `f209c2df`
- Corrección final de español neutral: `94f61ab0`
- Bandeja histórica unificada (incluye `Prueba 23`): `80c34f4c`
- No se publicó ni modificó producción.
- No se enviaron push ni WhatsApp reales. Se envió únicamente el correo de recuperación QA autorizado al Super Admin.

## Verificaciones locales

- Backend: 208/208 pruebas aprobadas.
- Frontend: 133/133 suites y 1097/1097 pruebas aprobadas.
- ESLint: 0 errores; queda una advertencia preexistente por un import sin uso en `DownloadSection.jsx`.
- Build optimizada: completada correctamente. Las únicas advertencias de build corresponden a sourcemaps incompletos de la dependencia `html5-qrcode` y al tamaño del bundle.
- Regresión focal posterior a la restauración histórica: 8 suites y 48 pruebas aprobadas (CRM, push, visibilidad de pestañas, rutas QA, acceso y liberación de reservas).

## Contratos comprobados

- Las notificaciones administrativas exigen un destino válido y sólo aceptan destinos internos del catálogo.
- El Super Admin no consulta ni consume cupo semanal; los administradores de club conservan su límite.
- Los envíos están deshabilitados por defecto en staging y el despachador probado no contacta Expo.
- Profesores, horarios y clases se resuelven por endpoints administrativos con alcance de sede.
- Los certificados/diplomas usan almacenamiento privado y URLs firmadas de corta duración.
- La liberación de turnos requiere una capacidad HMAC ligada a reserva, turno y expiración.

## Diagnóstico de la pantalla sin CRM

La pantalla que estaba abierta el 3 de octubre era `https://padbolmatch.com/admin?tab=notificaciones`, es decir producción. Esa versión no incluye la pestaña CRM y todavía muestra cupo semanal al Super Admin. La QA histórica es un origen diferente y su sesión había vencido.

La QA de CRM de la noche anterior sigue disponible en:

- `https://padbol-match-crm-real-qa.vercel.app/admin?tab=crm`
- Deployment inmutable: `dpl_ChesgEVx6Xz95tvNmqhh5A44ndsB`
- Creado: 2026-10-02 21:18 (America/Argentina/Buenos_Aires)

## Datos históricos comprobados en vivo

Lectura autenticada y sin mutaciones contra la QA histórica:

- 24 contactos
- 65 conversaciones
- 69 intentos
- 28 respuestas
- 3 actividades
- conversación WhatsApp `Prueba 23`: presente
- `/api/auth/mi-rol`: sesión autenticada con rol `super_admin`
- `/api/admin/crm/permissions`: auditoría habilitada
- `/api/push/admin-quota`: `unlimited=true`

## Correcciones posteriores a revisión

- El backend canónico registra el contrato completo `/api/admin/crm/*`: auditoría, bandeja, detalle, respuesta retenida, derivación y seguimiento.
- Un recorrido HTTP con servidor real (sin interceptar `fetch`) verifica auditoría, actividad, respuesta pendiente y derivación; la salida WhatsApp permanece apagada.
- El recorrido autenticado contra QA confirmó `Prueba 23` y 65 conversaciones. Las tres acciones probadas con sesión Super Admin respondieron `403 CRM_ADMIN_FORBIDDEN`, como exige la separación entre auditor y operador, sin producir mutaciones ni envíos.
- Los diplomas sólo se firman si `certificado_url` pertenece al prefijo exacto `sede-<sede_id>/`; rutas cruzadas o con traversal se rechazan antes de solicitar la URL firmada.
- La cancelación de clases selecciona `sede_id`, registra ese valor en `clases_eventos_internos` y propaga cualquier fallo de auditoría en lugar de ocultarlo.

No hubo pérdida de datos. La recuperación consiste en iniciar sesión en el origen QA anterior; no requiere restaurar ni copiar información.

## Candidato QA publicado

- URL estable: `https://padbol-crm-superadmin-qa.vercel.app`
- Deployment frontend: `dpl_3LMuiDEKurV7vAN2wvcqiFVFyjgW`
- Deployment backend aislado: `dpl_74A972cbmnkdi8t1TqCd7Cn6yqt8`
- Salud del backend: HTTP 200.
- Lectura autenticada en el alias final: CRM con 65 conversaciones y `Prueba 23`; Super Admin con `unlimited=true`; profesores HTTP 200.
- El alias estable fue asociado al candidato integrado, sin modificar producción.
- Los eventos de recuperación que Supabase entrega en el Site URL QA son dirigidos a la pantalla de creación de contraseña y luego al panel `/admin`.
- El primer correo de recuperación autorizado fue aceptado por Supabase (HTTP 200). Un reenvío inmediato posterior fue limitado temporalmente por Supabase (HTTP 429); el enlace anterior permanece dirigido al mismo alias estable ya actualizado.

## Clases y profesores — contrato móvil QA

- Backend estable: `https://padbol-crm-qa-api.vercel.app` (`dpl_DmMfqkAXMhK6dZY7uydh8jyLBMCi`).
- `GET /api/clases/disponibles?sede_id=1` publica las clases individual `id=3` y grupal `id=4`.
- Admite filtros secuenciales `tipo`, `profesor_id` y `deporte`; la sede se conserva desde el inicio del recorrido.
- Profesor `id=2`: aprobado, activo, diploma privado comprobado con URL firmada y certificación `QA-FIPA-2026-001` aprobada.
- La fecha publicada se calcula en cada consulta y avanza al primer turno futuro con cupo; al llenar el turno individual del 03/10, la oferta avanzó al 04/10 con un lugar disponible.
- `POST /api/clases/:id/reservar`: autenticado devolvió 201 para individual y grupal; turno lleno devolvió 409; sin Bearer devolvió 401.
- Super Admin y sede administran profesor, aprobación/certificación, clases, tipo, cupo y horarios mediante los endpoints administrativos existentes.
- El frontend QA estable fue asociado al backend anterior y conserva el CRM histórico por su ruta específica.
