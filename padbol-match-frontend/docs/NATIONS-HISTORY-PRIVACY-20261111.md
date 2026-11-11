# Nations — privacidad del historial FIPA por convocado

## Superficie
`GET /api/nations-activation/events/:slug/selector/:selectionId/history`

## Datos públicos deliberados
- `selectionId` ya se publica en `GET .../selector` (hash opaco de 32 hex; no es UUID canónico).
- El nombre, país, puntos y posición FIPA ya son parte de la fuente oficial pública.
- El endpoint devuelve **sólo** `{status, puntos, posicion}`:
  - `matched`: puntos/posición reales de una coincidencia única.
  - `zero`: `0`/`null` cuando no hay historial.
  - `ambiguous`: `null`/`null`; no atribuye ni inventa.
- Nunca devuelve `source_key`, `user_id`, email, teléfono, documento, fecha de nacimiento, contacto ni IDs canónicos.
- No crea solicitudes, vínculos ni reclamos; es sólo lectura y no autentica al jugador.

## Resolución
- Nombre canónico normalizado (acentos/espacios/mayúsculas) + país normalizado ISO/nombre (`Romania`↔`RO`).
- Coincidencia única → puntos reales.
- Sin coincidencia → 0, no error.
- Más de una coincidencia → estado administrativo; el jugador no hace ningún trámite adicional.
- Fuente no disponible → 503, nunca 0 inventado.

## Límites
- Sin rate limit agresivo: el selector ya es público; el endpoint comparte el límite de lectura.
- Sin JWT/autoclaim, sin escritura SQL, sin grants.
- La asociación de historial para QA/54 sigue siendo responsabilidad de coordinación; el endpoint no vincula cuentas.
