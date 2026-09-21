# Esquema Pro para sedes con Padbol Courts

Estado: especificación comercial confirmada para el tablero privado de Padbol Match. Implementación local informativa; no habilita cobros, no cambia suscripciones de producción y no fue desplegada.

## Condiciones confirmadas

- Precio base de Padbol Match Pro: **USD 68 por mes**.
- Sede con Padbol Courts, meses 1 a 3 desde su fecha de inicio: **USD 0 por mes**.
- Sede con Padbol Courts, desde el mes 4: **USD 34 por mes**, equivalente al 50% del precio base.
- Si cumple todos los objetivos mensuales expresamente configurados: **USD 17 por mes**, equivalente a un 50% adicional sobre USD 34.
- La moneda es USD. Impuestos, conversión, fecha de corte, prorrateo, vencimiento y medio de pago no están definidos en esta especificación.

El número de mes se calcula por mes calendario: el mes de la fecha de inicio es el mes 1. Esta regla sólo sirve para mostrar el tramo comercial; no genera una factura.

## Objetivos

No hay cantidades objetivo aprobadas en esta especificación. El sistema puede medir actividad real existente en estas seis familias:

- torneos finalizados;
- usuarios registrados que participaron en equipos confirmados de torneos;
- partidos finalizados con el marcador;
- reservas no canceladas de usuarios registrados;
- jugadores activos vinculados con actividad mensual verificable;
- movimientos de PadCoins registrados para la sede.

Estas familias no equivalen por sí solas a metas comerciales. Cada cantidad debe ser configurada expresamente por un superadministrador. Una meta ausente se muestra como **pendiente de configuración**, nunca como cero. Si una consulta de datos falla, el tablero muestra **dato no disponible**, nunca un cero estimado.

El descuento de USD 17 sólo puede proyectarse cuando las seis metas están configuradas y las seis aparecen cumplidas. Mientras falte una configuración, el tablero conserva USD 34 como tarifa de referencia y USD 17 como beneficio potencial, sin afirmar que corresponda cobrar ninguno.

## Estado mensual del tablero

Para cada sede se muestran:

- período y número de mes desde el inicio;
- tramo de tres meses sin cargo o tramo desde el cuarto mes;
- cantidad de metas configuradas y cumplidas;
- valor real observado, meta y estado de cada objetivo;
- tarifa base, tarifa Padbol Court, beneficio potencial y proyección disponible;
- advertencia permanente de que la facturación está cerrada.

Los valores del mes actual son una vista dinámica. No constituyen un cierre contable ni una promesa contractual irreversible.

## Compatibilidad y seguridad

El identificador interno `padbol_pro_renovable` se mantiene temporalmente para leer las filas actuales. Sólo se confían objetivos cuya `reglas_version` comience con `pricing-v2`; una fila `v1` queda señalada como configuración anterior y sus metas no se reutilizan silenciosamente.

La lógica anterior de seis meses gratis, extensión gratuita mensual y descenso automático a Starter es incompatible con esta especificación. El backend local dejó de ejecutar su cron y bloquea la reconciliación antigua. Los SQL históricos:

- `padbol-backend/sql/20260904160000_sede_incentivos_renovables.sql`;
- `padbol-backend/sql/20260904170000_sede_plan_comercial.sql`;

no deben aplicarse para este esquema sin una migración compensatoria revisada. Las filas históricas y los posibles efectos ya aplicados en producción no fueron inspeccionados ni modificados.

La acción local de “crear ficha comercial” guarda el programa como `borrador`.
La API rechaza el cambio a `activo` mientras este cierre esté vigente, por lo que
no dispara el trigger histórico de acceso Pro. Conserva `meses_base = 3`, pero
deja sin fecha de vencimiento los campos contractuales hasta definir corte y
prorrateo.

## Pendientes funcionales antes de cobrar

- Aprobar las seis cantidades objetivo y quién puede modificarlas.
- Decidir si el cumplimiento del mes reduce el mismo mes o el siguiente.
- Definir cierre, zona horaria contractual, prorrateo, impuestos, conversión y tratamiento de reembolsos o correcciones.
- Confirmar qué condición acredita que una sede es una Padbol Court elegible.
- Diseñar y revisar la migración de programas `v1` y del historial anterior.
- Integrar el resultado cerrado con facturación sólo después de pruebas y autorización expresa.
- Actualizar contratos, términos, privacidad cuando corresponda y toda comunicación comercial que todavía mencione seis meses gratis o renovación gratuita indefinida.
