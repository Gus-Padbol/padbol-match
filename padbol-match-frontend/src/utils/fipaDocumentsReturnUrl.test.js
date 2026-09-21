import {
  resolvePostLoginNavigatePath,
  safeFipaDocumentsPathFromLoginRedirect,
} from './reservaReturnUrl';
import { RESERVA_PENDIENTE_KEY } from './armarPartidoReservaPendiente';

describe('retorno a Biblioteca FIPA', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('conserva la ruta canónica y el documento exacto', () => {
    const destination = '/fipa/documentos?document=codigo-conducta';
    const search = `?redirect=${encodeURIComponent(destination)}`;
    expect(safeFipaDocumentsPathFromLoginRedirect(search)).toBe(destination);
    expect(resolvePostLoginNavigatePath(search)).toBe(destination);
  });

  it('prioriza el documento explícito y conserva una búsqueda deportiva guardada', () => {
    const destination = '/fipa/documentos?document=reglamento-oficial';
    sessionStorage.setItem('padbol_partidos_buscar_return', '/jugar/buscar?deporte=padbol');
    expect(resolvePostLoginNavigatePath(`?redirect=${encodeURIComponent(destination)}`)).toBe(destination);
    expect(sessionStorage.getItem('padbol_partidos_buscar_return')).toBe('/jugar/buscar?deporte=padbol');
  });

  it('prioriza el documento explícito sin consumir reserva pendiente ni búsqueda guardada', () => {
    const destination = '/fipa/documentos?document=reglamento-oficial';
    const pending = JSON.stringify({ sede_id: 'sede-prueba', cancha_id: 1, fecha: '2026-09-10', hora_inicio: '18:00', duracion_minutos: 90 });
    sessionStorage.setItem(RESERVA_PENDIENTE_KEY, pending);
    sessionStorage.setItem('padbol_partidos_buscar_return', '/jugar/buscar');
    expect(resolvePostLoginNavigatePath(`?redirect=${encodeURIComponent(destination)}`)).toBe(destination);
    expect(sessionStorage.getItem(RESERVA_PENDIENTE_KEY)).toBe(pending);
    expect(sessionStorage.getItem('padbol_partidos_buscar_return')).toBe('/jugar/buscar');
  });

  it('sin un destino FIPA válido conserva el orden y consumo deportivo anterior', () => {
    sessionStorage.setItem(RESERVA_PENDIENTE_KEY, JSON.stringify({ sede_id: 'sede-prueba', cancha_id: 1, fecha: '2026-09-10', hora_inicio: '18:00' }));
    sessionStorage.setItem('padbol_partidos_buscar_return', '/jugar/buscar');
    expect(resolvePostLoginNavigatePath('?redirect=%2Fhub')).toBe('/armar-partido');
    expect(sessionStorage.getItem('padbol_partidos_buscar_return')).toBe('/jugar/buscar');
    sessionStorage.removeItem(RESERVA_PENDIENTE_KEY);
    expect(resolvePostLoginNavigatePath('?redirect=%2Fhub')).toBe('/jugar/buscar');
    expect(sessionStorage.getItem('padbol_partidos_buscar_return')).toBeNull();
  });

  it.each([
    'https://example.invalid/fipa/documentos?document=reglamento-oficial',
    '//example.invalid/fipa/documentos',
    '/fipa/documentos-falsos',
  ])('un destino no autorizado no desplaza la operación guardada: %s', (destination) => {
    sessionStorage.setItem('padbol_partidos_buscar_return', '/jugar/buscar');
    expect(resolvePostLoginNavigatePath(`?redirect=${encodeURIComponent(destination)}`)).toBe('/jugar/buscar');
  });

  it('rechaza rutas parecidas y destinos externos', () => {
    expect(safeFipaDocumentsPathFromLoginRedirect('?redirect=/fipa/documentos-falsos')).toBeNull();
    expect(safeFipaDocumentsPathFromLoginRedirect('?redirect=https://example.com/fipa/documentos')).toBeNull();
    expect(safeFipaDocumentsPathFromLoginRedirect('?redirect=//example.com/fipa/documentos')).toBeNull();
  });
});
