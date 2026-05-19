#!/usr/bin/env python3
"""Sexta pasada: últimos strings UI en AdminDashboard."""
from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("pass4", ROOT / "scripts" / "migrate-admin-pass4.py")
_pass4 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_pass4)

PASS6: list[tuple[str, str, str, str]] = [
    ("Ya tienes 4 fotos en el carrusel. Quita una para agregar otra", "sedes", "carouselMaxFour", "You already have 4 photos in the carousel. Remove one to add another."),
    ("El nombre es obligatorio.", "formularios", "nameRequired", "Name is required."),
    ("Error al crear", "alerts", "createError", "Error creating"),
    ("No se pudo cambiar el estado", "alerts", "statusChangeFailed", "Could not change status"),
    ("Sorteo manual de grupos", "torneosSection", "manualGroupDrawTitle", "Manual group draw"),
    ("Editar torneo", "torneosSection", "editTournament", "Edit tournament"),
    ("Eliminar torneo", "torneosSection", "deleteTournament", "Delete tournament"),
    ("No hay sedes que coincidan con tu alcance nacional.", "sedes", "noVenuesNationalScope", "No venues match your national scope."),
    ("Estado de la reserva", "reservas", "bookingStatusLabel", "Booking status"),
    ("Selecciona sede", "reservas", "selectVenue", "Select venue"),
    ("Sin canchas activas", "reservas", "noActiveCourts", "No active courts"),
    ("Selecciona cancha", "reservas", "selectCourt", "Select court"),
    ("Elige cancha y fecha", "reservas", "chooseCourtAndDate", "Choose court and date"),
    ("Sin horarios disponibles", "reservas", "noSlotsAvailable", "No time slots available"),
    ("Selecciona horario", "reservas", "selectTimeSlot", "Select time slot"),
    ("Crear reserva", "reservas", "createBookingBtn", "Create booking"),
    ("Sin sede", "reservas", "noVenue", "No venue"),
    ("Invitado - pendiente de alta", "roles", "invitePendingSignup", "Invited — pending signup"),
    ("Hub del jugador (cards)", "roles", "editorScopeLabel", "Player hub (cards)"),
    ("Nombre del club", "sedes", "clubNameLabel", "Club name"),
    ("WhatsApp del club", "sedes", "clubWhatsappLabel", "Club WhatsApp"),
    ("Email de contacto", "sedes", "contactEmailLabel", "Contact email"),
    ("Agregar cancha", "sedes", "addCourt", "Add court"),
    ("Editar cancha", "sedes", "editCourt", "Edit court"),
    ("Color del borde / filete", "sedes", "heroBorderColorLabel", "Border / trim color"),
    ("Tu club", "sedes", "yourClub", "Your club"),
    ("Ej: 2213032019", "sedes", "phoneExamplePh", "E.g. 2213032019"),
    ("Sin 0 adelante, sin 15", "sedes", "phoneNoLeadingZero", "No leading 0 or 15"),
    ("Eliminar franja", "franjas", "deleteSlot", "Delete slot"),
    ("Sin configurar ⚠️", "sedes", "notConfiguredWarn", "Not configured ⚠️"),
    ("Logo del club", "sedes", "clubLogoLabel", "Club logo"),
    ("Color de fondo del logo", "sedes", "logoBackgroundColor", "Logo background color"),
    ("Recomendado en Safari iPhone: una foto por vez", "sedes", "safariOnePhotoHint", "Recommended on iPhone Safari: one photo at a time"),
    ("Quitar del carrusel", "sedes", "removeFromCarousel", "Remove from carousel"),
    ("Destacar en carrusel", "sedes", "featureInCarousel", "Feature in carousel"),
    ("Eliminar foto", "sedes", "deletePhoto", "Delete photo"),
    ("Solo se asigna el rol con alcance provincia o ciudad (no crea sede).", "sedes", "inviteRegionRoleHint", "Only assigns role with province or city scope (does not create a venue)."),
    ("Recortar logo del club", "sedes", "cropClubLogo", "Crop club logo"),
    ("Subiendo…", "metricas", "uploadingEllipsis", "Uploading…"),
    ("Confirmar recorte", "sedes", "confirmCrop", "Confirm crop"),
    ("Magic link de acceso", "formularios", "magicLinkAccess", "Access magic link"),
    ("🟡 Pago manual pendiente", "reservas", "badgeManualPaymentPending", "🟡 Manual payment pending"),
    ("💵 Cobro en sede pendiente", "reservas", "badgeVenuePaymentPending", "💵 Venue payment pending"),
    ("✅ Completada", "reservas", "badgeCompleted", "✅ Completed"),
    ("🟢 Confirmada", "reservas", "badgeConfirmed", "🟢 Confirmed"),
    ("💰 Financiero", "metricas", "financialTitle", "💰 Financial"),
    ("📝 Solicitudes", "sedes", "requestsTitle", "📝 Requests"),
    ("Historia / Sobre el club", "sedes", "clubStoryLabel", "Story / About the club"),
    ("Mercado Pago", "sedes", "paymentMercadoPago", "Mercado Pago"),
    ("Efectivo en sede", "sedes", "paymentCashVenue", "Cash at venue"),
    ("Instrucciones de pago manual", "sedes", "manualPaymentInstructions", "Manual payment instructions"),
    ("🔐 Licencia PADBOL", "sedes", "padbolLicenseTitle", "🔐 PADBOL license"),
    ("Fecha de otorgamiento", "sedes", "licenseGrantDate", "Grant date"),
    ("❌ Suspendida", "sedes", "licenseSuspended", "❌ Suspended"),
    ("Colores del hero", "sedes", "heroColorsTitle", "Hero colors"),
    ("ARS — Peso argentino", "sedes", "currencyArs", "ARS — Argentine peso"),
    ("CLP — Peso chileno", "sedes", "currencyClp", "CLP — Chilean peso"),
    ("UYU — Peso uruguayo", "sedes", "currencyUyu", "UYU — Uruguayan peso"),
    ("Franjas horarias y precios", "franjas", "slotsAndPricesTitle", "Time slots and prices"),
    ("📱 Redes Sociales", "sedes", "socialNetworksTitle", "📱 Social networks"),
    ("⚽ Mis Canchas", "sedes", "myCourtsTitle", "⚽ My courts"),
    ("✉️ Invitar nuevo admin", "formularios", "inviteNewAdminTitle", "✉️ Invite new admin"),
    ("🌍 Admin Nacional", "formularios", "nationalAdminRole", "🌍 National admin"),
    ("Recortar logo", "sedes", "cropLogoShort", "Crop logo"),
    ("Distribución de puntos por posición", "metricas", "pointsDistributionByPosition", "Points distribution by position"),
    ("Guardando...", "metricas", "savingDots", "Saving..."),
    ("✅ Guardar", "formularios", "saveOk", "✅ Save"),
    ("💾 Guardar", "formularios", "saveDisk", "💾 Save"),
    ("Motivo del rechazo (obligatorio):", "confirmaciones", "rejectReasonPrompt", "Rejection reason (required):"),
    ("1 sede", "metricas", "oneVenue", "1 venue"),
    ("sedes", "metricas", "venuesCount", "venues"),
    ("Cancha ", "reservas", "courtNumberPrefix", "Court "),
    ("Subiendo 1 de 1...", "sedes", "uploadingOneOfOne", "Uploading 1 of 1..."),
    ("País:", "common", "countryColon", "Country:"),
    ("Dirección:", "common", "addressColon", "Address:"),
    ("Ciudad:", "common", "cityColon", "City:"),
    ("Responsable:", "common", "responsibleColon", "Responsible:"),
    ("Email:", "common", "emailColon", "Email:"),
    ("Tipo interés:", "common", "interestTypeColon", "Interest type:"),
    ("Licenciatario país:", "common", "licenseeCountryColon", "Licensee country:"),
    ("Pendiente pago manual", "reservas", "optionManualPaymentPending", "Manual payment pending"),
    ("Pendiente pago manual", "reservas", "optionManualPaymentPendingEmoji", "🟡 Manual payment pending"),
    ("No hay planes. Ejecuta el SQL", "metricas", "noPlansSqlPrefix", "No plans. Run the SQL"),
    (" en Supabase.", "metricas", "noPlansSqlSuffix", " in Supabase."),
    ("Secciones Mi Sede", "sedes", "myVenueSectionsAria", "My Venue sections"),
    ("Subiendo ${files.length} fotos...", "sedes", "uploadingNPhotos", "Uploading {{count}} photos..."),
]

FILES = [ROOT / "src/pages/AdminDashboard.jsx"]


def main():
    _pass4.merge_locales(PASS6)
    repl = _pass4.build_replacements(PASS6)
    n = 0
    for fp in FILES:
        if not fp.exists():
            continue
        text = fp.read_text(encoding="utf-8")
        orig = text
        for old, new in repl:
            if old in text and "t('" not in old:
                text = text.replace(old, new)
                n += 1
        if text != orig:
            fp.write_text(text, encoding="utf-8")
            print("updated", fp.name)
    print(f"pass6: {len(PASS6)} keys, ~{n} replacements")


if __name__ == "__main__":
    main()
