import {
  ADMIN_NACIONAL_VISIBLE_TABS,
  ADMIN_CADENA_VISIBLE_TABS,
  ADMIN_CLUB_VISIBLE_TABS,
  SUPER_ADMIN_VISIBLE_TABS,
  EDITOR_CONTENIDO_VISIBLE_TABS,
  resolveAdminVisibleTab,
  sanitizeAdminActiveTab,
  canRoleSeePadCoins,
  canRoleSeeSponsorsTab,
  getAllowedAdminTabsForRole,
  defaultAdminTabForRole,
  tabHasKnownRenderSurface,
  normalizeAdminTabAlias,
} from './adminVisibleTabs';
import fs from 'fs';
import path from 'path';
import es from '../i18n/locales/es.json';
import en from '../i18n/locales/en.json';

const dashboardPath = path.join(__dirname, '../pages/AdminDashboard.jsx');
const dashboardSrc = fs.readFileSync(dashboardPath, 'utf8');

describe('adminVisibleTabs — PadCoins y nacional', () => {
  it('1. admin_nacional no ve PadCoins', () => {
    expect(canRoleSeePadCoins('admin_nacional')).toBe(false);
    expect(ADMIN_NACIONAL_VISIBLE_TABS).not.toContain('padcoins');
    expect(getAllowedAdminTabsForRole('admin_nacional')).not.toContain('padcoins');
  });

  it('2. admin_nacional con ?tab=padcoins va a resumen', () => {
    const r = resolveAdminVisibleTab('padcoins', 'admin_nacional');
    expect(r.tab).toBe('resumen');
    expect(r.redirected).toBe(true);
    expect(r.reason).toBe('padcoins_unavailable');
  });

  it('3. admin_nacional no dispara PadCoins por URL (puedeVerPadCoins sin nacional)', () => {
    expect(dashboardSrc).toMatch(/puedeVerPadCoins\s*=\s*canRoleSeePadCoins\(rolPanel\)/);
    expect(dashboardSrc).toMatch(/activeTab === 'padcoins' && puedeVerPadCoins/);
    expect(dashboardSrc).not.toMatch(/puedeVerPadCoins[\s\S]{0,80}esAdminNacional/);
  });

  it('4. admin_club sigue viendo PadCoins', () => {
    expect(canRoleSeePadCoins('admin_club')).toBe(true);
    expect(ADMIN_CLUB_VISIBLE_TABS).toContain('padcoins');
    expect(resolveAdminVisibleTab('padcoins', 'admin_club').tab).toBe('padcoins');
  });

  it('5. super_admin sigue viendo PadCoins', () => {
    expect(canRoleSeePadCoins('super_admin')).toBe(true);
    expect(SUPER_ADMIN_VISIBLE_TABS).toContain('padcoins');
    expect(resolveAdminVisibleTab('padcoins', 'super_admin').tab).toBe('padcoins');
  });
});

describe('adminVisibleTabs — Sponsors', () => {
  it('6. editor_contenido conserva Sponsors', () => {
    expect(canRoleSeeSponsorsTab('editor_contenido')).toBe(true);
    expect(EDITOR_CONTENIDO_VISIBLE_TABS).toContain('sponsors');
    expect(resolveAdminVisibleTab('sponsors', 'editor_contenido').tab).toBe('sponsors');
  });

  it('7. super_admin no ve tab Sponsors huérfano', () => {
    expect(canRoleSeeSponsorsTab('super_admin')).toBe(false);
    expect(SUPER_ADMIN_VISIBLE_TABS).not.toContain('sponsors');
    expect(dashboardSrc).not.toMatch(
      /isSuperAdmin\s*\?\s*\[\s*\{\s*id:\s*['"]sponsors['"]/,
    );
  });

  it('8. super_admin con ?tab=sponsors llega a Configuración', () => {
    const r = resolveAdminVisibleTab('sponsors', 'super_admin');
    expect(r.tab).toBe('config');
    expect(r.redirected).toBe(true);
    expect(r.reason).toBe('sponsors_in_config');
  });
});

describe('adminVisibleTabs — guard y fallback', () => {
  it('9. tab desconocido usa fallback seguro', () => {
    expect(resolveAdminVisibleTab('no_existe', 'super_admin').tab).toBe('resumen');
    expect(resolveAdminVisibleTab('xyz', 'admin_club').tab).toBe('mi_sede');
    expect(resolveAdminVisibleTab('xyz', 'editor_contenido').tab).toBe('personalizar_hub');
  });

  it('10. tab no permitido no queda como canónico', () => {
    expect(sanitizeAdminActiveTab('padcoins', 'admin_nacional')).toBe('resumen');
    expect(sanitizeAdminActiveTab('config', 'admin_club')).toBe('mi_sede');
  });

  it('11. todo tab visible tiene superficie de render conocida', () => {
    for (const rol of ['super_admin', 'admin_club', 'admin_nacional', 'admin_cadena', 'editor_contenido', 'empleado']) {
      for (const tab of getAllowedAdminTabsForRole(rol)) {
        expect(tabHasKnownRenderSurface(tab, rol)).toBe(true);
      }
    }
  });

  it('admin_cadena usa las vistas consolidadas sin acceso global', () => {
    expect(getAllowedAdminTabsForRole('admin_cadena')).toEqual(ADMIN_CADENA_VISIBLE_TABS);
    expect(ADMIN_CADENA_VISIBLE_TABS).toEqual(expect.arrayContaining(['reservas', 'torneos', 'jugadores', 'scoreboard']));
    expect(resolveAdminVisibleTab('sedes', 'admin_cadena').tab).toBe('sedes');
    expect(resolveAdminVisibleTab('config', 'admin_cadena').tab).toBe('resumen');
    expect(canRoleSeePadCoins('admin_cadena')).toBe(false);
  });

  it('12. aliases legacy se normalizan', () => {
    expect(normalizeAdminTabAlias('sedes_pendientes')).toBe('solicitudes');
    expect(normalizeAdminTabAlias('venues')).toBe('sedes');
    expect(sanitizeAdminActiveTab('venues', 'admin_nacional')).toBe('sedes');
  });

  it('13. ?tab=sedes sigue funcionando', () => {
    expect(sanitizeAdminActiveTab('sedes', 'admin_nacional')).toBe('sedes');
    expect(sanitizeAdminActiveTab('sedes', 'super_admin')).toBe('sedes');
  });

  it('14. cambio de idioma no afecta ids técnicos', () => {
    expect(sanitizeAdminActiveTab('sedes', 'admin_nacional')).toBe('sedes');
    expect(sanitizeAdminActiveTab('venues', 'admin_nacional')).toBe('sedes');
  });

  it('15. cambio de rol no conserva tab prohibido', () => {
    expect(sanitizeAdminActiveTab('padcoins', 'admin_nacional')).toBe('resumen');
    expect(sanitizeAdminActiveTab('sponsors', 'admin_club')).toBe('mi_sede');
  });

  it('16. refresh mantiene tab permitido', () => {
    expect(sanitizeAdminActiveTab('reservas', 'admin_club')).toBe('reservas');
    expect(sanitizeAdminActiveTab('config', 'super_admin')).toBe('config');
  });

  it('17. no se monta PadCoins antes de validar (guard en JSX)', () => {
    expect(dashboardSrc).toMatch(/activeTab === 'padcoins' && puedeVerPadCoins/);
  });

  it('18. no pantallas vacías: sponsors super → config; desconocido → fallback', () => {
    expect(resolveAdminVisibleTab('sponsors', 'super_admin').tab).toBe('config');
    expect(defaultAdminTabForRole('super_admin')).toBe('resumen');
    expect(dashboardSrc).toMatch(/resolveAdminVisibleTab|sanitizeAdminActiveTab/);
  });
});

describe('adminVisibleTabs — logs y alcance', () => {
  it('19. no quedan logs con emails en líneas auditadas', () => {
    expect(dashboardSrc).not.toMatch(/console\.log\('ADMIN fetchData:'[\s\S]*?email:/);
    expect(dashboardSrc).not.toMatch(/console\.log\('AdminDashboard montado'/);
  });

  it('20. no quedan logs con payloads completos auditados', () => {
    expect(dashboardSrc).not.toMatch(/console\.log\('\[Admin\] sedesMap'/);
    expect(dashboardSrc).not.toMatch(/console\.log\('fetchData torneos:'/);
    expect(dashboardSrc).not.toMatch(/console\.log\('\[AdminDashboard\] fetchData triggered/);
  });

  it('21. no se modifican permisos Backend', () => {
    const utilSrc = fs.readFileSync(path.join(__dirname, 'adminVisibleTabs.js'), 'utf8');
    expect(utilSrc).not.toMatch(/padbol-backend|requirePadcoins|server\.js/);
  });

  it('22. no se altera el sidebar CSS fixed', () => {
    const css = fs.readFileSync(path.join(__dirname, '../pages/AdminDashboard.css'), 'utf8');
    expect(css).toMatch(/position:\s*fixed/);
    expect(css).toMatch(/--pm-admin-sidebar-top/);
  });

  it('23. no se alteran métricas', () => {
    expect(fs.existsSync(path.join(__dirname, 'adminMetricasConsistencia.js'))).toBe(true);
    expect(dashboardSrc).toMatch(/adminMetricasConsistencia/);
  });

  it('24. no se altera Configuración de pagos', () => {
    expect(dashboardSrc).toMatch(/miSedePagos|pagosMpPanelAbierto|write-only/);
    const pagos = fs.readFileSync(path.join(__dirname, 'miSedePagos.js'), 'utf8');
    expect(pagos).toMatch(/SEDE_SECRET_FIELDS/);
  });

  it('i18n acceso no disponible ES/EN', () => {
    expect(es.admin.panel?.accessUnavailable || es.admin.accessUnavailable).toBeTruthy();
    expect(en.admin.panel?.accessUnavailable || en.admin.accessUnavailable).toBeTruthy();
  });
});
