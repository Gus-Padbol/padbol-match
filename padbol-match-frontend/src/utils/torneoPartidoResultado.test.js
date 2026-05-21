import {
  buildTablaPosiciones,
  parseResultadoPartido,
  partidoEstaFinalizado,
  resolveGanadorEquipoId,
  partidosDelGrupo,
  formatSetsLineaNeutral,
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
