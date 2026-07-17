/**
 * Tab Sedes: identificadores técnicos estables (nunca i18n).
 */
import fs from 'fs';
import path from 'path';
import {
  ADMIN_SEDES_TAB_ID,
  ADMIN_SEDES_TABLE,
  ADMIN_SEDES_STORAGE_BUCKET,
  LEGACY_SEDES_TAB_IDS,
  coerceAdminSedesTabId,
  isAdminSedesTab,
  assertSedesTableName,
} from './adminSedesTab';
import es from '../i18n/locales/es.json';
import en from '../i18n/locales/en.json';

const dashboardPath = path.join(__dirname, '../pages/AdminDashboard.jsx');
const dashboardSrc = fs.readFileSync(dashboardPath, 'utf8');

describe('adminSedesTab technical ids', () => {
  it('1. el id técnico del tab es sedes', () => {
    expect(ADMIN_SEDES_TAB_ID).toBe('sedes');
  });

  it('2. el query param canónico es tab=sedes', () => {
    expect(ADMIN_SEDES_TAB_ID).toBe('sedes');
    expect(dashboardSrc).toMatch(/ADMIN_SEDES_TAB_ID/);
    expect(dashboardSrc).toMatch(/sanitizeAdminActiveTab\(searchParams\.get\('tab'\)/);
  });

  it('3. supabase.from recibe sedes (constante de tabla)', () => {
    expect(ADMIN_SEDES_TABLE).toBe('sedes');
    expect(assertSedesTableName('sedes')).toBe('sedes');
    expect(() => assertSedesTableName('venues')).toThrow(/inválido/);
  });

  it('4. la traducción solo se usa como texto visible', () => {
    expect(es.admin.tabs.sedes).toBeTruthy();
    expect(en.admin.tabs.sedes).toBeTruthy();
    expect(es.admin.metricas.venuesCount).toBeTruthy();
    expect(dashboardSrc).not.toMatch(/t\(['"]admin\.metricas\.venuesCount['"]\)/);
    expect(dashboardSrc).toMatch(/label:\s*t\(['"]admin\.tabs\.sedes['"]\)/);
  });

  it('5. cambiar a inglés no rompe el tab (ids estables)', () => {
    expect(en.admin.metricas.venuesCount).not.toBe('sedes');
    expect(coerceAdminSedesTabId(en.admin.metricas.venuesCount)).toBe('sedes');
    expect(isAdminSedesTab(en.admin.metricas.venuesCount)).toBe(true);
    expect(ADMIN_SEDES_TAB_ID).toBe('sedes');
  });

  it('6. refresh con ?tab=sedes mantiene la pantalla (coerce + allowlist)', () => {
    expect(coerceAdminSedesTabId('sedes')).toBe('sedes');
    const visibleTabsSrc = fs.readFileSync(
      path.join(__dirname, 'adminVisibleTabs.js'),
      'utf8',
    );
    expect(visibleTabsSrc).toMatch(/SUPER_ADMIN_VISIBLE_TABS[\s\S]*?'sedes'/);
    expect(visibleTabsSrc).toMatch(/ADMIN_NACIONAL_VISIBLE_TABS[\s\S]*?'sedes'/);
  });

  it('7. admin_nacional puede abrir Sedes', () => {
    const visibleTabsSrc = fs.readFileSync(
      path.join(__dirname, 'adminVisibleTabs.js'),
      'utf8',
    );
    expect(visibleTabsSrc).toMatch(
      /ADMIN_NACIONAL_VISIBLE_TABS\s*=\s*Object\.freeze\(\[[^\]]*['"]sedes['"]/,
    );
    expect(dashboardSrc).toMatch(/id:\s*ADMIN_SEDES_TAB_ID,\s*label:\s*t\(['"]admin\.tabs\.sedes['"]\)/);
  });

  it('8. super_admin puede abrir Sedes', () => {
    const visibleTabsSrc = fs.readFileSync(
      path.join(__dirname, 'adminVisibleTabs.js'),
      'utf8',
    );
    expect(dashboardSrc).toMatch(
      /isSuperAdmin\s*\?\s*\[\s*\{\s*id:\s*ADMIN_SEDES_TAB_ID,\s*label:\s*t\(['"]admin\.tabs\.sedes['"]\)/,
    );
    expect(visibleTabsSrc).toMatch(/SUPER_ADMIN_VISIBLE_TABS[\s\S]*?'sedes'/);
  });

  it('9. no queda ningún nombre de tabla derivado de i18n', () => {
    expect(dashboardSrc).not.toMatch(/\.from\(\s*t\(/);
    expect(dashboardSrc).toMatch(/\.from\(ADMIN_SEDES_TABLE\)/);
    expect(ADMIN_SEDES_STORAGE_BUCKET).toBe('sedes');
  });

  it('10. no queda switch/case técnico usando traducciones de Sedes', () => {
    expect(dashboardSrc).not.toMatch(/case\s+t\(['"]admin\.metricas\.venuesCount['"]\)/);
    expect(dashboardSrc).not.toMatch(/activeTab\s*===\s*t\(['"]admin\.metricas\.venuesCount['"]\)/);
    expect(dashboardSrc).toMatch(/activeTab\s*===\s*ADMIN_SEDES_TAB_ID/);
  });

  it('legacy tab ids (venues, etc.) se normalizan a sedes', () => {
    for (const legacy of LEGACY_SEDES_TAB_IDS) {
      expect(coerceAdminSedesTabId(legacy)).toBe('sedes');
    }
    expect(coerceAdminSedesTabId('reservas')).toBe('reservas');
  });
});
