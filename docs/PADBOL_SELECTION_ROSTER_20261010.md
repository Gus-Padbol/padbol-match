# Plantel de selección Padbol: interfaz opt-in

Base: `0ba40f18b67b7f461909d2f8c90a4e7942d9f1ed`. Sólo aplica si deporte Padbol y `modalidad_plantel: selecciones`; el formato de juego permanece dobles, dos jugadores en cancha. Otros deportes y equipos dobles existentes conservan su flujo.

Un equipo comienza como borrador de su creador registrado. El cupo máximo es de cuatro a ocho. Cuatro miembros confirmados bastan para estar listo: no se exige llenar ocho. El capitán acepta solicitudes reales, o un administrador autorizado selecciona perfiles registrados; nombres/identidades del cliente nunca se usan para fabricar jugadores. El creador permanece en el plantel. Confirmar la inscripción es independiente del plantel y sólo se ofrece con `can_confirm` autorizado por el servidor; esta interfaz no inicia pagos.

Cada equipo de cada partido declara exactamente dos iniciales y dos suplentes, diferentes e integrantes del plantel. Las declaraciones se guardan con revisión, se vuelven a leer y se comparan antes de mostrar éxito. Un borrador distinto deshabilita el resultado. Antes de guardar un resultado se releen ambas declaraciones. La autorización real y los bloqueos por estado/revisión corresponden al backend, no a la visibilidad de botones.

La pantalla explica la alternancia en games impares y que siempre juegan dos. La carga manual de sets no registra cambios game por game. No hay clasificación oficial FIPA ni nuevas reglas de puntos en este cambio de interfaz.

## Contrato requerido antes de publicación

Endpoints autenticados `/api/torneos/:id/selecciones` para listado y creación; `/:equipoId` para lectura privada; `/:equipoId/solicitudes`, `/:equipoId/plantel` y `/:equipoId/confirmar` para operaciones reales. Mutaciones de equipo devuelven recibo con identidad de torneo/equipo, revisión, jugadores confirmados, solicitudes autorizadas, creador, cupo y `can_confirm`, además del estado guardado/idempotente. Listado requiere `equipo_abierto` booleano. Declaraciones GET/PUT usan `/api/torneos/:id/partidos/:partidoId/equipos/:equipoId/alineacion`, propiedad `alineacion`, dos arrays de UUID y revisión CAS. Un PUT con revisión antigua debe responder conflicto, no sobrescribir.

El backend y su migración aditiva requieren revisión independiente y canario QA; compilar esta interfaz no acredita tablas/RPC productivos. No se escribieron datos de producción, no se enviaron mensajes ni se activaron pagos.

## Pruebas y preview

Pruebas de componentes reales, utilizando los helpers API reales y reemplazando solamente sesión/fetch, cubren declaraciones4, plantel4de8, revisión concurrente, duplicados, jugadores ajenos, permisos, borradores conservados ante errores, ausencia de recibo, verificación GET tras PUT, aislamiento entre partidos y bloqueo de resultado. Se incluyen recorridos anteriores de resultado sin modalidad nueva.

Preview separado fuera de Git: `/private/tmp/jefe4-selection-preview`, puerto8818. Componentes reales TorneoTabbedView/PadbolSelectionTeams y estilos globales index/App/AdminDashboard. Sesión, traducción local ES y servidor son sintéticos; fetch rechaza hosts ajenos a fixture.invalid. Los SVG decorativos se omiten. Las operaciones modifican exclusivamente memoria local y se reinician al refrescar navegador. No acredita una sesión real ni SQL.

Escenarios: `/`, `/?saved=1`, `/?role=auditor&saved=1`, `/?role=captain`, `/?error=409`, `/?error=503`, `/?mode=legacy`. Dos partidos permiten comprobar aislamiento. Recargar componentes mantiene memoria local; simular revisión concurrente avanza revisiones sin modificar borradores. No se simula el paso tres grupos de cinco a cuadro de ocho.
