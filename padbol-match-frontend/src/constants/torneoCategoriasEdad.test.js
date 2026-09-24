import {
  TORNEO_CATEGORIAS_EDAD,
  TORNEO_CATEGORIA_EDAD_ADULTA,
  TORNEO_CATEGORIA_EDAD_DIVISION_ESPECIAL,
  TORNEO_CATEGORIA_EDAD_JUVENIL,
  TORNEO_CATEGORIA_EDAD_LEGADO,
  TORNEO_CATEGORIA_EDAD_VALORES,
  categoriaJuvenilParaEdad,
  categoriasEdadOfrecidas,
  categoriasElegiblesParaNacimiento,
  edadEnFechaCorte,
  esCategoriaAdulta,
  esCategoriaJuvenil,
  esCategoriaLegado,
  esDivisionEspecial,
  esNacimientoElegibleParaCategoria,
  esTorneoNextGeneration,
  isCategoriaEdadValida,
  normalizeCategoriaEdad,
  programaDeCategoria,
} from './torneoCategoriasEdad';

describe('modelo de categorías por edad / programa', () => {
  test('Next Generation es exclusivamente U13 / U15 / U17', () => {
    expect([...TORNEO_CATEGORIA_EDAD_JUVENIL]).toEqual(['u13', 'u15', 'u17']);
    TORNEO_CATEGORIA_EDAD_JUVENIL.forEach((v) => {
      expect(esCategoriaJuvenil(v)).toBe(true);
      expect(programaDeCategoria(v)).toBe('next_generation');
    });
  });

  test('adultos bajo Padbol y +50 como división especial opcional (sin marca nueva)', () => {
    expect([...TORNEO_CATEGORIA_EDAD_ADULTA]).toEqual(['open']);
    expect([...TORNEO_CATEGORIA_EDAD_DIVISION_ESPECIAL]).toEqual(['master_50']);
    expect(esCategoriaAdulta('open')).toBe(true);
    expect(esDivisionEspecial('master_50')).toBe(true);
    expect(esCategoriaJuvenil('master_50')).toBe(false);
    expect(programaDeCategoria('master_50')).toBe('padbol');
    // No hay +30 ni +40 como categorías principales.
    const ofrecidas = categoriasEdadOfrecidas().map((c) => c.value);
    expect(ofrecidas).not.toContain('master_30');
    expect(ofrecidas).not.toContain('master_40');
    expect(ofrecidas).toEqual(['u13', 'u15', 'u17', 'open', 'master_50']);
  });

  test('legado histórico válido pero no ofrecido (sub_18, master_40)', () => {
    expect([...TORNEO_CATEGORIA_EDAD_LEGADO]).toEqual(['sub_18', 'master_40']);
    TORNEO_CATEGORIA_EDAD_LEGADO.forEach((v) => {
      expect(isCategoriaEdadValida(v)).toBe(true);
      expect(esCategoriaLegado(v)).toBe(true);
      expect(categoriasEdadOfrecidas().map((c) => c.value)).not.toContain(v);
    });
    expect(isCategoriaEdadValida('master_30')).toBe(false);
    expect(isCategoriaEdadValida('sub_20')).toBe(false);
  });

  test('normalización y valores canónicos', () => {
    expect([...TORNEO_CATEGORIA_EDAD_VALORES]).toEqual(['u13', 'u15', 'u17', 'open', 'master_50', 'sub_18', 'master_40']);
    expect(normalizeCategoriaEdad(' MASTER_50 ')).toBe('master_50');
    expect(normalizeCategoriaEdad('u16')).toBeNull();
  });

  test('identificación Next Generation', () => {
    expect(esTorneoNextGeneration({ categoria_edad: 'u17' })).toBe(true);
    expect(esTorneoNextGeneration({ categoria_edad: 'open' })).toBe(false);
    expect(esTorneoNextGeneration({ categoria_edad: 'master_50' })).toBe(false);
    expect(esTorneoNextGeneration({ categoria_edad: 'open', programa: 'next_generation' })).toBe(true);
  });

  test('cada categoría declara kind, programa y etiquetas ES/EN', () => {
    TORNEO_CATEGORIAS_EDAD.forEach((c) => {
      expect(['juvenil', 'adulta', 'division_especial', 'legado']).toContain(c.kind);
      expect(['next_generation', 'padbol']).toContain(c.programa);
      expect(c.labelEs.length).toBeGreaterThan(0);
      expect(c.labelEn.length).toBeGreaterThan(0);
    });
    const m50 = TORNEO_CATEGORIAS_EDAD.find((c) => c.value === 'master_50');
    expect(m50.minAge).toBe(50);
    expect(m50.opcional).toBe(true);
  });
});

describe('edad por fecha de nacimiento y fecha de corte', () => {
  test('fechas inválidas devuelven null', () => {
    expect(edadEnFechaCorte('', '2026-01-01')).toBeNull();
    expect(edadEnFechaCorte('2010-02-30', '2026-01-01')).toBeNull();
  });

  test('respeta el cumpleaños dentro del año', () => {
    expect(edadEnFechaCorte('2010-03-10', '2026-03-09')).toBe(15);
    expect(edadEnFechaCorte('2010-03-10', '2026-03-10')).toBe(16);
  });

  test('límites juveniles U13 / U15 / U17', () => {
    expect(categoriaJuvenilParaEdad(13)).toBe('u13');
    expect(categoriaJuvenilParaEdad(14)).toBe('u15');
    expect(categoriaJuvenilParaEdad(15)).toBe('u15');
    expect(categoriaJuvenilParaEdad(16)).toBe('u17');
    expect(categoriaJuvenilParaEdad(17)).toBe('u17');
    expect(categoriaJuvenilParaEdad(18)).toBeNull();
  });

  test('umbral +50 y elegibilidad open', () => {
    expect(esNacimientoElegibleParaCategoria('master_50', '1976-06-30', '2026-06-30')).toBe(true);
    expect(esNacimientoElegibleParaCategoria('master_50', '1976-07-01', '2026-06-30')).toBe(false);
    expect(esNacimientoElegibleParaCategoria('open', '1950-01-01', '2026-06-30')).toBe(true);
  });

  test('un adulto de 45 años solo es elegible para open (no para juveniles ni +50)', () => {
    const values = categoriasElegiblesParaNacimiento('1981-01-15', '2026-06-30').map((c) => c.value);
    expect(values).toEqual(['open']);
  });

  test('un +50 puede además tener cualquier nivel deportivo (ejes independientes)', () => {
    // La elegibilidad por edad no restringe el nivel deportivo.
    expect(esNacimientoElegibleParaCategoria('master_50', '1970-01-01', '2026-06-30')).toBe(true);
  });
});
