import { nombreListadoTorneoRanking } from './jugadorPerfil';
import { normalizeJugadorEmail } from './jugadorNombreTorneo';
import {
  appendJsonWorksheet,
  createExcelWorkbook,
  downloadExcelWorkbook,
} from './excelWorkbook';

function safeJugadores(eq) {
  let j = eq?.jugadores;
  if (typeof j === 'string') {
    try {
      j = JSON.parse(j);
    } catch {
      j = [];
    }
  }
  return Array.isArray(j) ? j : [];
}

function nombreEquipoParaExport(eq) {
  const n = String(eq?.nombre || '').trim();
  if (n) return n;
  const j = safeJugadores(eq);
  const labels = j.slice(0, 2).map((player) => nombreListadoTorneoRanking(player)).filter(Boolean);
  if (labels.length >= 2) return `${labels[0]} & ${labels[1]}`;
  if (labels.length === 1) return labels[0];
  return eq?.id != null ? `Equipo #${eq.id}` : '—';
}

function perfilDesdeCtx(p, ctx) {
  const em = normalizeJugadorEmail(p);
  if (em && ctx?.perfilByEmailLower instanceof Map && ctx.perfilByEmailLower.has(em)) {
    return ctx.perfilByEmailLower.get(em);
  }
  return null;
}

function estadoInscripcionLabel(eq) {
  const s = String(eq?.inscripcion_estado || '').trim().toLowerCase();
  if (s === 'confirmado') return 'Confirmado';
  if (s === 'pendiente') return 'Pendiente';
  if (!String(eq?.inscripcion_estado || '').trim()) return '—';
  return String(eq.inscripcion_estado).trim();
}

export function buildTorneoJugadoresExportRows(equipos, jugadorNombreTorneoCtx) {
  const rows = [];
  for (const eq of equipos || []) {
    const equipoNombre = nombreEquipoParaExport(eq);
    const estadoIns = estadoInscripcionLabel(eq);
    const jugadores = safeJugadores(eq);
    for (const p of jugadores) {
      const perf = perfilDesdeCtx(p, jugadorNombreTorneoCtx);
      const nombre = String(perf?.nombre ?? p.nombre ?? '').trim();
      const apellido = String(perf?.apellido ?? p.apellido ?? '').trim();
      const email = String(perf?.email ?? p.email ?? '').trim();
      const whatsapp = String(perf?.whatsapp ?? p.whatsapp ?? '').trim();
      const categoria = String(perf?.nivel ?? p.nivel ?? '').trim();
      rows.push({
        Nombre: nombre,
        Apellido: apellido,
        Email: email,
        WhatsApp: whatsapp,
        Categoría: categoria || '—',
        'Equipo en el torneo': equipoNombre,
        'Estado de inscripción': estadoIns,
      });
    }
  }
  return rows;
}

function slugifyFilename(s) {
  const t = String(s || 'torneo')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .trim();
  return t.slice(0, 80) || 'torneo';
}

/**
 * Genera y descarga un .xlsx con jugadores inscriptos en el torneo (una fila por jugador).
 */
export async function downloadTorneoJugadoresXlsx({ torneo, equipos, jugadorNombreTorneoCtx }) {
  const data = buildTorneoJugadoresExportRows(equipos, jugadorNombreTorneoCtx);
  if (!data.length) {
    window.alert('No hay jugadores en los equipos de este torneo para exportar.');
    return;
  }
  const workbook = createExcelWorkbook();
  appendJsonWorksheet(workbook, data, 'Jugadores');
  const name = slugifyFilename(torneo?.nombre);
  const id = torneo?.id != null ? String(torneo.id) : '';
  await downloadExcelWorkbook(
    workbook,
    `jugadores_${name}${id ? `_${id}` : ''}.xlsx`
  );
}
