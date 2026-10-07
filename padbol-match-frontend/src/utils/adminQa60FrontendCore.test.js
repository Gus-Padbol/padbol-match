import fs from 'fs';
import path from 'path';
import { pctCambioPeriodo } from './adminMetricasConsistencia';
import es from '../i18n/locales/es.json';

const dashboardSrc = fs.readFileSync(path.join(__dirname, '../pages/AdminDashboard.jsx'), 'utf8');
const nuevaSedeSrc = fs.readFileSync(path.join(__dirname, '../components/NuevaSedeSuperBottomSheet.jsx'), 'utf8');
const suspensionesSrc = fs.readFileSync(path.join(__dirname, '../components/AdminSuspensionesSection.jsx'), 'utf8');

describe('QA panel admin - núcleo funcional y visual', () => {
  it('R-05 representa como Nuevo una comparación sin base anterior', () => {
    expect(pctCambioPeriodo(25, 0)).toBeNull();
    expect(pctCambioPeriodo(0, 0)).toBe(0);
    expect(dashboardSrc).toMatch(/pct == null[\s\S]*Nuevo/);
  });

  it('R-07 corrige los textos del resumen financiero', () => {
    expect(es.admin.metrics.historicalTotalHint).toBe('Acumulado histórico de los datos disponibles');
    expect(es.admin.overview.todayRevenue).toBe('INGRESOS DEL DÍA');
  });

  it('R-04 etiqueta y limita el rango personalizado', () => {
    expect(dashboardSrc).toMatch(/<span>Desde<\/span>[\s\S]*max=\{superAdminFechaHasta/);
    expect(dashboardSrc).toMatch(/<span>Hasta<\/span>[\s\S]*min=\{superAdminFechaDesde/);
    expect(dashboardSrc).toMatch(/La fecha «Desde» debe ser anterior o igual a «Hasta»/);
  });

  it('G-02, R-01, SO-01 y PL-01 distinguen error de estado vacío y permiten reintentar', () => {
    expect(dashboardSrc).toMatch(/analyticsGlobalesStatus === 'error'/);
    expect(dashboardSrc).toMatch(/No pudimos cargar Analytics globales/);
    expect(dashboardSrc).toMatch(/sedesPendientesError \|\| solicitudesLicenciaError/);
    expect(dashboardSrc).toMatch(/No pudimos cargar todas las solicitudes/);
    expect(dashboardSrc).toMatch(/planPricingError/);
    expect(dashboardSrc).toMatch(/No pudimos cargar los planes/);
  });

  it('RE-03 no ofrece configuración de sede al Super Admin', () => {
    expect(dashboardSrc).toMatch(/\{esAdminClub \? \([\s\S]*configurationTitle/);
    expect(dashboardSrc).not.toMatch(/\{\(esAdminClub \|\| isSuperAdmin\) \? \([\s\S]{0,800}configurationTitle/);
  });

  it('S-07 presenta validación accesible dentro del alta, no alertas silenciosas', () => {
    expect(nuevaSedeSrc).toMatch(/setConfigurationError\('Completa el nombre de la sede\.'/);
    expect(nuevaSedeSrc).toMatch(/configurationError && st\.step < 3/);
    expect(nuevaSedeSrc).toMatch(/role="alert"/);
  });

  it('SU-01 hace visible el criterio y el motivo de suspensión', () => {
    expect(suspensionesSrc).toMatch(/criterionTitle/);
    expect(suspensionesSrc).toMatch(/criterionBody/);
    expect(suspensionesSrc).toMatch(/colReason/);
  });

  it('S-05 permite al Super Admin editar datos básicos mediante la API autorizada', () => {
    expect(dashboardSrc).toMatch(/Editar datos de la sede/);
    expect(dashboardSrc).toMatch(/fetch\(`\$\{apiBaseUrl\}\/api\/sedes\/\$\{id\}`/);
    expect(dashboardSrc).toMatch(/method: 'PATCH'/);
    expect(dashboardSrc).toMatch(/email_contacto/);
  });

  it('V-01 ofrece rechazo confirmado y conserva el error visible', () => {
    expect(dashboardSrc).toMatch(/validationRejectConfirm/);
    expect(dashboardSrc).toMatch(/\/api\/admin\/jugadores\/validaciones\/\$\{encodeURIComponent\(email\)\}\/rechazar/);
    expect(dashboardSrc).toMatch(/admin-validacion-action--reject/);
    expect(dashboardSrc).toMatch(/vs\.error \? <div role="alert"/);
  });

  it('G-05 no guarda ni presenta emojis regionales en los selectores de país', () => {
    expect(dashboardSrc).toMatch(/value: `\$\{p\.bandera\} \$\{p\.nombre\}`\.trim\(\), label: p\.nombre/);
    expect(nuevaSedeSrc).toMatch(/value: `\$\{p\.bandera\} \$\{p\.nombre\}`\.trim\(\), label: p\.nombre/);
    expect(dashboardSrc).not.toMatch(/return flag \? `\$\{flag\} \$\{nombre\}`\.trim\(\) : nombre/);
  });
});
