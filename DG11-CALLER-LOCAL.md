# Caller DG11 — local, no publicado

Base frontend: 9f7e061145f0d92ba8b94a952971bcfdcb4aa76a. Rama candidate/support-dg11-caller-20261101. Conserva el caller comercial anterior y solo usa el circuito nuevo si el backend anuncia supportActivityAtomicEnabled para un operador ya autorizado y la consulta pertenece al buzón de soporte exacto.

La identidad se guarda antes de enviar en sessionStorage, ligada al actor, conversación, acción y SHA256 del contenido normalizado. No persiste el mensaje, token ni diagnóstico. Ante red/503/acuse incompleto conserva la referencia; otra composición se bloquea hasta recuperar la anterior o revisar el estado. Un rechazo explícito anterior al commit permite corregir el formulario. Solo un acuse validado elimina el pendiente. No hay envío o reintento automático. Una pestaña nueva tiene almacenamiento de sesión separado: no se afirma deduplicación global entre pestañas distintas o equipos. El backend sigue siendo la autoridad de acceso y resultado.

El borrador de pantalla se conserva al fallar. No se persiste su texto: tras recargar, para recuperar por reintento debe reconstruirse exactamente el contenido original; si no es posible, revisar el historial antes de otra mutación. No se ofrece borrar a ciegas una referencia incierta.

Validación:109pruebas de utilidad/API/pantalla, build local con destinos QA ficticios y red bloqueada; integración delta con handlers/repositorio reales y PostgreSQL efímero, incluyendo pérdida de acuse tras commit. Las pruebas usan identidad, proveedor y diagnóstico sintéticos. No prueban instalación de un agente autónomo ni transporte o autoridad reales.

Sin publicación/flags reales, esquema remoto, cuentas, permisos o automatizaciones. Código backend/caller preparados conjuntamente; la propuesta SQL añade columna nullable/hash y guardas sin cambios de ACL. Antes de activar se necesita revisión independiente y transición coordinada del caller, capacidad y RPC. No aplicar SQL aisladamente: el caller anterior de soporte carece de requestId.
