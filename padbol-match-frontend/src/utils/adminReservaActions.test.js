/**
 * Confirm/cancel reservas admin: single-flight, errores controlados, sin delay artificial.
 */
import fs from 'fs';
import path from 'path';
import {
  tryBeginReservaAction,
  clearReservaAction,
  isReservaActionBusyFor,
  parseAdminReservaActionError,
  resolveAdminReservaActionErrorMessage,
  mergeReservaAfterConfirm,
  removeReservaAfterCancel,
  sanitizeAdminReservaUserMessage,
  pickReservaFromConfirmResponse,
} from './adminReservaActions';

const dashboardPath = path.join(__dirname, '../pages/AdminDashboard.jsx');
const dashboardSrc = fs.readFileSync(dashboardPath, 'utf8');

function extractFn(src, name) {
  const start = src.indexOf(`const ${name} = async`);
  expect(start).toBeGreaterThanOrEqual(0);
  const slice = src.slice(start);
  const next = slice.search(/\n  const [a-zA-Z]/);
  return next > 0 ? slice.slice(0, next) : slice.slice(0, 2500);
}

describe('adminReservaActions — bloqueo y errores', () => {
  it('11. un click dispara un solo begin (ok)', () => {
    const a = tryBeginReservaAction({}, 'r1', 'confirm');
    expect(a.ok).toBe(true);
    expect(a.next).toEqual({ r1: 'confirm' });
  });

  it('12. dos clicks rápidos: el segundo se rechaza (un solo request lógico)', () => {
    let pending = {};
    const first = tryBeginReservaAction(pending, 'r1', 'confirm');
    expect(first.ok).toBe(true);
    pending = first.next;
    const second = tryBeginReservaAction(pending, 'r1', 'confirm');
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('busy');
  });

  it('13. mientras confirma, busy=confirm deshabilita esa acción', () => {
    const pending = { r1: 'confirm' };
    expect(isReservaActionBusyFor(pending, 'r1', 'confirm')).toBe(true);
    expect(isReservaActionBusyFor(pending, 'r1')).toBe(true);
  });

  it('14. mientras cancela, busy=cancel deshabilita esa acción', () => {
    const pending = { r1: 'cancel' };
    expect(isReservaActionBusyFor(pending, 'r1', 'cancel')).toBe(true);
  });

  it('15. confirmar y cancelar no pueden ejecutarse juntos sobre la misma reserva', () => {
    const pending = tryBeginReservaAction({}, 'r1', 'confirm').next;
    const cancel = tryBeginReservaAction(pending, 'r1', 'cancel');
    expect(cancel.ok).toBe(false);
  });

  it('16. después del éxito, clear deja el botón disponible', () => {
    let pending = tryBeginReservaAction({}, 'r1', 'confirm').next;
    pending = clearReservaAction(pending, 'r1');
    expect(isReservaActionBusyFor(pending, 'r1')).toBe(false);
    expect(tryBeginReservaAction(pending, 'r1', 'confirm').ok).toBe(true);
  });

  it('17. después del error, clear rehabilita (mismo clear)', () => {
    let pending = tryBeginReservaAction({}, 'r1', 'cancel').next;
    pending = clearReservaAction(pending, 'r1');
    expect(tryBeginReservaAction(pending, 'r1', 'cancel').ok).toBe(true);
  });

  it('18. el error del Backend se muestra al usuario (message prioritario)', () => {
    const parsed = parseAdminReservaActionError(500, { message: 'Cupo agotado en sede' }, 'cancel');
    expect(resolveAdminReservaActionErrorMessage(parsed, (k) => k)).toBe('Cupo agotado en sede');
  });

  it('19. un error 403 muestra mensaje de permiso', () => {
    const parsed = parseAdminReservaActionError(403, {}, 'cancel');
    const msg = resolveAdminReservaActionErrorMessage(parsed, (k) =>
      (k === 'admin.reservas.actionForbidden' ? 'No tenés permiso para realizar esta acción.' : k),
    );
    expect(msg).toMatch(/permiso/i);
  });

  it('20. un error 404 muestra mensaje de reserva inexistente', () => {
    const parsed = parseAdminReservaActionError(404, {}, 'confirm');
    const msg = resolveAdminReservaActionErrorMessage(parsed, () => null);
    expect(msg).toMatch(/no existe|eliminada/i);
  });

  it('21. el fallback no expone detalles internos', () => {
    expect(sanitizeAdminReservaUserMessage('{\n  "stack": true\n}')).toBeNull();
    expect(sanitizeAdminReservaUserMessage('Error\n    at foo (x.js:1)')).toBeNull();
    expect(sanitizeAdminReservaUserMessage('Bearer abc.def.ghi leaked')).toMatch(/\[redacted\]/);
    const parsed = parseAdminReservaActionError(500, { message: 'Error\n    at Internal' }, 'cancel');
    const msg = resolveAdminReservaActionErrorMessage(parsed, () => null);
    expect(msg).not.toMatch(/\bat\s+/);
    expect(msg).toMatch(/cancelar/i);
  });

  it('22. no se usa setTimeout de 1.5s para refrescar en confirm/cancel', () => {
    const confirmFn = extractFn(dashboardSrc, 'confirmarPagoManualReserva');
    const cancelFn = extractFn(dashboardSrc, 'ejecutarCancelarReservaAdmin');
    expect(confirmFn).not.toMatch(/setTimeout\([^)]*fetchData/);
    expect(cancelFn).not.toMatch(/setTimeout\([^)]*fetchData/);
    expect(confirmFn).not.toMatch(/1500/);
    expect(cancelFn).not.toMatch(/1500/);
  });

  it('23. el estado visual de la reserva se actualiza después del éxito', () => {
    const list = [{ id: 'r1', estado: 'pendiente_pago_manual' }, { id: 'r2', estado: 'confirmada' }];
    expect(mergeReservaAfterConfirm(list, 'r1', { estado: 'confirmada', id: 'r1' })[0].estado).toBe('confirmada');
    expect(removeReservaAfterCancel(list, 'r1').map((r) => r.id)).toEqual(['r2']);
    expect(dashboardSrc).toMatch(/mergeReservaAfterConfirm/);
    expect(dashboardSrc).toMatch(/removeReservaAfterCancel/);
  });

  it('24. las demás reservas permanecen operables', () => {
    const pending = tryBeginReservaAction({}, 'r1', 'confirm').next;
    const other = tryBeginReservaAction(pending, 'r2', 'cancel');
    expect(other.ok).toBe(true);
    expect(isReservaActionBusyFor(pending, 'r2')).toBe(false);
  });

  it('25. no se generan alertas duplicadas (segundo begin no avanza)', () => {
    let pending = {};
    const alerts = [];
    const run = (id) => {
      const begin = tryBeginReservaAction(pending, id, 'cancel');
      if (!begin.ok) return;
      pending = begin.next;
      alerts.push('would-alert-or-request');
    };
    run('r1');
    run('r1');
    expect(alerts).toHaveLength(1);
  });

  it('pickReservaFromConfirmResponse prioriza fila real del Backend', () => {
    expect(pickReservaFromConfirmResponse({ reserva: { id: 1, estado: 'confirmada' } })).toEqual({
      id: 1,
      estado: 'confirmada',
    });
    expect(pickReservaFromConfirmResponse({ mensaje: 'ok' })).toBeNull();
  });

  it('AdminDashboard cablea tryBegin + errores reales (sin alert genérico de cancelar)', () => {
    const cancelFn = extractFn(dashboardSrc, 'ejecutarCancelarReservaAdmin');
    expect(cancelFn).toMatch(/tryBeginReservaAction/);
    expect(cancelFn).toMatch(/parseAdminReservaActionError/);
    expect(cancelFn).not.toMatch(/alert\(['"]Error al cancelar['"]\)/);
    const confirmFn = extractFn(dashboardSrc, 'confirmarPagoManualReserva');
    expect(confirmFn).toMatch(/tryBeginReservaAction/);
    expect(confirmFn).toMatch(/resolveAdminReservaActionErrorMessage/);
  });
});
