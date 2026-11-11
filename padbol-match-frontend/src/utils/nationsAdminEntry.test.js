import {canShowNationsAdminEntry} from './nationsAdminEntry';

test('admin_nacional no ve entrada durable sin política explícita', () => {
  expect(canShowNationsAdminEntry({torneo: {id: 28}, rol: 'admin_nacional', isAdmin: false, fromAdmin: false})).toBe(false);
  expect(canShowNationsAdminEntry({torneo: {id: 28}, rol: 'admin_nacional', isAdmin: true, fromAdmin: false})).toBe(false);
});
test('roles del panel durable ven entrada; no se duplica dentro de gestión', () => {
  for (const rol of ['super_admin', 'admin_club', 'admin_sede']) {
    expect(canShowNationsAdminEntry({torneo: {id: 28}, rol, isAdmin: false, fromAdmin: false})).toBe(true);
  }
  expect(canShowNationsAdminEntry({torneo: {id: 28}, rol: 'super_admin', fromAdmin: true})).toBe(false);
});
