# Super Admin integrado — evidencia QA 2026-10-03

## Candidato

- Rama: `codex/release-superadmin-integrated`
- Integración CRM/push: merge `98fae79e`
- Integración clases/profesores: merge `f209c2df`
- Corrección final de español neutral: `94f61ab0`
- Bandeja histórica unificada (incluye `Prueba 23`): `80c34f4c`
- No se publicó ni modificó producción.
- No se enviaron push, WhatsApp ni correos reales.

## Verificaciones locales

- Backend: 202/202 pruebas aprobadas.
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

No hubo pérdida de datos. La recuperación consiste en iniciar sesión en el origen QA anterior; no requiere restaurar ni copiar información.
