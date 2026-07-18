import fs from 'fs';
import path from 'path';
import {
  SEDES_SUPER_ADMIN_PAGE_SIZE,
  RESERVAS_ADMIN_PAGE_SIZE,
  torneoConsideradoActivoPanelNacional,
} from './adminDashboardShellHelpers';

const dashboardSrc = fs.readFileSync(
  path.join(__dirname, '../pages/AdminDashboard.jsx'),
  'utf8',
);

describe('adminDashboardShellHelpers', () => {
  it('define tamaños de página estables', () => {
    expect(SEDES_SUPER_ADMIN_PAGE_SIZE).toBe(10);
    expect(RESERVAS_ADMIN_PAGE_SIZE).toBe(15);
  });

  it('torneoConsideradoActivoPanelNacional: activo vs finalizado/cancelado', () => {
    expect(torneoConsideradoActivoPanelNacional({ estado: 'en_curso' })).toBe(true);
    expect(torneoConsideradoActivoPanelNacional({ estado: 'abierto' })).toBe(true);
    expect(torneoConsideradoActivoPanelNacional({ estado: 'finalizado' })).toBe(false);
    expect(torneoConsideradoActivoPanelNacional({ estado: 'cancelado' })).toBe(false);
    expect(torneoConsideradoActivoPanelNacional(null)).toBe(true);
  });

  it('reproduce el crash de super_admin si falta SEDES_SUPER_ADMIN_PAGE_SIZE', () => {
    const list = [{ id: 1 }];
    const page = 1;
    const total = list.length;
    const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / SEDES_SUPER_ADMIN_PAGE_SIZE));
    const start = (page - 1) * SEDES_SUPER_ADMIN_PAGE_SIZE;
    const slice = list.slice(start, start + SEDES_SUPER_ADMIN_PAGE_SIZE);
    expect(totalPages).toBe(1);
    expect(slice).toHaveLength(1);
  });

  it('AdminDashboard importa los símbolos (sin ReferenceError post-login)', () => {
    expect(dashboardSrc).toMatch(
      /import\s*\{[^}]*SEDES_SUPER_ADMIN_PAGE_SIZE[^}]*\}\s*from\s*['"][^'"]*adminDashboardShellHelpers['"]/,
    );
    expect(dashboardSrc).toMatch(/SEDES_SUPER_ADMIN_PAGE_SIZE/);
    expect(dashboardSrc).toMatch(/RESERVAS_ADMIN_PAGE_SIZE/);
    expect(dashboardSrc).toMatch(/torneoConsideradoActivoPanelNacional/);
    expect(dashboardSrc).not.toMatch(/const SEDES_SUPER_ADMIN_PAGE_SIZE\s*=/);
    expect(dashboardSrc).not.toMatch(/function torneoConsideradoActivoPanelNacional/);
  });
});
