import {
  filterAdminJugadoresByVinculacion,
  formatJugadorActivity,
  normalizeAdminJugadoresSearchItems,
  parseAdminJugadoresApiError,
  sortAdminJugadoresItems,
} from './adminJugadoresApi';

describe('adminJugadoresApi helpers', () => {
  it('normaliza items de búsqueda en varios shapes', () => {
    expect(normalizeAdminJugadoresSearchItems({ items: [{ user_id: '1' }] })).toHaveLength(1);
    expect(normalizeAdminJugadoresSearchItems([{ user_id: '2' }])).toHaveLength(1);
    expect(normalizeAdminJugadoresSearchItems({ jugadores: [{ user_id: '3' }] })).toHaveLength(1);
    expect(normalizeAdminJugadoresSearchItems({})).toEqual([]);
  });

  it('mensajes de error 401/403/500', () => {
    expect(parseAdminJugadoresApiError(401, {})).toMatch(/401|sesión/i);
    expect(parseAdminJugadoresApiError(403, {})).toMatch(/403|permiso/i);
    expect(parseAdminJugadoresApiError(500, { error: 'boom' })).toBe('boom');
  });

  it('formatea la actividad con la región elegida', () => {
    const iso = '2026-06-15T12:00:00Z';
    expect(formatJugadorActivity(iso, 'de-DE')).toContain('Juni');
    expect(formatJugadorActivity(iso, 'de-DE')).not.toBe(formatJugadorActivity(iso, 'en-US'));
  });

  it('ordena y filtra por vinculación', () => {
    const rows = [
      { display_name: 'Bruno', vinculacion: 'registrado', last_activity_at: '2026-01-01' },
      { display_name: 'Ana', vinculacion: 'con_historial', last_activity_at: '2026-06-01' },
    ];
    expect(sortAdminJugadoresItems(rows, 'name_asc')[0].display_name).toBe('Ana');
    expect(filterAdminJugadoresByVinculacion(rows, 'con_historial')).toHaveLength(1);
  });
});
