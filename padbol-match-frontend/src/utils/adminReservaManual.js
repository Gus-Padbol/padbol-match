import {
  generarIniciosMinutosSlotReserva,
  minutosAHoraReserva,
} from './reservaSlotsHorarios';

export const RESERVA_MANUAL_DURACIONES = [60, 90, 120];
export const RESERVA_MANUAL_ESTADOS = ['pendiente', 'reservada', 'confirmada'];

const ADMIN_MANUAL_EMAIL_FALLBACK = 'admin@padbolmatch.com';

function normalizeHoraInicio(hora) {
  if (!hora) return null;
  const s = String(hora).trim().split(' - ')[0].trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}`;
}

function minutosDesdeMedianoche(hora) {
  const s = normalizeHoraInicio(hora);
  if (!s) return null;
  const [hh, mm] = s.split(':').map(Number);
  return hh * 60 + mm;
}

export function duracionReservaMinutos(reserva) {
  const d = parseInt(String(reserva?.duracion_minutos ?? reserva?.duracion ?? ''), 10);
  return Number.isFinite(d) && d > 0 ? d : 90;
}

export function reservaBloqueaSlot(reserva) {
  const est = String(reserva?.estado || '').trim().toLowerCase();
  return est !== 'cancelada' && !reserva?.cancelada;
}

function reservaMatchesSede(reserva, sedeRow) {
  if (!sedeRow) return false;
  const sid = String(sedeRow.id ?? '');
  if (sid && reserva?.sede_id != null && String(reserva.sede_id) === sid) return true;
  const nombre = String(sedeRow.nombre || '').trim().toLowerCase();
  return Boolean(nombre && String(reserva?.sede || '').trim().toLowerCase() === nombre);
}

function reservaSolapaSlot(reserva, startMin, endMin) {
  const rStart = minutosDesdeMedianoche(reserva?.hora);
  if (rStart == null) return false;
  const rEnd = rStart + duracionReservaMinutos(reserva);
  return startMin < rEnd && endMin > rStart;
}

export function slotsReservaManualDisponibles({
  sedeRow,
  reservas,
  fecha,
  cancha,
  duracion,
  ctx,
}) {
  if (!sedeRow || !fecha || cancha == null || cancha === '') return [];
  const duracionMin = RESERVA_MANUAL_DURACIONES.includes(parseInt(String(duracion), 10))
    ? parseInt(String(duracion), 10)
    : 90;
  const canchaNum = parseInt(String(cancha), 10);
  if (!Number.isFinite(canchaNum)) return [];

  const fechaISO = String(fecha || '').trim().slice(0, 10);
  const ocupadas = (Array.isArray(reservas) ? reservas : []).filter((r) => {
    if (!reservaBloqueaSlot(r)) return false;
    if (String(r?.fecha || '').trim().slice(0, 10) !== fechaISO) return false;
    if (parseInt(String(r?.cancha), 10) !== canchaNum) return false;
    return reservaMatchesSede(r, sedeRow);
  });

  const filtraPasadosHoy = ctx?.hoyISO && fechaISO === ctx.hoyISO;
  const inicios = generarIniciosMinutosSlotReserva(sedeRow, fechaISO, duracionMin, 30);
  const out = [];
  for (const start of inicios) {
    if (filtraPasadosHoy && start < ctx.minutesNow) continue;
    const end = start + duracionMin;
    if (ocupadas.some((r) => reservaSolapaSlot(r, start, end))) continue;
    out.push(minutosAHoraReserva(start));
  }
  return out;
}

export function ahoraArgentinaPartes() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    hoyISO: `${y}-${m}-${d}`,
    minutesNow: now.getHours() * 60 + now.getMinutes(),
  };
}

export function validateReservaManualForm(form, { esAdminClub, sedeIdDefault } = {}) {
  const errors = [];
  const sedeId = String(form.sede_id || (esAdminClub && sedeIdDefault != null ? sedeIdDefault : '') || '').trim();
  const cancha = form.cancha;
  const fecha = String(form.fecha || '').trim();
  const hora = normalizeHoraInicio(form.hora);
  const nombre = String(form.nombre || '').trim();
  const duracion = parseInt(String(form.duracion), 10);

  if (!sedeId) errors.push('sede');
  if (cancha == null || cancha === '') errors.push('cancha');
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) errors.push('fecha');
  if (!hora) errors.push('hora');
  if (!nombre) errors.push('nombre');
  if (!RESERVA_MANUAL_DURACIONES.includes(duracion)) errors.push('duracion');

  return {
    ok: errors.length === 0,
    errors,
    sedeId,
    canchaNum: parseInt(String(cancha), 10),
    fecha,
    hora,
    nombre,
    duracion,
    telefono: String(form.telefono || '').trim() || null,
    estado: RESERVA_MANUAL_ESTADOS.includes(String(form.estado || '').toLowerCase())
      ? String(form.estado).toLowerCase()
      : 'confirmada',
  };
}

export function validationErrorMessage(errors) {
  if (!errors?.length) return '';
  if (errors.includes('sede')) return 'Seleccioná una sede.';
  if (errors.includes('cancha')) return 'Seleccioná una cancha.';
  if (errors.includes('fecha')) return 'Ingresá una fecha válida.';
  if (errors.includes('hora')) return 'Seleccioná un horario válido.';
  if (errors.includes('nombre')) return 'Ingresá el nombre del jugador.';
  if (errors.includes('duracion')) return 'Seleccioná una duración válida (60, 90 o 120 min).';
  return 'Completá todos los campos obligatorios.';
}

export function buildReservaManualPostPayload(validated, { sedeNombre, email }) {
  const contactEmail = String(email || ADMIN_MANUAL_EMAIL_FALLBACK).trim().toLowerCase();
  const telefono = validated.telefono;
  return {
    sede_id: parseInt(String(validated.sedeId), 10),
    sede: sedeNombre || undefined,
    fecha: validated.fecha,
    hora: validated.hora,
    cancha: validated.canchaNum,
    duracion_minutos: validated.duracion,
    nombre: validated.nombre,
    email: contactEmail,
    telefono: telefono || '',
    whatsapp: telefono || '',
    nivel: 'intermedio',
  };
}

export function buildAdminReservaEstadoPutBody(estadoDeseado) {
  const estado = String(estadoDeseado || 'pendiente').toLowerCase();
  if (estado === 'confirmada') {
    return { estado: 'confirmada', pago_estado: 'pagado' };
  }
  if (estado === 'reservada') {
    return { estado: 'reservada' };
  }
  if (estado === 'pendiente') {
    return { estado: 'pendiente', pago_estado: 'pendiente' };
  }
  return { estado };
}

export function parseReservaManualCreateResponse(json) {
  if (Array.isArray(json)) return json[0] || null;
  if (json?.id) return json;
  if (json?.reserva?.id) return json.reserva;
  return null;
}

export function mapReservaManualApiError(status, body) {
  const msg = String(body?.error || body?.message || '').trim();
  if (status === 400) {
    if (/faltan|requerid|inválid|invalid/i.test(msg)) return msg || 'Datos inválidos o incompletos.';
    if (/sede/i.test(msg)) return msg || 'Sede inválida o no encontrada.';
    if (/fecha|hora/i.test(msg)) return msg || 'Fecha u hora inválida.';
    return msg || 'Datos inválidos o incompletos.';
  }
  if (status === 401) return 'Sesión expirada. Volvé a iniciar sesión.';
  if (status === 403) {
    if (body?.suspendido) return msg || 'No tenés permiso para crear reservas en este momento.';
    return msg || 'No tenés permiso para crear esta reserva.';
  }
  if (status === 409) return msg || 'Este horario ya está ocupado en la cancha seleccionada.';
  if (status === 404) return msg || 'Sede o recurso no encontrado.';
  if (status >= 500) return msg || 'Error interno del servidor. Intentá de nuevo o contactá soporte.';
  return msg || `No se pudo crear la reserva (código ${status}).`;
}

export async function crearReservaManualApi({
  apiBaseUrl,
  headers,
  payload,
  estadoDeseado,
}) {
  const postRes = await fetch(`${apiBaseUrl}/api/reservas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  const postJson = await postRes.json().catch(() => ({}));
  if (!postRes.ok) {
    const err = new Error(mapReservaManualApiError(postRes.status, postJson));
    err.status = postRes.status;
    throw err;
  }

  const created = parseReservaManualCreateResponse(postJson);
  const reservaId = created?.id;
  const estado = String(estadoDeseado || 'pendiente').toLowerCase();

  if (reservaId && estado !== 'pendiente') {
    const putBody = buildAdminReservaEstadoPutBody(estado);
    const putRes = await fetch(`${apiBaseUrl}/api/reservas/${reservaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(putBody),
    });
    const putJson = await putRes.json().catch(() => ({}));
    if (!putRes.ok) {
      const err = new Error(
        mapReservaManualApiError(putRes.status, putJson)
          + ' La reserva se creó pero no se pudo aplicar el estado solicitado.',
      );
      err.status = putRes.status;
      err.reservaId = reservaId;
      throw err;
    }
  }

  return created;
}

export function canchasManualDesdeFilas(canchasRows, sedeRow) {
  const activas = (Array.isArray(canchasRows) ? canchasRows : [])
    .filter((c) => String(c?.estado || 'activa').toLowerCase() !== 'inactiva')
    .map((c, idx) => {
      const numero = parseInt(String(c.numero_reserva ?? c.orden ?? idx + 1), 10);
      return {
        numero,
        nombre: String(c.nombre || '').trim() || `Cancha ${numero}`,
      };
    })
    .filter((c) => Number.isFinite(c.numero))
    .sort((a, b) => a.numero - b.numero);

  if (activas.length) return activas;

  const count = Math.max(0, parseInt(String(sedeRow?.cantidad_canchas), 10) || 0);
  return Array.from({ length: count }, (_, idx) => ({
    numero: idx + 1,
    nombre: `Cancha ${idx + 1}`,
  }));
}
