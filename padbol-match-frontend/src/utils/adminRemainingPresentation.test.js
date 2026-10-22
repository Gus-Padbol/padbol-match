import { normalizeCanjeEstado, adminRoleIdentity, adminRoleScopeMismatch } from './adminRemainingPresentation';

test('only an explicit pending state allows pending redemption actions', () => {
  ['pendiente', ' PENDIENTE '].forEach(value => expect(normalizeCanjeEstado(value)).toBe('pendiente'));
  ['entregado', 'ENTREGADA', 'cancelado', ' Cancelada ', 'approved', 'error', null, undefined, ''].forEach(value => {
    expect(normalizeCanjeEstado(value)).not.toBe('pendiente');
  });
  expect(normalizeCanjeEstado('approved')).toBe('desconocido');
  expect(normalizeCanjeEstado(null)).toBe('sin_estado');
});
test('real identity shows name or explicit missing-name label, keeping email in its own field', () => {
  expect(adminRoleIdentity({nombre:' Ana ',email:'known@example.com'})).toBe('Ana');
  [' ', 'Sin nombre', ' SIN   NOMBRE '].forEach(nombre => expect(adminRoleIdentity({nombre,email:' known@example.com '})).toBe('Nombre sin completar'));
  expect(adminRoleIdentity({})).toBe('Identidad no disponible');
});
test('national role with venue scope is flagged, without widening its scope', () => {
  const row={role:' ADMIN_NACIONAL ',alcance:' SEDE ',sede_id:'actual'};
  expect(adminRoleScopeMismatch(row)).toBe(true);
  expect(row.sede_id).toBe('actual');
  expect(adminRoleScopeMismatch({role:'admin_nacional',alcance:'pais'})).toBe(false);
  expect(adminRoleScopeMismatch({role:'admin_club',alcance:'sede'})).toBe(false);
});
