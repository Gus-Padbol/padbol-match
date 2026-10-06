# Snapshot operativo: Admin, CRM y Next Generation

Fecha: 6 de octubre de 2026.

Este documento acompaña la rama `snapshot/admin-crm-ng-2026-10-06`. La rama
conserva el paquete de trabajo posterior a la versión hoy publicada, pero **no
es una autorización de despliegue**.

## Estado verificado antes del snapshot

- `https://www.padbolmatch.com/admin` responde HTTP 200.
- El frontend publicado usa el backend de Vercel mediante rewrites a
  `https://padbol-backend.vercel.app`.
- En ese backend, sin sesión, estas rutas responden 401 (existen y están
  protegidas):
  - `GET /api/admin/crm/permissions`
  - `GET /api/admin/crm/inbox`
  - `GET /api/admin/next-generation/overview`
- `https://padbol-backend.onrender.com/health` responde 200, pero el 6 de
  octubre estas rutas respondían 404 en Render:
  - `GET /api/admin/crm/permissions`
  - `GET /api/admin/crm/inbox`
  - `GET /api/admin/next-generation/overview`

## Qué contiene este snapshot

- Mejoras visuales y funcionales de Atención/CRM.
- Mejoras del formulario de alta manual.
- Ajustes de navegación posterior al ingreso.
- Panel operativo de Next Generation para participantes, postulaciones de
  sedes, jornadas y cupos.
- Endpoints para convertir conversaciones del CRM en inscripciones o
  postulaciones, asignar sede/jornada, actualizar estados y administrar cupos.
- Migración canónica `20261005170000_next_generation_operations.sql`.
- Historia de migraciones Supabase disponible para reconstruir el contexto.

## Validaciones ejecutadas

- Frontend: 4 suites, 23 pruebas aprobadas.
- Backend incluido en este repositorio: 224 pruebas aprobadas.
- Frontend: build de producción completado; sólo mostró advertencias conocidas
  de source maps de `html5-qrcode` y tamaño del bundle.
- `git diff --check`: debe ejecutarse nuevamente desde esta rama antes de
  continuar o abrir un Pull Request.

## Bloqueos que impiden publicarlo directamente

1. **Backend de destino.** La configuración nueva permite usar
   `REACT_APP_API_BASE_URL`. Antes de apuntar producción a Render, el backend
   oficial de Render debe incorporar y exponer las rutas CRM y Next Generation
   listadas arriba. Hoy devolver 404 dejaría la bandeja en blanco.
2. **Migración de base de datos.** Debe revisarse y aplicarse primero en QA la
   migración `supabase/migrations/20261005170000_next_generation_operations.sql`.
   Crea o modifica `ng_solicitudes_sede`, `ng_sesiones`, `ng_inscripciones`,
   `ng_inscripcion_participantes`, `ng_inscripcion_eventos` y las funciones RPC
   de confirmación, espera, promoción y cancelación.
3. **Orden seguro.** El orden obligatorio es: migración QA, backend QA,
   comprobación autenticada de rutas, frontend preview, prueba humana y recién
   después producción. No publicar primero el frontend.
4. **Datos reales.** Las pruebas automatizadas no sustituyen una verificación
   con una cuenta superadmin y otra cuenta de sede para confirmar aislamiento
   territorial, asignación, cupos y cambios de estado.

## Procedimiento de continuación

1. Crear una rama de trabajo desde este snapshot; no trabajar directamente
   sobre la rama de conservación.
2. Comparar el backend incluido aquí con el repositorio oficial
   `Gus-Padbol/padbol-backend` y trasladar sólo los cambios necesarios.
3. Validar la migración contra una copia o QA y documentar resultado y rollback.
4. Desplegar el backend oficial en QA y comprobar que las tres rutas ya no
   devuelvan 404.
5. Crear un preview del frontend apuntado exclusivamente a QA.
6. Ejecutar las pruebas automáticas y la prueba humana CRM/Next Generation.
7. Hacer Pull Request y publicar con posibilidad de reversión al despliegue
   Vercel anterior.

## Exclusiones deliberadas

- No se incluyen directorios `supabase/.temp`, archivos de enlace local ni
  credenciales.
- No se tocaron DNS, `padbol.com`, dominios ni aliases.
- No se aplicó ninguna migración ni se desplegó esta rama.
