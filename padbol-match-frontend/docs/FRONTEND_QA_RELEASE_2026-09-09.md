# Candidato frontend de QA — 9 de septiembre de 2026

Este candidato conserva la fuente local de `padbol-match-native/.web-commercial-live/padbol-match-frontend` y agrega aislamiento de conexiones para QA. No constituye un despliegue ni habilita cobros. No contiene archivos `.env`, SQL, backend, respaldos, credenciales privadas ni datos de usuarios. Los recursos públicos existentes se conservan.

## Fuente y publicación

La web pública observada sirve `main.30fcb7ca.js` (SHA256 `62a59ef6bc3caba72497dd3fc2e09e884d3212c035b27442a7053ef222d38e87`). Su source map público devuelve 404, por lo que ese archivo por sí solo no permite demostrar igualdad con una revisión de Git. La inspección del coordinador identifica el proyecto Vercel `padbol-match-9abn`, raíz `padbol-match-frontend`, Node 24 y deployment `dpl_HrpA6JTKwSnmAt68pvciieAaLzx9`, del 4 de septiembre. La API Vercel v13 informa `source=cli`, revisión `049d1f8b3d4d2672889d7fbb82a4878443a835d1`, rama `codex/integrate-commercial-landing` y `gitDirty=1`. El commit existe en el monorepo local y es ancestro del HEAD local. La subida incluía cambios sin commit: la revisión registrada no reconstruye por sí sola todos los bytes publicados. No consta enlace Git del proyecto en esa metadata.

El repositorio dedicado público `Gus-Padbol/padbol-match-frontend`, main `0b72e8c407af9feeb6e4807c4bf6da5b2a5999b1`, está fechado el 28 de julio y tiene 90 archivos. Es materialmente distinto del frontend actual del monorepo `Gus-Padbol/padbol-match`. No se sustituyó ni se subió una rama en ese repositorio antiguo. Tampoco se cambió configuración remota de Vercel.

## Variables de compilación obligatorias para QA

CRA incorpora estas variables al compilar; cambiarlas en el servidor después no modifica un bundle existente. No deben incluirse secretos de servidor en variables `REACT_APP_*`.

| Variable | Valor requerido |
| --- | --- |
| `REACT_APP_APP_VARIANT` | `qa` |
| `REACT_APP_API_BASE_URL` | Origen HTTPS del backend QA verificado por el coordinador, sin `/api`, query ni credenciales |
| `REACT_APP_API_URL` | Exactamente el mismo origen QA; también lo usa el marcador/socket |
| `REACT_APP_SUPABASE_URL` | Origen HTTPS del proyecto Supabase QA verificado, separado de producción |
| `REACT_APP_SUPABASE_ANON_KEY` | Clave pública `anon` o `sb_publishable_*` de ese proyecto QA |
| `REACT_APP_VERSION` | Identificador de esta revisión para auditoría legal; recomendado |

El prebuild usa el cargador de configuración de CRA y bloquea QA con variables ausentes, URLs de producción conocidas, HTTP, aliases contradictorios, claves `service_role`/secret o la clave pública productiva conocida. El mismo resolver se ejecuta antes de crear el cliente Supabase y al resolver bases API. La variante vacía conserva el comportamiento de producción. Se verificó por DNS el alias productivo `vpldffhsxhgnmitiikof.supabase.co`, y también se bloquea en QA (incluido el hostname con punto final y un JWT anon de esa referencia). El control de formato no demuestra aislamiento del servicio remoto: el coordinador debe verificar que API, base, storage y credenciales pertenecen al entorno QA.

Variables opcionales existentes: `REACT_APP_ENABLE_CLUB_PRICING`, `REACT_APP_COMMERCIAL_PRICING_PREVIEW`, `REACT_APP_SUPPORT_WHATSAPP` y `REACT_APP_GOOGLE_PLACES_KEY`. Mantener pagos desactivados y no introducir claves Stripe para este QA. El backend QA debe mantener envíos, trabajos automáticos y cobros apagados.

Se centralizaron los defaults y lecturas dispersas de API, incluyendo Mi Perfil, administración, alta de sedes, torneos, biblioteca FIPA, marcador y servicios compartidos. Autenticación mantiene PKCE, persistencia y renovación existentes; auth/storage usan el Supabase configurado.

## Legal y comercial: candidato pendiente de alineación

`src/utils/legalDocuments.js` todavía declara términos y privacidad versión `2026-09-05`, en `/terminos` y `/privacidad`. Antes de publicar el candidato, el coordinador debe alinear el texto final, manifiestos web/nativo, versiones y hashes del registro legal de Supabase y aceptación efectiva mediante `estado_aceptacion_legal_actual` / `registrar_aceptacion_legal_actual`. Las páginas locales o sus pruebas no acreditan esa alineación remota.

Incluir en la revisión final los flujos FIPA, push por instalación/idioma y sus preferencias. No se cambian edad mínima ni consentimiento por inferencia. Continúan los límites existentes: sin cuenta para menores de 13; 13–15 requiere autorización parental verificada; acceso autónomo desde 16.

Se conservan las condiciones autorizadas: USD 68 de base, tres meses gratis, USD 34 desde el cuarto mes para el beneficio correspondiente, y proyección USD 17 únicamente con las seis metas configuradas y cumplidas. El anual USD 690 permanece sin inferir condiciones nuevas. Las metas duras 1/8/3/10/10/5 siguen pendientes de decisión comercial. Checkout y cobros no se habilitan.

## Pruebas reproducibles

- `npm run check:environment`: valida el entorno cargado por CRA sin mostrar valores ni claves.
- `npm run test:qa-routing`: ejecuta handlers y defaults reales extraídos por AST con red simulada: cancelar reserva, crear sede y contrato, crear torneo, administración, Supabase QA y ausencia de accesos API productivos directos.
- `CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand`: suite completa sin regenerar el identificador PWA.
- `npm run build`: valida entorno, regenera el identificador PWA y compila. El director debe ejecutar el build final con las variables QA verificadas; nunca publicar el build de prueba con dominios de fixture.

La prueba aislada usa exclusivamente dominios ficticios y llamadas simuladas. Las pruebas de FIPA cubren componentes reales `ProtectedRoute`/`FipaDocuments` con sesión/API simuladas, no autenticación OAuth remota ni el router completo desplegado. QA por roles y aceptación legal requieren el entorno remoto ya preparado.

## Resultado de validación local

Suite completa final posterior a la corrección de CRA: **995/995 pruebas, 121 suites**. Pruebas de rutas/handlers reales con red simulada: **7/7**. Incluye alta real de sede (precio obligatorio, cero explícito, horarios nocturnos), notificaciones con DTO/rutas vigentes y conservación del estado ante errores, alias booleano y consumidores de identidad pública/búsqueda autenticada.

Se detectó y corrigió una diferencia que Jest no cubría: CRA trataba el resolver `.cjs` como recurso estático, causando `resolveClientEnvironment is not a function` en `/planes`. Ahora el módulo usa extensión `.js`, compatible con CRA y los scripts Node. Se comprobó su ejecución a partir de los bytes servidos por `localhost:3000` y del bundle optimizado, con producción habitual, QA aislado y bloqueo de host productivo. El servidor recompiló sin reiniciarlo. El manifiesto ya no contiene el resolver en `static/media`.

Compilación corregida de fixture: `/static/js/main.a1feaa43.js`. Los compilados anteriores sólo acreditaban compilación y quedan reemplazados por esta comprobación. **No desplegar este bundle de fixture**: contiene orígenes ficticios. La conexión Browser del agente no estuvo disponible; la revisión visual fue solicitada al coordinador con acceso al navegador. No se afirma una prueba remota de login, pago, aceptación legal ni permisos por rol.

Preflight: producción habitual y QA aislado válidos; QA incompleto o apuntando a producción rechazados. Se corrigió además la detección UUID del navegador en el panel de notificaciones; comprobados crypto y fallback sin window.

## Privacidad y dependencias funcionales abiertas

Se migraron al DTO público por UUID/alias los compañeros de perfil, equipo público y enriquecimiento de jugadores. La disponibilidad del alias usa `/api/registro/alias-disponible`, sin leer filas. AppHeader y la búsqueda de compañeros requieren sesión y usan `/api/jugadores/buscar`; nunca consultan un directorio anónimo. Conservan acceso directo los flujos de perfil propio autenticado.

El cierre SQL11 se aplicó en QA según el equipo de backend/QA. El barrido completo también identifica consumidores legacy ajenos todavía pendientes: `ModalJugador`, dos lecturas en `EquipoVista`, el fallback no invocado de `Rankings`, y listado/validación administrativa de jugadores. El backend actual no tiene API equivalente para pendientes, cambio de nivel o lista territorial; requiere autorización del servidor explícita. `EquipoVista` escribe equipos legacy mientras `/api/equipos/:id/invitar` actual usa `equipos_usuario`: no se intercambian IDs ni se declara resuelta la invitación por cambiar una URL. Estos recorridos no se consideran cerrados por las pruebas de este candidato.

La matriz priorizada de contratos pendientes y su responsable se conserva junto al informe de release del coordinador. Pagos, disponibilidad, clases, solicitudes de partidos, Chivi y otros flujos FIPA requieren la integración concreta descrita allí.
