import { getAuthHeaders } from './scoreboardApi';
import { parseSetGames } from './torneoPartidoResultado';
import { validarMejorDeTres } from './speechResultadoPartido';

/** The tournament API calls sets won goles_a/b; individual games stay in history. */
export function buildResultadoManualTorneoBody(resultado = {}) {
  const sets = [resultado.set1, resultado.set2, resultado.set3]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (sets.length < 2) throw new Error('Mínimo 2 sets requeridos');
  const parsed = sets.map((set) => parseSetGames(set));
  if (parsed.some((set) => !set || !Number.isInteger(set.a) || !Number.isInteger(set.b))) {
    throw new Error('Formato de set inválido (ej.: 6-4). No puede haber empate en un set.');
  }
  const validation = validarMejorDeTres(parsed);
  if (!validation.ok) throw new Error(validation.error);
  return {
    goles_a: validation.winsA,
    goles_b: validation.winsB,
    historial_sets: parsed.map(({ a, b }, index) => ({ set: index + 1, a, b })),
  };
}

export async function guardarResultadoManualTorneo({ apiBaseUrl, torneoId, partidoId, resultado }) {
  if (![torneoId, partidoId].every((id) => Number.isSafeInteger(Number(id)) && Number(id) > 0)) {
    throw new Error('Torneo o partido inválido');
  }
  const body = buildResultadoManualTorneoBody(resultado);
  const headers = await getAuthHeaders();
  if (!headers.Authorization) {
    throw Object.assign(new Error('Inicia sesión para guardar el resultado.'), { status: 401 });
  }
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');
  const res = await fetch(`${base}/api/torneos/${encodeURIComponent(String(torneoId))}/partidos/${encodeURIComponent(String(partidoId))}/resultado`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok !== true) {
    throw Object.assign(new Error(data?.error || res.statusText || 'No se pudo guardar el resultado.'), {
      status: res.status,
      code: data?.code,
    });
  }
  if (!data.resultado || !['finalized', 'idempotent'].includes(data.status)
    || Number(data.partido_id) !== Number(partidoId) || Number(data.torneo_id) !== Number(torneoId)) {
    throw new Error('El servidor no confirmó el resultado de este partido. Recarga el torneo para comprobarlo.');
  }
  return data;
}
