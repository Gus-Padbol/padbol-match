# Push móvil seguro — contrato y despliegue pendiente

Estado: implementación local. No se aplicó la migración, no se desplegó y no se realizó ningún envío real.

## Contrato autenticado

- `POST /api/push-tokens`: `{ token, platform: "ios" | "android", deviceId }`.
- `DELETE /api/push-tokens`: `{ token?, deviceId? }`; al menos uno es obligatorio.
- `GET /api/push-preferences`.
- `PATCH /api/push-preferences`: uno o ambos booleanos `{ transactionalEnabled, marketingEnabled }`.

El usuario siempre se obtiene del Bearer. Nunca se acepta `userId` del cliente ni se devuelve el token. `deviceId` es un UUID seudónimo persistente de la instalación, no un identificador de hardware.

Preferencias iniciales: operativas activadas, marketing desactivado. El panel administrativo usa siempre la categoría marketing porque admite texto libre; los eventos operativos son exclusivamente los automatismos tipados del backend.

## Payload nativo cerrado

Tipos: `admin_message`, reservas confirmada/recordatorio/cancelada/modificada, solicitudes y partido completo, invitación de dupla, resultado, inscripción/fixture/equipo completo/nuevo torneo, ranking y `general`.

Destinos admitidos:

- `Reserva`: `{ sedeId, deporte? }`.
- `PartidoDetalle`: `{ partidoId }`.
- `TorneoDetalle`: `{ torneoId }`.
- `Notificaciones`, `Reservas`, `Perfil`: sin parámetros.

Todo otro destino o parámetro se rechaza o elimina antes de contactar Expo.

## Orden de activación

1. Aprobar los pendientes de privacidad/retención del checklist raíz y actualizar documentos/declaraciones si corresponde.
2. Respaldar y revisar duplicados/formato de `push_tokens` y el esquema de `notificaciones_admin_log` en staging.
3. Aplicar `supabase/migrations/20260909143000_secure_mobile_push_delivery.sql` en staging.
4. Verificar RLS/grants, RPC, defaults de preferencias, rotación y revocación con cuentas controladas.
5. Desplegar backend compatible; luego panel web y cliente nativo compatible.
6. Probar primero una sola notificación a un solo dispositivo físico controlado. Verificar recepción, deep link, opt-out y cleanup de receipt inválido.
7. Recién después considerar otros segmentos. Un broadcast no es una prueba inicial aceptable.

La ruta prevista para esa prueba controlada es `POST /api/push/send-admin`, con
Bearer de superadministración y `segment: { "type": "jugador", "userId": "..." }`.
Como el panel admite texto libre, esta prueba requiere que la cuenta controlada
haya activado marketing y tenga una sola instalación registrada; el backend no
expone ni permite seleccionar el token. Usar una clave `idempotencyKey` nueva y
guardar el resultado del job. No existe un bypass de consentimiento para pruebas.

`SUPABASE_SERVICE_ROLE_KEY` es obligatorio y falla cerrado. `EXPO_ACCESS_TOKEN` debe permanecer sólo en backend; se recomienda habilitar Expo push security antes de producción.

## Auditoría e idempotencia

Cada envío tiene clave idempotente, origen, categoría, evento, actor, cantidades y estado. Los intentos conservan una huella SHA-256 del token, ticket y receipt; no el token. Errores transitorios de red/408/429/5xx se reintentan con espera incremental. `DeviceNotRegistered` deshabilita el registro. Un planificador procesa receipts pendientes sin superponer ejecuciones.

La receta histórica `padbol-match-frontend/sql/add_notificaciones_admin_log.sql`
queda bloqueada y remite a la migración canónica para evitar que se recree el
contrato anterior.

## Reversión

Antes de que existan datos nuevos, se puede usar `supabase/rollbacks/20260909143000_secure_mobile_push_delivery.down.sql`. El script se bloquea si detecta preferencias, auditoría o entregas, para evitar borrar evidencia o decisiones de consentimiento.

Si ya hubo uso, no ejecutar una baja destructiva: desactivar rutas/envíos mediante rollback de aplicación, exportar datos, aplicar la política de retención aprobada y preparar una migración compensatoria revisada. El rollback no restaura acceso directo de `anon`/`authenticated` a tokens.

## Límites de la evidencia local

Las pruebas usan transporte Expo simulado. No acreditan credenciales, configuración EAS/APNs/FCM, recepción en segundo plano, permisos, entrega física, declaraciones de tiendas ni estado productivo. No se inspeccionaron tokens ni secretos de producción.
