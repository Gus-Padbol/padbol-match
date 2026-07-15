import {
  buildPadcoinsReportesQuery,
  downloadPadcoinsReporteCsv,
  isUuidLike,
  padcoinsReporteFechaDesdeIso,
  padcoinsReporteFechaHastaIso,
  parseContentDispositionFilename,
  parsePadcoinsReportesError,
} from './padcoinsReportesApi';

describe('padcoinsReportesApi', () => {
  it('arma query con sede, fechas y tipo', () => {
    const q = buildPadcoinsReportesQuery({
      sede_id: '12',
      fecha_desde: '2026-07-01',
      fecha_hasta: '2026-07-15',
      tipo: 'earn',
      limit: 50,
      offset: 0,
    });
    expect(q.get('sede_id')).toBe('12');
    expect(q.get('fecha_desde')).toBe(padcoinsReporteFechaDesdeIso('2026-07-01'));
    expect(q.get('fecha_hasta')).toBe(padcoinsReporteFechaHastaIso('2026-07-15'));
    expect(q.get('tipo')).toBe('earn');
    expect(q.get('limit')).toBe('50');
  });

  it('pasa búsqueda UUID como user_id', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(isUuidLike(id)).toBe(true);
    const q = buildPadcoinsReportesQuery({ search: id });
    expect(q.get('user_id')).toBe(id);
  });

  it('parsea Content-Disposition', () => {
    expect(parseContentDispositionFilename(
      'attachment; filename="padcoins-movimientos_sede-todas_2026-07-15.csv"',
    )).toBe('padcoins-movimientos_sede-todas_2026-07-15.csv');
  });

  it('mensajes 403 y límite excedido', () => {
    expect(parsePadcoinsReportesError(403, {})).toMatch(/403|permiso/i);
    expect(parsePadcoinsReportesError(400, {
      code: 'PADCOINS_EXPORT_LIMIT_EXCEEDED',
      error: 'La exportación supera el límite de 5000 filas (total=9000).',
    })).toMatch(/límite|5000/i);
  });

  it('downloadPadcoinsReporteCsv usa Authorization y no abre ventana', async () => {
    const blob = new Blob(['a,b\n'], { type: 'text/csv' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (k) => (k.toLowerCase() === 'content-disposition'
          ? 'attachment; filename="padcoins-canjes_sede-1_2026-07-15.csv"'
          : null),
      },
      blob: async () => blob,
    });
    global.fetch = fetchMock;

    const click = jest.fn();
    const remove = jest.fn();
    const appendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      if (el && typeof el.click === 'function') {
        el.click = click;
        el.remove = remove;
      }
      return el;
    });
    const createObjectURL = jest.fn(() => 'blob:mock');
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const result = await downloadPadcoinsReporteCsv({
      apiBaseUrl: 'https://padbol-backend.onrender.com',
      accessToken: 'tok-xyz',
      kind: 'canjes',
      filters: { sede_id: '1' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/padcoins-reportes/canjes.csv?'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer tok-xyz' },
      }),
    );
    expect(result.filename).toBe('padcoins-canjes_sede-1_2026-07-15.csv');
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();

    appendChild.mockRestore();
  });
});
