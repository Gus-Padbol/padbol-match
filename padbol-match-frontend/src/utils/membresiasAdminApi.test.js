/**
 * Tests — paginación server-side Membresías admin.
 */
import fs from 'fs';
import path from 'path';
import {
  MEMBRESIAS_PAGE_SIZE,
  MEMBRESIAS_Q_MIN,
  accionesDisponiblesParaEstado,
  buildMembresiasListQueryParams,
  computeVencimientoFromPlan,
  countActivosPorPlan,
  emptyPlanForm,
  fetchAdminMembresias,
  filterMembresiasClient,
  normalizeMembresiasDirection,
  normalizeMembresiasListResponse,
  normalizeMembresiasSort,
  parseMembresiasApiError,
  planToForm,
  resolveDuracionDiasPlan,
  resolveMembresiaJugadorLabel,
  validateAndBuildPlanPayload,
} from './membresiasAdminApi';

const sectionPath = path.join(__dirname, '../components/AdminMembresiasSection.jsx');
const sectionSrc = fs.readFileSync(sectionPath, 'utf8');
const apiSrc = fs.readFileSync(path.join(__dirname, 'membresiasAdminApi.js'), 'utf8');
const torneosStatsPath = path.join(__dirname, 'adminTorneosResumenStats.js');
const dashboardCssPath = path.join(__dirname, '../pages/AdminDashboard.css');

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('membresiasAdminApi — helpers legacy', () => {
  it('resuelve duración por tipo y días personalizados', () => {
    expect(resolveDuracionDiasPlan({ duracion_tipo: 'mensual' })).toBe(30);
    expect(resolveDuracionDiasPlan({ duracion_tipo: 'dias', duracion_dias: 14 })).toBe(14);
  });

  it('valida payload de plan', () => {
    const base = {
      ...emptyPlanForm('7'),
      nombre: 'Gold',
      precio: '100',
      descuento_porcentual: '10',
      reservas_incluidas_por_periodo: '2',
    };
    expect(validateAndBuildPlanPayload(base, { mode: 'create' }).ok).toBe(true);
  });

  it('planToForm y computeVencimientoFromPlan', () => {
    const form = planToForm({
      id: 1,
      sede_id: 3,
      nombre: 'Silver',
      precio: 50,
      moneda: 'usd',
      duracion_tipo: 'mensual',
      beneficios: { descuento_porcentual: 5, reservas_incluidas_por_periodo: 1 },
    });
    expect(form.moneda).toBe('USD');
    const venc = computeVencimientoFromPlan('2026-01-01T00:00:00.000Z', { duracion_tipo: 'mensual' });
    expect(venc).toMatch(/^2026-01-31/);
  });

  it('acciones por estado y conteo de activos', () => {
    expect(accionesDisponiblesParaEstado('activa')).toEqual(['renovar', 'suspender', 'cancelar']);
    expect(countActivosPorPlan([{ plan_id: 1, estado: 'activa' }], 1)).toBe(1);
  });

  it('filtra membresías en cliente (legacy) y parsea 403', () => {
    const rows = [
      { plan_id: 1, email: 'a@x.com', user_id: 'u1', jugador_nombre: 'Ana' },
      { plan_id: 2, email: 'b@x.com', user_id: 'u2', jugador_nombre: 'Bruno' },
    ];
    expect(filterMembresiasClient(rows, { planId: '1' })).toHaveLength(1);
    expect(parseMembresiasApiError(403, {})).toMatch(/403|permiso/i);
  });
});

describe('membresiasAdminApi — paginación server-side', () => {
  it('1. carga inicial envía page=1 y limit=15', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        membresias: [],
        pagination: { page: 1, limit: 15, total: 0, total_pages: 0, has_next: false, has_previous: false },
      }),
    });
    await fetchAdminMembresias({
      apiBaseUrl: 'https://api.test',
      accessToken: 'tok',
      sedeId: 7,
    });
    const url = String(global.fetch.mock.calls[0][0]);
    expect(url).toContain('page=1');
    expect(url).toContain('limit=15');
  });

  it('2. no envía limit=100 por defecto', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ membresias: [], pagination: { page: 1, limit: 15, total: 0, total_pages: 0, has_next: false, has_previous: false } }),
    });
    await fetchAdminMembresias({ apiBaseUrl: 'https://api.test', accessToken: 'tok', sedeId: 1 });
    expect(String(global.fetch.mock.calls[0][0])).not.toContain('limit=100');
    expect(MEMBRESIAS_PAGE_SIZE).toBe(15);
  });

  it('3. respuesta se normaliza correctamente', () => {
    const n = normalizeMembresiasListResponse({
      membresias: [{ id: 1 }],
      pagination: { page: 2, limit: 15, total: 40, total_pages: 3, has_next: true, has_previous: true },
    });
    expect(n.membresias).toHaveLength(1);
    expect(n.pagination.page).toBe(2);
    expect(n.pagination.total).toBe(40);
    expect(n.pagination.has_next).toBe(true);
  });

  it('4. respuesta legacy sin pagination no rompe', () => {
    const n = normalizeMembresiasListResponse({ membresias: [{ id: 1 }, { id: 2 }] });
    expect(n.pagination.page).toBe(1);
    expect(n.pagination.total).toBe(2);
    expect(n.pagination.has_next).toBe(false);
  });

  it('5–6. page siguiente/anterior generan query distinta', () => {
    const p1 = buildMembresiasListQueryParams({ sedeId: 1, page: 1 }).toString();
    const p2 = buildMembresiasListQueryParams({ sedeId: 1, page: 2 }).toString();
    expect(p1).toContain('page=1');
    expect(p2).toContain('page=2');
    expect(p1).not.toBe(p2);
  });

  it('7. no usa slice local en la sección', () => {
    expect(sectionSrc).not.toMatch(/\.slice\(\s*pageSafe\s*\*\s*PAGE_SIZE/);
    expect(sectionSrc).not.toMatch(/filteredMembresias\.slice/);
  });

  it('8–11. total / pages / has_next / has_previous en UI', () => {
    expect(sectionSrc).toMatch(/hasNext/);
    expect(sectionSrc).toMatch(/hasPrevious/);
    expect(sectionSrc).toMatch(/totalPages/);
    expect(sectionSrc).toMatch(/count:\s*total/);
    expect(sectionSrc).toMatch(/disabled=\{!hasPrevious/);
    expect(sectionSrc).toMatch(/disabled=\{!hasNext/);
  });

  it('12–14. cambio de estado/plan/búsqueda vuelve a page=1', () => {
    expect(sectionSrc).toMatch(/onEstadoFilterChange[\s\S]*?setPage\(1\)/);
    expect(sectionSrc).toMatch(/onPlanFilterChange[\s\S]*?setPage\(1\)/);
    expect(sectionSrc).toMatch(/setSearchQuery[\s\S]*?setPage\(1\)/);
  });

  it('15. búsqueda usa debounce', () => {
    expect(sectionSrc).toMatch(/SEARCH_DEBOUNCE_MS\s*=\s*400/);
    expect(sectionSrc).toMatch(/setTimeout/);
  });

  it('16. búsqueda de un carácter no se envía', () => {
    const q = buildMembresiasListQueryParams({ sedeId: 1, q: 'a' });
    expect(q.get('q')).toBeNull();
    expect(MEMBRESIAS_Q_MIN).toBe(2);
  });

  it('17. q se envía trim', () => {
    const q = buildMembresiasListQueryParams({ sedeId: 1, q: '  ana  ' });
    expect(q.get('q')).toBe('ana');
  });

  it('18–19. stale/seq y abort en sección', () => {
    expect(sectionSrc).toMatch(/membresiasSeqRef/);
    expect(sectionSrc).toMatch(/AbortController/);
    expect(sectionSrc).toMatch(/seq !== membresiasSeqRef/);
  });

  it('20–22. filtros y búsqueda server-side', () => {
    const q = buildMembresiasListQueryParams({
      sedeId: 9,
      estado: 'activa',
      planId: '3',
      q: 'bruno',
    });
    expect(q.get('estado')).toBe('activa');
    expect(q.get('plan_id')).toBe('3');
    expect(q.get('q')).toBe('bruno');
    expect(sectionSrc).not.toMatch(/filterMembresiasClient\(/);
  });

  it('23–24. orden y dirección', () => {
    expect(normalizeMembresiasSort('vencimiento')).toBe('vencimiento');
    expect(normalizeMembresiasSort('hack')).toBe('created_at');
    expect(normalizeMembresiasDirection('asc')).toBe('asc');
    expect(normalizeMembresiasDirection('nope')).toBe('desc');
    const q = buildMembresiasListQueryParams({ sedeId: 1, sort: 'inicio', direction: 'asc' });
    expect(q.get('sort')).toBe('inicio');
    expect(q.get('direction')).toBe('asc');
  });

  it('25. no se filtra sobre ventana local de 100', () => {
    expect(sectionSrc).not.toMatch(/limit:\s*100/);
    expect(sectionSrc).not.toMatch(/filterMembresiasClient/);
  });

  it('26. no usa endpoint jugadores para enriquecer listado', () => {
    expect(sectionSrc).not.toMatch(/fetchAdminJugadoresList/);
    expect(sectionSrc).not.toMatch(/jugadorMap/);
  });

  it('27–28. plan y jugador del item', () => {
    expect(sectionSrc).toMatch(/m\.plan\?\.nombre/);
    expect(sectionSrc).toMatch(/resolveMembresiaJugadorLabel/);
    expect(resolveMembresiaJugadorLabel({
      jugador: { nombre: 'Ana Pérez', username: 'ana', email: 'a@x.com' },
    })).toMatch(/Ana/);
  });

  it('29–33. mutaciones refrescan página (no loadAll)', () => {
    expect(sectionSrc).not.toMatch(/loadAll\s*=/);
    expect(sectionSrc).not.toMatch(/await loadAll\(/);
    expect(sectionSrc).toMatch(/await loadMembresiasPage\(\{\s*soft:\s*true\s*\}\)/);
    expect(sectionSrc).toMatch(/asignarMembresia/);
    expect(sectionSrc).toMatch(/renovarMembresia/);
    expect(sectionSrc).toMatch(/suspenderMembresia/);
    expect(sectionSrc).toMatch(/cancelarMembresia/);
  });

  it('34. página vacía retrocede de forma segura', () => {
    expect(sectionSrc).toMatch(/setPage\(pag\.total_pages\)/);
  });

  it('35–36. error conserva datos y permite reintento', () => {
    expect(sectionSrc).toMatch(/Conservar datos previos/);
    expect(sectionSrc).toMatch(/Reintentar|retry/);
  });

  it('37. sin resultados muestra vacío', () => {
    expect(sectionSrc).toMatch(/emptyMembresias/);
    expect(sectionSrc).toMatch(/membresias\.length === 0/);
  });

  it('38–39. admin_club scope / super_admin sede', () => {
    expect(sectionSrc).toMatch(/esAdminClub/);
    expect(sectionSrc).toMatch(/isSuperAdmin/);
    expect(sectionSrc).toMatch(/effectiveSedeId/);
    expect(sectionSrc).toMatch(/sede_id:\s*Number\(effectiveSedeId\)/);
  });

  it('40. no se modifican mutaciones (endpoints intactos)', () => {
    expect(apiSrc).toMatch(/\/api\/admin\/membresias\/asignar/);
    expect(apiSrc).toMatch(/\/renovar/);
    expect(apiSrc).toMatch(/\/suspender/);
    expect(apiSrc).toMatch(/\/cancelar/);
  });

  it('41. no se modifican beneficios (payload planes)', () => {
    expect(apiSrc).toMatch(/descuento_porcentual/);
    expect(apiSrc).toMatch(/reservas_incluidas_por_periodo/);
  });

  it('42. no se toca Torneos', () => {
    expect(fs.existsSync(torneosStatsPath)).toBe(true);
    expect(sectionSrc).not.toMatch(/resumen-stats|fetchAdminTorneosResumenStats/);
  });

  it('43. no se toca PadCoins (módulo)', () => {
    expect(sectionSrc).not.toMatch(/padcoinsAdmin|PadCoinsSection|\/api\/padcoins/i);
  });

  it('44. no se toca responsive sidebar CSS fixed', () => {
    const css = fs.readFileSync(dashboardCssPath, 'utf8');
    expect(css).toMatch(/position:\s*fixed/);
  });

  it('45. no se toca Backend', () => {
    expect(apiSrc).not.toMatch(/padbol-backend\/src|require\('\.\.\/\.\.\/padbol-backend/);
  });
});
