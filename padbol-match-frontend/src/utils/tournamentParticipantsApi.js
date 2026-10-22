import { getAuthHeaders } from './scoreboardApi';

export async function tournamentParticipantRequest(base, torneoId, path = '', body, method) {
  const headers = await getAuthHeaders();
  if (!headers.Authorization) throw Object.assign(new Error('Inicia sesión para administrar tu inscripción.'), { status: 401 });
  const response = await fetch(`${String(base).replace(/\/+$/, '')}/api/torneos/${Number(torneoId)}${path}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { ...headers, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true) throw Object.assign(new Error(data?.error || 'No pudimos confirmar la operación. Revisa el estado antes de repetir.'), { status: response.status, code: data?.code });
  return data;
}

export async function readTournamentParticipants(base, id) {
  const data = await tournamentParticipantRequest(base, id, '/participantes');
  if (Number(data.torneo_id) !== Number(id) || !Array.isArray(data.participants) || !Array.isArray(data.teams)
    || !Number.isInteger(data.limits?.min_jugadores) || !Number.isInteger(data.limits?.max_jugadores)
    || data.limits.min_jugadores < 1 || data.limits.max_jugadores < data.limits.min_jugadores || data.limits.max_jugadores > 20) {
    throw new Error('No recibimos un catálogo de participantes válido. Recarga antes de continuar.');
  }
  return data;
}

export async function registerTournamentParticipants(base, id, body) {
  const data = await tournamentParticipantRequest(base, id, '/inscripciones-participantes', body);
  if (Number(data.torneo_id) !== Number(id) || !data.equipo?.id || !['created', 'idempotent'].includes(data.status)) {
    throw new Error('La inscripción no quedó confirmada. Revisa tus equipos antes de repetir.');
  }
  return data;
}
