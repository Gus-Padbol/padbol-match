import { membershipPlanVisibleStatus, venueContractBadge } from './adminVenuePresentation';

const now = new Date('2026-10-08T12:00:00-03:00');

test('an enabled plan with expired validity displays expired without modifying business data', () => {
  const plan = { activo: true, vigencia_hasta: '2026-09-05', precio: 99, moneda: 'USD' };
  expect(membershipPlanVisibleStatus(plan, now)).toBe('Vencida');
  expect(plan).toEqual({ activo: true, vigencia_hasta: '2026-09-05', precio: 99, moneda: 'USD' });
});

test('contract validity requires dates and a reference, including when expiry parses incorrectly', () => {
  expect(venueContractBadge({}, now).label).toBe('Información incompleta');
  expect(venueContractBadge({ fecha_inicio: '2026-01-01', fecha_vencimiento: '2027-01-01' }, now).label).toBe('Información incompleta');
  expect(venueContractBadge({ fecha_inicio: '2026-01-01', fecha_vencimiento: 'invalid', referencia: 'REF' }, now).label).toBe('Información incompleta');
});

test('complete contracts can report expired, pending or valid without changing records', () => {
  expect(venueContractBadge({ fecha_inicio: '2025-01-01', fecha_vencimiento: '2026-01-01', referencia: 'REF' }, now).label).toBe('Vencido');
  expect(venueContractBadge({ fecha_inicio: '2026-11-01', fecha_vencimiento: '2027-01-01', referencia: 'REF' }, now).label).toBe('Pendiente de inicio');
  expect(venueContractBadge({ fecha_inicio: '2026-01-01', fecha_vencimiento: '2027-01-01', referencia: 'REF' }, now).label).toBe('Vigente');
});
