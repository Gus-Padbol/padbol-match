# Manual operativo — Campañas automáticas PadCoins por sede

Guía simple para aprender, probar y explicar el módulo de campañas PadCoins en Admin Padbol Match.

---

## 1. Qué son las campañas automáticas PadCoins

Las campañas automáticas PadCoins son **acciones temporales** que una sede puede crear para **impulsar reservas** y **fidelizar jugadores**.

Durante el período de la campaña, los jugadores pueden **sumar más PadCoins** al reservar en esa sede. Los PadCoins sirven para canjear beneficios dentro del programa de fidelización.

La campaña tiene **fecha de inicio y de fin**, un **tipo de acción** (por ejemplo, multiplicar PadCoins o entregar una cantidad fija) y **mensajes** que el jugador ve en la app web.

---

## 2. Quién puede usarlas

| Rol | Qué puede hacer |
|-----|-----------------|
| **Super Admin** | Ver campañas de todas las sedes, revisar impacto y auditar campañas de alto impacto. No aprueba campaña por campaña. |
| **Admin Club** | Crear, editar, activar y pausar campañas **solo de su propia sede**. |
| **Admin Nacional** | **No** administra este módulo. No verá la sección de campañas automáticas en PadCoins. |

---

## 3. Responsabilidad de la sede

La **sede** es quien define la campaña:

- Nombre y descripción
- Fechas de vigencia
- Tipo de campaña
- Cupos (total y por jugador)
- Beneficio asociado, si aplica
- Mensajes que verá el jugador

La sede **asume el costo operativo y comercial** de la campaña (beneficios, promociones, cumplimiento).

**Padbol Match**:

- Automatiza la aplicación de la campaña cuando corresponde
- Registra la trazabilidad y el impacto
- Muestra la campaña al jugador en sede y reserva

**Padbol Match no aprueba campaña por campaña.** Las campañas de alto impacto quedan marcadas para auditoría del Super Admin, pero no se bloquean automáticamente.

---

## 4. Tipos de campaña (explicación simple)

| Tipo | Qué hace |
|------|----------|
| **Multiplicador** | Multiplica los PadCoins que el jugador ganaría normalmente (por ejemplo, duplica o triplica). |
| **Porcentaje especial** | Durante la campaña, aplica un porcentaje de fidelización más alto y entrega más PadCoins por reserva. |
| **PadCoins fijos** | Entrega una **cantidad fija** de PadCoins extra por cada reserva que cumpla las condiciones. |
| **Beneficio especial** | Campaña vinculada a un **beneficio** de la sede: el jugador suma PadCoins orientados a canjear ese beneficio. |

---

## 5. Cómo crear una campaña (paso a paso)

1. Entrar a **Admin** con usuario Admin Club o Super Admin.
2. Abrir la pestaña **PadCoins**.
3. Bajar hasta la sección **Campañas automáticas**.
4. Tocar **Nueva campaña**.
5. Completar los datos:
   - **Nombre** de la campaña (obligatorio)
   - **Sede** (Super Admin elige sede; Admin Club usa la suya automáticamente)
   - **Fecha de inicio** y **fecha de fin**
   - **Tipo** de campaña
   - Valores según el tipo (multiplicador, porcentaje, PadCoins fijos o beneficio)
   - **Cupo total** y **cupo por jugador** (si se usan límites)
   - **Título y cuerpo del mensaje** para el jugador (recomendado)
6. Tocar **Guardar campaña** (queda en estado borrador).
7. Cuando esté lista, tocar **Activar**.

**Sugerencia:** Si el sistema marca la campaña como **alto impacto**, confirma que realmente quieres activarla. Quedará registrada para auditoría.

---

## 6. Qué ve el jugador

El jugador **no ve precios ni equivalencias monetarias** de los PadCoins. Solo ve mensajes de fidelización y beneficios.

| Momento | Qué puede ver |
|---------|----------------|
| **Perfil de la sede** | Un banner con título y texto de la campaña, y un botón para reservar. |
| **Reserva — horarios** | Una etiqueta discreta (por ejemplo: «Triplica PadCoins» o «PadCoins extra»). |
| **Reserva — confirmación** | Un mensaje antes de pagar: que al confirmar puede sumar PadCoins extra por la campaña. |
| **Después del pago exitoso** | Un mensaje de que, si cumple las condiciones, los PadCoins extra se acreditarán automáticamente (cuando la información de la reserva lo permite). |

Los textos pueden venir del admin (título y mensaje de campaña) o de mensajes predeterminados claros y simples.

---

## 7. Qué revisar después de activar

Checklist rápido en Admin y como jugador:

- [ ] La campaña está **activa** (no en borrador ni pausada).
- [ ] Las **fechas** incluyen el día de la prueba (inicio ≤ hoy ≤ fin).
- [ ] La campaña es de la **sede correcta**.
- [ ] Los **cupos** están configurados como se espera (o sin límite, si aplica).
- [ ] El **mensaje** es claro para el jugador (sin lenguaje económico).
- [ ] En la **sede** (perfil público) aparece el banner de campaña.
- [ ] En el **flujo de reserva** aparece la etiqueta y el mensaje de confirmación.

---

## 8. Checklist para prueba real (Gustavo y Juampi)

Usar cuando hagan la **prueba operativa** (no es obligatorio hacerla ahora).

| Paso | Acción |
|------|--------|
| 1 | Crear una **campaña de prueba** en La Meca u otra sede acordada. |
| 2 | Completar fechas, tipo, cupos y mensajes. |
| 3 | **Activar** la campaña. |
| 4 | Entrar como **jugador** (cuenta de prueba o real). |
| 5 | Abrir el **perfil de la sede** y verificar el **banner**. |
| 6 | Iniciar **reserva**, elegir día, horario y cancha. |
| 7 | Verificar **etiqueta** de campaña en horarios y **mensaje** en confirmación. |
| 8 | Completar una **reserva de prueba** (pago según método de la sede). |
| 9 | En **pago exitoso**, verificar mensaje de PadCoins extra si corresponde. |
| 10 | Revisar **acreditación de PadCoins** en el jugador (saldo / movimiento). |
| 11 | En **Admin**, abrir **Ver resumen** de la campaña (usos, PadCoins entregados, reservas impactadas). |
| 12 | Si era solo prueba: **pausar** o dejar que **finalice** según fechas; documentar resultado. |

---

## 9. Errores comunes

| Problema | Causa probable | Qué hacer |
|----------|----------------|-----------|
| No aparece nada al jugador | Fechas fuera de vigencia | Ajustar inicio y fin para incluir el día de prueba. |
| No aparece nada al jugador | Campaña en **borrador** o **pausada** | Activar la campaña. |
| No aparece en la sede esperada | Campaña creada para **otra sede** | Verificar sede en Admin o crear campaña en la sede correcta. |
| No hay mensaje en pago exitoso | La confirmación de pago no trae identificador de sede | Revisar con soporte técnico; el banner y la reserva pueden funcionar igual. |
| Jugador confundido | Mensaje con lenguaje de dinero | Reescribir mensajes: hablar de PadCoins y beneficios, no de «valor» o «costo» en dinero. |
| Cupos agotados | Se alcanzó cupo total o por jugador | Revisar resumen en Admin; ampliar cupos o crear nueva campaña. |

**Regla de oro:** El jugador **nunca** debe ver equivalencias monetarias de los PadCoins.

---

## 10. Cierre

El módulo de campañas automáticas PadCoins permite que **cada sede genere movimiento comercial y fidelización** por su cuenta, con reglas claras y trazabilidad para Padbol Match.

El Super Admin mantiene **visibilidad y auditoría** sin tener que aprobar cada campaña manualmente.

Para dudas en la prueba operativa, Gustavo y Juampi pueden usar este manual y el checklist de la sección 8.

---

*Documento operativo — Padbol Match. Actualizar si cambian pantallas o reglas de negocio.*
