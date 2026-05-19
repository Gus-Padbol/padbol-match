#!/usr/bin/env python3
"""Quinta pasada: placeholders, sede, reservas manuales y labels en AdminDashboard + Admin*."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "src" / "i18n" / "locales"
FILES = [
    ROOT / "src/pages/AdminDashboard.jsx",
    ROOT / "src/components/AdminSponsorsSection.jsx",
    ROOT / "src/components/AdminHubPromoSedeSection.jsx",
    ROOT / "src/components/AdminHubPersonalizarSection.jsx",
    ROOT / "src/components/AdminSedeExtrasSection.jsx",
    ROOT / "src/components/AdminClubOnboardingTour.jsx",
    ROOT / "src/components/AdminClasesClubSection.jsx",
    ROOT / "src/components/AdminProfesoresClubSection.jsx",
    ROOT / "src/components/AdminSedeExtrasPendientesSuper.jsx",
    ROOT / "src/components/AdminModuloClasesSection.jsx",
    ROOT / "src/components/AdminProfesoresPendientesSuper.jsx",
]

PASS5: list[tuple[str, str, str, str]] = [
    # placeholders
    ("Minutos", "formularios", "minutesPh", "Minutes"),
    ("Ej: Intermedio", "formularios", "levelExamplePh", "E.g. Intermediate"),
    ("Vacío = gratis", "formularios", "emptyFreePh", "Empty = free"),
    ("Ej: 1er lugar $50.000, 2do lugar $20.000", "formularios", "prizesExamplePh", "E.g. 1st place $500, 2nd place $200"),
    ("Nombre o nº de licencia", "sedes", "searchLicensePh", "Name or license number"),
    ("Filtrar por ciudad", "sedes", "filterByCityPh", "Filter by city"),
    ("Buscar sede", "sedes", "searchVenuePh", "Search venue"),
    ("min", "formularios", "minAbbrPh", "min"),
    ("Ej: FIPA Qualifier", "formularios", "tournamentTypeExamplePh", "E.g. FIPA Qualifier"),
    ("Pts", "formularios", "pointsAbbrPh", "Pts"),
    ("Nombre o email", "formularios", "nameOrEmailPh", "Name or email"),
    ("correo@ejemplo.com", "formularios", "emailExamplePh", "email@example.com"),
    ("Nombre visible", "formularios", "displayNamePh", "Display name"),
    ("acct_…", "sedes", "stripeAccountEllipsisPh", "acct_…"),
    ("acct_...", "sedes", "stripeAccountPh", "acct_..."),
    ("Notas internas o para el equipo…", "reservas", "internalNotesPh", "Internal notes for the team…"),
    ("Ej: FIPA-ARG-001", "sedes", "fipaLicensePh", "E.g. FIPA-ARG-001"),
    ("Ej: 2015", "sedes", "yearFoundedPh", "E.g. 2015"),
    ("Vacío = no ofrecer", "sedes", "emptyNotOfferedPh", "Empty = not offered"),
    ("Ej: 8000", "formularios", "priceExamplePh", "E.g. 8000"),
    ("Ej: Cancha 1", "sedes", "courtNameExamplePh", "E.g. Court 1"),
    ("admin@ejemplo.com", "formularios", "adminEmailPh", "admin@example.com"),
    ("Ej: Club Padbol Norte", "sedes", "clubNameExamplePh", "E.g. Padbol North Club"),
    ("Token actual guardado — ingresa uno nuevo para reemplazar", "sedes", "mpTokenReplacePh", "Current token saved — enter a new one to replace"),
    ("APP_USR-...", "sedes", "mpTokenPh", "APP_USR-..."),
    ("Precio (", "formularios", "priceWithCurrencyPh", "Price ("),
    # torneo / reservas / sede labels
    ("Categoría de edad", "formularios", "ageCategoryLabel", "Age category"),
    ("Categoría *", "formularios", "categoryRequiredLabel", "Category *"),
    ("Cupos máx. equipos", "formularios", "maxTeamsSlotsLabel", "Max team slots"),
    ("Año", "formularios", "yearLabel", "Year"),
    ("Próxima reserva:", "reservas", "nextBookingLabel", "Next booking:"),
    ("Jugadores federados en tu país", "formularios", "federatedPlayersTitle", "Federated players in your country"),
    ("No hay jugadores marcados como federados en tu país.", "formularios", "noFederatedPlayers", "No players marked as federated in your country."),
    ("Categoría", "formularios", "categoryCol", "Category"),
    ("País (ficha)", "formularios", "countryProfileCol", "Country (profile)"),
    ("⏳ Jugadores Pendientes de Validación", "formularios", "pendingValidationTitle", "⏳ Players pending validation"),
    ("No hay jugadores pendientes de validación.", "formularios", "noPendingValidation", "No players pending validation."),
    ("Ningún jugador coincide con la búsqueda.", "formularios", "noPlayerSearchMatch", "No players match the search."),
    ("Todos los países", "sedes", "allCountries", "All countries"),
    ("Sin reservas en este período", "reservas", "noBookingsInPeriod", "No bookings in this period"),
    ("⚙️ Configuración de Puntos", "metricas", "pointsConfigTitle", "⚙️ Points settings"),
    ("Posición", "formularios", "positionCol", "Position"),
    ("Puntos base por nivel de torneo", "metricas", "basePointsByLevel", "Base points by tournament level"),
    ("Nivel", "formularios", "levelCol", "Level"),
    ("Pts totales torneo", "formularios", "totalTournamentPtsCol", "Total tournament pts"),
    ("✓ Distribución completa", "metricas", "distributionComplete", "✓ Distribution complete"),
    ("⏳ Guardando...", "metricas", "savingEllipsis", "⏳ Saving..."),
    ("💾 Guardar configuración", "metricas", "saveConfigBtn", "💾 Save settings"),
    ("💳 Planes y Precios", "metricas", "plansPricingTitle", "💳 Plans and pricing"),
    ("Precio mensual en USD según la cantidad de canchas del club. Solo super admin puede editar.", "metricas", "plansPricingHint", "Monthly USD price by number of courts. Super admin only."),
    ("Canchas", "formularios", "courtsCol", "Courts"),
    ("Precio USD/mes", "metricas", "priceUsdMonthCol", "USD/month price"),
    ("País", "formularios", "countryLabel", "Country"),
    ("Ciudad", "formularios", "cityLabel", "City"),
    ("Acción", "formularios", "actionCol", "Action"),
    ("Asignación", "formularios", "assignmentCol", "Assignment"),
    ("Ocultar detalle", "sedes", "hideDetail", "Hide detail"),
    ("Más datos (alta nacional)", "sedes", "moreNationalSignup", "More data (national signup)"),
    ("Precios por duración", "sedes", "pricesByDuration", "Prices by duration"),
    ("Descripción del club", "sedes", "clubDescriptionLabel", "Club description"),
    ("Método de pago", "sedes", "paymentMethodLabel", "Payment method"),
    ("Número de licencia", "sedes", "licenseNumberLabel", "License number"),
    ("Información General", "sedes", "generalInfoTitle", "General information"),
    ("90 min (turno estándar)", "sedes", "price90minLabel", "90 min (standard slot)"),
    ("USD — Dólar estadounidense", "sedes", "currencyUsd", "USD — US Dollar"),
    ("BRL — Real brasileño", "sedes", "currencyBrl", "BRL — Brazilian real"),
    ("Aplicación", "franjas", "applicationLabel", "Application"),
    ("💳 Configuración de pagos", "sedes", "paymentConfigTitle", "💳 Payment settings"),
    ("💾 Guardar método e instrucciones", "sedes", "savePaymentMethodBtn", "💾 Save method and instructions"),
    ("JPG, PNG o WEBP · máx. 2MB", "sedes", "photoFormatHint", "JPG, PNG or WEBP · max. 2MB"),
    ("No hay fotos cargadas aún.", "sedes", "noPhotosYet", "No photos uploaded yet."),
    ("Tipo de interés", "sedes", "interestTypeTitle", "Interest type"),
    ("Gestiona una sede específica", "sedes", "manageOneVenue", "Manages a specific venue"),
    ("Gestiona un país completo", "sedes", "manageFullCountry", "Manages an entire country"),
    ("Gestiona una zona específica", "sedes", "manageRegion", "Manages a specific region"),
    ("Seleccionar país", "sedes", "selectCountry", "Select country"),
    ("Invitación sede (48 h):", "sedes", "venueInvite48h", "Venue invite (48 h):"),
    ("Mis sponsors disponibles", "sponsors", "mySponsorsAvailable", "My available sponsors"),
    ("Cargando cupos de sponsors…", "sponsors", "loadingSponsorQuotas", "Loading sponsor quotas…"),
    ("Editor de contenido", "formularios", "contentEditorTitle", "Content editor"),
    ("Asignar editor", "formularios", "assignEditor", "Assign editor"),
    ("Cargando...", "metricas", "loading", "Loading..."),
    ("Sin número para WhatsApp", "reservas", "noWhatsappNumber", "No WhatsApp number"),
    ("No se encontró información de la sede.", "sedes", "venueInfoNotFound", "Venue information not found."),
    ("Puedes obtener las coordenadas desde Google Maps (clic derecho → \"¿Qué hay aquí?\")", "sedes", "coordsGoogleMapsHint", "You can get coordinates from Google Maps (right-click → \"What's here?\")"),
    # reservas / mensajes
    ("✅ Cobro presencial / pago confirmado", "reservas", "inPersonPaymentConfirmed", "✅ In-person payment confirmed"),
    ("✅ Pagos actualizados", "sedes", "paymentsUpdated", "✅ Payments updated"),
    ("⚠️ Elige una imagen", "formularios", "chooseImageWarnShort", "⚠️ Choose an image"),
    ("✅ Logo actualizado", "sedes", "logoUpdated", "✅ Logo updated"),
    ("Error al recortar", "sedes", "cropError", "Crop error"),
    ("✅ Guardado", "metricas", "savedOk", "✅ Saved"),
    ("⚠️ Completa horarios y al menos un día o fecha por franja", "franjas", "completeSlotFields", "⚠️ Complete times and at least one day or date per slot"),
    ("✅ Franjas guardadas", "franjas", "slotsSaved", "✅ Time slots saved"),
    ("Magic link copiado", "formularios", "magicLinkCopied", "Magic link copied"),
    ("nueva sede", "sedes", "newVenueFallback", "new venue"),
    ("Email", "formularios", "emailLabel", "Email"),
    ("Aprobado", "sponsors", "approvedStatus", "Approved"),
    ("Pendiente", "sponsors", "pendingStatus", "Pending"),
    ("Sí", "formularios", "yes", "Yes"),
    ("No", "formularios", "no", "No"),
    ("Aprobar", "sponsors", "approveBtn", "Approve"),
    ("Editar", "formularios", "editBtn", "Edit"),
    ("Eliminar", "formularios", "deleteBtn", "Delete"),
    ("Desactivar", "sponsors", "deactivateBtn", "Deactivate"),
    ("Editar sponsor", "sponsors", "editSponsorTitle", "Edit sponsor"),
    ("Nuevo sponsor", "sponsors", "newSponsorTitle", "New sponsor"),
    ("Nombre de la marca *", "sponsors", "brandNameLabel", "Brand name *"),
    ("Ej: Marca deportiva", "sponsors", "brandNamePh", "E.g. Sports brand"),
    ("Patrocinios por alcance: torneo tiene prioridad sobre sede, país y global.", "sponsors", "scopePriorityHint", "Sponsorship by scope: tournament overrides venue, country and global."),
    ("🤝 Sponsors", "sponsors", "sectionTitle", "🤝 Sponsors"),
    # hub personalizar
    ("Vista previa", "hub", "previewLabel", "Preview"),
    ("No hay cards globales configuradas.", "hub", "noGlobalCards", "No global cards configured."),
]

PASS5_BATCH2: list[tuple[str, str, str, str]] = [
    ("Sin licencia", "sedes", "noLicense", "No license"),
    ("Duraciones y precios (tabla)", "sedes", "durationsPricesTable", "Durations and prices (table)"),
    ("Cambiar estado (super admin)", "sedes", "changeSubscriptionStatus", "Change status (super admin)"),
    ("Cargando…", "common", "loadingEllipsis", "Loading…"),
    ("Cargando...", "metricas", "loading", "Loading..."),
    ("Deporte", "metricas", "sportLabel", "Sport"),
    ("Formato", "metricas", "formatLabel", "Format"),
    ("Fecha inicio", "metricas", "startDateLabel", "Start date"),
    ("Fecha fin", "metricas", "endDateLabel", "End date"),
    ("Buscar", "metricas", "searchLabel", "Search"),
    ("Contacto", "metricas", "contactCol", "Contact"),
    ("Licencia", "metricas", "licenseCol", "License"),
    ("Perfil", "metricas", "profileCol", "Profile"),
    ("Fecha", "metricas", "dateCol", "Date"),
    ("Horario", "metricas", "timeCol", "Time"),
    ("Cancha", "metricas", "courtCol", "Court"),
    ("Estado", "metricas", "statusCol", "Status"),
    ("Monto", "metricas", "amountCol", "Amount"),
    ("Acciones", "metricas", "actionsCol", "Actions"),
    ("Alcance", "metricas", "scopeCol", "Scope"),
    ("Puntos", "metricas", "pointsCol", "Points"),
    ("pts totales", "metricas", "totalPtsShort", "total pts"),
    ("Sin datos para estos filtros.", "metricas", "noDataFilters", "No data for these filters."),
    ("Sin cambios de estado registrados.", "metricas", "noStateChanges", "No status changes recorded."),
    ("No hay solicitudes con este filtro.", "metricas", "noRequestsFilter", "No requests with this filter."),
    ("No hay planes. Ejecuta el SQL", "metricas", "noPlansSqlHint", "No plans. Run plan_pricing.sql in Supabase."),
    ("Equipos de 5", "metricas", "teamFormat5", "Teams of 5"),
    ("Equipos de 7", "metricas", "teamFormat7", "Teams of 7"),
    ("Dobles (2v2)", "metricas", "doublesFormat", "Doubles (2v2)"),
    ("Round Robin", "metricas", "formatRoundRobin", "Round Robin"),
    ("Knockout", "metricas", "formatKnockout", "Knockout"),
    ("Grupos + Knockout", "metricas", "formatGroupsKnockout", "Groups + Knockout"),
    ("Confirmada", "metricas", "statusConfirmed", "Confirmed"),
    ("Reservada", "metricas", "statusReserved", "Reserved"),
    ("Club (sugerido)", "metricas", "suggestedClubCol", "Club (suggested)"),
    ("Vence", "metricas", "expiresCol", "Expires"),
    ("Tipo de torneo (M / F / Mixto)", "metricas", "tournamentTypeLabel", "Tournament type (M / F / Mixed)"),
    ("Categoría de edad", "formularios", "ageCategoryLabel", "Age category"),
    ("Cupos máx. equipos", "formularios", "maxTeamsSlotsLabel", "Max team slots"),
    ("Responsable:", "common", "responsible", "Responsible"),
    ("Tipo interés:", "common", "interestType", "Interest type"),
    ("Licenciatario país:", "common", "licenseeCountry", "Licensee country"),
    ("💡 Recomendado: PNG transparente, mín. 300×300 px", "common", "recommendedPhotoHint", "💡 Recommended: transparent PNG, min. 300×300 px"),
    ("Total:", "metricas", "totalLabel", "Total:"),
    ("Desactivado", "sponsors", "deactivated", "Deactivated"),
    ("Sponsor actualizado", "sponsors", "sponsorUpdated", "Sponsor updated"),
    ("Sponsor creado", "sponsors", "sponsorCreated", "Sponsor created"),
    ("Sponsor eliminado", "sponsors", "sponsorDeleted", "Sponsor deleted"),
    ("Sponsor aprobado", "sponsors", "sponsorApproved", "Sponsor approved"),
]

PASS5.extend(PASS5_BATCH2)

# Import helpers from pass4
import importlib.util

_spec = importlib.util.spec_from_file_location("pass4", ROOT / "scripts" / "migrate-admin-pass4.py")
_pass4 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pass4)

is_migratable = _pass4.is_migratable
set_nested = _pass4.set_nested
slugify = _pass4.slugify
build_replacements = _pass4.build_replacements


def merge_locales(catalog: list[tuple[str, str, str, str]]) -> None:
    es = json.loads((LOCALES / "es.json").read_text(encoding="utf-8"))
    en = json.loads((LOCALES / "en.json").read_text(encoding="utf-8"))
    used_keys: set[str] = set()
    for es_text, section, suffix, en_text in catalog:
        if not is_migratable(es_text):
            continue
        full = f"admin.{section}.{suffix}"
        if full in used_keys:
            base = slugify(es_text)
            full = f"admin.{section}.{base}"
            n = 2
            while full in used_keys:
                full = f"admin.{section}.{base}{n}"
                n += 1
        used_keys.add(full)
        set_nested(es, full, es_text)
        set_nested(en, full, en_text)
    (LOCALES / "es.json").write_text(json.dumps(es, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (LOCALES / "en.json").write_text(json.dumps(en, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def apply_placeholder_attr(text: str, catalog: list[tuple[str, str, str, str]]) -> str:
    """placeholder="literal" -> placeholder={t('admin...')}"""
    key_by_es: dict[str, str] = {}
    for es_text, section, suffix, _ in catalog:
        if not is_migratable(es_text):
            continue
        key_by_es[es_text] = f"admin.{section}.{suffix}"
    for es_text, key in sorted(key_by_es.items(), key=lambda x: -len(x[0])):
        old = f'placeholder="{es_text}"'
        new = f"placeholder={{t('{key}')}}"
        if old in text:
            text = text.replace(old, new)
        old2 = f"placeholder='{es_text}'"
        new2 = f"placeholder={{t('{key}')}}"
        if old2 in text:
            text = text.replace(old2, new2)
    return text


def apply_files(repl: list[tuple[str, str]], catalog: list[tuple[str, str, str, str]]) -> int:
    n = 0
    for fp in FILES:
        if not fp.exists():
            continue
        text = fp.read_text(encoding="utf-8")
        orig = text
        text = apply_placeholder_attr(text, catalog)
        for old, new in repl:
            if old in text and "t('" not in old:
                text = text.replace(old, new)
                n += 1
        if text != orig:
            fp.write_text(text, encoding="utf-8")
            print("updated", fp.name)
    return n


def main():
    merge_locales(PASS5)
    repl = build_replacements(PASS5)
    n = apply_files(repl, PASS5)
    print(f"pass5 catalog: {len(PASS5)}, replacements: ~{n}")


if __name__ == "__main__":
    main()
