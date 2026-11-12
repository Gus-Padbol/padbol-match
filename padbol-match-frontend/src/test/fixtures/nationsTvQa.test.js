import {QA_NATIONS_BOARD_ID, QA_NATIONS_TV_FIXTURE, isQaNationsTvFixture} from './nationsTvQa';

test('QA fixture is enabled only for qa + exact scoreboard UUID + Nations mode', () => {
  expect(isQaNationsTvFixture({variant:'qa', mode:'nations', scoreboardId:QA_NATIONS_BOARD_ID})).toBe(true);
  for (const input of [
    {variant:'production', mode:'nations', scoreboardId:QA_NATIONS_BOARD_ID},
    {variant:'qa', mode:'legacy', scoreboardId:QA_NATIONS_BOARD_ID},
    {variant:'qa', mode:'nations', scoreboardId:'11111111-1111-4111-8111-111111111111'},
  ]) expect(isQaNationsTvFixture(input)).toBe(false);
  expect(QA_NATIONS_TV_FIXTURE.equipo_a_jugadores.map(p=>p.nombre)).toEqual(['Marco Rossi','Luca Bianchi','Paolo Conti','Andrea Ricci']);
  expect(QA_NATIONS_TV_FIXTURE.equipo_b_jugadores.map(p=>p.nombre)).toEqual(['Carlos Martín','Javier López','Pablo García','Diego Ruiz']);
});
