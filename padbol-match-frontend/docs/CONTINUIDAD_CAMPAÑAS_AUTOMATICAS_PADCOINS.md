# Continuidad — Campañas automáticas PadCoins

Documento de referencia para retomar el trabajo sin reauditar lo ya publicado.

---

## 1. Qué quedó implementado

| Capa | Estado | Descripción breve |
|------|--------|-------------------|
| **Backend** | Publicado | Campañas automáticas PadCoins por sede: crear, editar, activar, pausar, resumen e impacto en reservas. |
| **Admin web** | Publicado | Sección **Campañas automáticas** en Admin → PadCoins (Super Admin y Admin Club). |
| **Endpoint jugador** | Publicado | Consulta de campaña activa por sede para mostrar mensajes al jugador. |
| **Frontend jugador** | Publicado | Banner en sede, etiqueta en reserva, mensaje antes de confirmar y mensaje en pago exitoso (cuando aplica). |
| **Documentación operativa** | Publicado | Manual para Admin Club / Juampi: crear, activar, probar y explicar campañas. |

**Archivos de apoyo ya existentes:**

- `docs/PADCOINS_CAMPAIGNS_PLAYER_UI.md` — plan de integración jugador (referencia técnica ligera).
- `docs/MANUAL_ADMIN_CAMPAÑAS_PADCOINS.md` — manual operativo para pruebas y capacitación.

---

## 2. Commits publicados

| Commit | Descripción |
|--------|-------------|
| `0085fd9` | Backend: campañas automáticas por sede |
| `b97a82d` | Admin: interfaz de campañas automáticas PadCoins |
| `8964c8a` | Documentación: plan de integración UI jugador |
| `fae6bf5` | Backend: endpoint de campaña activa para jugador por sede |
| `8203902` | Jugador: campañas activas en flujo de reserva |
| `940132a` | Documentación: manual operativo para Admin Club |

---

## 3. Qué debe ver Gustavo (verificación rápida)

1. Entrar a **Admin → PadCoins → Campañas automáticas**.
2. **Crear** una campaña de prueba (nombre, sede, fechas, tipo, cupos, mensaje).
3. **Guardar** y **activar** la campaña.
4. Entrar como **jugador** en la misma sede:
   - Banner en el perfil de la sede.
   - Etiqueta en el flujo de reserva (horarios).
   - Mensaje antes de confirmar el pago.
5. Tras una reserva de prueba, revisar mensaje en **pago exitoso** (si la respuesta incluye sede).
6. Volver a Admin y abrir **Ver resumen** de la campaña (usos, PadCoins entregados, reservas impactadas).

---

## 4. Qué falta validar con Juampi

Estas validaciones son **operativas**, no de desarrollo. Gustavo y Juampi las harán cuando corresponda.

| Ítem | Qué validar |
|------|-------------|
| Prueba real de campaña | Crear, activar y recorrer el flujo completo en una sede acordada (ej. La Meca). |
| Acreditación PadCoins extra | Confirmar que el jugador recibe los PadCoins adicionales tras una reserva que cumple condiciones. |
| Resumen en Admin | Que el resumen de campaña refleje usos e impacto coherentes con la prueba. |
| Pago exitoso y sede | Que en todos los métodos de pago la pantalla de éxito pueda mostrar el mensaje de campaña (requiere que la respuesta traiga identificador de sede). |

Usar el checklist del manual: `docs/MANUAL_ADMIN_CAMPAÑAS_PADCOINS.md` (sección 8).

---

## 5. Qué NO hay que reauditar

- Backend de campañas (ya pasó tests y está en producción).
- Frontend Admin de campañas (ya publicado).
- Endpoint jugador de campaña activa (ya publicado).
- Integración jugador en sede / reserva / pago exitoso (ya publicada).
- Manual operativo (ya creado y publicado).
- Regla de producto: **PadCoins no tienen valor económico para el jugador** — no volver a discutir ni mostrar equivalencias monetarias.

---

## 6. Pendientes futuros

| Área | Notas |
|------|--------|
| **App nativa** | Mostrar campañas activas en la app móvil (fuera del alcance web actual). |
| **Métricas de campaña** | Ampliar reportes en Admin si el negocio lo pide. |
| **Documentación legal** | Condiciones y responsabilidad de sede para campañas (texto legal/comercial). |
| **Comunicación interna** | Mensaje corto al equipo cuando se haga la primera prueba real exitosa. |

---

## 7. Regla de trabajo (para quien continúe)

- **SQL:** Si hace falta migración o script, entregar el SQL completo en un **cuadro copiable** (no fragmentos sueltos).
- **Git:** Commit y push preferentemente desde **Cursor**, con mensaje claro y solo archivos del alcance.
- **Runs:** Se puede autorizar **ejecutar comandos agrupados** sin pedir permiso por cada Run.
- **Render / despliegue:** No insistir con Render salvo que haya un **error** concreto de despliegue.
- **Archivos excluidos:** No incluir nunca `i18n-revision-2026-05-20.xlsx` en commits.
- **PWA:** Tras `npm run build`, revertir `public/sw.js` y `src/pwaBuildId.js` si el build los modifica (salvo que el cambio sea intencional).

---

## Mensaje simple para el equipo

> El bloque **Campañas automáticas PadCoins** está implementado en backend, admin y jugador web. Falta la **prueba operativa real** con Gustavo y Juampi usando el manual operativo. No hace falta reauditar código ya publicado; el foco es validar en cancha y ajustar mensajes o procesos si algo no se entiende en la práctica.

---

*Última actualización del bloque: documentación de continuidad tras publicación del manual operativo (`940132a`).*
