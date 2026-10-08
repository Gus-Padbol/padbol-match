import {
  PROGRAMA_FILTRO_TODOS,
  PROGRAMA_NEXT_GENERATION,
  PROGRAMA_PADBOL,
  agruparTorneosPorProgramaYCategoria,
  etiquetaCategoriaEdad,
  filtrarTorneos,
  programaDeTorneo,
  separarTorneosPorPrograma,
  torneoEsNextGenerationUI,
  torneoPasaFiltroCategoriaEdad,
  torneoPasaFiltroNivel,
  torneoPasaFiltroPrograma,
} from './torneoProgramaUI';

const T_U13 = { id: 1, categoria_edad: 'u13', categoria: '6ta' };
const T_U17 = { id: 2, categoria_edad: 'u17', categoria: 'Libre' };
const T_OPEN = { id: 3, categoria_edad: 'open', categoria: 'Elite' };
const T_50 = { id: 4, categoria_edad: 'master_50', categoria: 'Principiante' };
const T_LEGADO = { id: 5, categoria_edad: 'sub_18', categoria: 'Libre' };

describe('programa del torneo', () => {
  test('U13/U15/U17 son Next Generation; open y +50 son Padbol', () => {
    expect(programaDeTorneo(T_U13)).toBe(PROGRAMA_NEXT_GENERATION);
    expect(programaDeTorneo(T_U17)).toBe(PROGRAMA_NEXT_GENERATION);
    expect(programaDeTorneo(T_OPEN)).toBe(PROGRAMA_PADBOL);
    expect(programaDeTorneo(T_50)).toBe(PROGRAMA_PADBOL);
    expect(torneoEsNextGenerationUI(T_U13)).toBe(true);
    expect(torneoEsNextGenerationUI(T_50)).toBe(false);
  });

  test('marca explícita `programa` gana sobre la categoría', () => {
    expect(programaDeTorneo({ categoria_edad: 'open', programa: 'next_generation' })).toBe(PROGRAMA_NEXT_GENERATION);
  });

  test('legado sub_18 no se considera Next Generation', () => {
    expect(programaDeTorneo(T_LEGADO)).toBe(PROGRAMA_PADBOL);
  });

  test('torneo inválido cae a Padbol sin romper', () => {
    expect(programaDeTorneo(null)).toBe(PROGRAMA_PADBOL);
    expect(programaDeTorneo({})).toBe(PROGRAMA_PADBOL);
  });
});

describe('filtros', () => {
  const lista = [T_U13, T_U17, T_OPEN, T_50, T_LEGADO];

  test('filtro por programa', () => {
    expect(filtrarTorneos(lista, { programa: PROGRAMA_NEXT_GENERATION }).map((t) => t.id)).toEqual([1, 2]);
    expect(filtrarTorneos(lista, { programa: PROGRAMA_PADBOL }).map((t) => t.id)).toEqual([3, 4, 5]);
    expect(filtrarTorneos(lista, { programa: PROGRAMA_FILTRO_TODOS })).toHaveLength(5);
  });

  test('filtro por categoría de edad (normaliza mayúsculas)', () => {
    expect(filtrarTorneos(lista, { categoriaEdad: 'U13' }).map((t) => t.id)).toEqual([1]);
    expect(torneoPasaFiltroCategoriaEdad(T_U17, 'u17')).toBe(true);
    expect(torneoPasaFiltroCategoriaEdad(T_U17, 'u15')).toBe(false);
  });

  test('filtro por nivel deportivo (eje separado de la edad)', () => {
    expect(filtrarTorneos(lista, { nivel: 'Libre' }).map((t) => t.id)).toEqual([2, 5]);
    expect(torneoPasaFiltroNivel(T_U13, '6ta')).toBe(true);
    expect(torneoPasaFiltroNivel(T_U13, 'Elite')).toBe(false);
  });

  test('combina los tres filtros sin mezclar programas', () => {
    const r = filtrarTorneos(lista, { programa: PROGRAMA_NEXT_GENERATION, categoriaEdad: 'u13', nivel: '6ta' });
    expect(r.map((t) => t.id)).toEqual([1]);
    expect(torneoPasaFiltroPrograma(T_OPEN, PROGRAMA_NEXT_GENERATION)).toBe(false);
  });

  test('lista vacía o inválida no rompe', () => {
    expect(filtrarTorneos(null, {})).toEqual([]);
    expect(filtrarTorneos(undefined, { programa: PROGRAMA_PADBOL })).toEqual([]);
  });
});

describe('separación para rankings', () => {
  const lista = [T_U13, T_U17, T_OPEN, T_50, T_LEGADO];

  test('separa juveniles de adultos (no se mezclan)', () => {
    const { nextGeneration, padbol } = separarTorneosPorPrograma(lista);
    expect(nextGeneration.map((t) => t.id)).toEqual([1, 2]);
    expect(padbol.map((t) => t.id)).toEqual([3, 4, 5]);
  });

  test('agrupa por programa + categoría de edad', () => {
    const grupos = agruparTorneosPorProgramaYCategoria(lista);
    const claves = grupos.map((g) => `${g.programa}:${g.categoriaEdad}`);
    expect(claves).toContain('next_generation:u13');
    expect(claves).toContain('next_generation:u17');
    expect(claves).toContain('padbol:open');
    expect(claves).toContain('padbol:master_50');
    expect(grupos.find((g) => g.categoriaEdad === 'u13').torneos).toHaveLength(1);
  });

  test('etiqueta de categoría de edad con fallback', () => {
    expect(etiquetaCategoriaEdad('u15')).toBe('U15');
    expect(etiquetaCategoriaEdad('master_50')).toContain('+50');
    expect(etiquetaCategoriaEdad('desconocida')).toBe('desconocida');
    expect(etiquetaCategoriaEdad(null)).toBe('—');
  });
});
