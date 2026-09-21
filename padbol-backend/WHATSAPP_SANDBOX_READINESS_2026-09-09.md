# WhatsApp sandbox — preparación de nuestro backend

Estado comprobado el 2026-09-09. Complementa el runbook del primer mensaje y corrige sus referencias históricas a Meta todavía no creado.

## Resuelto localmente

Meta sandbox ya fue creado y probado por Juan Pablo, según la confirmación de Gustavo. App ID `2178656636869198`, WABA ID `1384040043841797`, Phone Number ID `1300908966439481`. No se repitió esa preparación ni se tocó el número oficial.

El backend ahora puede limitar de forma persistida los intentos físicos de respuesta. La configuración de servidor usa **un intento por mensaje** por defecto:

```dotenv
WHATSAPP_CLOUD_SEND_ENABLED=false
WHATSAPP_CLOUD_MAX_SEND_ATTEMPTS=1
```

Si Meta no devuelve una confirmación utilizable, o la confirmación no puede guardarse en la base, la salida pasa a `cancelled` con `WHATSAPP_SEND_UNCERTAIN_NO_RETRY`. Una repetición del webhook, un barrido de pendientes o un reinicio no vuelve a enviar esa salida. `cancelled` significa detenido para revisión: no afirma que el destinatario no haya recibido el mensaje.

Las salidas antiguas `pending` que ya consumieron su intento se cancelan con `WHATSAPP_MAX_SEND_ATTEMPTS_REACHED`. Una salida `sending` se conserva para revisión y no se reclama de nuevo. El contador forma parte del reclamo atómico en la base, para que otro proceso no reclame una copia atrasada después de un intento.

No cambiar `attempts`, borrar filas de outbox ni reabrir una salida cancelada para repetir la prueba sin revisar el resultado en Meta. Este límite elimina la dependencia del corte manual antes del siguiente minuto; no habilita mensajes adicionales ni destinatarios nuevos.

La implementación usa estados y columnas existentes: no agrega migración, datos personales, credenciales en base ni cambios de retención. El transporte continúa apagado por defecto.

## Verificación ejecutada

- Pruebas WhatsApp: **22/22**, sin Meta, teléfono ni base remota.
- Suite completa del backend: **114/114**.
- Sintaxis de `lib/whatsappCloud.js` y `server.js`: correcta.
- Pruebas nuevas: fallo incierto sin reenvío tras replay/reinicio; fallo de guardado después de aceptación; salida antigua que agotó intentos; reclamo de copia atrasada; configuración inválida rechazada.
- Las pruebas previas de firma, tenant, concurrencia, ventana de 24 horas y envío apagado siguen aprobadas.
- No se volvió a aplicar el arnés SQL: la migración no cambió. Sus 10/10 resultados del traspaso son históricos.

## Infraestructura comprobada, sin mutaciones

**Supabase:** la herramienta instalada pudo listar los proyectos de la sesión actual. Aparecen `Gus-Padbol Match Project` y un proyecto ajeno. No hay staging Match visible para esa sesión. El proyecto Match (`vpldffhsxhgnmitiikof`) coincide con la URL configurada en la nativa y con su enlace local de Supabase; no es una alternativa de staging acreditada.

**Render:** no hay herramienta Render instalada, variable de credencial Render presente en el proceso ni archivo de configuración en las ubicaciones estándar inspeccionadas. Browser no expone una sesión disponible para abrir el panel (listado vacío). Esto acredita falta de acceso disponible en esta sesión, no que la cuenta Render carezca de otros servicios.

Comprobación pública sin token ni datos:

| Ruta | Resultado |
|---|---|
| `https://padbol-backend.onrender.com/health` | HTTP 200, `status: ok` |
| `https://padbol-backend.onrender.com/api/webhooks/whatsapp-cloud` | HTTP 404 |

**No hay Callback URL de staging utilizable acreditada.** La salud del backend productivo no demuestra el endpoint WhatsApp ni autorización para ensayar allí. No entregar el host productivo a Juan Pablo como callback.

## Configuración preparada para el staging que se identifique

Guardar directamente en su gestor de secretos, nunca por chat:

| Variable | Uso |
|---|---|
| `SUPABASE_URL` | Proyecto exclusivamente de staging, verificado por ID. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave del mismo proyecto staging. |
| `WHATSAPP_META_APP_SECRET` | App Secret de la app Meta de prueba existente. |
| `WHATSAPP_META_VERIFY_TOKEN` | Token independiente del callback. |
| `WHATSAPP_META_GRAPH_VERSION` | Versión seleccionada en el panel de Meta para el ensayo. |
| `WHATSAPP_META_TOKEN_TEST` | Token de acceso de prueba; comprobar vigencia. |
| `WHATSAPP_CLOUD_SEND_ENABLED` | `false` hasta el ensayo autorizado. |
| `WHATSAPP_CLOUD_MAX_SEND_ATTEMPTS` | `1`; valores inválidos impiden iniciar con una configuración insegura. |

El callback conserva la ruta `GET`/`POST /api/webhooks/whatsapp-cloud`; el dominio debe salir del servicio staging real. La verificación inicial exige token válido y el POST exige firma de Meta sobre los bytes crudos. No hay que reemplazar la app Meta existente.

La secuencia pendiente es: identificar/otorgar acceso al backend y Supabase staging → preflight de esquema sólo lectura → migración aprobada → tenant/canal de prueba → desplegar esta revisión con envíos apagados → verificar GET del callback → Juan Pablo registra callback y suscripción messages → ensayo de una entrada/una respuesta → apagado y evidencia redactada.

No se ejecutó ninguna de esas mutaciones, activaciones o comunicaciones remotas en esta entrega. Los bloques SQL, aislamiento, receptor único, retención y criterios de aceptación siguen en `docs/WHATSAPP_MATCH_META_TEST_RUNBOOK.md`; leer su confirmación Meta junto al traspaso para no repetir los apartados históricos superados.

## Siguiente dependencia concreta

El coordinador necesita acceso a un servicio HTTPS **staging** y a su proyecto Supabase aislado, o una decisión explícita para provisionarlos mediante el proceso autorizado. No solicitar a Juan Pablo otra app/número de Meta. No usar el otro proyecto Supabase ajeno ni conectar el ensayo a los datos de Match vigentes.
