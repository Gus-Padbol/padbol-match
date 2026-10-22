import {isGlobalSuperAdminEmailOrRole, computeIsAdminEnTorneo} from './torneoAdminAccess';
test('commercial operator email does not grant global or tournament administration', () => {
  window.localStorage.clear();
  expect(isGlobalSuperAdminEmailOrRole('sm@padbol.com','jugador')).toBe(false);
  expect(computeIsAdminEnTorneo({email:'sm@padbol.com',rol:'jugador',torneo:{sede_id:1},enRutaAdmin:true})).toBe(false);
  expect(isGlobalSuperAdminEmailOrRole('padbolinternacional@gmail.com','super_admin')).toBe(true);
});
