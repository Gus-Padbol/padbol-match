# PadCoins — campañas activas en frontend jugador (web)

Estado: **bloqueado por endpoint backend**. El frontend admin ya consume `/api/admin/padcoins/campaigns`; no hay ruta jugador equivalente.

## Endpoint jugador: no existe

Revisado en `padbol-backend` (commit `feat(padcoins): add automatic campaigns per sede`):

| Existe | Ruta | Uso |
|--------|------|-----|
| Sí | `GET /api/padcoins/mi-saldo` | Saldo jugador |
| Sí | `GET /api/padcoins/historial` | Movimientos jugador |
| Sí | `GET /api/padcoins/mis-canjes` | Canjes jugador |
| **No** | Campañas activas por sede | — |
| Sí (admin) | `GET /api/admin/padcoins/campaigns` | Solo Super Admin / Admin Club |

La resolución de campaña (`resolveActiveCampaignForReserva`) corre **solo en backend al acreditar** tras pago; no se expone al cliente.

## Endpoint recomendado (backend)

```
GET /api/padcoins/sedes/:sedeId/active-campaign
```

**Auth:** opcional (público para preview en sede; con token para validar elegibilidad por jugador/cupos).

**Respuesta 200 (hay campaña):**

```json
{
  "ok": true,
  "has_active_campaign": true,
  "campaign": {
    "id": "uuid",
    "sede_id": 12,
    "name": "Semana triple",
    "campaign_type": "multiplier",
    "message_title": "Triplica PadCoins esta semana",
    "message_body": "Reserva en esta sede y suma PadCoins extra por tiempo limitado.",
    "multiplier": 3,
    "loyalty_percentage_override": null,
    "fixed_padcoins": null,
    "benefit_id": null,
    "benefit_name": null,
    "start_at": "2026-07-01T00:00:00Z",
    "end_at": "2026-07-07T23:59:59Z",
    "display_label": "Triplica PadCoins",
    "display_short_label": "Triplica PadCoins",
    "eligible_for_player": true
  }
}
```

**Respuesta 200 (sin campaña):**

```json
{
  "ok": true,
  "has_active_campaign": false,
  "campaign": null
}
```

**Reglas backend sugeridas:**

- Reutilizar `resolveActiveCampaignForReserva` + `isCampaignEligibleForContext` cuando hay `userId`.
- Exponer solo campos de mensaje (`message_title`, `message_body`) y metadatos para etiquetas; **no** `estimated_cost_reference` ni equivalencias monetarias.
- `display_label` / `display_short_label` opcionales (backend puede precomputar según `campaign_type`).

## Pantallas a integrar (fase 2 — tras endpoint)

| Pantalla | Archivo | Ubicación UI |
|----------|---------|--------------|
| Perfil de sede | `src/pages/SedePublica.jsx` | Banner sobre CTA “Reservar cancha” (~columna sticky reservar) |
| Listado sedes | `src/pages/SedesPublicas.jsx` | Badge opcional en card si hay campaña (requiere batch o N+1; evaluar `GET ?sede_ids=`) |
| Reserva — sede | `src/pages/ReservaForm.jsx` pantalla 1 | Banner al seleccionar sede con campaña |
| Reserva — horarios | `ReservaForm.jsx` pantalla 2 | Etiqueta en chips de horario / cancha: `getPlayerCampaignSlotLabel()` |
| Reserva — confirmación | `ReservaForm.jsx` pantalla 4 | Aviso antes del botón de pago: `getPlayerCampaignConfirmMessage()` |
| Éxito MP | `src/pages/PagoExitoso.jsx` | Línea bajo “reserva confirmada” |
| Éxito Stripe | `ReservaForm.jsx` modal `reservaStripeExitoOpen` | Mismo mensaje de éxito |
| Home jugador | `src/pages/UserHome.jsx` | Opcional: card informativa si sede favorita tiene campaña |

## Helper frontend preparado

`src/utils/padcoinsCampaignsPlayer.js`

- `fetchActivePadcoinsCampaignForSede(sedeId, { apiBaseUrl, accessToken })` — retorna `null` si 404/501
- `parsePlayerActiveCampaign(data)`
- `getPlayerCampaignBannerTitle/Body`, `getPlayerCampaignSlotLabel`
- `getPlayerCampaignConfirmMessage`, `getPlayerCampaignSuccessMessage`

## Textos UI (español neutro, sin voseo)

| Contexto | Texto |
|----------|-------|
| Banner título default | Campaña PadCoins activa |
| Banner cuerpo default | Esta sede tiene una campaña especial por tiempo limitado. |
| CTA banner | Reservar ahora |
| Etiquetas slot | + PadCoins extra / Triplica PadCoins / Campaña activa |
| Confirmación | Al confirmar esta reserva puedes sumar PadCoins extra por la campaña activa de esta sede. |
| Éxito | Reserva confirmada. Si cumple las condiciones de la campaña, los PadCoins extra se acreditarán automáticamente. |

## Próximo paso

1. Backend: implementar `GET /api/padcoins/sedes/:sedeId/active-campaign`
2. Frontend: consumir helper en `SedePublica`, `ReservaForm` (pantallas 2 y 4), `PagoExitoso` y modal Stripe
3. Tests: unitarios en `padcoinsCampaignsPlayer.js` para labels por tipo
