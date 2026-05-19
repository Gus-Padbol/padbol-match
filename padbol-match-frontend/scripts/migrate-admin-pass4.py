#!/usr/bin/env python3
"""Cuarta pasada: migra strings ES hardcodeados en Admin* a admin.{section}.*"""
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

# (es, section, key_suffix, en) — key = admin.{section}.{key_suffix}
CATALOG: list[tuple[str, str, str, str]] = [
    # confirmaciones
    ("¿Desactivar este sponsor? Dejará de mostrarse en la app.", "confirmaciones", "deactivateSponsor", "Deactivate this sponsor? It will stop showing in the app."),
    ("¿Eliminar el sponsor {{name}}? Esta acción no se puede deshacer.", "confirmaciones", "deleteSponsor", "Delete sponsor {{name}}? This cannot be undone."),
    ("¿Rechazar este extra? Quedará desactivado.", "confirmaciones", "rejectExtra", "Reject this extra? It will be deactivated."),
    ("¿Eliminar este producto?", "confirmaciones", "deleteProduct", "Delete this product?"),
    ("Esta acción no se puede deshacer.", "confirmaciones", "cannotUndo", "This action cannot be undone."),
    ("¿Eliminar la duración de {{minutes}} min de esta sede?", "confirmaciones", "deleteDuration", "Delete the {{minutes}} min duration for this venue?"),
    # formularios / validaciones
    ("Completá el nombre del extra.", "formularios", "completeExtraName", "Enter the extra name."),
    ("Completá el nombre.", "formularios", "completeName", "Enter the name."),
    ("Completá título, profesor y deporte.", "formularios", "completeClassFields", "Complete title, coach and sport."),
    ("Agregá al menos un horario.", "formularios", "addAtLeastOneSchedule", "Add at least one time slot."),
    ("Completá al menos título y URL de destino.", "formularios", "completePromoTitleUrl", "Complete at least title and destination URL."),
    ("Indicá el nombre de la marca.", "formularios", "brandNameRequired", "Enter the brand name."),
    ("Elegí una sede.", "formularios", "chooseVenue", "Choose a venue."),
    ("Elegí un torneo.", "formularios", "chooseTournament", "Choose a tournament."),
    ("Elegí un país.", "formularios", "chooseCountry", "Choose a country."),
    ("Elegí al menos un deporte.", "formularios", "chooseAtLeastOneSport", "Choose at least one sport."),
    ("Elegí un archivo de imagen.", "formularios", "chooseImageFile", "Choose an image file."),
    ("Elegí un deporte en el selector.", "formularios", "chooseSportInSelector", "Choose a sport in the selector."),
    ("Elegí un deporte.", "formularios", "chooseSport", "Choose a sport."),
    ("Elegí de nuevo «Cambiar foto».", "formularios", "chooseChangePhotoAgain", "Choose «Change photo» again."),
    ("Seleccioná una sede válida.", "formularios", "selectValidVenue", "Select a valid venue."),
    ("Indicá duración entre 15 y 480 minutos.", "formularios", "durationRange", "Enter duration between 15 and 480 minutes."),
    ("Indicá un precio válido.", "formularios", "validPriceRequired", "Enter a valid price."),
    ("El número de certificado FIPA es obligatorio si enseñás Padbol.", "formularios", "fipaRequiredPadbol", "FIPA certificate number is required if you teach Padbol."),
    ("Elige una imagen (JPEG, PNG, WebP o GIF).", "formularios", "chooseImageFormats", "Choose an image (JPEG, PNG, WebP or GIF)."),
    ("Máximo 4MB para el logo.", "formularios", "logoMax4mb", "Maximum 4MB for the logo."),
    ("Iniciá sesión como super admin para guardar.", "formularios", "loginSuperAdminSave", "Sign in as super admin to save."),
    ("Iniciá sesión de nuevo.", "formularios", "loginAgain", "Sign in again."),
    ("Iniciá sesión de nuevo para subir imágenes.", "formularios", "loginAgainUpload", "Sign in again to upload images."),
    ("Inicia sesión de nuevo.", "formularios", "loginAgainAlt", "Sign in again."),
    ("Inicia sesión nuevamente.", "formularios", "loginAgainAgain", "Sign in again."),
    ("Sin sesión", "formularios", "noSession", "No session"),
    ("Revisa los datos", "formularios", "checkData", "Check the data"),
    # sponsors
    ("Configuración de cupos", "sponsors", "quotaConfigTitle", "Quota settings"),
    ("✅ Configuración de cupos guardada", "sponsors", "quotaConfigSaved", "✅ Quota settings saved"),
    ("Guardar configuración de cupos", "sponsors", "saveQuotaConfig", "Save quota settings"),
    ("Sponsors globales máximo", "sponsors", "maxGlobal", "Max global sponsors"),
    ("Sponsors por nación máximo", "sponsors", "maxPerNation", "Max sponsors per nation"),
    ("Límite de sponsors alcanzado para este plan", "sponsors", "quotaLimitReached", "Sponsor limit reached for this plan"),
    ("No se pudo obtener la URL pública del logo. Revisá que el bucket sponsors sea público.", "sponsors", "logoPublicUrlFailed", "Could not get public logo URL. Check that the sponsors bucket is public."),
    ("Logo subido", "sponsors", "logoUploaded", "Logo uploaded"),
    ("URL pública del logo (o sube archivo arriba)", "sponsors", "logoUrlPlaceholder", "Public logo URL (or upload file above)"),
    ("Una o dos líneas sobre la marca u oferta", "sponsors", "brandDescPlaceholder", "One or two lines about the brand or offer"),
    ("Ver oferta", "sponsors", "seeOffer", "See offer"),
    ("Global", "sponsors", "scopeGlobal", "Global"),
    ("Por sede", "sponsors", "scopeVenue", "Per venue"),
    ("Por torneo", "sponsors", "scopeTournament", "Per tournament"),
    ("Por país", "sponsors", "scopeCountry", "Per country"),
    ("Todos", "sponsors", "allSports", "All"),
    # hub
    ("Ver más", "hub", "seeMore", "See more"),
    ("Título", "hub", "title", "Title"),
    ("Subtítulo", "hub", "subtitle", "Subtitle"),
    ("Texto del botón", "hub", "buttonText", "Button text"),
    ("Opcional", "hub", "optional", "Optional"),
    ("Ej: Pro shop del club", "hub", "titlePlaceholder", "E.g. Club pro shop"),
    ("URL al hacer clic", "hub", "clickUrl", "Click URL"),
    ("https://… o /ruta", "hub", "urlPlaceholder", "https://… or /path"),
    ("Guardar promo", "hub", "savePromo", "Save promo"),
    ("Subir imagen desde el dispositivo", "hub", "uploadFromDevice", "Upload image from device"),
    ("Vista previa de la imagen de la promo", "hub", "promoPreviewAria", "Promo image preview"),
    ("⚠️ Elegí un archivo de imagen", "hub", "chooseImageWarn", "⚠️ Choose an image file"),
    ("⚠️ La imagen supera los 2MB", "hub", "imageOver2mb", "⚠️ Image exceeds 2MB"),
    ("No se obtuvo URL pública", "hub", "noPublicUrl", "No public URL received"),
    ("No se pudo cargar el hub", "hub", "hubLoadFailed", "Could not load hub"),
    ("No se pudo cargar hub por deporte", "hub", "hubSportLoadFailed", "Could not load hub by sport"),
    ("Cargando configuración del hub…", "hub", "loadingHubConfig", "Loading hub configuration…"),
    ("Cargando configuración por deporte…", "hub", "loadingSportConfig", "Loading configuration by sport…"),
    ("Guardar deporte", "hub", "saveSport", "Save sport"),
    ("Guardar texto", "hub", "saveText", "Save text"),
    ("Título (opcional; si vacío, usa el texto por defecto del hub)", "hub", "titleOptionalHint", "Title (optional; if empty, uses default hub text)"),
    ("Recortar foto del hub", "hub", "cropHubPhoto", "Crop hub photo"),
    ("Confirmar y subir", "hub", "confirmAndUpload", "Confirm and upload"),
    ("Ajustá el encuadre en formato horizontal 16:9, ideal para las cards del hub. Mové la imagen y usá el zoom.", "hub", "cropHubHint", "Adjust framing in 16:9 horizontal format, ideal for hub cards. Move the image and use zoom."),
    ("Sesión requerida para subir archivos.", "hub", "sessionRequiredUpload", "Session required to upload files."),
    ("El servidor guardó la foto en otro deporte/card. Revisá la migración UNIQUE (deporte, card_key).", "hub", "wrongSportCardSaved", "Server saved photo to another sport/card. Check UNIQUE migration (deporte, card_key)."),
    # sedes / mi sede
    ("Extras pendientes de aprobación", "sedes", "extrasPendingApproval", "Extras pending approval"),
    ("Pendiente de aprobación", "sedes", "pendingApproval", "Pending approval"),
    ("Pendiente aprobación", "sedes", "pendingApprovalShort", "Pending approval"),
    ("Descripción (opcional)", "sedes", "descriptionOptional", "Description (optional)"),
    ("Stock disponible (opcional, vacío = ilimitado)", "sedes", "stockOptional", "Available stock (optional, empty = unlimited)"),
    ("Stock (vacío = ilimitado)", "sedes", "stockEmptyUnlimited", "Stock (empty = unlimited)"),
    ("Descripción", "sedes", "description", "Description"),
    ("Eliminar", "sedes", "delete", "Delete"),
    ("Guardar profesor", "sedes", "saveCoach", "Save coach"),
    ("Aprobar", "sedes", "approve", "Approve"),
    ("No se pudieron cargar canchas", "sedes", "courtsLoadFailed", "Could not load courts"),
    ("La imagen comprimida supera 5MB", "sedes", "compressedOver5mb", "Compressed image exceeds 5MB"),
    ("No se obtuvo URL", "sedes", "noUrl", "No URL received"),
    ("Contrato", "sedes", "contract", "Contract"),
    ("Inicio:", "sedes", "startLabel", "Start:"),
    ("Vencimiento:", "sedes", "expiryLabel", "Expiry:"),
    ("Referencia:", "sedes", "referenceLabel", "Reference:"),
    ("Descargar contrato", "sedes", "downloadContract", "Download contract"),
    ("Estado:", "sedes", "statusLabel", "Status:"),
    ("Próximo cobro:", "sedes", "nextChargeLabel", "Next charge:"),
    ("Info del club", "sedes", "clubInfo", "Club info"),
    ("Extras del tercer tiempo", "sedes", "halftimeExtras", "Halftime extras"),
    ("Configuración de pagos", "sedes", "paymentSettings", "Payment settings"),
    ("Imágenes", "sedes", "images", "Images"),
    ("✅ Color del logo guardado", "sedes", "logoColorSaved", "✅ Logo color saved"),
    ("✅ Sede actualizada", "sedes", "venueUpdated", "✅ Venue updated"),
    ("✅ Precios guardados", "sedes", "pricesSaved", "✅ Prices saved"),
    ("✅ Licencia actualizada", "sedes", "licenseUpdated", "✅ License updated"),
    ("dirección / ubicación", "sedes", "addressLocation", "address / location"),
    ("email de contacto / admin", "sedes", "contactEmail", "contact / admin email"),
    ("número de licencia", "sedes", "licenseNumber", "license number"),
    ("fecha de licencia", "sedes", "licenseDate", "license date"),
    ("estado de licencia", "sedes", "licenseStatus", "license status"),
    ("⚠️ El archivo supera los 2MB", "sedes", "fileOver2mb", "⚠️ File exceeds 2MB"),
    ("No se pudieron cargar las duraciones", "sedes", "durationsLoadFailed", "Could not load durations"),
    ("Activa", "sedes", "subscriptionActive", "Active"),
    ("Vencida", "sedes", "subscriptionExpired", "Expired"),
    ("Pendiente de pago", "sedes", "paymentPending", "Payment pending"),
    ("Cancelada", "sedes", "subscriptionCancelled", "Cancelled"),
    ("Aviso (mora)", "sedes", "noticeOverdue", "Notice (overdue)"),
    ("Segundo aviso", "sedes", "secondNotice", "Second notice"),
    ("Suspendida (mora)", "sedes", "suspendedOverdue", "Suspended (overdue)"),
    # reservas
    ("Jugador", "reservas", "player", "Player"),
    ("jugador:", "reservas", "playerLabel", "player:"),
    ("Todas", "reservas", "all", "All"),
    ("Sin reservas hoy", "reservas", "noBookingsToday", "No bookings today"),
    ("✅ Reserva actualizada", "reservas", "bookingUpdated", "✅ Booking updated"),
    ("✅ Reserva manual creada", "reservas", "manualBookingCreated", "✅ Manual booking created"),
    ("✅ Reserva cancelada", "reservas", "bookingCancelled", "✅ Booking cancelled"),
    ("No se pudo confirmar el pago", "reservas", "paymentConfirmFailed", "Could not confirm payment"),
    ("No se pudo crear la reserva manual", "reservas", "manualBookingFailed", "Could not create manual booking"),
    ("Completa sede, cancha, fecha, hora y nombre del jugador.", "reservas", "completeManualBookingFields", "Complete venue, court, date, time and player name."),
  # metricas / general admin
    ("Procesando…", "metricas", "processing", "Processing…"),
    ("Confirmar pago", "metricas", "confirmPayment", "Confirm payment"),
    ("✅ Configuración guardada", "metricas", "configSaved", "✅ Settings saved"),
    ("⚠️ Guardado local OK, error en servidor", "metricas", "localSaveServerError", "⚠️ Saved locally OK, server error"),
    ("⚠️ Sin conexión — guardado solo en local", "metricas", "offlineLocalOnly", "⚠️ Offline — saved locally only"),
    ("No se pudo guardar", "metricas", "saveFailed", "Could not save"),
    ("Error al guardar", "metricas", "saveError", "Error saving"),
    ("Guardando…", "metricas", "saving", "Saving…"),
    ("Guardar clase", "formularios", "saveClass", "Save class"),
    ("Cupo máximo", "formularios", "maxCapacity", "Max capacity"),
    ("Duración (min)", "formularios", "durationMin", "Duration (min)"),
    # onboarding
    ("Saltar tour", "formularios", "skipTour", "Skip tour"),
    ("Anterior", "formularios", "previous", "Previous"),
    ("Siguiente", "formularios", "next", "Next"),
    ("Finalizar", "formularios", "finish", "Finish"),
    ("Paso {{current}} de {{total}}", "formularios", "stepOf", "Step {{current}} of {{total}}"),
    # torneos / licencia types
    ("Club Afiliado", "sedes", "affiliateClub", "Affiliate club"),
    ("Padbol Point Franquicia", "sedes", "padbolPointFranchise", "Padbol Point franchise"),
    ("Master Nacional", "sedes", "masterNational", "Master national"),
    ("Club No Oficial", "sedes", "unofficialClub", "Unofficial club"),
    ("Club Oficial", "sedes", "officialClub", "Official club"),
    ("Nacional", "sedes", "national", "National"),
    ("Internacional", "sedes", "international", "International"),
    ("Mundial", "sedes", "world", "World"),
    ("🏙️ Admin Ciudad/Región", "sedes", "adminCityRegion", "🏙️ City/Region Admin"),
    ("🏆 Admin Club", "sedes", "adminClub", "🏆 Club Admin"),
    ("No se recibió magic link", "formularios", "noMagicLink", "No magic link received"),
    ("No se pudo iniciar la suscripción", "formularios", "subscriptionStartFailed", "Could not start subscription"),
    ("No se pudo iniciar el enlace de Stripe", "formularios", "stripeLinkFailed", "Could not start Stripe link"),
    ("Respuesta sin URL de onboarding", "formularios", "noOnboardingUrl", "Response without onboarding URL"),
    ("No se pudo actualizar el estado", "formularios", "statusUpdateFailed", "Could not update status"),
    ("Falta REACT_APP_STRIPE_PUBLISHABLE_KEY en el frontend.", "formularios", "stripeKeyMissing", "Missing REACT_APP_STRIPE_PUBLISHABLE_KEY in frontend."),
    ("Stripe no devolvió client_secret. Revisa el precio y la suscripción en el dashboard de Stripe.", "formularios", "noClientSecret", "Stripe did not return client_secret. Check price and subscription in Stripe dashboard."),
    ("Días de la semana", "franjas", "weekdays", "Days of the week"),
    ("Fecha especial", "franjas", "specialDate", "Special date"),
    ("Inicio", "franjas", "start", "Start"),
    ("Fin", "franjas", "end", "End"),
    ("Semana {{week}} · {{year}}", "franjas", "weekLabel", "Week {{week}} · {{year}}"),
]

# Extra Dashboard-only (sample of high-impact)
DASHBOARD_EXTRA = [
    ("Torneo", "formularios", "tournament", "Tournament"),
    ("+ Nuevo Torneo", "formularios", "newTournamentBtn", "+ New tournament"),
    ("No hay torneos creados aún", "formularios", "noTournamentsYet", "No tournaments created yet"),
    ("Marcar todas leídas", "metricas", "markAllRead", "Mark all as read"),
    ("Exportar Excel", "metricas", "exportExcel", "Export Excel"),
    ("Nueva sede", "sedes", "newVenue", "New venue"),
    ("Solicitudes pendientes", "sedes", "pendingRequests", "Pending requests"),
    ("Aprobar sede", "confirmaciones", "approveVenue", "Approve venue"),
    ("Rechazar", "confirmaciones", "reject", "Reject"),
    ("Motivo del rechazo", "formularios", "rejectReason", "Rejection reason"),
    ("Invitar admin", "formularios", "inviteAdmin", "Invite admin"),
    ("Reenviar invitación", "formularios", "resendInvite", "Resend invitation"),
    ("Revocar rol", "formularios", "revokeRole", "Revoke role"),
    ("Crear reserva manual", "reservas", "createManualBooking", "Create manual booking"),
    ("Confirmar pago manual", "reservas", "confirmManualPayment", "Confirm manual payment"),
    ("Cancelar reserva", "reservas", "cancelBooking", "Cancel booking"),
    ("Historial de cambios", "reservas", "changeHistory", "Change history"),
    ("Ingresos por moneda", "metricas", "revenueByCurrency", "Revenue by currency"),
    ("Reservas en período", "metricas", "bookingsInPeriod", "Bookings in period"),
    ("Comisión Padbol Match", "metricas", "pmCommission", "Padbol Match commission"),
    ("Franjas horarias", "franjas", "timeSlots", "Time slots"),
    ("Agregar franja", "franjas", "addSlot", "Add time slot"),
    ("Tipo", "franjas", "type", "Type"),
    ("Nombre", "formularios", "name", "Name"),
    ("Precio", "formularios", "price", "Price"),
    ("Semanal", "franjas", "weekly", "Weekly"),
    ("Especial", "franjas", "special", "Special"),
]

CATALOG.extend(DASHBOARD_EXTRA)

PASS2_DASHBOARD = [
    ("Inicia sesión de nuevo para conectar Stripe.", "formularios", "loginStripeConnect", "Sign in again to connect Stripe."),
    ("Estado sin edición manual.", "formularios", "statusReadOnly", "Status cannot be edited manually."),
    ("Vacío = sin tope en card pública", "formularios", "emptyNoCapHint", "Empty = no cap on public card"),
    ("Moneda inscripción torneo", "formularios", "tournamentCurrencyAria", "Tournament registration currency"),
    ("Sedes registradas", "sedes", "registeredVenues", "Registered venues"),
    ("Sedes en tu país", "sedes", "venuesInCountry", "Venues in your country"),
    ("No hay sedes creadas todavía.", "sedes", "noVenuesYet", "No venues created yet."),
    ("Filtrar sedes por país", "sedes", "filterVenuesByCountry", "Filter venues by country"),
    ("Buscar sede por nombre o número de licencia", "sedes", "searchVenueLicense", "Search venue by name or license number"),
    ("Ej. García o @gmail", "formularios", "searchPlayerPlaceholder", "E.g. Smith or @gmail"),
    ("Este año", "metricas", "thisYear", "This year"),
    ("Duración en minutos", "franjas", "durationMinutesTitle", "Duration in minutes"),
    ("Alta nacional", "sedes", "nationalSignup", "National signup"),
    ("Interés web", "sedes", "webInterest", "Web interest"),
    ("Dirección", "sedes", "address", "Address"),
    ("Longitud", "sedes", "longitude", "Longitude"),
    ("Latitud", "sedes", "latitude", "Latitude"),
    ("Sin 0 adelante, sin 15. Usá número internacional con código de país (549…).", "formularios", "phoneHint", "No leading 0 or 15. Use international format with country code (549…)."),
    ("Ej: -58.3816", "formularios", "coordPlaceholder", "E.g. -34.6037"),
    ("Ej: Primer club de PADBOL del mundo, donde todo comenzó...", "sedes", "taglinePlaceholder", "E.g. First PADBOL club in the world, where it all began..."),
    ("Cuenta la historia del club, servicios, valores… Se muestra en la sección «Sobre el club» del perfil público.", "sedes", "aboutPlaceholder", "Tell the club story, services, values… Shown in public profile «About the club»."),
    ("Ej: Feriado, Evento privado", "franjas", "specialDateNamePh", "E.g. Holiday, Private event"),
    ("Ej: Mañana, Tarde, Noche", "franjas", "slotNamePh", "E.g. Morning, Afternoon, Evening"),
    ("Asignar tipo de interés", "formularios", "assignInterestTypeAria", "Assign interest type"),
    ("Se enviará un email para completar el alta de la sede.", "sedes", "inviteEmailVenueHint", "An email will be sent to complete venue registration."),
    ("Solo se asigna el rol a nivel país (no crea sede).", "sedes", "inviteCountryRoleHint", "Only assigns country-level role (does not create venue)."),
    ("Ej: Córdoba", "formularios", "cityPlaceholder", "E.g. Cordoba"),
    ("Si la dejas vacía, el alcance es la provincia/estado", "formularios", "scopeProvinceHint", "If left empty, scope is province/state"),
    ("Enviando…", "metricas", "sending", "Sending…"),
    ("Enviar invitación", "formularios", "sendInvitation", "Send invitation"),
    ("Pago suscripción Padbol Match", "sedes", "subscriptionPaymentAria", "Padbol Match subscription payment"),
    ("Pago procesado. El estado «Activa» y la fecha de próximo cobro se actualizarán cuando Stripe envíe el webhook (unos segundos).", "sedes", "stripeWebhookHint", "Payment processed. Active status and next charge will update when Stripe sends the webhook (a few seconds)."),
    ("Promo en «Jugar» (hub)", "hub", "promoJugarTitle", "Promo on «Play» (hub)"),
]
CATALOG.extend(PASS2_DASHBOARD)


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if c.isalnum() or c == " ")
    parts = re.sub(r"\s+", " ", s).strip().split()[:6]
    if not parts:
        return "text"
    out = parts[0] + "".join(w.capitalize() for w in parts[1:])
    return re.sub(r"[^a-zA-Z0-9]", "", out)[:48] or "text"


def is_migratable(s: str) -> bool:
    if len(s) < 3 or len(s) > 180:
        return False
    if "${" in s or "`" in s:
        return False
    if re.search(r"[)\];}|]{2,}", s):
        return False
    if re.match(r"^[\d\spx#.%]+$", s):
        return False
    if s.startswith("admin-") or s.startswith("hub-"):
        return False
    if ".trim()" in s or "String(" in s:
        return False
    if not re.search(r"[a-zA-Záéíóúñ]", s):
        return False
    return True


def set_nested(d: dict, key: str, val: str) -> None:
    parts = key.split(".")
    if len(parts) >= 3 and parts[0] == "admin":
        admin = d.setdefault("admin", {})
        sec = parts[1]
        if isinstance(admin.get(sec), str):
            admin[f"{sec}Label"] = admin[sec]
            del admin[sec]
    cur = d
    for p in parts[:-1]:
        nxt = cur.get(p)
        if isinstance(nxt, str):
            cur[p] = {}
            nxt = cur[p]
        elif not isinstance(nxt, dict):
            cur[p] = {}
            nxt = cur[p]
        cur = nxt
    cur[parts[-1]] = val


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
    return catalog


def build_replacements(catalog: list[tuple[str, str, str, str]]) -> list[tuple[str, str]]:
    repl = []
    used_keys: set[str] = set()
    for es_text, section, suffix, _en in catalog:
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
        for q in ("'", '"'):
            old = f"{q}{es_text}{q}"
            if "${" in es_text:
                continue
            repl.append((old, f"t('{full}')"))
        # JSX text >text<
        if "<" not in es_text and ">" not in es_text:
            repl.append((f">{es_text}<", f">{{t('{full}')}}<"))
            repl.append((f">{es_text}</", f">{{t('{full}')}}</"))
            repl.append((f">{es_text}\n", f">{{t('{full}')}}\n"))
    return sorted(set(repl), key=lambda x: -len(x[0]))


def ensure_use_translation(content: str) -> str:
    if "useTranslation" in content:
        return content
    if "import React" in content:
        content = content.replace(
            "import React",
            "import { useSafeTranslation as useTranslation } from '../i18n/tSafe';\nimport React",
            1,
        )
    # add hook in first function component
    m = re.search(r"export default function \w+\([^)]*\)\s*\{", content)
    if m:
        insert = m.end()
        content = content[:insert] + "\n  const { t } = useTranslation();" + content[insert:]
    return content


def apply_files(repl: list[tuple[str, str]]) -> int:
    n = 0
    for fp in FILES:
        if not fp.exists():
            continue
        text = fp.read_text(encoding="utf-8")
        orig = text
        if "AdminHubPromoSedeSection" in fp.name or "AdminSedeExtrasPendientesSuper" in fp.name or "AdminProfesoresPendientesSuper" in fp.name:
            text = ensure_use_translation(text)
        for old, new in repl:
            if old in text and "t('" not in old:
                text = text.replace(old, new)
                n += 1
        if text != orig:
            fp.write_text(text, encoding="utf-8")
            print("updated", fp.name)
    return n


def main():
    merge_locales(CATALOG)
    repl = build_replacements(CATALOG)
    n = apply_files(repl)
    print(f"catalog entries: {len(CATALOG)}, replacements applied: ~{n}")


if __name__ == "__main__":
    main()
