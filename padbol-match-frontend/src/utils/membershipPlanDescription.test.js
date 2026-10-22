import { membershipPlanDescription } from './membershipPlanDescription';
import { planToForm, validateAndBuildPlanPayload } from './membresiasAdminApi';
const original = 'Monthly plan for players with access to bookings, competitions, and exclusive club benefits.';
const translated = 'Plan mensual para jugadores con acceso a reservas, competiciones y beneficios exclusivos del club.';
test.each(['es','es-AR','es-ES','es_AR'])('shows faithful legacy description only in Spanish %s', language => {
  expect(membershipPlanDescription(original, language)).toBe(translated);
});
test.each(['en','en-US','pt','ro',undefined])('preserves original for other or unknown language %s', language => {
  expect(membershipPlanDescription(original, language)).toBe(original);
});
test('never translates arbitrary or similar commercial text', () => {
 for (const text of ['Special bookings plan with a different price.', original+' Additional conditions.', null, '']) expect(membershipPlanDescription(text,'es')).toBe(text);
});
test('presentation leaves stored description, edit form, price and currency intact', () => {
 const plan={id:1,sede_id:1,nombre:'Padbol Player',descripcion:original,precio:100,moneda:'USD',duracion_tipo:'mensual',activo:true};
 expect(membershipPlanDescription(plan.descripcion,'es')).toBe(translated);
 const form=planToForm(plan,1);
 expect(form.descripcion).toBe(original);expect(plan.descripcion).toBe(original);expect(form.moneda).toBe('USD');expect(Number(form.precio)).toBe(100);
 const built=validateAndBuildPlanPayload(form,{mode:'update'});
 expect(built.ok).toBe(true);expect(built.body.descripcion).toBe(original);expect(built.body.moneda).toBe('USD');expect(built.body.precio).toBe(100);
});
