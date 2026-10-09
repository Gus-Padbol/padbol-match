# Revalidación 2 del panel admin · revisión técnica 9/10/2026

Fuente: Revalidacion_2_QA_Panel_Admin_PadbolMatch_2026-10-08.pdf, leído completo (7 páginas). Sus observaciones se trataron como evidencia. Este documento informa cambios locales preparados para integrar; no acredita publicación ni revalidación visual de producción.

Repositorio frontend: https://github.com/Gus-Padbol/padbol-match.git. Rama aislada `fix/admin-revalidation-2-20261009`, base `f20bad846a344156228d3e12b9d5888a9a7a114b`. No cambios de datos, permisos reales, credenciales, DNS, pagos ni mensajes externos.

## Hallazgos resueltos por esta rama

| ID | Cambio y evidencia |
| --- | --- |
| G05 / T03 | Países sin glifos de banderas en ubicaciones de torneos y los selectores que usan sedeFlag. Se preserva el nombre del país. |
| G09 | Las reglas PadCoins muestran su etiqueta y ayuda; se retiró la clave interna visible. |
| G12 | Se retiró el punto adicional al texto legal que ya termina en punto, tanto en panel como sitio público. Test verifica LLC. sin LLC.. |
| S03 | Duraciones muestran Base/Padbol explícitamente junto al precio; test render distingue60minARS20000 base vs26000Padbol. Tarifas/datos se preservan. |
| S08 | Detalle con contraste y objetivo táctil de 44 px. Contactos ausentes conservan el mensaje explícito ya presente en la base. |
| SO01 | Accesos FIPA/jornadas/documentos separados en un bloque secundario plegable y traducido; se retiró un contador fijo. |
| RE04 | Resumen y Reservas comparten la misma traducción de Año. |
| J01 | Un Super Admin sin selección no recibe una sede automática; muestra elección necesaria sin consultar ni anunciar historial vacío. Test cubre seleccionar y volver a limpiar la selección. |
| C02 / N6 | A 390 px los canales ocupan una columna y sus palabras no se cortan. Preview local de lectura usa CSS real y datos ficticios. |
| C01 | UI permite respuesta email exclusivamente si servidor declara emailSendEnabled, el usuario tiene canOperate y existe email_normalized. Auditor, canal deshabilitado o destinatario ausente mantienen compositor/envío bloqueados. Tests solo usan adaptador simulado. Configuración de proveedor real continúa pendiente. |

## Contrato backend coordinado

R03 / N7: revisión de lectura encontró 88 reservas con deporte padbol; el DTO descartaba deporte y cancha_id. El agente backend corrige selección/DTO para devolver datos existentes, sin completar ni inventar registros. Su commit y pruebas se integran por separado.

C01: el adaptador backend email se mantiene deshabilitado sin proveedor, remitente, secreto y flag efectivos. Esta rama no configura ninguno. La revisión independiente detectó necesidad de idempotencia entre solicitudes repetidas; backend está preparando requestId estable obligatorio para email y debe integrarse también en UI antes de habilitar el canal. La etiqueta HABILITADO solo refleja la capacidad retornada por el servidor. WhatsApp permanece pendiente del proveedor.

## Pendientes que requieren decisiones sobre datos reales

S01: existe una única sede física La Meca Padbol Club (id 1). El ranking separado se origina en 38 reservas legacy con sede textual La Meca y sin sede_id/cancha_id, frente a 49 vinculadas a sede 1. No existe una segunda sede que pueda eliminarse. Para unificar, el responsable debe confirmar la atribución de las 38 reservas; luego preparar actualización acotada con inventario/backup/reconciliación. No se ejecutó.

S03: registros activos en sede 1 no tienen idéntico alcance: id 6 Padbol 60 min ARS 26000 vs id 1 sin deporte 60 min ARS 20000; id 7 Padbol 90 min ARS 28000 vs id 2 sin deporte 90 min ARS 30000; id 3 sin deporte 120 min ARS 40000. Hace falta decidir tarifas y alcance del fallback; borrar/deactivar automáticamente puede alterar precios reales y referencias históricas.

G06: el inventario es de candidatos, no autorización para purgar. Ahora hay 5 torneos DEMO (ids 23,27,28,29,32), 21 conversaciones explícitas QA/E2E y 11 con palabra genérica prueba; estas últimas pueden incluir consultas reales. Seis movimientos contables tienen descripción de prueba. Antes de limpieza hacen falta clasificación por propietario, dependencias de torneo/conversación y conciliación de saldos/canjes. Los ids candidatos se detallan debajo, sin contactos ni identidad personal.

RO02: rol id 6 admin_nacional con alcance sede y sede_id 1. Alternativas comerciales: admin_club/sede 1 preserva territorio; admin_nacional/país Argentina amplía privilegios. No puede elegirse automáticamente.

ME01: plan id 3 sede 1 tiene moneda USD, precio 100, nombre Padbol Player y descripción guardada en inglés. Está vencido. Se muestran códigos monetarios ISO explícitos, sin conversiones; cambiar precio/moneda/descripción necesita decisión de producto. R06: el ingreso ARS 1 corresponde a importe real; no se alteró.

## Cobertura de los restantes puntos del PDF

G01,G02,G03,G07,G08,R01,R02,R04,R05,R07,S02,S04,S05,S06,S07,MS01,PL01,ME02,RE01,RE02,RE03,V01,SU01,T01,T02,I01,IN01,PC01,PC02,N01,C03,H01,CF01,RO01,RP01,RP02,RP03 y N1–N4: se conservan las correcciones de la base y se comprueban mediante suite existente. Esto no sustituye recorrido autenticado de producción.

G04: retirado como falso positivo según PDF. G10,G11,T04,PC03: no se declara cierre visual; suite local cubre componentes disponibles. NG01 pertenece al informe Next Generation asignado a otro agente. N5: no se causó despliegue en esta tarea, por lo que no se afirma ausencia de incidente futuro.

## Publicación: identidad verificada, sin publicar

AGENTS limita uso al repositorio canónico y ramas aisladas; requiere preservar snapshots, no secretos y validación. El archivo ignorado .vercel/project.json original apunta a otro proyecto (`padbol-match-frontend`, prj_fQrcos7P0Cyd7upmc8b0gPiBoWpS). Consulta de lectura del alias www.padbolmatch.com confirma proyecto real `padbol-match-9abn`, id `prj_cAg72IvuMtUzJyMIePz1BtIHbwUM`, raíz `padbol-match-frontend`, Node 24, build npm run build. Se informó al coordinador para publicar al proyecto correcto; no se modificó metadata.

Backend canónico: https://github.com/Gus-Padbol/padbol-backend.git; API https://padbol-backend.onrender.com. Su AGENTS/preflight exige raíz canónica, origin correcto, main limpio y tests. Release queda a cargo del coordinador.

## Validación

Suite completa: 146 suites y 1169 tests PASS (73 s, timeouts/assertions intactos). Revisión posterior del compositor email añadió guard del textarea y assertion de edición; repetición exclusiva CRM: 13 tests PASS (2.446 s). Los dos fallos de la primera ejecución durante sobrecarga de la máquina pasaron al repetir sus dos suites sin modificar tests.

Test posterior S03: resumen renderizado distingue alcance base/deporte, 1 test PASS.

Compilación producción HEAD41c0bc75: EXIT0, compilada con advertencias existentes de sourcemaps html5-qrcode y Browserslist desactualizado. Se restauraron stamps PWA generados en este worktree para que la publicación los regenere. Log local /private/tmp/jefe4-admin2-build-final.log. Preview: http://127.0.0.1:8792/mobile-channels.html. Solo HTML local de lectura, sin autenticación ni servicios; recorrido visual de producción a cargo del coordinador.

## Inventario de lectura

Fecha consulta: 2026-10-09T16:20:32.048Z

- Reservas legacy La Meca: 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 43, 44, 45, 46, 47, 37, 39, 40, 42.
- Conversaciones QA/E2E explícitas: db0caba6-75f7-440e-a79e-3b766d53b7d0, b1e72018-f98a-4460-a1b6-69ff2932e850, 9035e493-b4dd-495c-be56-59de757ad475, f626e1ad-c027-4b74-8a02-fc2deef43f42, fbbe1e64-d2dd-42a5-9ca8-ff19ca7c1135, 4a007727-2f12-4851-8f1f-e6ac615485f3, 32846385-5876-444f-ae65-b43f24e743b9, e7a1d711-a07b-4f9a-8667-3d0f764be891, bee47bbe-f699-413e-ac0e-f018c9576983, 62f9e2f2-d658-42bc-ace0-bd49017f6aaa, f1b5f5aa-359f-4bc3-a233-7b94386a1f27, ca94ec45-b1bd-4e27-89a8-5d7903e773b9, 3f14d8e2-b9a0-4910-851a-766581e9dee2, 9561a4f0-76e8-4488-91e1-7e6b1cc523dc, f9492eb4-a7d0-430a-9b01-ab2b2787b02d, 35a2bc5f-54c0-4cf7-a95e-c50f86ee7604, 158eac5d-ddcc-417f-98ab-50475103cc44, 196c598c-db8f-4450-a576-9123f1d4e0ba, 12786428-93b6-40db-b503-3227503de2d8, 60c4d054-bf08-47c9-bec4-b62859214197, decd663b-b6ff-4f0a-8b75-6c39e91b0edd.
- Conversaciones con prueba genérica (requieren revisión): db0caba6-75f7-440e-a79e-3b766d53b7d0, b1e72018-f98a-4460-a1b6-69ff2932e850, 9035e493-b4dd-495c-be56-59de757ad475, f626e1ad-c027-4b74-8a02-fc2deef43f42, fbbe1e64-d2dd-42a5-9ca8-ff19ca7c1135, 4a007727-2f12-4851-8f1f-e6ac615485f3, 32846385-5876-444f-ae65-b43f24e743b9, e7a1d711-a07b-4f9a-8667-3d0f764be891, 90f2adcf-ef0f-4854-b139-1de6d680a9d1, 677d4bfc-fda6-426d-b109-f595388bf11e, 62f9e2f2-d658-42bc-ace0-bd49017f6aaa.
- Movimientos de prueba: ef5cc6da-3ef1-4a35-b68b-34d825745460, b7f9d9e0-fe80-44cc-bd95-525deee598ec, f7707802-594e-43f6-b69b-2e20c87535cb, b10a631e-a7c6-4454-8f78-af4c6f1ac19c, 0b72762c-5ead-47af-a506-a49104364728, 2e0a2a3d-afec-4b46-ad54-653e11daf37c.
- Reserva legacy Madrid Padbol Point: id 38, sin sede_id/cancha_id; no atribuir a La Meca.
