import {
  CATEGORIAS_NIVEL_FEMENINO,
  CATEGORIAS_NIVEL_MASCULINO,
  CATEGORIAS_NIVEL_TODAS,
  categoriasNivelPorGenero,
} from './jugadorCategoria';
import { TORNEO_CATEGORIA_OPTIONS } from './torneoCategoria';

/**
 * Normalización de la 6.ª: la creación de torneos ya la ofrecía, pero el perfil del jugador no.
 * Este test fija el invariante para que no vuelva a divergir.
 */
describe('normalización de la categoría 6ta', () => {
  test('6ta está en las categorías del perfil del jugador', () => {
    expect(CATEGORIAS_NIVEL_MASCULINO).toContain('6ta');
    expect(CATEGORIAS_NIVEL_FEMENINO).toContain('6ta');
    expect(CATEGORIAS_NIVEL_TODAS).toContain('6ta');
  });

  test('6ta está en las categorías de torneo (misma nomenclatura)', () => {
    const valores = TORNEO_CATEGORIA_OPTIONS.map((o) => o.value);
    expect(valores).toContain('6ta');
  });

  test('el orden deportivo ubica 6ta entre Principiante y 5ta', () => {
    const orden = CATEGORIAS_NIVEL_TODAS;
    expect(orden.indexOf('Principiante')).toBeLessThan(orden.indexOf('6ta'));
    expect(orden.indexOf('6ta')).toBeLessThan(orden.indexOf('5ta'));
    expect(orden.indexOf('5ta')).toBeLessThan(orden.indexOf('Elite'));
  });

  test('categoriasNivelPorGenero incluye 6ta para todos los géneros de perfil', () => {
    ['masculino', 'femenino', 'otro', 'open', undefined].forEach((g) => {
      expect(categoriasNivelPorGenero(g)).toContain('6ta');
    });
  });

  test('un padre/madre puede ingresar como Principiante y luego avanzar hasta Elite', () => {
    const niveles = categoriasNivelPorGenero('masculino');
    expect(niveles[0]).toBe('Principiante');
    expect(niveles[niveles.length - 1]).toBe('Elite');
    expect(niveles).toEqual(['Principiante', '6ta', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite']);
  });
});
