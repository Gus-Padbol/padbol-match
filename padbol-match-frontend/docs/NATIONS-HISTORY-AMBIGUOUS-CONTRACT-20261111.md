# Nations — contrato de historial FIPA ambiguo

## Estado
`ambiguous` cuando el nombre canónico + país normalizado coincide con **más de un** participante FIPA oficial.

## Quién resuelve
Coordinación Nations/FIPA (staff administrativo autorizado), no el jugador. El jugador **no** hace un trámite adicional, no reclama y no vincula su cuenta.

## Qué ve el jugador
- `status: ambiguous`, `puntos: null`, `posicion: null`.
- Copy: “This history requires administrative coordination; no points are assigned here.”
- No se muestran IDs, contactos, documentos ni `source_key`.
- No se inventa ni se suma un valor.

## Qué debe hacer coordinación
- Revisar la identidad oficial y resolver la asociación fuera del flujo del jugador.
- Mantener el caso en estado administrativo hasta tener una fuente/ID autoritativo; no atribuir por coincidencia ambigua.
- No se agrega endpoint, claim, JWT autoclaim ni escritura en este cambio.

## Casos no ambiguos
- Coincidencia única → puntos/posición reales.
- Sin coincidencia → 0, sin error ni obligación de reclamo.
- Fuente no disponible → 503, nunca 0 fabricado.

Privacidad de la superficie: [NATIONS-HISTORY-PRIVACY-20261111.md](./NATIONS-HISTORY-PRIVACY-20261111.md).
