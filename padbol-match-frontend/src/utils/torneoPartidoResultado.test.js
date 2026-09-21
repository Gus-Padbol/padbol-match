import {
  buildTablaPosiciones,
  parseResultadoPartido,
  partidoEstaFinalizado,
  resolveGanadorEquipoId,
  partidosDelGrupo,
  formatSetsLineaNeutral,
  validarMarcadorSetsPartido,
  formatMarcadorPartidoDetalle,
} from './torneoPartidoResultado';

describe('buildTablaPosiciones', () => {
  const equipos = [
    { id: 1, nombre: 'A' },
    { id: 2, nombre: 'B' },
  ];

  it('cuenta PJ/PG/PTS y sets desde partidos finalizados', () => {
    const partidos = [
      {
        id: 10,
        estado: 'finalizado',
        equipo_a_id: 1,
        equipo_b_id: 2,
        resultado: { set1: '6-4', set2: '6-3', ganador_id: 1 },
      },
    ];
    const tabla = buildTablaPosiciones(equipos, partidos);
    const a = tabla.find((r) => r.id === 1);
    const b = tabla.find((r) => r.id === 2);
    expect(a.jj).toBe(1);
    expect(a.g).toBe(1);
    expect(a.p).toBe(0);
    expect(a.pts).toBe(3);
    expect(a.sg).toBe(2);
    expect(a.sp).toBe(0);
    expect(a.gg).toBe(12);
    expect(a.gp).toBe(7);
    expect(a.gf).toBe(12);
    expect(a.gc).toBe(7);
    expect(a.dg).toBe(2);
    expect(b.jj).toBe(1);
    expect(b.g).toBe(0);
    expect(b.p).toBe(1);
    expect(b.pts).toBe(0);
  });

  it('ignora partidos no finalizados', () => {
    const partidos = [
      {
        id: 11,
        estado: 'pendiente',
        equipo_a_id: 1,
        equipo_b_id: 2,
        resultado: { set1: '6-0', set2: '6-0' },
      },
    ];
    const tabla = buildTablaPosiciones(equipos, partidos);
    expect(tabla.every((r) => r.pts === 0 && r.jj === 0)).toBe(true);
  });

  it('solo filas de equipos del torneo', () => {
    const tabla = buildTablaPosiciones([...equipos, { id: null }, { id: '' }], []);
    expect(tabla).toHaveLength(2);
  });
});

describe('resolveGanadorEquipoId', () => {
  it('usa ganador_id del JSON', () => {
    expect(
      resolveGanadorEquipoId({
        equipo_a_id: 5,
        equipo_b_id: 8,
        resultado: { set1: '0-0', set2: '0-0', ganador_id: 8 },
      }),
    ).toBe('8');
  });
});

describe('partidosDelGrupo', () => {
  it('incluye partidos por equipos del grupo aunque falte p.grupo', () => {
    const eqs = [
      { id: 1, grupo: 'A' },
      { id: 2, grupo: 'A' },
    ];
    const partidos = [
      { id: 1, equipo_a_id: 1, equipo_b_id: 2, estado: 'finalizado' },
      { id: 2, equipo_a_id: 1, equipo_b_id: 3, estado: 'finalizado' },
    ];
    const g = partidosDelGrupo(partidos, eqs, 'A');
    expect(g).toHaveLength(1);
    expect(g[0].id).toBe(1);
  });
});

describe('partidoEstaFinalizado', () => {
  it('detecta estado finalizado', () => {
    expect(partidoEstaFinalizado({ estado: 'finalizado' })).toBe(true);
    expect(partidoEstaFinalizado({ estado: 'pendiente' })).toBe(false);
  });
});

describe('parseResultadoPartido', () => {
  it('reconstruye el resultado manual persistido y las posiciones al recargar', () => {
    const partido = {
      id: 45, estado: 'finalizado', equipo_a_id: 71, equipo_b_id: 72, ganador_equipo_id: 71,
      resultado: {
        goles_a: 2, goles_b: 1, fuente_resultado: 'manual_admin',
        historial_sets: [{ set: 1, a: 6, b: 4 }, { set: 2, a: 3, b: 6 }, { set: 3, a: 7, b: 5 }],
      },
    };
    const reloaded = JSON.parse(JSON.stringify(partido));
    expect(parseResultadoPartido(reloaded)).toEqual(['6-4', '3-6', '7-5']);
    expect(formatSetsLineaNeutral(reloaded)).toBe('6-4 / 3-6 / 7-5');
    expect(resolveGanadorEquipoId(reloaded)).toBe('71');
    const table = buildTablaPosiciones([{ id: 71 }, { id: 72 }], [reloaded]);
    expect(table.find(row => row.id === 71)).toMatchObject({ g: 1, pts: 3, sg: 2, sp: 1, gg: 16, gp: 15 });
  });

  it('no inventa games a partir de goles_a/b (sets ganados) si no hay historial', () => {
    expect(parseResultadoPartido({ resultado: { goles_a: 2, goles_b: 0 } })).toEqual([]);
    expect(parseResultadoPartido({ resultado: { historial_sets: [], set1: '6-4', set2: '6-3' } })).toEqual(['6-4', '6-3']);
  });

  it('parsea sets como strings set1/set2', () => {
    const sets = parseResultadoPartido({
      resultado: { set1: '6-4', set2: '6-3' },
    });
    expect(sets).toEqual(['6-4', '6-3']);
    expect(formatSetsLineaNeutral({ resultado: { set1: '6-4', set2: '6-3' } })).toBe('6-4 / 6-3');
  });

  it('parsea sets como arrays [games_a, games_b]', () => {
    const sets = parseResultadoPartido({
      estado: 'finalizado',
      resultado: { set1: [6, 4], set2: [6, 2], ganador_id: 1 },
    });
    expect(sets).toEqual(['6-4', '6-2']);
  });

  it('parsea resultado JSON doblemente serializado', () => {
    const sets = parseResultadoPartido({
      resultado: JSON.stringify(JSON.stringify({ set1: '7-5', set2: '6-4' })),
    });
    expect(sets).toEqual(['7-5', '6-4']);
  });

  it('parsea res.sets con objetos games_a/games_b', () => {
    const sets = parseResultadoPartido({
      resultado: {
        sets: [
          { games_a: 6, games_b: 4 },
          { games_a: 3, games_b: 6 },
          { games_a: 7, games_b: 5 },
        ],
      },
    });
    expect(sets).toEqual(['6-4', '3-6', '7-5']);
  });
});

describe('validarMarcadorSetsPartido', () => {
  it('rechaza empate en sets ganados (1-1)', () => {
    const partido = {
      resultado: { set1: '6-4', set2: '4-6' },
    };
    expect(validarMarcadorSetsPartido(partido)).toEqual({
      valido: false,
      empate: true,
      sgA: 1,
      sgB: 1,
    });
    expect(formatMarcadorPartidoDetalle(partido, 'A', 'B')).toBe('');
  });

  it('acepta ganador claro 2-1', () => {
    const partido = {
      resultado: { set1: '6-4', set2: '4-6', set3: '7-5' },
    };
    expect(validarMarcadorSetsPartido(partido)).toMatchObject({
      valido: true,
      empate: false,
      sgA: 2,
      sgB: 1,
    });
  });
});
